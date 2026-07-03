// ============================================================
// weather.js — Day/night cycle, rain particles, fog, clouds
// ============================================================
import * as THREE from 'three';

export class WeatherManager {
  constructor(scene, sunLight, ambientLight, sky) {
    this.scene = scene;
    this.sunLight = sunLight;
    this.ambientLight = ambientLight;
    this.sky = sky;

    this.timeOfDay = 9; // hours, 0-24
    this.timeSpeed = 0.02; // in-game hours per real second (very slow by default)
    this.rainEnabled = false;
    this.isNight = false;

    this._buildRain();
    this._buildClouds();
    this.scene.fog = new THREE.FogExp2(0xbfd9ff, 0.0025);
    this._baseFogDensity = 0.0025;
  }

  _buildRain() {
    const count = 4000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 300;
      positions[i * 3 + 1] = Math.random() * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 300;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.2, transparent: true, opacity: 0 });
    this.rain = new THREE.Points(geo, mat);
    this.scene.add(this.rain);
    this._rainVelocities = new Float32Array(count).fill(0).map(() => 25 + Math.random() * 15);
  }

  _buildClouds() {
    this.cloudGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1 });
    for (let i = 0; i < 20; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffs; p++) {
        const geo = new THREE.SphereGeometry(4 + Math.random() * 3, 8, 8);
        const puff = new THREE.Mesh(geo, mat);
        puff.position.set((Math.random() - 0.5) * 10, Math.random() * 2, (Math.random() - 0.5) * 6);
        cloud.add(puff);
      }
      cloud.position.set((Math.random() - 0.5) * 500, 70 + Math.random() * 30, (Math.random() - 0.5) * 500);
      cloud.userData.speed = 0.5 + Math.random() * 0.5;
      this.cloudGroup.add(cloud);
    }
    this.scene.add(this.cloudGroup);
  }

  setRain(enabled) {
    this.rainEnabled = enabled;
    this.rain.material.opacity = enabled ? 0.6 : 0;
    this.scene.fog.density = enabled ? this._baseFogDensity * 3 : this._baseFogDensity;
  }

  setTimeOfDay(hours) {
    this.timeOfDay = ((hours % 24) + 24) % 24;
  }

  update(delta, autoAdvance = true) {
    if (autoAdvance) this.timeOfDay = (this.timeOfDay + this.timeSpeed * delta * 6) % 24;

    // Sun angle: 6am = sunrise (horizon), 12pm = noon (overhead), 18pm = sunset, night otherwise
    const angle = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const sunHeight = Math.sin(angle);
    this.sunLight.position.set(Math.cos(angle) * 100, Math.max(sunHeight, -0.1) * 100, 40);
    this.sunLight.intensity = THREE.MathUtils.clamp(sunHeight * 1.6, 0.05, 1.6);

    this.isNight = sunHeight < 0.05;
    this.ambientLight.intensity = this.isNight ? 0.15 : THREE.MathUtils.clamp(0.35 + sunHeight * 0.3, 0.15, 0.65);

    // Sky color shift
    const dayTop = new THREE.Color(0x4a90d9);
    const dayBottom = new THREE.Color(0xcfe8ff);
    const nightTop = new THREE.Color(0x040814);
    const nightBottom = new THREE.Color(0x0d1830);
    const t = THREE.MathUtils.clamp((sunHeight + 0.2) / 0.6, 0, 1);
    this.sky.material.uniforms.topColor.value.lerpColors(nightTop, dayTop, t);
    this.sky.material.uniforms.bottomColor.value.lerpColors(nightBottom, dayBottom, t);

    // Rain animation
    if (this.rainEnabled) {
      const pos = this.rain.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - this._rainVelocities[i] * delta;
        if (y < 0) y = 100;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    // Cloud drift
    for (const cloud of this.cloudGroup.children) {
      cloud.position.x += cloud.userData.speed * delta;
      if (cloud.position.x > 300) cloud.position.x = -300;
    }
  }
}
