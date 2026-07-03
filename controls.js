// ============================================================
// controls.js — Keyboard & touch input manager
// W/S/A/D drive, Space handbrake, H horn, L headlights,
// Q/E indicators, R reset, C camera, P pause
// ============================================================
export class InputManager {
  constructor() {
    this.state = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      brake: false,
      handbrake: false
    };

    // One-shot action callbacks registered by script.js
    this.onHorn = null;
    this.onHornRelease = null;
    this.onHeadlights = null;
    this.onLeftIndicator = null;
    this.onRightIndicator = null;
    this.onReset = null;
    this.onCameraSwitch = null;
    this.onPause = null;
    this.onDoors = null;

    this._bindKeyboard();
    this._bindTouch();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => this._handleKey(e.code, true));
    window.addEventListener('keyup', (e) => this._handleKey(e.code, false));
  }

  _handleKey(code, isDown) {
    switch (code) {
      case 'KeyW': case 'ArrowUp': this.state.forward = isDown; break;
      case 'KeyS': case 'ArrowDown': this.state.backward = isDown; this.state.brake = isDown; break;
      case 'KeyA': case 'ArrowLeft': this.state.left = isDown; break;
      case 'KeyD': case 'ArrowRight': this.state.right = isDown; break;
      case 'Space': this.state.handbrake = isDown; break;
      case 'KeyH': if (isDown && this.onHorn) this.onHorn(); if (!isDown && this.onHornRelease) this.onHornRelease(); break;
      case 'KeyL': if (isDown && this.onHeadlights) this.onHeadlights(); break;
      case 'KeyQ': if (isDown && this.onLeftIndicator) this.onLeftIndicator(); break;
      case 'KeyE': if (isDown && this.onRightIndicator) this.onRightIndicator(); break;
      case 'KeyR': if (isDown && this.onReset) this.onReset(); break;
      case 'KeyC': if (isDown && this.onCameraSwitch) this.onCameraSwitch(); break;
      case 'KeyP': case 'Escape': if (isDown && this.onPause) this.onPause(); break;
      case 'KeyF': if (isDown && this.onDoors) this.onDoors(); break;
    }
  }

  _bindTouch() {
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const set = (v) => (e) => { e.preventDefault(); this.state[key] = v; };
      el.addEventListener('touchstart', set(true));
      el.addEventListener('touchend', set(false));
      el.addEventListener('mousedown', set(true));
      el.addEventListener('mouseup', set(false));
    };
    bind('touchGas', 'forward');
    bind('touchBrake', 'brake');
    bind('touchLeft', 'left');
    bind('touchRight', 'right');
  }
}
