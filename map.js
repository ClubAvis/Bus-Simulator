// ============================================================
// map.js — Procedural open-world city: roads, buildings, trees,
// river, bridge, mountains, skybox, bus stops, traffic lights
// ============================================================
import * as THREE from 'three';

// ---- Procedural texture helpers (canvas-generated, no image files needed) ----
function makeCanvasTexture(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function grassTexture() {
  return makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = '#3a7d3f';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#4a9450' : '#2f6a35';
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
}

function roadTexture() {
  return makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = '#3b3b3f';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#f4d35e';
    ctx.fillRect(s / 2 - 4, 0, 8, s * 0.4);
    ctx.fillRect(s / 2 - 4, s * 0.6, 8, s * 0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(6, 0, 4, s);
    ctx.fillRect(s - 10, 0, 4, s);
  });
}

function buildingTexture(baseColor) {
  return makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(255,255,200,0.65)';
    for (let y = 10; y < s; y += 22) {
      for (let x = 10; x < s; x += 18) {
        if (Math.random() > 0.4) ctx.fillRect(x, y, 8, 10);
      }
    }
  }, 128);
}

export class GameWorld {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.roadWidth = 12;
    this.blockSize = 60;
    this.gridCount = 6; // 6x6 city blocks
    this.busStops = [];
    this.trafficLights = [];
    this.roadLanes = []; // array of {points:[Vector3,...]} loops for traffic AI
    this.streetLights = [];

    this._buildSky();
    this._buildGround();
    this._buildRoadGrid();
    this._buildRiverAndBridge();
    this._buildBuildings();
    this._buildTrees();
    this._buildBusStopsAndLights();
    this._buildMountainsBorder();
  }

  // ---------------- SKY ----------------
  _buildSky() {
    const skyGeo = new THREE.SphereGeometry(900, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x4a90d9) },
        bottomColor: { value: new THREE.Color(0xcfe8ff) },
        offset: { value: 20 },
        exponent: { value: 0.7 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }`,
      side: THREE.BackSide
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
  }

  // ---------------- GROUND ----------------
  _buildGround() {
    const size = this.gridCount * this.blockSize + 200;
    const tex = grassTexture();
    tex.repeat.set(size / 8, size / 8);
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  // ---------------- ROAD GRID ----------------
  _buildRoadGrid() {
    const tex = roadTexture();
    const half = (this.gridCount * this.blockSize) / 2;
    this.roadGroup = new THREE.Group();

    // Horizontal & vertical road strips forming a grid
    for (let i = 0; i <= this.gridCount; i++) {
      const pos = -half + i * this.blockSize;

      // Horizontal road (runs along X)
      const hGeo = new THREE.PlaneGeometry(this.gridCount * this.blockSize + this.roadWidth, this.roadWidth);
      const hTex = tex.clone(); hTex.needsUpdate = true;
      hTex.repeat.set((this.gridCount * this.blockSize) / 10, 1);
      const hMat = new THREE.MeshStandardMaterial({ map: hTex, roughness: 0.9 });
      const hRoad = new THREE.Mesh(hGeo, hMat);
      hRoad.rotation.x = -Math.PI / 2;
      hRoad.position.set(0, 0.02, pos);
      hRoad.receiveShadow = true;
      this.roadGroup.add(hRoad);

      // Vertical road (runs along Z)
      const vGeo = new THREE.PlaneGeometry(this.roadWidth, this.gridCount * this.blockSize + this.roadWidth);
      const vTex = tex.clone(); vTex.needsUpdate = true;
      vTex.repeat.set(1, (this.gridCount * this.blockSize) / 10);
      const vMat = new THREE.MeshStandardMaterial({ map: vTex, roughness: 0.9 });
      const vRoad = new THREE.Mesh(vGeo, vMat);
      vRoad.rotation.x = -Math.PI / 2;
      vRoad.position.set(pos, 0.02, 0);
      vRoad.receiveShadow = true;
      this.roadGroup.add(vRoad);
    }
    this.scene.add(this.roadGroup);

    // Build a loop lane path for traffic AI along the outer ring of the grid
    const loop = [];
    const r = half;
    const steps = 8;
    for (let i = 0; i <= steps; i++) loop.push(new THREE.Vector3(-r + (2 * r * i) / steps, 0.3, -r));
    for (let i = 0; i <= steps; i++) loop.push(new THREE.Vector3(r, 0.3, -r + (2 * r * i) / steps));
    for (let i = 0; i <= steps; i++) loop.push(new THREE.Vector3(r - (2 * r * i) / steps, 0.3, r));
    for (let i = 0; i <= steps; i++) loop.push(new THREE.Vector3(-r, 0.3, r - (2 * r * i) / steps));
    this.roadLanes.push(loop);

    // Inner loop as a secondary lane
    const r2 = half * 0.5;
    const inner = [];
    for (let i = 0; i <= steps; i++) inner.push(new THREE.Vector3(-r2 + (2 * r2 * i) / steps, 0.3, -r2));
    for (let i = 0; i <= steps; i++) inner.push(new THREE.Vector3(r2, 0.3, -r2 + (2 * r2 * i) / steps));
    for (let i = 0; i <= steps; i++) inner.push(new THREE.Vector3(r2 - (2 * r2 * i) / steps, 0.3, r2));
    for (let i = 0; i <= steps; i++) inner.push(new THREE.Vector3(-r2, 0.3, r2 - (2 * r2 * i) / steps));
    this.roadLanes.push(inner);
  }

  // ---------------- RIVER + BRIDGE ----------------
  _buildRiverAndBridge() {
    const half = (this.gridCount * this.blockSize) / 2;
    const riverGeo = new THREE.PlaneGeometry(30, half * 2 + 100);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x2f6fa8, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85
    });
    this.river = new THREE.Mesh(riverGeo, riverMat);
    this.river.rotation.x = -Math.PI / 2;
    this.river.position.set(half + 60, -0.5, 0);
    this.scene.add(this.river);

    // Bridge deck crossing the river at z=0
    const bridgeGeo = new THREE.BoxGeometry(this.roadWidth + 2, 1, 40);
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.8 });
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.position.set(half + 60, 0.5, 0);
    bridge.castShadow = bridge.receiveShadow = true;
    this.scene.add(bridge);
    this.physics.addStaticBox({ x: this.roadWidth + 2, y: 1, z: 40 }, bridge.position);

    // Bridge railings
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 40), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      rail.position.set(half + 60 + side * (this.roadWidth / 2 + 1), 1.5, 0);
      this.scene.add(rail);
    }
  }

  // ---------------- BUILDINGS ----------------
  _buildBuildings() {
    const half = (this.gridCount * this.blockSize) / 2;
    const colors = ['#c8b89a', '#a9c1c9', '#c9a9a9', '#b9c9a9', '#9aa8c8'];
    this.buildingGroup = new THREE.Group();

    for (let bx = 0; bx < this.gridCount; bx++) {
      for (let bz = 0; bz < this.gridCount; bz++) {
        const cx = -half + this.blockSize * bx + this.blockSize / 2;
        const cz = -half + this.blockSize * bz + this.blockSize / 2;
        // Skip a couple of central blocks for a park / plaza
        if (bx === Math.floor(this.gridCount / 2) && bz === Math.floor(this.gridCount / 2)) continue;

        const buildingsInBlock = 1 + Math.floor(Math.random() * 3);
        for (let n = 0; n < buildingsInBlock; n++) {
          const w = 8 + Math.random() * 10;
          const d = 8 + Math.random() * 10;
          const h = 6 + Math.random() * 26;
          const offX = (Math.random() - 0.5) * (this.blockSize - this.roadWidth - w);
          const offZ = (Math.random() - 0.5) * (this.blockSize - this.roadWidth - d);
          const color = colors[Math.floor(Math.random() * colors.length)];

          const geo = new THREE.BoxGeometry(w, h, d);
          const tex = buildingTexture(color);
          tex.repeat.set(2, Math.ceil(h / 4));
          const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(cx + offX, h / 2, cz + offZ);
          mesh.castShadow = mesh.receiveShadow = true;
          this.buildingGroup.add(mesh);

          this.physics.addStaticBox({ x: w, y: h, z: d }, mesh.position);
        }
      }
    }
    this.scene.add(this.buildingGroup);
  }

  // ---------------- TREES ----------------
  _buildTrees() {
    const half = (this.gridCount * this.blockSize) / 2;
    this.treeGroup = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f });
    const leafGeo = new THREE.ConeGeometry(1.8, 3.5, 8);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3a });

    for (let i = 0; i < 160; i++) {
      const x = (Math.random() - 0.5) * (half * 2 + 60);
      const z = (Math.random() - 0.5) * (half * 2 + 60);
      // avoid roads: skip points near grid lines
      const distToRoadX = Math.min(...Array.from({ length: this.gridCount + 1 }, (_, i2) => Math.abs(x - (-half + i2 * this.blockSize))));
      const distToRoadZ = Math.min(...Array.from({ length: this.gridCount + 1 }, (_, i2) => Math.abs(z - (-half + i2 * this.blockSize))));
      if (distToRoadX < this.roadWidth || distToRoadZ < this.roadWidth) continue;

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.1;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = 3.2;
      trunk.castShadow = leaf.castShadow = true;
      tree.add(trunk, leaf);
      tree.position.set(x, 0, z);
      tree.scale.setScalar(0.8 + Math.random() * 0.6);
      this.treeGroup.add(tree);
    }
    this.scene.add(this.treeGroup);
  }

  // ---------------- BUS STOPS + TRAFFIC LIGHTS + STREET LIGHTS ----------------
  _buildBusStopsAndLights() {
    const half = (this.gridCount * this.blockSize) / 2;
    this.busStopGroup = new THREE.Group();
    this.trafficLightGroup = new THREE.Group();

    // Bus stops at a handful of intersections
    const stopPositions = [
      new THREE.Vector3(-half + this.blockSize, 0, -half + this.roadWidth / 2 + 1),
      new THREE.Vector3(half - this.blockSize, 0, half - this.roadWidth / 2 - 1),
      new THREE.Vector3(-half + this.roadWidth / 2 + 1, 0, half - this.blockSize),
      new THREE.Vector3(half - this.roadWidth / 2 - 1, 0, -half + this.blockSize)
    ];
    stopPositions.forEach((pos, i) => {
      const sign = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
      pole.position.y = 1.25;
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: 0x2255cc }));
      board.position.y = 2.2;
      const shelter = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.2), new THREE.MeshStandardMaterial({ color: 0xaaaaaa }));
      shelter.position.set(0, 2.4, 0.8);
      sign.add(pole, board, shelter);
      sign.position.copy(pos);
      sign.userData.isBusStop = true;
      sign.userData.stopId = i;
      this.busStopGroup.add(sign);
      this.busStops.push({ id: i, position: pos.clone().add(new THREE.Vector3(0, 0, 0)) });
    });
    this.scene.add(this.busStopGroup);

    // Traffic lights at a few key intersections
    const lightIntersections = [
      new THREE.Vector3(-half + this.blockSize, 0, -half + this.blockSize),
      new THREE.Vector3(half - this.blockSize, 0, half - this.blockSize),
      new THREE.Vector3(0, 0, 0)
    ];
    lightIntersections.forEach((pos) => {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
      pole.position.y = 2;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      box.position.y = 4.2;
      const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 }));
      redLight.position.set(0, 4.55, 0.25);
      const yellowLight = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0x442200, emissive: 0x000000 }));
      yellowLight.position.set(0, 4.2, 0.25);
      const greenLight = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0x004400, emissive: 0x000000 }));
      greenLight.position.set(0, 3.85, 0.25);
      group.add(pole, box, redLight, yellowLight, greenLight);
      group.position.copy(pos).add(new THREE.Vector3(this.roadWidth / 2 + 0.5, 0, this.roadWidth / 2 + 0.5));
      this.trafficLightGroup.add(group);
      this.trafficLights.push({ group, red: redLight, yellow: yellowLight, green: greenLight, state: 'green', timer: Math.random() * 5 });
    });
    this.scene.add(this.trafficLightGroup);

    // Street lights lining a couple of main roads
    this.streetLightGroup = new THREE.Group();
    for (let i = -half; i <= half; i += 20) {
      const pole = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), new THREE.MeshStandardMaterial({ color: 0x444444 }));
      post.position.y = 2.5;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xfff0c0, emissiveIntensity: 0 }));
      lamp.position.y = 5;
      pole.add(post, lamp);
      pole.position.set(i, 0, this.roadWidth / 2 + 2);
      pole.userData.lamp = lamp;
      this.streetLightGroup.add(pole);
      this.streetLights.push(lamp);
    }
    this.scene.add(this.streetLightGroup);
  }

  // ---------------- MOUNTAIN BORDER ----------------
  _buildMountainsBorder() {
    this.mountainGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b7a8c, roughness: 1 });
    const ringRadius = this.gridCount * this.blockSize * 0.85;
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const dist = ringRadius + Math.random() * 60;
      const h = 30 + Math.random() * 60;
      const geo = new THREE.ConeGeometry(20 + Math.random() * 15, h, 5);
      const mountain = new THREE.Mesh(geo, mat);
      mountain.position.set(Math.cos(angle) * dist, h / 2 - 3, Math.sin(angle) * dist);
      mountain.rotation.y = Math.random() * Math.PI;
      this.mountainGroup.add(mountain);
    }
    this.scene.add(this.mountainGroup);
  }

  // ---------------- UPDATE (traffic lights, street lamps) ----------------
  update(delta, isNight) {
    for (const tl of this.trafficLights) {
      tl.timer -= delta;
      if (tl.timer <= 0) {
        if (tl.state === 'green') { tl.state = 'yellow'; tl.timer = 2; }
        else if (tl.state === 'yellow') { tl.state = 'red'; tl.timer = 5; }
        else { tl.state = 'green'; tl.timer = 6; }
      }
      tl.red.material.emissiveIntensity = tl.state === 'red' ? 1 : 0.05;
      tl.yellow.material.emissiveIntensity = tl.state === 'yellow' ? 1 : 0.05;
      tl.green.material.emissiveIntensity = tl.state === 'green' ? 1 : 0.05;
    }
    for (const lamp of this.streetLights) {
      lamp.material.emissiveIntensity = isNight ? 1.2 : 0;
    }
  }
}
