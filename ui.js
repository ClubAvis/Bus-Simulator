// ============================================================
// ui.js — Menus, HUD, minimap, notifications
// ============================================================
export class UIManager {
  constructor(saveGame) {
    this.saveGame = saveGame;
    this.paused = false;

    this.el = {
      mainMenu: document.getElementById('mainMenu'),
      loadingScreen: document.getElementById('loadingScreen'),
      settingsPanel: document.getElementById('settingsPanel'),
      controlsPanel: document.getElementById('controlsPanel'),
      pauseMenu: document.getElementById('pauseMenu'),
      hud: document.getElementById('hud'),
      touchControls: document.getElementById('touchControls'),

      btnStart: document.getElementById('btnStart'),
      btnContinue: document.getElementById('btnContinue'),
      btnSettings: document.getElementById('btnSettings'),
      btnControls: document.getElementById('btnControls'),
      btnCloseSettings: document.getElementById('btnCloseSettings'),
      btnCloseControls: document.getElementById('btnCloseControls'),
      btnResume: document.getElementById('btnResume'),
      btnSave: document.getElementById('btnSave'),
      btnMainMenu: document.getElementById('btnMainMenu'),

      volumeSlider: document.getElementById('volumeSlider'),
      shadowToggle: document.getElementById('shadowToggle'),
      rainToggle: document.getElementById('rainToggle'),
      timeSlider: document.getElementById('timeSlider'),

      speedValue: document.getElementById('speedValue'),
      rpmValue: document.getElementById('rpmValue'),
      fuelBar: document.getElementById('fuelBar'),
      gearIndicator: document.getElementById('gearIndicator'),
      indLeft: document.getElementById('indLeft'),
      indRight: document.getElementById('indRight'),
      indHazard: document.getElementById('indHazard'),
      indLights: document.getElementById('indLights'),
      indHandbrake: document.getElementById('indHandbrake'),
      coinsVal: document.getElementById('coinsVal'),
      levelVal: document.getElementById('levelVal'),
      xpVal: document.getElementById('xpVal'),
      xpMaxVal: document.getElementById('xpMaxVal'),
      missionText: document.getElementById('missionText'),
      missionProgress: document.getElementById('missionProgress'),
      fpsCounter: document.getElementById('fpsCounter'),
      camHint: document.getElementById('camHint'),
      minimap: document.getElementById('minimap'),
      notifications: document.getElementById('notifications')
    };

    this.minimapCtx = this.el.minimap.getContext('2d');

    if (!this.saveGame.hasSave()) this.el.btnContinue.disabled = true;

    this._bindMenuEvents();
  }

  _bindMenuEvents() {
    this.el.btnSettings.addEventListener('click', () => this.show('settingsPanel'));
    this.el.btnCloseSettings.addEventListener('click', () => this.show('mainMenu'));
    this.el.btnControls.addEventListener('click', () => this.show('controlsPanel'));
    this.el.btnCloseControls.addEventListener('click', () => this.show('mainMenu'));
  }

  show(key) {
    for (const k of ['mainMenu', 'settingsPanel', 'controlsPanel']) {
      this.el[k].classList.toggle('hidden', k !== key);
    }
  }

  hideAllMenus() {
    this.el.mainMenu.classList.add('hidden');
    this.el.settingsPanel.classList.add('hidden');
    this.el.controlsPanel.classList.add('hidden');
    this.el.pauseMenu.classList.add('hidden');
  }

  showMainMenu() {
    this.el.loadingScreen.classList.add('hidden');
    this.hideAllMenus();
    this.el.mainMenu.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
  }

  startGameUI() {
    this.hideAllMenus();
    this.el.hud.classList.remove('hidden');
    this.el.touchControls.classList.remove('hidden');
  }

  togglePause(forceState) {
    this.paused = forceState !== undefined ? forceState : !this.paused;
    this.el.pauseMenu.classList.toggle('hidden', !this.paused);
    return this.paused;
  }

  notify(message) {
    const div = document.createElement('div');
    div.className = 'notif';
    div.textContent = message;
    this.el.notifications.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }

  updateHUD(bus, cameraLabel, fps) {
    this.el.speedValue.textContent = Math.round(bus.speedKmh);
    this.el.rpmValue.textContent = (bus.rpm / 1000).toFixed(1);
    this.el.fuelBar.style.width = bus.fuel + '%';
    this.el.gearIndicator.textContent = bus.gear;

    this.el.indLeft.classList.toggle('active', bus.leftIndicatorOn || bus.hazardOn);
    this.el.indRight.classList.toggle('active', bus.rightIndicatorOn || bus.hazardOn);
    this.el.indHazard.classList.toggle('active', bus.hazardOn);
    this.el.indLights.classList.toggle('active', bus.headlightsOn);
    this.el.indHandbrake.classList.toggle('active', bus.handbrakeOn);

    this.el.coinsVal.textContent = this.saveGame.data.coins;
    this.el.levelVal.textContent = this.saveGame.data.level;
    this.el.xpVal.textContent = this.saveGame.data.xp;
    this.el.xpMaxVal.textContent = this.saveGame.data.xpToNext;

    this.el.camHint.textContent = `Camera: ${cameraLabel} (C to change)`;
    this.el.fpsCounter.textContent = `${fps} FPS`;
  }

  updateMission(text, progress) {
    this.el.missionText.textContent = text;
    this.el.missionProgress.textContent = progress || '';
  }

  drawMinimap(busPos, busHeadingRad, busStops, worldHalfExtent) {
    const ctx = this.minimapCtx;
    const size = this.el.minimap.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#16241a';
    ctx.fillRect(0, 0, size, size);

    const scale = size / (worldHalfExtent * 2.4);
    const cx = size / 2;
    const cy = size / 2;

    // Roads (simple crosshair grid representation)
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, cy + i * 20);
      ctx.lineTo(size, cy + i * 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + i * 20, 0);
      ctx.lineTo(cx + i * 20, size);
      ctx.stroke();
    }

    // Bus stops
    ctx.fillStyle = '#4fc3f7';
    for (const stop of busStops) {
      const dx = (stop.position.x - busPos.x) * scale;
      const dz = (stop.position.z - busPos.z) * scale;
      const sx = cx + dx, sz = cy + dz;
      if (sx > 0 && sx < size && sz > 0 && sz < size) {
        ctx.beginPath();
        ctx.arc(sx, sz, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player arrow (always centered, rotates with heading)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(busHeadingRad);
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
