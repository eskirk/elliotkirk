import React, { useEffect, useRef } from 'react';
import { faro } from '@grafana/faro-web-sdk';
import * as Matter from 'matter-js';
import _ from 'lodash';

export const Balls = () => {
  const scene = useRef<HTMLDivElement>(null);
  const engine = useRef(Matter.Engine.create());

  useEffect(() => {
    let runner = Matter.Runner.create();
    let pageWidth = document.body.clientWidth;
    let pageHeight = window.innerHeight;

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
    // sits just above the bottom edge. Rebuilt whenever the scene resizes.
    const makeGround = (width: number, height: number) =>
      Matter.Bodies.rectangle(width / 2 - 10, height - 100, width + 50, 60, { isStatic: true });

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
      resize(document.body.clientWidth, window.innerHeight);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);

    Matter.World.add(engine.current.world, [stack, ground, mouseConstraint]);
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine.current);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  });

  return <div ref={scene} style={{ width: '100%', height: '100%' }} />;
};
