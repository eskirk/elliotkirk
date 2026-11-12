import { useEffect, useRef } from "react";
import * as Matter from "matter-js";

// Slackline view (builds on the first sketch: anchored side posts, a chained
// webbing composite, category-filtered collisions, spacebar press force).
// Key additions over the sketch: the joints are ELASTIC (chain stiffness
// 1 -> ~0.05, that's the trampoline), arrow-key walking with hold, a drawn
// stick figure (invisible round body, inertia locked so it can't tumble),
// a floor band, resize handling, and full teardown for route remounts.
//
// The bounce: low-stiffness joints stretch as the figure presses down
// (spacebar adds downward force), storing energy that snaps back up.

const SEGMENTS = 26;
const BED_STIFFNESS = 0.07; // per-segment spring back toward the home line
const BED_DAMPING = 0.08; // tames endless wobble without killing the bounce
// Must exceed the static-friction grip on the line (mu_s ~1.2 x gravity 0.001),
// otherwise the walker just sticks and creeps.
const MAX_WALK_SPEED = 2.6; // px/tick horizontal cruise // horizontal accel (px/ms^2) while an arrow is held
// Press pushes the WALKER down (real load path: his legs drive the foot
// joint into the fabric; the fabric's springs resist — never touch the line).
const PRESS_FORCE = 1.1; // extra downward accel the walker's legs drive into the fabric under space
const BODY_WEIGHT = 0.05; // his standing weight, loaded onto the segment under his foot
const ANCHOR_Y_FRAC = 0.42; // line height above the top of the viewport
const WEBBING_COLOR = "RebeccaPurple"; // solid webbing, one color end to end
const FOOT_R = 16; // walker foot radius
const WALKER_DENSITY = 0.004;

export const Slackline = () => {
  const engine = useRef(Matter.Engine.create());

  useEffect(() => {
    const runner = Matter.Runner.create();
    // Same viewport logic as the ball scene: visualViewport tracks the iOS
    // URL bar honestly, innerHeight lags behind it.
    const viewportHeight = () =>
      (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    let pageWidth = window.innerWidth;
    let pageHeight = viewportHeight();
    let settleTimer = 0;

    const render = Matter.Render.create({
      element: document.body,
      engine: engine.current,
      options: {
        background: "transparent",
        width: pageWidth,
        height: pageHeight,
        showAngleIndicator: false,
        wireframes: false,
      },
    });

    const world = engine.current.world;

    const makeGround = (width: number, height: number) =>
      Matter.Bodies.rectangle(width / 2 - 10, height - 30, width + 50, 60, { isStatic: true });
    let ground = makeGround(pageWidth, pageHeight);

    // The slacker (circle, like the sketch) and webbing live in separate
    // collision categories: webbing never collides with itself, the walker
    // rides on top of it.
    const webbingGroup = Matter.Body.nextGroup(true);

    let anchors: Matter.Body[] = [];
    let webbing: Matter.Composite | null = null;
    let bedConstraints: Matter.Constraint[] = [];
    let segHalfW = 0; // ribbon geometry, refreshed by buildLine
    let lineHomeY = 0; // rest height of the fabric, for dip measurement
    let slacker: Matter.Body;

    const anchorY = () => Math.round(pageHeight * ANCHOR_Y_FRAC);

    const clearLine = () => {
      if (webbing) Matter.World.remove(world, webbing, true);
      if (anchors.length) Matter.World.remove(world, anchors);
      webbing = null;
      anchors = [];
      bedConstraints = [];
    };

    const buildLine = () => {
      clearLine();
      const margin = 45;
      const span = Math.max(200, pageWidth - margin * 2);
      const spacing = span / (SEGMENTS - 1);
      const y0 = anchorY();

      // Visual posts the line ties off to (the sketch's gray blocks).
      anchors = [
        Matter.Bodies.rectangle(25, y0, 40, Math.min(300, pageHeight - y0 + 30), {
          isStatic: true,
          collisionFilter: { category: 0x0002 },
          render: { fillStyle: "#5a5a66" },
        }),
        Matter.Bodies.rectangle(pageWidth - 25, y0, 40, Math.min(300, pageHeight - y0 + 30), {
          isStatic: true,
          collisionFilter: { category: 0x0002 },
          render: { fillStyle: "#5a5a66" },
        }),
      ];

      webbing = Matter.Composite.create({ label: "webbing" });
      const segs: Matter.Body[] = [];
      for (let i = 0; i < SEGMENTS; i++) {
        segs.push(
          Matter.Bodies.rectangle(margin + i * spacing, y0, spacing * 1.15, 7, {
            collisionFilter: { group: webbingGroup, category: 0x0004, mask: 0x0004 },
            render: { visible: false }, // drawn as one continuous ribbon overlay
            chamfer: { radius: 3 },
            friction: 1,
            frictionStatic: 1.4,
            density: 0.004,
            frictionAir: 0.04,
          })
        );
      }
      Matter.Composite.add(webbing, segs);
      segHalfW = (spacing * 1.15) / 2;
      lineHomeY = y0;

      // Trampoline-bed model (what a real trampoline is: fabric + springs to
      // a frame). Each interior segment hangs on TWO invisible springs, one
      // at each end: a single center spring fixes position but exerts no
      // torque, so segments hinge down around it and the line gaps. The
      // end-pair forms a force couple that keeps every segment level.
      bedConstraints = [];
      for (let i = 1; i < segs.length - 1; i++) {
        for (const end of [-1, 1]) {
          const c = Matter.Constraint.create({
            bodyA: segs[i],
            pointA: { x: (end * spacing) / 2, y: 0 },
            pointB: { x: margin + i * spacing + (end * spacing) / 2, y: y0 },
            length: 0,
            stiffness: BED_STIFFNESS,
            damping: BED_DAMPING,
          });
          bedConstraints.push(c);
        }
      }
      // End segments get a spring at their free end too; otherwise they
      // hang off the single rigid pin like a flag and gap at the posts.
      const first = segs[0];
      const last = segs[segs.length - 1];
      const endSpring = (seg: Matter.Body, end: number, anchorX: number) => {
        const c = Matter.Constraint.create({
          bodyA: seg,
          pointA: { x: (end * spacing) / 2, y: 0 },
          pointB: { x: anchorX, y: y0 },
          length: 0,
          stiffness: BED_STIFFNESS,
          damping: BED_DAMPING,
        });
        bedConstraints.push(c);
      };
      endSpring(first, 1, margin + spacing * 0.575);
      endSpring(last, -1, pageWidth - margin - spacing * 0.575);
      Matter.Composite.add(webbing, bedConstraints);

      // Soft links between neighbours: the trough the walker's load digs
      // spills smoothly into adjacent segments.
      for (let i = 0; i < segs.length - 1; i++) {
        Matter.Composite.add(
          webbing,
          Matter.Constraint.create({
            bodyA: segs[i],
            bodyB: segs[i + 1],
            pointA: { x: spacing / 2, y: 0 },
            pointB: { x: -spacing / 2, y: 0 },
            length: spacing * 1.02,
            stiffness: 0.25, // stiff enough that the walker's load spreads
            damping: 0.1,    // over many segments instead of punching one
          })
        );
      }

      // Rigid world anchors at both ends (no bodyA => fixed point).
      Matter.Composite.add(
        webbing,
        Matter.Constraint.create({
          pointA: { x: margin, y: y0 },
          bodyB: segs[0],
          pointB: { x: -spacing / 2, y: 0 },
          length: 0,
          stiffness: 1,
        })
      );
      Matter.Composite.add(
        webbing,
        Matter.Constraint.create({
          pointA: { x: pageWidth - margin, y: y0 },
          bodyB: segs[segs.length - 1],
          pointB: { x: spacing / 2, y: 0 },
          length: 0,
          stiffness: 1,
        })
      );

      Matter.World.add(world, [...anchors, webbing]);
    };

    const spawnSlacker = () => {
      // A round foot stands on a segmented line without corner slips; the
      // stick figure is drawn centred above it in the afterRender overlay.
      slacker = Matter.Bodies.circle(pageWidth / 2, anchorY() - 21, FOOT_R, {
        friction: 1,
        frictionStatic: 1.6,
        density: WALKER_DENSITY,
        restitution: 0,
        // Never touches the webbing (its category/mask excludes it): a
        // collision rider gets flung by the rebounding bed; the pin carries
        // him instead.
        collisionFilter: { category: 0x0001, mask: 0x0001 | 0x0002 },
        render: { visible: false },
      });
      // Balance is the point of slacklining; a spinning tumbleweed is not.
      // Locking inertia keeps the figure upright while friction still
      // transfers pushes into the line.
      Matter.Body.setInertia(slacker, Infinity);
      Matter.World.add(world, slacker);
    };

    const respawnSlacker = () => {
      Matter.Body.setPosition(slacker, { x: pageWidth / 2, y: anchorY() - 21 });
      Matter.Body.setVelocity(slacker, { x: 0, y: 0 });
      attached = true;
    };

    buildLine();
    spawnSlacker();
    Matter.World.add(world, ground);

    // --- controls (keysDown-hold pattern from the sketch, per-key flags) ---
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const keysDown = new Set<string>();
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.code === "ArrowLeft" || event.code === "ArrowRight" || event.code === "Space") {
        keysDown.add(event.code);
        event.preventDefault();
      } else if (event.key === "r") {
        respawnSlacker();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keysDown.delete(event.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // --- press / launch state machine ---
    // The walker is either ATTACHED (carried on the fabric surface) or
    // FLYING. Pressing space drives his legs into the webbing at the foot
    // point — the bed dips under him and he rides the dip; the fabric's
    // bed springs store the energy. Releasing pushes off: the measured dip
    // sets the launch velocity and his feet leave the bed. Nothing ever
    // constrains him to the line, so no solver can swallow the launch, and
    // re-catching is just "descending, feet at the fabric".
    let pressing = false;
    let prevPressing = false;
    let attached = true;
    let dipNow = 0; // how far the bed currently dips under him

    const nearestSegment = (x: number) => {
      if (!webbing) return null;
      const bodies = webbing.bodies as Matter.Body[];
      if (!bodies.length) return null;
      let best = bodies[0];
      bodies.forEach((b) => {
        if (Math.abs(b.position.x - x) < Math.abs(best.position.x - x)) best = b;
      });
      return best;
    };

    Matter.Events.on(engine.current, "beforeUpdate", () => {
      const wp = slacker.position;
      const vel = slacker.velocity;
      pressing = keysDown.has("Space");
      const seg = nearestSegment(wp.x);
      const surf = seg ? seg.position.y - 3.5 : null; // fabric top under him

      // walked off the end / on the ground: airborne (falling) instead
      if (attached && (!seg || wp.y + FOOT_R > pageHeight - 60 - FOOT_R + 4)) {
        attached = false;
      }

      // His legs load the webbing right under him: standing weight, plus
      // the spacebar push (tapered so a held key can't bottom him out).
      dipNow = seg ? Math.max(0, seg.position.y - lineHomeY) : 0;
      if (attached && seg) {
        Matter.Body.applyForce(seg, seg.position, {
          x: 0,
          y: (BODY_WEIGHT + (pressing && wp.y < pageHeight - 140 ? PRESS_FORCE * Math.max(0, 1 - dipNow / 200) : 0)) * seg.mass,
        });
      }

      if (!pressing && prevPressing && attached && dipNow > 8) {
        // Push-off: feet leave the bed, dip energy becomes launch velocity.
        const pop = Math.min(11, 2 + dipNow * 0.22);
        attached = false;
        Matter.Body.setVelocity(slacker, { x: vel.x, y: -pop });
      }
      prevPressing = pressing;

      // Walking drives horizontal velocity directly: the fabric grip needs
      // mu ~1.6, and no sane push force clears that static threshold —
      // horizontal control authority, vertical physics untouched.
      if (keysDown.has("ArrowLeft") || keysDown.has("ArrowRight")) {
        const dir = keysDown.has("ArrowLeft") ? -1 : 1;
        if (dir * vel.x < MAX_WALK_SPEED) {
          const vx = Math.max(-MAX_WALK_SPEED, Math.min(MAX_WALK_SPEED, vel.x + dir * 0.18));
          Matter.Body.setVelocity(slacker, { x: vx, y: vel.y });
        }
      }

      if (attached && surf !== null) {
        // Carried: feet track the fabric surface. Velocity steering — no
        // constraint to stretch, and the pop sets attached=false BEFORE it
        // launches, so the pin never fights a jump. (Collision alone was
        // tried for carrying; a rebounding bed flings a collision rider.)
        // PD steering to the surface: pure P gain limit-cycles at rest.
        const follow = (surf - FOOT_R - wp.y) * 0.4 + vel.y * 0.55;
        Matter.Body.setVelocity(slacker, {
          x: vel.x,
          y: Math.max(-18, Math.min(18, follow)),
        });
      } else if (!attached && seg && vel.y >= 0 && wp.y + FOOT_R >= surf! - 24 && wp.y < pageHeight - 130) {
        // Landing: descending and the feet have reached the fabric — he is
        // standing on it again (collision carries him; no velocity pin,
        // which fought the solver and shredded walking).
        attached = true;
      }

            // Level the fabric: the end-spring couple does most of the work; this
      // gently snaps away residual hinge so the seam never gapes.
      if (webbing) {
        (webbing.bodies as Matter.Body[]).forEach((b) => {
          if (Math.abs(b.angle) > 0.005) {
            Matter.Body.setAngle(b, b.angle * 0.5);
            // Verlet: setAngle alone leaves anglePrev stale, and the engine
            // turns the removed delta back into spin on the next step — the
            // "snap" was driving the wobble, not damping it. Kill the
            // angular velocity with it.
            Matter.Body.setAngularVelocity(b, 0);
          }
        });
      }
    });

    // --- webbing + slackliner overlay (Matter only renders the posts) ---
    const legPhase = { t: 0 };
    const drawRibbon = (ctx: CanvasRenderingContext2D) => {
      if (!webbing) return;
      const bodies = webbing.bodies as Matter.Body[];
      if (bodies.length < 2) return;
      const hw = segHalfW;
      const hh = 3.5;
      const corner = (b: Matter.Body, lx: number, ly: number) => ({
        x: b.position.x + lx * Math.cos(b.angle) - ly * Math.sin(b.angle),
        y: b.position.y + lx * Math.sin(b.angle) + ly * Math.cos(b.angle),
      });
      // Top edge then bottom edge, stitched through joint midpoints: one
      // filled path across ALL segments, so physics gaps can never show.
      const top: { x: number; y: number }[] = [corner(bodies[0], -hw, -hh)];
      const bot: { x: number; y: number }[] = [corner(bodies[0], -hw, hh)];
      for (let i = 0; i < bodies.length; i++) {
        const isLast = i === bodies.length - 1;
        const tR = corner(bodies[i], hw, -hh);
        const bR = corner(bodies[i], hw, hh);
        if (isLast) {
          top.push(tR);
          bot.push(bR);
        } else {
          const nT = corner(bodies[i + 1], -hw, -hh);
          const nB = corner(bodies[i + 1], -hw, hh);
          top.push({ x: (tR.x + nT.x) / 2, y: (tR.y + nT.y) / 2 });
          bot.push({ x: (bR.x + nB.x) / 2, y: (bR.y + nB.y) / 2 });
        }
      }
      ctx.beginPath();
      ctx.moveTo(top[0].x, top[0].y);
      top.forEach((p) => ctx.lineTo(p.x, p.y));
      for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
      ctx.closePath();
      ctx.fillStyle = WEBBING_COLOR;
      ctx.fill();
      // subtle under-edge so the ribbon reads as webbing, not a flat stripe
      ctx.beginPath();
      ctx.moveTo(bot[0].x, bot[0].y);
      bot.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();
    };
    Matter.Events.on(render, "afterRender", () => {
      const ctx = render.context;
      drawRibbon(ctx);
      const fg =
        getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#212529";
      const { x, y } = slacker.position;
      const vx = slacker.velocity.x;
      legPhase.t += Math.abs(vx) * 0.25 + 0.02;
      const stride = Math.abs(vx) > 0.4 ? Math.sin(legPhase.t) * 7 : 0;

      ctx.strokeStyle = fg;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      // figure anchored to the foot-ball: sole at y + FOOT_R, hip ~y-6
      // head
      ctx.beginPath();
      ctx.arc(x, y - 44, 7, 0, Math.PI * 2);
      ctx.stroke();
      // torso
      ctx.beginPath();
      ctx.moveTo(x, y - 36);
      ctx.lineTo(x, y - 6);
      ctx.stroke();
      // arms out, gently counterbalancing
      const armLift = Math.sin(legPhase.t * 0.5) * 3;
      ctx.beginPath();
      ctx.moveTo(x - 17, y - 30 - armLift);
      ctx.lineTo(x, y - 26);
      ctx.lineTo(x + 17, y - 30 + armLift);
      ctx.stroke();
      // legs: planted, striding while walking
      ctx.beginPath();
      ctx.moveTo(x - 8 - stride * 0.5, y + FOOT_R - 2);
      ctx.lineTo(x, y - 6);
      ctx.lineTo(x + 8 + stride * 0.5, y + FOOT_R - 2);
      ctx.stroke();
    });

    // --- resize: rebuild line + ground for the new viewport ---
    const resize = (newWidth: number, newHeight: number) => {
      if (newWidth === pageWidth && newHeight === pageHeight) return;
      pageWidth = newWidth;
      pageHeight = newHeight;
      render.options.width = newWidth;
      render.options.height = newHeight;
      render.canvas.width = newWidth;
      render.canvas.height = newHeight;
      Matter.World.remove(world, ground);
      ground = makeGround(newWidth, newHeight);
      Matter.World.add(world, ground);
      buildLine();
      respawnSlacker();
    };
    const onResize = () => {
      resize(window.innerWidth, viewportHeight());
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        resize(window.innerWidth, viewportHeight());
      }, 350);
    };
    window.addEventListener("resize", onResize);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener("resize", onResize);

    Matter.Render.run(render);
    Matter.Runner.run(runner, engine.current);

    return () => {
      // Full teardown: Matter appends its canvas outside React, so route
      // remounts leak a canvas + physics loop unless everything is stopped.
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      clearLine();
      Matter.World.clear(engine.current.world, false);
      Matter.Engine.clear(engine.current);
      if (render.canvas.parentNode) {
        render.canvas.parentNode.removeChild(render.canvas);
      }
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      if (vv) vv.removeEventListener("resize", onResize);
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, []);

  return null;
};
