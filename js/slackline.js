let Engine = Matter.Engine,
  Render = Matter.Render,
  Runner = Matter.Runner,
  Body = Matter.Body,
  Composites = Matter.Composites,
  Common = Matter.Common,
  Constraint = Matter.Constraint,
  MouseConstraint = Matter.MouseConstraint,
  Mouse = Matter.Mouse,
  Composite = Matter.Composite,
  Bodies = Matter.Bodies,
  World = Matter.World;

// create engine
let engine = Engine.create();
var runner = Runner.create();
let world = engine.world;
let pageWidth = document.body.clientWidth;

// create renderer
let render = Render.create({
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

// mouse control
let mouse = Matter.Mouse.create(render.canvas);
let mouseConstraint = Matter.MouseConstraint.create(engine, {
  mouse: mouse,
  constraint: {
    render: {
      visible: false
    }
  }
});
// keep the mouse in sync with rendering
render.mouse = mouse;

let bridge = Composites.stack(200, 800, 50, 1, 0, 0, function (x, y) {
  return Bodies.rectangle(x, y, 53, 20, {
    chamfer: 5,
    density: 0.005,
    frictionAir: 0.05,
    render: {
      fillStyle: '#060a19'
    }
  });
});

Composites.chain(bridge, 0.3, 0, -0.3, 0, {
  stiffness: 1,
  length: 0
});

World.add(world, [bridge, ground, mouseConstraint]);
Runner.run(render);
Runner.run(runner, engine);