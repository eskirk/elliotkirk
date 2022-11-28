import React, { useEffect, useRef } from 'react';
import * as Matter from 'matter-js';

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
          visible: true,
        },
      },
    });
    render.mouse = mouse;


    let stack = Matter.Composites.stack(
      pageWidth / 2,
      0,
      8,
      4,
      0,
      0,
      function (x: number, y: number) {
        return Matter.Bodies.circle(x, y, Math.random() * 50 + 20);
      }
    );

    let mouseDown = false;

    // create balls on click
    Matter.Events.on(mouseConstraint, 'mousedown', (event: any) => {
      mouseDown = true;
      var position = event.mouse.position;
      var circle = Matter.Bodies.circle(position.x, position.y, Math.random() * 50 + 20);
      Matter.World.add(engine.current.world, circle);
    });

    // stop creating balls when mouse up
    Matter.Events.on(mouseConstraint, 'mouseup', () => {
      mouseDown = false;
    });

    // create balls continuously when mouse is down
    Matter.Events.on(mouseConstraint, 'mousemove', (event: any) => {
      if (mouseDown) {
        var position = event.mouse.position;
        var circle = Matter.Bodies.circle(position.x, position.y, Math.random() * 50 + 20);
        Matter.World.add(engine.current.world, circle);
      }
    });

    Matter.World.add(engine.current.world, [stack, ground, mouseConstraint]);
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine.current);
  });

  return <div ref={scene} style={{ width: '100%', height: '100%' }} />;
};
