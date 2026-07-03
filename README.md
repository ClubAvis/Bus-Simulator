# 🚌 BusSimulator

A complete browser-based 3D bus driving simulation inspired by *Bus Simulator Indonesia (BUSSID)* — built with **Three.js**, **Cannon-es** physics, and the **Web Audio API**. No installs, no build step, no backend. Open `index.html` and drive.

---

## ⚠️ A note on assets

This project ships **without binary asset files** (`.glb` models, `.jpg`/`.png` textures, `.mp3` sounds). Those are binary media files that can't be authored as source code, so instead everything is generated **procedurally at runtime**:

- **3D models** (bus, cars, trucks, buildings, trees, traffic lights) are built from Three.js primitive geometry in `js/player.js`, `js/traffic.js`, and `js/map.js`.
- **Textures** (road, grass, buildings) are drawn on an HTML5 `<canvas>` and used as `THREE.CanvasTexture`.
- **Sound** (engine, horn, brakes, rain, wind, birds, pickup chime) is synthesized live with the Web Audio API in `js/audio.js` — oscillators and filtered noise buffers, no audio files.

The `assets/` folder is kept in the project structure as a drop-in slot: if you add real files there (see below), the game can be wired up to use them instead of the procedural versions.

### Swapping in real assets later
- Drop a `bus.glb` into `assets/models/` and load it with `GLTFLoader` inside `Bus._buildMesh()` in `js/player.js`, replacing the procedural group (keep the same local origin/forward axis).
- Drop textures into `assets/textures/` and load with `THREE.TextureLoader` in `js/map.js` in place of the `makeCanvasTexture()` calls.
- Drop `.mp3` files into `assets/sounds/` and load them with `THREE.AudioLoader` or a plain `<audio>` element, wiring them into `AudioManager` in `js/audio.js` in place of the oscillator nodes.

---

## ▶️ Running locally

No build tools, no npm install required. Three.js and Cannon-es load from a CDN via an import map in `index.html`, so you need an internet connection the first time (browser caching handles the rest) and a local static server (ES module imports don't work over `file://` in most browsers).

**Option 1 — Python (built into most systems):**
```bash
cd BusSimulator
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

**Option 2 — Node's `http-server` (if you have Node installed):**
```bash
npx http-server BusSimulator -p 8000
```

**Option 3 — VS Code Live Server extension:** right-click `index.html` → "Open with Live Server".

---

## 🌐 Hosting on GitHub Pages

1. Push this folder to a GitHub repository (the `index.html` should be at the repo root, or in a `/docs` folder).
2. In the repo, go to **Settings → Pages**.
3. Under **Source**, choose the branch (e.g. `main`) and root folder (`/` or `/docs`).
4. Save — GitHub will publish at `https://<your-username>.github.io/<repo-name>/`.
5. No further configuration needed — it's a static site.

---

## 📁 Folder structure

```
BusSimulator/
├── index.html          Entry point: canvas, menus, HUD markup, import map
├── style.css            All UI/HUD/menu styling
├── script.js             Main game loop; wires every system together
├── js/
│   ├── player.js         Bus model, physics body, dashboard state, animations
│   ├── controls.js       Keyboard + touch input mapping
│   ├── physics.js        Cannon-es world setup & helpers
│   ├── camera.js         4 camera modes (interior/driver/third-person/free)
│   ├── traffic.js        AI cars/trucks/buses + pedestrians
│   ├── ui.js             Menus, HUD, minimap, notifications
│   ├── map.js            Procedural city: roads, buildings, trees, river, bridge, mountains, sky
│   ├── audio.js          Web Audio synthesis (engine/horn/brake/rain/wind/birds)
│   ├── weather.js        Day/night cycle, rain particles, fog, clouds
│   ├── savegame.js       LocalStorage save/load
│   └── loading.js        Loading screen with staged progress
├── assets/               Drop-in slot for real .glb/.jpg/.mp3 files (see note above)
└── README.md
```

---

## 🎮 Controls

| Key | Action |
|---|---|
| **W** | Accelerate |
| **S** | Brake / Reverse |
| **A / D** | Steer left / right |
| **Space** | Hand brake |
| **H** | Horn |
| **L** | Headlights |
| **Q** | Left indicator |
| **E** | Right indicator |
| **F** | Open/close doors |
| **R** | Reset bus |
| **C** | Change camera |
| **P / Esc** | Pause |

On touch devices, on-screen gas/brake/steer buttons appear automatically.

---

## 🕹️ Features included

- Procedural open-world city: road grid, buildings, trees, river + bridge, mountains, bus stops, traffic lights, street lights
- Day/night cycle with dynamic sky gradient and sun movement
- Weather: toggleable rain (particles + audio + fog increase), drifting clouds
- Drivable bus with arcade-style suspension-free physics via Cannon-es, animated wheels, steering wheel, doors, headlights, brake lights, indicators, hazards
- Dashboard HUD: speedometer, RPM gauge, fuel gauge, gear indicator, indicator/hazard/headlight/handbrake icons
- 4 camera modes: third-person chase, driver cam, interior cam, free orbit
- AI traffic: cars, trucks, buses following lane loops with basic ahead-distance collision avoidance, plus wandering pedestrians
- Mission system: pickup/drop-off routes between bus stops, coin + XP rewards, leveling
- Minimap with live bus stop markers and heading arrow
- LocalStorage save system: coins, XP, level, position, settings — with Continue on the main menu
- Main menu, settings panel (volume/shadows/rain/time-of-day), controls reference panel, pause menu
- Notification toast system for mission events
- FPS counter, shadow mapping, ACES tone mapping, fog

---

## 🗺️ Adding new maps

The city is generated in `js/map.js` inside `GameWorld`. To customize it:
- Change `gridCount` / `blockSize` in the constructor to resize the city grid.
- Edit `_buildBuildings()` to change building density, height ranges, or colors.
- Edit `_buildBusStopsAndLights()` to reposition or add more bus stops (each pushed into `this.busStops` becomes a valid mission destination automatically).
- Add new lane arrays to `this.roadLanes` (arrays of `THREE.Vector3` waypoints forming a closed loop) to route more AI traffic.
- To load a hand-built map instead, replace the procedural calls with a `GLTFLoader` load of an exported city model, and populate `busStops` / `roadLanes` manually to match its layout.

## 🚍 Adding new buses

The player bus is defined in `js/player.js` inside the `Bus` class:
- `_buildMesh()` builds the visible model — extend or replace this to change the look (or swap in a GLTF model as described in the assets note above).
- `dims` controls the physics collision box size — keep it in sync with your model's footprint.
- To offer multiple selectable buses, create a small registry (e.g. `{ id, name, meshBuilder, stats }`) and pass a variant into `Bus`'s constructor; `SaveGame.data.unlockedBuses` / `currentBus` already exist as storage fields to build a bus-selection menu on top of.

---

Enjoy the drive! 🚌💨
