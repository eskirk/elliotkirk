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
const BED_STIFFNESS = 0.25; // per-segment spring back toward the home line
const BED_DAMPING = 0.08; // tames endless wobble without killing the bounce
// Must exceed the static-friction grip on the line (mu_s ~1.2 x gravity 0.001),
// otherwise the walker just sticks and creeps.
const WALK_FORCE = 0.0028; // horizontal accel (px/ms^2) while an arrow is held
const PRESS_SAG = 60; // px the bed dips under the walker while space is held
const BED_POCKET_RADIUS = 130; // px of line around the walker that dips with him
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
          Matter.Bodies.rectangle(margin + i * spacing, y0, spacing * 1.15, 9, {
            collisionFilter: { group: webbingGroup },
            render: { fillStyle: WEBBING_COLOR },
            chamfer: { radius: 3 },
            friction: 1,
            frictionStatic: 1.4,
            density: 0.004,
            frictionAir: 0.04,
          })
        );
      }
      Matter.Composite.add(webbing, segs);

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
          (c as any).__homeX = margin + i * spacing; // pocket math target
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
        // intentionally no __homeX: post-end springs never pocket
        bedConstraints.push(c);
      };
      endSpring(first, 1, margin + spacing * 0.575);
      endSpring(last, -1, pageWidth - margin - spacing * 0.575);
      Matter.Composite.add(webbing, bedConstraints);

      // Soft links between neighbours: a press dips the walker's local
      // pocket and drips the trough into adjacent segments.
      for (let i = 0; i < segs.length - 1; i++) {
        Matter.Composite.add(
          webbing,
          Matter.Constraint.create({
            bodyA: segs[i],
            bodyB: segs[i + 1],
            pointA: { x: spacing / 2, y: 0 },
            pointB: { x: -spacing / 2, y: 0 },
            length: spacing * 1.02,
            stiffness: 0.06,
            damping: 0.1,
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
        collisionFilter: { category: 0x0001 },
        render: { visible: false },
      });
      // Balance is the point of slacklining; a spinning tumbleweed is not.
      // Locking inertia keeps the figure upright while friction still
      // transfers pushes into the line.
      Matter.Body.setInertia(slacker, Infinity);
      Matter.World.add(world, slacker);
    };

    const respawnSlacker = () => {
      detachFoot();
      Matter.Body.setPosition(slacker, { x: pageWidth / 2, y: anchorY() - 21 });
      Matter.Body.setVelocity(slacker, { x: 0, y: 0 });
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

    // --- trampoline press: spacebar lengthens the bed springs under the
    // walker so the line dips beneath him (storing energy in the springs),
    // and retracts them on release — the snap home is the launch. ---
    let pressing = false;
    let prevPressing = false;
    let pocketMax = 0; // deepest dip reached during the current press
    let footJoint: Matter.Constraint | null = null;
    let footJointSeg: Matter.Body | null = null;

    const attachFoot = (seg: Matter.Body) => {
      detachFoot();
      // rest length ≈ foot radius + half segment height: the foot hangs ON
      // the fabric, exactly like a shoe gripping a real slackline.
      footJoint = Matter.Constraint.create({
        bodyA: slacker,
        pointA: { x: 0, y: FOOT_R * 0.7 },
        bodyB: seg,
        pointB: { x: 0, y: -5 },
        length: FOOT_R + 4,
        stiffness: 0.3,
        damping: 0.05,
      });
      footJointSeg = seg;
      Matter.World.add(world, footJoint);
    };
    const detachFoot = () => {
      if (footJoint) Matter.World.remove(world, footJoint);
      footJoint = null;
      footJointSeg = null;
    };
    const bedSurfaceY = (x: number) => {
      const seg = nearestSegment(x);
      return seg ? seg.position.y - 4.5 : anchorY();
    };
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
      const m = slacker.mass;
      const wp = slacker.position;
      const vel = slacker.velocity;
      pressing = keysDown.has("Space");
      if (pressing && !prevPressing) pocketMax = 0;
      if (!pressing && prevPressing && footJoint && pocketMax > 15) {
        const pop = Math.min(11, 3 + pocketMax * 0.16);
        Matter.Body.setVelocity(slacker, { x: slacker.velocity.x, y: -pop });
      }
      prevPressing = pressing;
      if (keysDown.has("ArrowLeft")) {
        Matter.Body.applyForce(slacker, wp, { x: -WALK_FORCE * m, y: 0 });
      }
      if (keysDown.has("ArrowRight")) {
        Matter.Body.applyForce(slacker, wp, { x: WALK_FORCE * m, y: 0 });
      }

      // grip the line: attach when a foot touches the fabric, ride it, and
      // let go on a strong launch so the walker can actually fly.
      const seg = nearestSegment(wp.x);
      if (seg) {
        const gap = seg.position.y - 4.5 - (wp.y + FOOT_R);
        if (!footJoint && Math.abs(gap) < 20 && vel.y > -4) {
          attachFoot(seg);
        } else if (footJoint) {
          if (footJointSeg !== seg && Math.abs(seg.position.x - wp.x) < 30) {
            attachFoot(seg); // hopped to the next segment mid-stride
          }
          if (vel.y < -6) {
            detachFoot(); // strong upward snap → launch into a jump
          }
        }
      } else if (footJoint) {
        detachFoot();
      }
      // falling past the line or sitting on the ground: nothing to grip
      if (footJoint && wp.y + FOOT_R < bedSurfaceY(wp.x) - 60) detachFoot();

      // Bed springs near the walker dip into a pocket while pressing.
      bedConstraints.forEach((c: any) => {
        if (c.__homeX === undefined) return; // post-end springs stay taut
        const dx = Math.abs(c.__homeX - wp.x);
        const near = dx < BED_POCKET_RADIUS;
        const target = pressing && near ? PRESS_SAG * (1 - dx / BED_POCKET_RADIUS) : 0;
        c.__pocket = (c.__pocket ?? 0) + (target - (c.__pocket ?? 0)) * (pressing ? 0.1 : 0.3);
        c.length = c.__pocket;
        if (pressing) pocketMax = Math.max(pocketMax, c.__pocket);
      });

      // Level the fabric: the end-spring couple does most of the work; this
      // gently snaps away residual hinge so the seam never gapes.
      if (webbing) {
        (webbing.bodies as Matter.Body[]).forEach((b) => {
          if (Math.abs(b.angle) > 0.005) Matter.Body.setAngle(b, b.angle * 0.6);
        });
      }
    });

    // --- stick figure overlay (Matter renders the webbing + posts itself) ---
    const legPhase = { t: 0 };
    Matter.Events.on(render, "afterRender", () => {
      const ctx = render.context;
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
