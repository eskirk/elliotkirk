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
    let render = Matter.Render.create({
      element: document.body,
      engine: engine.current,
      options: {
        background: 'transparent',
        width: pageWidth,
        height: 800,
        showAngleIndicator: false,
        wireframes: false,
      },
    });

    let ground = Matter.Bodies.rectangle(
      pageWidth / 2 - 10,
      700,
      pageWidth + 50,
      60,
      { isStatic: true }
    );

    let mouse = Matter.Mouse.create(render.canvas);
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

    const addBall = () => {
      const x = Math.random() * pageWidth;
      const circle = Matter.Bodies.circle(x, 40, Math.random() * 50 + 20, {
        render: { fillStyle: _.sample(colors) },
      });
      Matter.World.add(world, circle);
      faro?.api?.pushEvent?.('ball_created', { x: String(x) });
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
      ground = Matter.Bodies.rectangle(pageWidth / 2 - 10, 700, pageWidth + 50, 60, { isStatic: true });
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

    window.addEventListener('keydown', (event) => {
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
    });

    Matter.World.add(engine.current.world, [stack, ground, mouseConstraint]);
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine.current);
  });

  return <div ref={scene} style={{ width: '100%', height: '100%' }} />;
};
