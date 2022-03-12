Matter.use(MatterWrap);
Matter.use(MatterAttractors);

let engine = Matter.Engine.create();
let runner = Matter.Runner.create();

let pageWidth = document.body.clientWidth;
let pageHeight = document.body.clientHeight;
let render = Matter.Render.create({
  element: document.body,
  engine: engine,
  options: {
    background: 'transparent',
    width: pageWidth,
    height: 800,
    showAngleIndicator: false,
    wireframes: false
  }
});

let ground = Matter.Bodies.rectangle(pageWidth / 2 - 10, 700, pageWidth + 50, 60, { isStatic: true });

let mouse = Matter.Mouse.create(render.canvas);
let mouseConstraint = Matter.MouseConstraint.create(engine, {
  mouse: mouse,
  constraint: {
    render: {
      visible: false
    }
  }
});
render.mouse = mouse;

let stack = Matter.Composites.stack(pageWidth / 2, 0, 8, 4, 0, 0, function(x, y) {
  return Matter.Bodies.circle(x, y, Math.random() * 50 + 20,
    {
      plugin: {
        wrap: {
          min: {
            x: 0,
          },
          max: {
            x: pageWidth
          }
        }
      }
    });
});

Matter.World.add(engine.world, [stack, ground, mouseConstraint]);
Matter.Render.run(render);
Matter.Runner.run(runner, engine);

// WIND GENERATOR
Matter.Events.on(runner, "beforeUpdate", function(e) {
	// random force to the left (from right edge center, affects torque?)
	let from = Matter.Vector.create(render.options.width, render.options.height/2)
	let force = Matter.Vector.create(Matter.Common.random(0.005, 0), 0)

	// all bodies affected by the wind
	stack.bodies.forEach(function(body) {
		Matter.Body.applyForce(body, from, force)
	})
})