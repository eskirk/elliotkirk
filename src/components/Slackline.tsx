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
// Bed stiffness is a Matter constraint fraction: it corrects
// stiffness*error of velocity per tick, mass-independently — so sag is
// (load Δv)/stiffness. At 0.012 the line hangs ~23px on its own weight
// (it IS a saggy elastic rope now) and dips ~35 under the walker.
const BED_STIFFNESS = 0.006; // per-segment spring toward the home line // per-segment spring back toward the home line
const BED_DAMPING = 0.2; // A/B: damping back // Matter constraint damping blows up the alternating
// mode at low stiffness (exponential ± growth); frictionAir damps honestly
// Must exceed the static-friction grip on the line (mu_s ~1.2 x gravity 0.001),
// otherwise the walker just sticks and creeps.
const MAX_WALK_SPEED = 2.6; // px/tick horizontal cruise
// Press pushes the WALKER down (real load path: his legs drive the foot
// joint into the fabric; the fabric's springs resist — never touch the line).
const PRESS_ACCEL = 12; // extra g's the walker drives into the fabric while space is held
const LOAD_SPAN_SEGS = 1.6; // half-width of the contact-force footprint, in segment spacings
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
    let segBed: Matter.Constraint[][] = []; // bed springs by segment index
    let loadHalfW = 100; // kernel half-width in px, refreshed by buildLine
    let slacker: Matter.Body;

    const anchorY = () => Math.round(pageHeight * ANCHOR_Y_FRAC);

    const clearLine = () => {
      if (webbing) Matter.World.remove(world, webbing, true);
      if (anchors.length) Matter.World.remove(world, anchors);
      webbing = null;
      anchors = [];
      bedConstraints = [];
      segBed = [];
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
      segBed = [];
      loadHalfW = spacing * LOAD_SPAN_SEGS;
      const segs: Matter.Body[] = [];
      for (let i = 0; i < SEGMENTS; i++) {
        segs.push(
          Matter.Bodies.rectangle(margin + i * spacing, y0, spacing * 1.15, 7, {
            // Negative group: segments never collide with each other. They
            // overlap 1.15x for ribbon continuity, and as colliding
            // bodies that overlap became a repulsion spring — the softer
            // bed could no longer out-muscle it (rest-state sawtooth).
            collisionFilter: { group: webbingGroup, category: 0x0004, mask: 0x0004 },
            render: { visible: false }, // drawn as one continuous ribbon overlay
            chamfer: { radius: 3 },
            friction: 1,
            frictionStatic: 1.4,
            density: 0.004,
            frictionAir: 0.03,
          })
        );
      }
      Matter.Composite.add(webbing, segs);
      segHalfW = (spacing * 1.15) / 2;

      // Trampoline-bed model (what a real trampoline is: fabric + springs to
      // a frame). Each interior segment hangs on TWO invisible springs, one
      // at each end: a single center spring fixes position but exerts no
      // torque, so segments hinge down around it and the line gaps. The
      // end-pair forms a force couple that keeps every segment level.
      bedConstraints = [];
      for (let i = 0; i < segs.length; i++) segBed.push([]);
      for (let i = 1; i < segs.length - 1; i++) {
        for (const end of [-1, 1]) {
          const nearPost = i === 1 || i === segs.length - 2;
          const c = Matter.Constraint.create({
            bodyA: segs[i],
            pointA: { x: (end * spacing) / 2, y: 0 },
            pointB: { x: margin + i * spacing + (end * spacing) / 2, y: y0 },
            length: 0,
            stiffness: nearPost ? BED_STIFFNESS * 1.8 : BED_STIFFNESS,
            damping: BED_DAMPING,
          });
          bedConstraints.push(c);
          segBed[i].push(c);
        }
      }
      // End segments get a spring at their free end too; otherwise they
      // hang off the single rigid pin like a flag and gap at the posts.
      const first = segs[0];
      const last = segs[segs.length - 1];
      const endSpring = (seg: Matter.Body, idx: number, anchorX: number) => {
        // Center-anchored like the other bed springs: an edge-anchored
        // spring holds the segment by one corner and bends the first few
        // segments into visible bulges beside the posts.
        const c = Matter.Constraint.create({
          bodyA: seg,
          pointA: { x: 0, y: 0 },
          pointB: { x: anchorX, y: y0 },
          length: 0,
          stiffness: BED_STIFFNESS,
          damping: BED_DAMPING,
        });
        bedConstraints.push(c);
        segBed[idx].push(c);
      };
      // Anchor exactly under the body-side point's REST position: the
      // old 0.575-spacing offsets left every end spring permanently
      // stretched, squeezing the line inward from both posts. Invisible
      // on the stiff bed; with the soft bed the squeeze buckled it.
      endSpring(first, 0, first.position.x);
      endSpring(last, segs.length - 1, last.position.x);
      Matter.Composite.add(webbing, bedConstraints);

      // Soft links between neighbours: the trough the walker's load digs
      // spills smoothly into adjacent segments.
      for (let i = 0; i < segs.length - 1; i++) {
        Matter.Composite.add(
          webbing,
          Matter.Constraint.create({
            bodyA: segs[i],
            bodyB: segs[i + 1],
            // Center-to-center, rest = natural spacing. (These used to
            // anchor at ±spacing/2 — i.e. ZERO world distance at rest —
            // so every link pulled at full 1.02*spacing extension, ~27g
            // of phantom compression through the line. That stored energy
            // is what the checkerboard mode fed on until the line snapped
            // and threw the walker through.)
            pointA: { x: 0, y: 0 },
            pointB: { x: 0, y: 0 },
            length: spacing * 1.02,
            stiffness: 0.25,
            damping: 0.2,
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
    let attached = true;
    let lastFootSegY = 0; // for measuring the fabric's real velocity
    let bedVy = 0; // fabric surface velocity under the foot (px/tick, -=up)
    // Matter's applyForce is in force units: a Δv of `a` px/tick^2 on a
    // body of mass m needs F = a*m/(gravity.scale*dt^2). Passing the bare
    // a*m (the mistake here the first time) multiplied every contact
    // force by ~3.6 and launched the walker out of the world.
    const dtSq = (1000 / 60) ** 2;
    const gravityStep = engine.current.gravity.y * engine.current.gravity.scale * dtSq;
    const forceScale = 1 / dtSq; // F = (Δv px/tick^2) * mass / dt^2

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

      if (seg) {
        bedVy = lastFootSegY ? seg.position.y - lastFootSegY : 0;
        lastFootSegY = seg.position.y;
      } else {
        bedVy = 0;
      }

      // Foot contact: a soft spring between feet and fabric — the only
      // vertical coupling in the scene, and it is a real force on both
      // sides (Newton 3: the reaction spreads over the cos² footprint, so
      // the webbing sags across a span under his step, not a notch).
      // No velocity clamps, no pins, no pops: the fabric presses him up
      // exactly as long as it is compressed and closing on him; the moment
      // it sinks away from his ballistic path his feet leave it with the
      // speed it gave him. Pressing is a gravity well — extra weight on
      // the spring — so the bed sinks, stores energy, and its recoil
      // compresses the spring harder than gravity and throws him.
      attached = false;
      const bodies = webbing ? (webbing.bodies as Matter.Body[]) : [];
      if (seg && surf !== null && bodies.length > 2) {
        const pen = Math.min(26, Math.max(0, wp.y + FOOT_R - surf + 1));
        // window must be DEEPER than any real overshoot (landing speed /
        // foot-spring rate) — a tighter one let a pressed walker outrun
        // contact and drop straight through the line
        const near = wp.y + FOOT_R - surf < 40;
        if (near) {
          attached = pen > 0; // indicator only; contact force below is gated too
          // zero force at zero penetration: the fabric can push, never
          // suck — the moment his feet leave it he is purely ballistic
          // spring carries exactly his weight at rest: equilibrium when
          // 0.3*pen == gravityStep, i.e. a few px of sink
          // cap must sit above the full press demand (1 + PRESS_ACCEL g),
          // else a held press sinks him through the spring at 1g — the
          // exact slow fall-through this replaced
          const a =
            pen > 0
              ? Math.max(
                  0,
                  Math.min(gravityStep * 16, 0.3 * pen + 0.07 * (bedVy - vel.y)),
                )
              : 0;
          const well = pressing && wp.y < pageHeight - 140 ? PRESS_ACCEL * gravityStep : 0;
          Matter.Body.applyForce(slacker, slacker.position, {
            x: 0,
            y: (well - a) * slacker.mass * forceScale,
          });
          let sum = 0;
          const ws = bodies.map((b) => {
            const dx = b.position.x - wp.x;
            const w =
              Math.abs(dx) < loadHalfW
                ? Math.cos((dx / loadHalfW) * (Math.PI / 2)) ** 2
                : 0;
            sum += w;
            return w;
          });
          if (sum > 0) {
            bodies.forEach((b, j) => {
              if (ws[j] > 0) {
                Matter.Body.applyForce(b, b.position, {
                  x: 0,
                  y: (a * slacker.mass * ws[j] * forceScale) / sum,
                });
              }
            });
          }
        }
      }

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
      // The physics line has a small every-other-segment ripple (a
      // discretization artifact of per-segment springs; stiffer couplings
      // that remove it also stiffen the whole bed). The webbing is drawn
      // as a smooth band through the segment centers anyway, so draw it
      // through a lightly smoothed centerline: eyes see a rope, solver
      // keeps its honest dynamics.
      const n = bodies.length;
      const px = bodies.map((b) => b.position.x);
      const py = bodies.map((b, i) =>
        i === 0 || i === n - 1
          ? b.position.y
          : (bodies[i - 1].position.y + b.position.y + bodies[i + 1].position.y) / 3
      );
      const top: { x: number; y: number }[] = [];
      const bot: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const x = px[i] + (i === 0 ? -hw : i === n - 1 ? hw : 0);
        top.push({ x, y: py[i] - hh });
        bot.push({ x, y: py[i] + hh });
      }
      const trace = (pts: { x: number; y: number }[]) => {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      };
      ctx.beginPath();
      trace(top);
      ctx.lineTo(bot[bot.length - 1].x, bot[bot.length - 1].y);
      trace(bot.reverse());
      ctx.closePath();
      ctx.fillStyle = WEBBING_COLOR;
      ctx.fill();
      // subtle under-edge so the ribbon reads as webbing, not a flat stripe
      ctx.beginPath();
      trace(bot);
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
