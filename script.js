// ============================================================
// script.js — Main entry point
// Wires together rendering, physics, world, player, traffic,
// camera, UI, audio, weather, save system, and the mission loop.
// ============================================================
import * as THREE from 'three';

import { PhysicsWorld } from './js/physics.js';
import { GameWorld } from './js/map.js';
import { Bus } from './js/player.js';
import { InputManager } from './js/controls.js';
import { CameraRig } from './js/camera.js';
import { TrafficManager } from './js/traffic.js';
import { UIManager } from './js/ui.js';
import { AudioManager } from './js/audio.js';
import { WeatherManager } from './js/weather.js';
import { SaveGame } from './js/savegame.js';
import { LoadingManager } from './js/loading.js';

// ---------------------------------------------------------------
// Renderer / Scene / Camera
// ---------------------------------------------------------------
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 5, 15);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.4);
sunLight.position.set(80, 100, 40);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -120;
sunLight.shadow.camera.right = 120;
sunLight.shadow.camera.top = 120;
sunLight.shadow.camera.bottom = -120;
sunLight.shadow.camera.far = 300;
sunLight.shadow.bias = -0.0015;
scene.add(sunLight);
scene.add(sunLight.target);

// ---------------------------------------------------------------
// Core systems (built during loading sequence)
// ---------------------------------------------------------------
const saveGame = new SaveGame();
const ui = new UIManager(saveGame);
const loading = new LoadingManager();
const audio = new AudioManager();

let physics, world, bus, input, cameraRig, traffic, weather;
let missions;
let lastTime = performance.now();
let fpsAccum = 0, fpsFrames = 0, fpsDisplay = 60;
let gameStarted = false;

// ---------------------------------------------------------------
// Mission system
// ---------------------------------------------------------------
class MissionSystem {
  constructor(world, ui, saveGame, audio) {
    this.world = world;
    this.ui = ui;
    this.saveGame = saveGame;
    this.audio = audio;
    this.state = 'toPickup'; // 'toPickup' | 'toDropoff'
    this.pickupStop = null;
    this.dropoffStop = null;
    this.passengerCount = 0;
    this._pickNewRoute();
  }

  _pickNewRoute() {
    const stops = this.world.busStops;
    const a = stops[Math.floor(Math.random() * stops.length)];
    let b = stops[Math.floor(Math.random() * stops.length)];
    while (b.id === a.id) b = stops[Math.floor(Math.random() * stops.length)];
    this.pickupStop = a;
    this.dropoffStop = b;
    this.state = 'toPickup';
    this.passengerCount = 2 + Math.floor(Math.random() * 8);
    this.ui.updateMission(
      `Drive to Bus Stop #${a.id + 1} to pick up ${this.passengerCount} passengers.`,
      'Status: En route to pickup'
    );
  }

  update(busMesh) {
    const targetStop = this.state === 'toPickup' ? this.pickupStop : this.dropoffStop;
    const dist = busMesh.position.distanceTo(targetStop.position);

    if (dist < 6) {
      if (this.state === 'toPickup') {
        this.state = 'toDropoff';
        this.audio.playChime();
        this.ui.notify(`Picked up ${this.passengerCount} passengers!`);
        this.ui.updateMission(
          `Drive to Bus Stop #${this.dropoffStop.id + 1} to drop off passengers.`,
          'Status: Delivering passengers'
        );
      } else {
        const coinsEarned = this.passengerCount * 10;
        const xpEarned = this.passengerCount * 5;
        this.saveGame.addCoins(coinsEarned);
        const leveledUp = this.saveGame.addXp(xpEarned);
        this.saveGame.data.missionsCompleted += 1;
        this.audio.playChime();
        this.ui.notify(`Route complete! +${coinsEarned} coins, +${xpEarned} XP`);
        if (leveledUp) this.ui.notify(`Level up! You are now Level ${this.saveGame.data.level}`);
        this._pickNewRoute();
      }
    } else {
      this.ui.updateMission(
        this.state === 'toPickup'
          ? `Drive to Bus Stop #${this.pickupStop.id + 1} to pick up ${this.passengerCount} passengers.`
          : `Drive to Bus Stop #${this.dropoffStop.id + 1} to drop off passengers.`,
        `Distance: ${Math.round(dist)}m`
      );
    }
  }
}

// ---------------------------------------------------------------
// Boot sequence: build world during loading screen with real
// progress reporting for each generation stage.
// ---------------------------------------------------------------
async function boot() {
  await loading.run([
    { label: 'Physics World', weight: 1, fn: () => { physics = new PhysicsWorld(); } },
    { label: 'City & Terrain', weight: 3, fn: () => { world = new GameWorld(scene, physics); } },
    { label: 'Bus Model', weight: 2, fn: () => {
        const savedPos = saveGame.data.position;
        bus = new Bus(scene, physics, new THREE.Vector3(savedPos.x, 1.5, savedPos.z));
      }
    },
    { label: 'Traffic AI', weight: 2, fn: () => { traffic = new TrafficManager(scene, world.roadLanes); } },
    { label: 'Camera Rig', weight: 1, fn: () => { cameraRig = new CameraRig(camera, renderer, bus); } },
    { label: 'Weather System', weight: 1, fn: () => { weather = new WeatherManager(scene, sunLight, ambientLight, world.sky); } },
    { label: 'Controls', weight: 1, fn: () => { input = new InputManager(); bindInputActions(); } },
    { label: 'Missions', weight: 1, fn: () => { missions = new MissionSystem(world, ui, saveGame, audio); } }
  ]);

  // Apply saved settings
  weather.setTimeOfDay(saveGame.data.settings.timeOfDay);
  weather.setRain(saveGame.data.settings.rain);
  audio.setVolume(saveGame.data.settings.volume);
  ui.el.volumeSlider.value = Math.round(saveGame.data.settings.volume * 100);
  ui.el.rainToggle.checked = saveGame.data.settings.rain;
  ui.el.timeSlider.value = saveGame.data.settings.timeOfDay;
  ui.el.shadowToggle.checked = saveGame.data.settings.shadows;

  loading.hide();
  ui.showMainMenu();
  bindMenuActions();
  requestAnimationFrame(loop);
}

function bindInputActions() {
  input.onHorn = () => { audio.start(); audio.playHorn(); };
  input.onHornRelease = () => audio.stopHorn();
  input.onHeadlights = () => { bus.headlightsOn = !bus.headlightsOn; };
  input.onLeftIndicator = () => {
    bus.leftIndicatorOn = !bus.leftIndicatorOn;
    if (bus.leftIndicatorOn) bus.rightIndicatorOn = false;
    bus.hazardOn = false;
  };
  input.onRightIndicator = () => {
    bus.rightIndicatorOn = !bus.rightIndicatorOn;
    if (bus.rightIndicatorOn) bus.leftIndicatorOn = false;
    bus.hazardOn = false;
  };
  input.onReset = () => { bus.reset(new THREE.Vector3(0, 1.5, 0)); ui.notify('Bus reset to starting position'); };
  input.onCameraSwitch = () => cameraRig.cycle();
  input.onPause = () => setPaused(!ui.paused);
  input.onDoors = () => bus.toggleDoors();
}

function setPaused(state) {
  if (!gameStarted) return;
  ui.togglePause(state);
}

function bindMenuActions() {
  ui.el.btnStart.addEventListener('click', () => {
    saveGame.reset();
    startGame();
  });
  ui.el.btnContinue.addEventListener('click', () => {
    if (saveGame.hasSave()) startGame();
  });

  ui.el.btnResume.addEventListener('click', () => setPaused(false));
  ui.el.btnMainMenu.addEventListener('click', () => {
    setPaused(false);
    gameStarted = false;
    ui.showMainMenu();
  });
  ui.el.btnSave.addEventListener('click', () => {
    saveGame.data.position = { x: bus.mesh.position.x, y: bus.mesh.position.y, z: bus.mesh.position.z };
    saveGame.save();
    ui.notify('Game saved');
  });

  ui.el.volumeSlider.addEventListener('input', (e) => {
    const v = e.target.value / 100;
    audio.setVolume(v);
    saveGame.data.settings.volume = v;
  });
  ui.el.rainToggle.addEventListener('change', (e) => {
    weather.setRain(e.target.checked);
    audio.setRain(e.target.checked);
    saveGame.data.settings.rain = e.target.checked;
  });
  ui.el.shadowToggle.addEventListener('change', (e) => {
    renderer.shadowMap.enabled = e.target.checked;
    saveGame.data.settings.shadows = e.target.checked;
  });
  ui.el.timeSlider.addEventListener('input', (e) => {
    weather.setTimeOfDay(parseFloat(e.target.value));
    saveGame.data.settings.timeOfDay = parseFloat(e.target.value);
  });
}

function startGame() {
  gameStarted = true;
  ui.startGameUI();
  audio.start();
  ui.notify('Welcome! Follow the mission panel to start your route.');

  // Autosave every 30 seconds while playing
  if (!window._autosaveInterval) {
    window._autosaveInterval = setInterval(() => {
      if (gameStarted && bus) {
        saveGame.data.position = { x: bus.mesh.position.x, y: bus.mesh.position.y, z: bus.mesh.position.z };
        saveGame.save();
      }
    }, 30000);
  }
}

// ---------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  fpsAccum += delta; fpsFrames++;
  if (fpsAccum >= 0.5) { fpsDisplay = Math.round(fpsFrames / fpsAccum); fpsAccum = 0; fpsFrames = 0; }

  if (gameStarted && !ui.paused) {
    physics.step(delta);
    bus.update(delta, input.state);
    traffic.update(delta);
    world.update(delta, weather.isNight);
    weather.update(delta);
    cameraRig.update(delta);
    missions.update(bus.mesh);

    audio.updateEngine(bus.rpm, input.state.forward);

    const heading = new THREE.Euler().setFromQuaternion(bus.mesh.quaternion, 'YXZ').y;
    ui.drawMinimap(bus.mesh.position, heading, world.busStops, world.gridCount * world.blockSize * 0.6);
    ui.updateHUD(bus, cameraRig.modeLabel, fpsDisplay);

    // Auto-save position periodically (lightweight — just updates in-memory object)
    saveGame.data.position = { x: bus.mesh.position.x, y: bus.mesh.position.y, z: bus.mesh.position.z };
  }

  renderer.render(scene, camera);
}

boot();
