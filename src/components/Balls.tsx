import React, { useEffect, useRef } from 'react';
import { faro } from '@grafana/faro-web-sdk';
import * as Matter from 'matter-js';
import _ from 'lodash';
import { tiltState } from '../tilt';

export const Balls = () => {
  const scene = useRef<HTMLDivElement>(null);
  const engine = useRef(Matter.Engine.create());
  // Tilt is opt-in per visit via the button in the floor band (see
  // src/tilt.ts); this component only consumes tiltState each tick.

  useEffect(() => {
    let runner = Matter.Runner.create();
    // iOS keeps innerHeight at the URL-bar-expanded size (or reports it mid-
    // animation), which left the floor floating above the real bottom edge.
    // visualViewport.height tracks the actually-visible viewport live.
    const viewportHeight = () =>
      (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    let pageWidth = window.innerWidth;
    let pageHeight = viewportHeight();
    let settleTimer = 0;

    let render = Matter.Render.create({
      element: document.body,
      engine: engine.current,
      options: {
        background: 'transparent',
        width: pageWidth,
        height: pageHeight,
        showAngleIndicator: false,
        wireframes: false,
      },
    });

    // A static ground that spans (a touch wider than) the current width and
    // is flush with the bottom of the viewport: a 60-unit band whose top
    // surface sits at height - 60. Rebuilt whenever the scene resizes.
    const makeGround = (width: number, height: number) =>
      Matter.Bodies.rectangle(width / 2 - 10, height - 30, width + 50, 60, { isStatic: true });

    let ground = makeGround(pageWidth, pageHeight);

    let mouse = Matter.Mouse.create(render.canvas);
    // Default the pointer to the upper-centre so the "a" shortcut places a
    // ball somewhere sensible before the user has moved over the canvas.
    mouse.position = { x: pageWidth / 2, y: 40 };
    let mouseConstraint = Matter.MouseConstraint.create(engine.current, {
      mouse: mouse,
      constraint: {
        render: {
          visible: false,
        },
      },
    });
    render.mouse = mouse;

    const colors = ['RebeccaPurple', 'HotPink', 'PaleVioletRed', 'Indigo', 'LightSlateGray'];
    let stack = Matter.Composites.stack(
      pageWidth / 2,
      0,
      8,
      4,
      0,
      0,
      function (x: number, y: number) {
        return Matter.Bodies.circle(x, y, Math.random() * 50 + 20, {
          render: {
            fillStyle: _.sample(colors)
          }
        });
      }
    );

    let mouseDown = false;

    // create balls on click
    Matter.Events.on(mouseConstraint, 'mousedown', (event: any) => {
      mouseDown = true;
      var position = event.mouse.position;
      var circle = Matter.Bodies.circle(position.x, position.y, Math.random() * 50 + 20, {
        render: {
          fillStyle: _.sample(colors)
        }
      });
      Matter.World.add(engine.current.world, circle);
      faro.api.pushEvent('ball_created', { x: position.x, y: position.y });
    });

    // stop creating balls when mouse up
    Matter.Events.on(mouseConstraint, 'mouseup', () => {
      mouseDown = false;
    });

    // create balls continuously when mouse is down
    Matter.Events.on(mouseConstraint, 'mousemove', (event: any) => {
      if (mouseDown) {
        var position = event.mouse.position;
        var circle = Matter.Bodies.circle(position.x, position.y, Math.random() * 50 + 20, {
          render: {
            fillStyle: _.sample(colors)
          }
        });
        Matter.World.add(engine.current.world, circle);
      }
    });

    const world = engine.current.world;

    // "a" drops a ball at the current pointer position (the canvas-relative
    // cursor tracked by Matter.Mouse), matching the click behaviour.
    const addBall = () => {
      const { x, y } = mouse.position;
      const circle = Matter.Bodies.circle(x, y, Math.random() * 50 + 20, {
        render: { fillStyle: _.sample(colors) },
      });
      Matter.World.add(world, circle);
      faro?.api?.pushEvent?.('ball_created', { x: String(x), y: String(y) });
    };

    // Bodies spawned by the ball-rain loop (shared so reset/clear can drop
    // stale references — see the rain section below).
    const rainBalls: Matter.Body[] = [];

    const clearAll = () => {
      Matter.World.clear(world, false);
      rainBalls.length = 0;
      faro?.api?.pushEvent?.('world_cleared');
    };

    const toggleGround = () => {
      const present = world.bodies.includes(ground);
      if (present) {
        Matter.World.remove(world, ground);
      } else {
        Matter.World.add(world, ground);
      }
      faro?.api?.pushEvent?.('ground_toggled', { present: String(!present) });
    };

    const toggleGravity = () => {
      const next = world.gravity.y === 0 ? 1 : 0;
      world.gravity.y = next;
      engine.current.gravity.y = next;
      faro?.api?.pushEvent?.('gravity_toggled', { y: String(next) });
    };

    const resetScene = () => {
      Matter.World.clear(world, false);
      rainBalls.length = 0;
      ground = makeGround(pageWidth, pageHeight);
      world.gravity.y = 1;
      engine.current.gravity.y = 1;
      const freshStack = Matter.Composites.stack(
        pageWidth / 2,
        0,
        8,
        4,
        0,
        0,
        function (x: number, y: number) {
          return Matter.Bodies.circle(x, y, Math.random() * 50 + 20, {
            render: { fillStyle: _.sample(colors) },
          });
        }
      );
      Matter.World.add(world, [ground, freshStack]);
      faro?.api?.pushEvent?.('world_reset');
    };

    // Resize the whole scene to fit the window: resize the canvas, rebuild the
    // ground to span the new width at the bottom, and scale existing balls
    // proportionally so the layout is preserved.
    const resize = (newWidth: number, newHeight: number) => {
      if (newWidth === pageWidth && newHeight === pageHeight) {
        return;
      }
      render.options.width = newWidth;
      render.options.height = newHeight;
      render.canvas.width = newWidth;
      render.canvas.height = newHeight;

      // Rebuild the ground to span the new width at the bottom. The balls are
      // left where they are — only the floor + canvas bounds change on resize.
      const groundPresent = world.bodies.includes(ground);
      Matter.World.remove(world, ground);
      ground = makeGround(newWidth, newHeight);
      if (groundPresent) {
        Matter.World.add(world, ground);
      }

      pageWidth = newWidth;
      pageHeight = newHeight;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case 'a':
          addBall();
          break;
        case 'c':
          clearAll();
          break;
        case 'g':
          toggleGround();
          break;
        case 'e':
          toggleGravity();
          break;
        case 'r':
          resetScene();
          break;
      }
    };

    const onResize = () => {
      resize(window.innerWidth, viewportHeight());
      // URL-bar collapse can fire resize while iOS still reports the old
      // height; re-check once the animation has settled.
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        resize(window.innerWidth, viewportHeight());
      }, 350);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', onResize);

    Matter.World.add(engine.current.world, [stack, ground, mouseConstraint]);
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine.current);

    // --- Tilt controls (mobile, opt-in per visit via the band button) ---
    // tiltState is fed by the shared listener in src/tilt.ts once the user
    // taps the tilt button; balls steer by it tilting the gravity vector.
    // Held upright (beta≈90, gamma≈0) it's normal downward gravity.
    let tiltWasOn = false;
    const onBeforeUpdate = () => {
      if (tiltState.enabled) {
        world.gravity.x = tiltState.gx;
        world.gravity.y = tiltState.gy;
        engine.current.gravity.x = tiltState.gx;
        engine.current.gravity.y = tiltState.gy;
        tiltWasOn = true;
      } else if (tiltWasOn) {
        // turned off mid-visit: restore plain downward gravity exactly once
        tiltWasOn = false;
        world.gravity.x = 0;
        world.gravity.y = world.gravity.y === 0 ? 0 : 1;
        engine.current.gravity.x = 0;
        engine.current.gravity.y = world.gravity.y;
      }
    };
    Matter.Events.on(engine.current, 'beforeUpdate', onBeforeUpdate);

    // --- Ball rain (all devices) ---
    // A ~1 ball/second drizzle — size, colour, drop position and initial
    // velocity vary per ball so it never feels metronomic — keeping the scene
    // re-throwing itself whether the visitor taps or clicks. Spawning pauses
    // while the tab is hidden: the physics clock rides requestAnimationFrame
    // and halts there, so a hidden-tab backlog would otherwise cascade all
    // at once when the user returns.
    // Past a modest cap the oldest rain ball retires, so physics stays light
    // no matter how long the page sits open.
    const RAIN_BASE_MS = 1000;
    const RAIN_JITTER_MS = 250; // effective interval: 750–1250ms
    const RAIN_MAX = 60;
    let rainTimer = 0;
    const spawnRainBall = () => {
      const r = 12 + Math.random() * 28;
      const x = 30 + Math.random() * Math.max(60, pageWidth - 60);
      const ball = Matter.Bodies.circle(x, -r - 10, r, {
        render: { fillStyle: _.sample(colors) },
      });
      Matter.Body.setVelocity(ball, { x: (Math.random() - 0.5) * 4, y: 2 });
      Matter.World.add(world, ball);
      rainBalls.push(ball);
      if (rainBalls.length > RAIN_MAX) {
        Matter.World.remove(world, rainBalls.shift() as Matter.Body, true);
      }
    };
    const scheduleRain = () => {
      const delay = RAIN_BASE_MS + (Math.random() * 2 - 1) * RAIN_JITTER_MS;
      rainTimer = window.setTimeout(() => {
        if (document.visibilityState !== 'hidden') spawnRainBall();
        scheduleRain();
      }, delay);
    };
    scheduleRain();

    return () => {
      // Full teardown: this component now mounts/unmounts on route changes,
      // so the render + physics loops must stop or they'd leak against a
      // detached canvas (and duplicate on every return to home).
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.World.clear(engine.current.world, false);
      Matter.Engine.clear(engine.current);
      // The canvas was appended to document.body by Matter (outside React's
      // tree), so React unmounting can't remove it — take it out explicitly
      // or every route change leaks another full-viewport canvas.
      if (render.canvas && render.canvas.parentNode) {
        render.canvas.parentNode.removeChild(render.canvas);
      }
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      if (vv) vv.removeEventListener('resize', onResize);
      if (settleTimer) window.clearTimeout(settleTimer);
      if (rainTimer) window.clearTimeout(rainTimer);
    };
    // Deps: the effect builds the whole world once — never re-run it on
    // re-renders.
  }, []);

  return <div ref={scene} style={{ width: '100%', height: '100%' }} />;
};
