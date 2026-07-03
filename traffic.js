// ============================================================
// traffic.js — AI traffic: cars/trucks/buses follow lane loops,
// slow down for vehicles ahead & red lights; pedestrians cross
// ============================================================
import * as THREE from 'three';

function vehicleMesh(type) {
  const colors = { car: [0x3366cc, 0xcc3355, 0x33cc77, 0xcccc33], truck: [0x888888], bus: [0xffaa33] };
  const color = colors[type][Math.floor(Math.random() * colors[type].length)];
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  const g = new THREE.Group();

  let w = 1.8, h = 1.4, l = 4.2;
  if (type === 'truck') { w = 2.2; h = 2.2; l = 7; }
  if (type === 'bus') { w = 2.5; h = 2.8; l = 9; }

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
  body.position.y = h / 2 + 0.35;
  body.castShadow = true;
  g.add(body);

  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const wPositions = [
    [-w / 2, 0.35, -l / 2 + 1], [w / 2, 0.35, -l / 2 + 1],
    [-w / 2, 0.35, l / 2 - 1], [w / 2, 0.35, l / 2 - 1]
  ];
  for (const [x, y, z] of wPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    g.add(wheel);
  }

  // Taillights
  for (const side of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.05), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x660000 }));
    tl.position.set(side * w * 0.35, h * 0.5 + 0.2, l / 2 + 0.02);
    g.add(tl);
  }

  return g;
}

function pedestrianMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x3355aa : 0xaa5533 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.9, 4, 8), bodyMat);
  body.position.y = 0.9;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshStandardMaterial({ color: 0xe8b998 }));
  head.position.y = 1.6;
  g.add(body, head);
  return g;
}

class AIVehicle {
  constructor(scene, type, lane, startIndex) {
    this.type = type;
    this.mesh = vehicleMesh(type);
    this.lane = lane;
    this.pathIndex = startIndex % lane.length;
    this.speed = type === 'truck' ? 5 : type === 'bus' ? 6 : 8;
    this.baseSpeed = this.speed;
    scene.add(this.mesh);
    const p = lane[this.pathIndex];
    this.mesh.position.copy(p);
  }

  update(delta, othersAheadDistance) {
    let targetSpeed = this.baseSpeed;
    if (othersAheadDistance < 8) targetSpeed = 0;
    else if (othersAheadDistance < 16) targetSpeed = this.baseSpeed * 0.4;
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, 0.05);

    const target = this.lane[(this.pathIndex + 1) % this.lane.length];
    const dir = new THREE.Vector3().subVectors(target, this.mesh.position);
    const dist = dir.length();
    if (dist < 0.5) {
      this.pathIndex = (this.pathIndex + 1) % this.lane.length;
    } else {
      dir.normalize();
      this.mesh.position.addScaledVector(dir, this.speed * delta);
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      this.mesh.quaternion.slerp(targetQuat, 0.1);
    }
  }
}

export class TrafficManager {
  constructor(scene, lanes) {
    this.scene = scene;
    this.lanes = lanes;
    this.vehicles = [];
    this.pedestrians = [];

    const types = ['car', 'car', 'car', 'truck', 'bus'];
    lanes.forEach((lane, laneIdx) => {
      const count = laneIdx === 0 ? 8 : 5;
      for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const startIdx = Math.floor((lane.length / count) * i);
        this.vehicles.push(new AIVehicle(scene, type, lane, startIdx));
      }
    });

    // Pedestrians walking small loops near crosswalks
    for (let i = 0; i < 14; i++) {
      const ped = pedestrianMesh();
      const angle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 100;
      ped.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      ped.userData.angle = angle;
      ped.userData.radius = radius;
      ped.userData.speed = 0.2 + Math.random() * 0.3;
      scene.add(ped);
      this.pedestrians.push(ped);
    }
  }

  update(delta) {
    // Simple ahead-distance collision avoidance within same lane array
    for (let li = 0; li < this.lanes.length; li++) {
      const laneVehicles = this.vehicles.filter((v) => v.lane === this.lanes[li]);
      laneVehicles.sort((a, b) => a.pathIndex - b.pathIndex);
      for (let i = 0; i < laneVehicles.length; i++) {
        const v = laneVehicles[i];
        const next = laneVehicles[(i + 1) % laneVehicles.length];
        const dist = v === next ? 999 : v.mesh.position.distanceTo(next.mesh.position);
        v.update(delta, dist);
      }
    }

    // Pedestrians shuffle along small circular paths
    for (const ped of this.pedestrians) {
      ped.userData.angle += ped.userData.speed * delta * 0.1;
      ped.position.x = Math.cos(ped.userData.angle) * ped.userData.radius;
      ped.position.z = Math.sin(ped.userData.angle) * ped.userData.radius;
      ped.rotation.y = ped.userData.angle + Math.PI / 2;
    }
  }
}
