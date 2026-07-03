// ============================================================
// physics.js — Cannon-es physics world setup and helpers
// ============================================================
import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    // Materials
    this.groundMaterial = new CANNON.Material('ground');
    this.wheelMaterial = new CANNON.Material('wheel');
    this.vehicleMaterial = new CANNON.Material('vehicle');

    const groundVehicleContact = new CANNON.ContactMaterial(
      this.groundMaterial, this.vehicleMaterial,
      { friction: 0.6, restitution: 0.05, contactEquationStiffness: 1e8 }
    );
    this.world.addContactMaterial(groundVehicleContact);

    // Static ground plane (large, matches visual terrain)
    const groundShape = new CANNON.Plane();
    this.groundBody = new CANNON.Body({ mass: 0, material: this.groundMaterial });
    this.groundBody.addShape(groundShape);
    this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(this.groundBody);

    this._fixedTimeStep = 1 / 60;
    this._maxSubSteps = 5;
  }

  step(delta) {
    this.world.step(this._fixedTimeStep, delta, this._maxSubSteps);
  }

  addBody(body) { this.world.addBody(body); }
  removeBody(body) { this.world.removeBody(body); }

  // Create a static box body for buildings / obstacles
  addStaticBox(size, position, quaternionY = 0) {
    const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
    const body = new CANNON.Body({ mass: 0, material: this.groundMaterial });
    body.addShape(shape);
    body.position.set(position.x, position.y, position.z);
    body.quaternion.setFromEuler(0, quaternionY, 0);
    this.world.addBody(body);
    return body;
  }
}
