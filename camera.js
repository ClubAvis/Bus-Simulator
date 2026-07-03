// ============================================================
// camera.js — Multi-mode camera rig
// Modes: interior | driver | thirdPerson | free (OrbitControls)
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MODES = ['thirdPerson', 'driver', 'interior', 'free'];
const MODE_LABELS = {
  thirdPerson: 'Third Person',
  driver: 'Driver Cam',
  interior: 'Interior Cam',
  free: 'Free Orbit'
};

export class CameraRig {
  constructor(camera, renderer, bus) {
    this.camera = camera;
    this.bus = bus;
    this.modeIndex = 0;

    this.orbit = new OrbitControls(camera, renderer.domElement);
    this.orbit.enabled = false;
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.maxDistance = 120;
    this.orbit.minDistance = 5;

    this._chaseOffset = new THREE.Vector3(0, 3.2, 11);
    this._currentPos = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
  }

  get mode() { return MODES[this.modeIndex]; }
  get modeLabel() { return MODE_LABELS[this.mode]; }

  cycle() {
    this.modeIndex = (this.modeIndex + 1) % MODES.length;
    this.orbit.enabled = this.mode === 'free';
    if (this.orbit.enabled) this.orbit.target.copy(this.bus.mesh.position);
  }

  update(delta) {
    const busPos = this.bus.mesh.position;
    const busQuat = this.bus.mesh.quaternion;

    if (this.mode === 'thirdPerson') {
      const offset = this._chaseOffset.clone().applyQuaternion(busQuat);
      const targetPos = busPos.clone().add(offset);
      this._currentPos.lerp(targetPos, 1 - Math.pow(0.001, delta));
      this.camera.position.copy(this._currentPos);
      this._lookAt.lerp(busPos.clone().add(new THREE.Vector3(0, 1.5, 0)), 0.2);
      this.camera.lookAt(this._lookAt);
    } else if (this.mode === 'driver') {
      const offset = new THREE.Vector3(-0.6, 2.3, -1.2).applyQuaternion(busQuat);
      this.camera.position.copy(busPos.clone().add(offset));
      const lookOffset = new THREE.Vector3(0, 2.0, -20).applyQuaternion(busQuat);
      this.camera.lookAt(busPos.clone().add(lookOffset));
    } else if (this.mode === 'interior') {
      const offset = new THREE.Vector3(0, 2.0, 1.5).applyQuaternion(busQuat);
      this.camera.position.copy(busPos.clone().add(offset));
      const lookOffset = new THREE.Vector3(0, 1.9, -20).applyQuaternion(busQuat);
      this.camera.lookAt(busPos.clone().add(lookOffset));
    } else if (this.mode === 'free') {
      this.orbit.target.lerp(busPos, 0.05);
      this.orbit.update();
    }
  }
}
