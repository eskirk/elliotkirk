import React, { useEffect, useRef } from "react";
import * as Matter from "matter-js";
import _ from "lodash";

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
        background: "transparent",
        width: pageWidth,
        height: 1200,
        showAngleIndicator: false,
        wireframes: false,
      },
    });

    const anchors = [
      Matter.Bodies.rectangle(25, pageHeight / 2, 80, 300, {
        isStatic: true,
        collisionFilter: {
          category: 0x0002,
        },
        render: {
          fillStyle: "gray",
        },
      }),
      Matter.Bodies.rectangle(pageWidth - 25, pageHeight / 2, 80, 300, {
        isStatic: true,
        collisionFilter: {
          category: 0x0002,
        },
        render: {
          fillStyle: "gray",
        },
      }),
    ];

    const colors = [
      "RebeccaPurple",
      "HotPink",
      "PaleVioletRed",
      "Indigo",
      "LightSlateGray",
    ];
    const slacker = Matter.Bodies.circle(pageWidth / 2, 0, 45, {
      density: 0.0045,
      collisionFilter: {
        category: 0x0001,
      },
      render: {
        fillStyle: _.sample(colors),
      },
    });

    const webbing = Matter.Composites.stack(
      100,
      1000,
      100,
      1,
      10,
      10,
      function (x: number, y: number) {
        return Matter.Bodies.rectangle(x - 20, y, 20, 10, {
          collisionFilter: {
            mask: 0x0001,
          },
          render: { fillStyle: _.sample(colors) },
          chamfer: { radius: 5 },
        });
      }
    );

    Matter.Composites.chain(webbing, 0.2, 0, -0.2, 0, {
      length: 0,
      stiffness: 1,
      damping: 1
    });
    Matter.Composite.add(
      webbing,
      Matter.Constraint.create({
        pointA: { x: anchors[0].position.x + 30, y: anchors[0].position.y },
        bodyB: webbing.bodies[0],
        damping: 1.5,
        stiffness: .1,
        length: 5
      })
    );
    Matter.Composite.add(
      webbing,
      Matter.Constraint.create({
        pointA: { x: anchors[1].position.x - 30, y: anchors[1].position.y },
        bodyB: _.last(webbing.bodies),
        damping: 1.5,
        stiffness: .1,
        length: 5
      })
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

    const keyHandlers: Record<string, Function> = {
      Space: () => {
        Matter.Body.applyForce(
          slacker,
          {
            x: slacker.position.x,
            y: slacker.position.y,
          },
          { x: 0, y: 0.1 }
        );
      },
    };

    const keysDown = new Set<string>();
    document.addEventListener("keydown", (event) => {
      console.log(event.code);

      keysDown.add(event.code);
    });
    document.addEventListener("keyup", (event) => {
      keysDown.delete(event.code);
    });

    Matter.Events.on(engine.current, "beforeUpdate", () => {
      [...keysDown].forEach((k: string) => {
        console.log(keyHandlers[k]);

        keyHandlers[k]?.();
      });
    });

    Matter.World.add(engine.current.world, [
      ...anchors,
      webbing,
      slacker,
      mouseConstraint,
    ]);
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine.current);
  });

  return <div ref={scene} style={{ width: "100%", height: "100%" }} />;
};
