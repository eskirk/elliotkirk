import React, { useEffect, useRef, useState } from 'react';
import { faro } from '@grafana/faro-web-sdk';
import * as Matter from 'matter-js';
import _ from 'lodash';

// Set once, on the first gated visit, so the tilt hint pill shows exactly
// once ever (iOS site grants persist, so later loads enable silently).
const TILT_HINT_KEY = 'ek-tilt-hint-shown';

export const Balls = () => {
  const scene = useRef<HTMLDivElement>(null);
  const engine = useRef(Matter.Engine.create());
  // Tilt-permission UI state, shown on iOS only:
  //   'hidden' — nothing to show (desktop, Android, motion already running,
  //              or already-seen loads where permission resolves silently)
  //   'enable' — one-time discoverability hint (retired via localStorage)
  //   'denied' — iOS refused (earlier dismissal or Safari setting)
  //   'nodata' — granted but the sensor never fired (per-site Safari toggle)
  const [tilt, setTilt] = useState<'hidden' | 'enable' | 'denied' | 'nodata'>('hidden');
  const tiltRequestRef = useRef<(() => void) | null>(null);

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

    const clearAll = () => {
      Matter.World.clear(world, false);
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

    // --- Tilt controls (mobile) ---
    // On touch devices the balls react to the phone's accelerometer: tilting the
    // phone steers the gravity vector. Held upright (beta≈90, gamma≈0) it's
    // normal downward gravity; tipping tips the world like a tray. iOS 13+ gates
    // DeviceOrientationEvent behind a one-tap permission request; desktop has no
    // accelerometer, so the whole block is a no-op there.
    const BASE_G = 1;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const applyTilt = (beta: number, gamma: number) => {
      const gx = BASE_G * clamp(gamma / 90, -1, 1);
      const gy = BASE_G * clamp(beta / 90, -1, 1);
      world.gravity.x = gx;
      world.gravity.y = gy;
      engine.current.gravity.x = gx;
      engine.current.gravity.y = gy;
    };

    // The deviceorientation listener — attached only when tilt controls are on.
    let sawOrientation = false;
    const onOrientation = (e: DeviceOrientationEvent) => {
      sawOrientation = true;
      if (e.beta == null || e.gamma == null) return;
      applyTilt(e.beta, e.gamma);
    };

    const isTouch =
      'ontouchstart' in window ||
      (navigator.maxTouchPoints ?? 0) > 0 ||
      (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
    const DOE: any = (window as any).DeviceOrientationEvent;
    // iOS 13+ gates the sensor behind a permission request fired from a user
    // gesture; Android (and iOS ≤12) stream orientation events freely.
    const gated = isTouch && !!DOE && typeof DOE.requestPermission === 'function';

    let motionActive = false;
    let nodataTimer = 0;
    const enableMotion = (watch: boolean) => {
      if (motionActive) return;
      motionActive = true;
      window.addEventListener('deviceorientation', onOrientation);
      if (watch) {
        // 'granted' but no events for a while means the per-site "Motion &
        // Orientation" toggle is off in Safari — surface that instead of the
        // balls just sitting there with no explanation.
        nodataTimer = window.setTimeout(() => {
          if (!sawOrientation) setTilt('nodata');
        }, 2500);
      }
    };

    // The old code fired the permission prompt on the first pointerdown with
    // { once: true } — a dismissed or failed prompt was consumed forever with
    // no way to retry, which is why tilt "did nothing" on iPhone. Now every
    // gesture retries until the request settles, and the pill shows the state.
    // requestPermission() must be called synchronously inside the gesture
    // handler; a synchronous throw just means that event type didn't count —
    // the next gesture (iOS reliably accepts click/touchend/keydown) tries again.
    const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
    let settled = false;
    let inFlight = false;
    function onGesture() {
      request();
    }
    const detachGestures = () => GESTURES.forEach((g) => window.removeEventListener(g, onGesture));
    const request = () => {
      if (settled || inFlight) return;
      let p: Promise<string>;
      try {
        p = DOE.requestPermission();
      } catch {
        return; // not a qualifying gesture — retry on the next one
      }
      inFlight = true;
      Promise.resolve(p).then(
        (res) => {
          inFlight = false;
          settled = true;
          detachGestures();
          if (res === 'granted') {
            enableMotion(true);
            setTilt('hidden');
          } else {
            // iOS won't prompt again for this site — guide the user to the
            // setting instead of failing silently.
            setTilt('denied');
          }
        },
        () => {
          inFlight = false; // rejected outside activation — next gesture retries
        }
      );
    };

    tiltRequestRef.current = gated ? request : null;

    // iOS grants motion access per *site*: once allowed, a later
    // requestPermission() (still called from a gesture) resolves instantly
    // with no dialog. So the request fires silently on the first tap — no
    // pill needed as a gate. The 'enable' pill is now a ONE-TIME hint (so
    // the tilt feature stays discoverable), retired forever via localStorage
    // after its first appearance; the warn pills still surface real
    // failures (denied, or granted-but-no-sensor-data).
    if (isTouch) {
      if (gated) {
        let hintSeen = true;
        try {
          hintSeen = window.localStorage.getItem(TILT_HINT_KEY) === "1";
          if (!hintSeen) window.localStorage.setItem(TILT_HINT_KEY, "1");
        } catch {
          /* storage blocked (e.g. strict privacy mode): never show the hint */
        }
        if (!hintSeen) setTilt("enable");
        GESTURES.forEach((g) => window.addEventListener(g, onGesture));
      } else {
        enableMotion(false); // Android / others: no permission gate
      }
    }

    // --- Ball rain (mobile) ---
    // On touch devices it drizzles ~1 ball/second — size, colour, drop position
    // and initial velocity vary per ball so it never feels metronomic —
    // keeping the scene re-throwing itself for phone users (desktop stays
    // click-driven). Spawning pauses while the tab is hidden: the physics
    // clock rides requestAnimationFrame and halts there, so a hidden-tab
    // backlog would otherwise cascade all at once when the user returns.
    // Past a modest cap the oldest rain ball retires, so physics stays light
    // no matter how long the page sits open.
    const RAIN_BASE_MS = 1000;
    const RAIN_JITTER_MS = 250; // effective interval: 750–1250ms
    const RAIN_MAX = 60;
    const rainBalls: Matter.Body[] = [];
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
    if (isTouch) scheduleRain();

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
      window.removeEventListener('deviceorientation', onOrientation);
      GESTURES.forEach((g) => window.removeEventListener(g, onGesture));
      if (nodataTimer) window.clearTimeout(nodataTimer);
      if (rainTimer) window.clearTimeout(rainTimer);
      tiltRequestRef.current = null;
    };
    // Deps: the effect builds the whole world once — never re-run it on
    // re-renders (the setTilt() calls below re-render this component).
  }, []);

  return (
    <>
      <div ref={scene} style={{ width: '100%', height: '100%' }} />
      {tilt !== 'hidden' && (
        <button
          type="button"
          className={tilt === 'enable' ? 'tilt-pill' : 'tilt-pill tilt-pill-warn'}
          onClick={() => tiltRequestRef.current?.()}
        >
          {tilt === 'enable' && <>📱 tap to enable tilt controls</>}
          {tilt === 'denied' && (
            <>⚠️ motion blocked — Safari ▸ ⋯ ▸ Website Settings ▸ allow Motion &amp; Orientation</>
          )}
          {tilt === 'nodata' && (
            <>⚠️ no motion data — Safari ▸ ⋯ ▸ Website Settings ▸ allow Motion &amp; Orientation</>
          )}
        </button>
      )}
    </>
  );
};
