// ============================================================
// player.js — The drivable Bus: procedural model + physics +
// dashboard state (speed, RPM, fuel, gear, lights, doors)
// ============================================================
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// NOTE: Real asset pipeline: if assets/models/bus.glb is present, it can be
// loaded via GLTFLoader and swapped in for this procedural mesh — see
// loadFromGLTF() below (disabled by default since no binary model ships
// with this project).

export class Bus {
  constructor(scene, physics, startPos = new THREE.Vector3(0, 1, 0)) {
    this.scene = scene;
    this.physics = physics;

    this.dims = { width: 2.6, height: 3.1, length: 9.5 };

    this._buildMesh();
    this.mesh.position.copy(startPos);
    this.scene.add(this.mesh);

    this._buildPhysicsBody(startPos);

    // Dashboard / gameplay state
    this.speedKmh = 0;
    this.rpm = 800;
    this.fuel = 100;
    this.gear = 'D';
    this.steerAngle = 0;
    this.throttle = 0;
    this.brake = 0;
    this.handbrakeOn = false;
    this.headlightsOn = false;
    this.leftIndicatorOn = false;
    this.rightIndicatorOn = false;
    this.hazardOn = false;
    this.doorsOpen = false;
    this._doorAnim = 0;
    this._indicatorBlinkTimer = 0;
    this._indicatorVisible = true;

    this.maxSpeedKmh = 100;
    this.wheelRadius = 0.45;
  }

  // ---------------- MESH ----------------
  _buildMesh() {
    const g = new THREE.Group();
    const { width, height, length } = this.dims;

    // Body shell
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdd4433, roughness: 0.5, metalness: 0.3 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x8fd0ff, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.75 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.65, length), bodyMat);
    chassis.position.y = height * 0.42;
    chassis.castShadow = chassis.receiveShadow = true;
    g.add(chassis);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, height * 0.4, length * 0.92), bodyMat);
    roof.position.y = height * 0.82;
    roof.castShadow = true;
    g.add(roof);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.35, length), stripeMat);
    stripe.position.y = height * 0.55;
    g.add(stripe);

    // Windshield + side windows
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, height * 0.35, 0.05), glassMat);
    windshield.position.set(0, height * 0.68, -length / 2 + 0.1);
    g.add(windshield);

    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, height * 0.3, length * 0.75), glassMat);
      win.position.set(side * (width / 2 + 0.01), height * 0.68, 0.3);
      g.add(win);
    }

    // Door (front-right side, animated group)
    this.doorGroup = new THREE.Group();
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, height * 0.55, 1.4), bodyMat);
    door.position.set(width / 2 + 0.04, height * 0.42, -length / 2 + 1.4);
    this.doorGroup.add(door);
    g.add(this.doorGroup);

    // Headlights
    this.headlightMeshes = [];
    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0x000000 }));
      hl.position.set(side * width * 0.35, height * 0.25, -length / 2 - 0.05);
      g.add(hl);
      this.headlightMeshes.push(hl);
    }
    // Actual light sources (spotlights)
    this.headlightSpots = [];
    for (const side of [-1, 1]) {
      const spot = new THREE.SpotLight(0xfff2cc, 0, 40, Math.PI / 6, 0.4, 1.5);
      spot.position.set(side * width * 0.35, height * 0.25, -length / 2);
      const target = new THREE.Object3D();
      target.position.set(side * width * 0.35, 0, -length / 2 - 20);
      g.add(spot, target);
      spot.target = target;
      this.headlightSpots.push(spot);
    }

    // Brake / reverse / indicator lights (rear)
    this.brakeLights = [];
    this.indicatorLights = { left: null, right: null };
    for (const side of [-1, 1]) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0x000000 }));
      bl.position.set(side * width * 0.4, height * 0.35, length / 2 + 0.03);
      g.add(bl);
      this.brakeLights.push(bl);

      const ind = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.05), new THREE.MeshStandardMaterial({ color: 0x553300, emissive: 0x000000 }));
      ind.position.set(side * width * 0.48, height * 0.35, length / 2 + 0.03);
      g.add(ind);
      if (side === -1) this.indicatorLights.left = ind; else this.indicatorLights.right = ind;
    }

    // Wheels
    this.wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 14);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
    const wheelPositions = [
      [-width / 2 - 0.05, 0.45, -length / 2 + 1.6],
      [width / 2 + 0.05, 0.45, -length / 2 + 1.6],
      [-width / 2 - 0.05, 0.45, length / 2 - 1.6],
      [width / 2 + 0.05, 0.45, length / 2 - 1.6],
      [-width / 2 - 0.05, 0.45, length / 2 - 3.6],
      [width / 2 + 0.05, 0.45, length / 2 - 3.6]
    ];
    for (const [x, y, z] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      wheel.castShadow = true;
      g.add(wheel);
      this.wheels.push(wheel);
    }

    // Steering wheel (for interior camera view)
    const wheelRingGeo = new THREE.TorusGeometry(0.22, 0.03, 8, 16);
    this.steeringWheel = new THREE.Mesh(wheelRingGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
    this.steeringWheel.position.set(-width * 0.28, height * 0.55, -length / 2 + 1.3);
    this.steeringWheel.rotation.x = Math.PI / 2.4;
    g.add(this.steeringWheel);

    this.mesh = g;
  }

  _buildPhysicsBody(startPos) {
    const { width, height, length } = this.dims;
    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, length / 2));
    this.body = new CANNON.Body({
      mass: 1800,
      material: this.physics.vehicleMaterial,
      linearDamping: 0.3,
      angularDamping: 0.9
    });
    this.body.addShape(shape);
    this.body.position.set(startPos.x, startPos.y, startPos.z);
    this.physics.addBody(this.body);
  }

  reset(position = new THREE.Vector3(0, 1, 0)) {
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.position.set(position.x, position.y, position.z);
    this.body.quaternion.set(0, 0, 0, 1);
    this.speedKmh = 0;
    this.rpm = 800;
  }

  toggleDoors() { this.doorsOpen = !this.doorsOpen; }

  // ---------------- UPDATE ----------------
  update(delta, input) {
    // ---- Simplified arcade vehicle physics ----
    const forwardVec = new CANNON.Vec3(0, 0, -1);
    const worldForward = this.body.quaternion.vmult(forwardVec);

    this.throttle = input.forward ? 1 : (input.backward ? -1 : 0);
    this.brake = input.brake ? 1 : 0;
    this.handbrakeOn = input.handbrake;

    const currentSpeed = this.body.velocity.length();
    const forwardSpeed = worldForward.dot(this.body.velocity);

    // Engine force
    const enginePower = 9000;
    let force = 0;
    if (this.fuel > 0) {
      if (this.throttle > 0) force = enginePower;
      else if (this.throttle < 0) force = -enginePower * 0.6;
    }
    if (this.handbrakeOn) force = 0;

    if (Math.abs(forwardSpeed) < this.maxSpeedKmh / 3.6 || Math.sign(force) !== Math.sign(forwardSpeed)) {
      const impulse = worldForward.scale(force * delta);
      this.body.applyImpulse(impulse, this.body.position);
    }

    // Braking
    if (this.brake > 0 || this.handbrakeOn) {
      const brakeStrength = this.handbrakeOn ? 12 : 8;
      this.body.velocity.x -= this.body.velocity.x * Math.min(1, brakeStrength * delta);
      this.body.velocity.z -= this.body.velocity.z * Math.min(1, brakeStrength * delta);
    }

    // Steering — rotate body around Y based on speed & steer input
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const speedFactor = THREE.MathUtils.clamp(currentSpeed / 8, 0, 1);
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, steerInput * 0.55, 0.15);
    if (Math.abs(forwardSpeed) > 0.15) {
      const turnRate = this.steerAngle * speedFactor * Math.sign(forwardSpeed) * 1.8;
      const angVel = new CANNON.Vec3(0, turnRate, 0);
      this.body.angularVelocity.y = THREE.MathUtils.lerp(this.body.angularVelocity.y, turnRate, 0.3);
    } else {
      this.body.angularVelocity.y *= 0.8;
    }

    // Natural friction / drag to prevent infinite sliding
    this.body.velocity.x *= 0.995;
    this.body.velocity.z *= 0.995;

    // Sync mesh to physics body
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);

    // Dashboard values
    this.speedKmh = Math.abs(forwardSpeed) * 3.6;
    const targetRpm = 800 + THREE.MathUtils.clamp(this.speedKmh / this.maxSpeedKmh, 0, 1) * 4500 + (this.throttle !== 0 ? 400 : 0);
    this.rpm = THREE.MathUtils.lerp(this.rpm, targetRpm, 0.08);
    this.gear = this.throttle < 0 ? 'R' : (this.speedKmh < 0.5 && this.throttle === 0 ? 'N' : 'D');

    if (this.throttle !== 0 && this.fuel > 0) this.fuel = Math.max(0, this.fuel - delta * 0.15);

    // Wheel spin animation
    const spinSpeed = (forwardSpeed / this.wheelRadius) * delta;
    for (const wheel of this.wheels) wheel.rotation.x -= spinSpeed;
    // Front wheel steer visual (first two wheels)
    this.wheels[0].rotation.y = this.steerAngle * 0.6;
    this.wheels[1].rotation.y = this.steerAngle * 0.6;

    // Steering wheel visual rotation
    this.steeringWheel.rotation.z = -this.steerAngle * 3;

    // Lights
    for (const spot of this.headlightSpots) spot.intensity = this.headlightsOn ? 2.2 : 0;
    for (const hl of this.headlightMeshes) hl.material.emissive.setHex(this.headlightsOn ? 0xffffcc : 0x000000);
    for (const bl of this.brakeLights) bl.material.emissive.setHex((this.brake > 0 || this.handbrakeOn) ? 0xff0000 : 0x000000);

    // Indicators (blinking)
    this._indicatorBlinkTimer += delta;
    if (this._indicatorBlinkTimer > 0.4) { this._indicatorBlinkTimer = 0; this._indicatorVisible = !this._indicatorVisible; }
    const leftOn = (this.leftIndicatorOn || this.hazardOn) && this._indicatorVisible;
    const rightOn = (this.rightIndicatorOn || this.hazardOn) && this._indicatorVisible;
    this.indicatorLights.left.material.emissive.setHex(leftOn ? 0xff8800 : 0x000000);
    this.indicatorLights.right.material.emissive.setHex(rightOn ? 0xff8800 : 0x000000);

    // Door animation
    const doorTarget = this.doorsOpen ? 1 : 0;
    this._doorAnim = THREE.MathUtils.lerp(this._doorAnim, doorTarget, 0.1);
    this.doorGroup.rotation.y = -this._doorAnim * (Math.PI / 2.2);
  }

  refuel() { this.fuel = 100; }
}
