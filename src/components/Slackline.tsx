import React, { useEffect, useRef } from "react"
import * as Matter from 'matter-js';
import _ from 'lodash';

export const Slackline = () => {
  const scene = useRef<HTMLDivElement>(null);
  const engine = useRef(Matter.Engine.create());

  useEffect(() => {
    const runner = Matter.Runner.create();
    const pageWidth = document.body.clientWidth;
    const pageHeight = document.body.clientHeight;

    const render = Matter.Render.create({
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

    const anchors = [
      Matter.Bodies.rectangle(0, pageHeight - 350, 80, 300, {
        isStatic: true,
        render: {
          fillStyle: 'gray'
        }
      }),
      Matter.Bodies.rectangle(pageWidth, pageHeight - 350, 80, 300, {
        isStatic: true,
        render: {
          fillStyle: 'gray'
        }
      }),
    ];

    const colors = ['RebeccaPurple', 'HotPink', 'PaleVioletRed', 'Indigo', 'LightSlateGray'];
    const slacker = Matter.Bodies.circle(pageWidth / 2, 0, 45, {
      density: 0.0045,
      render: {
        fillStyle: _.sample(colors)
      }
    });

    const webbing = Matter.Composites.stack(100, 200, 35, 1, 20, 10, function(x: number, y: number) {
      return Matter.Bodies.rectangle(x - 25, y, 50, 20, { render: { fillStyle: _.sample(colors)}, chamfer: { radius: 5 } });
    });

    Matter.Composites.chain(webbing, 0.3, 0, -0.3, 0, { length: 0 });
    Matter.Composite.add(webbing, Matter.Constraint.create({
      pointA:  anchors[0].position,
      bodyB: webbing.bodies[0],
      pointB: { x: -25, y: 0 },
      stiffness: .25,
      length: 1
    }));
    Matter.Composite.add(webbing, Matter.Constraint.create({
      pointA: anchors[1].position,
      bodyB: _.last(webbing.bodies),
      pointB: { x: 25, y: 0 },
      stiffness: .25,
      length: 1
    }));

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

    // let mouseDown = false;
    // create balls on click
    Matter.Events.on(mouseConstraint, 'mousedown', () => {
      Matter.Body.applyForce( slacker, {x: slacker.position.x, y: slacker.position.y}, {x: 0, y: 1});
    });

    Matter.Events.on(mouseConstraint, 'mouseup', () => {
      Matter.Body.applyForce( slacker, {x: slacker.position.x, y: slacker.position.y}, {x: 0, y: -1});
    });

    // // stop creating balls when mouse up
    // Matter.Events.on(mouseConstraint, 'mouseup', () => {
    //   mouseDown = false;
    // });

    // // create balls continuously when mouse is down
    // Matter.Events.on(mouseConstraint, 'mousemove', (event: any) => {
    //   if (mouseDown) {
    //     var position = event.mouse.position;
    //     var circle = Matter.Bodies.circle(position.x, position.y, Math.random() * 50 + 20, {
    //       render: {
    //         fillStyle: _.sample(colors)
    //       }
    //     });
    //     Matter.World.add(engine.current.world, circle);
    //   }
    // });

    Matter.World.add(engine.current.world, [...anchors, webbing, slacker, mouseConstraint]);
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine.current);
  });

  return <div ref={scene} style={{ width: '100%', height: '100%' }} />;
}