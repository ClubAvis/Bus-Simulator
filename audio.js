// ============================================================
// audio.js — Web Audio API sound synthesis (no external mp3
// files needed). Engine pitch follows RPM, horn/brake are
// short synthesized bursts, rain/wind/birds are ambient loops.
// ============================================================
export class AudioManager {
  constructor() {
    this.ctx = null; // created lazily on first user gesture (autoplay policies)
    this.masterGain = null;
    this.volume = 0.6;
    this.engineOsc = null;
    this.engineGain = null;
    this.rainNode = null;
    this.rainGain = null;
    this.windGain = null;
    this._started = false;
  }

  start() {
    if (this._started) return;
    this._started = true;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    this._buildEngine();
    this._buildRain();
    this._buildWind();
    this._buildBirds();
  }

  setVolume(v) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  _buildEngine() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    osc.connect(filter).connect(gain).connect(this.masterGain);
    osc.start();
    this.engineOsc = osc;
    this.engineGain = gain;
  }

  updateEngine(rpm, throttleActive) {
    if (!this.engineOsc) return;
    const freq = 40 + (rpm / 6000) * 140;
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(throttleActive ? 0.09 : 0.04, this.ctx.currentTime, 0.15);
  }

  _noiseBuffer(duration = 2) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _buildRain() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2);
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.masterGain);
    src.start();
    this.rainNode = src;
    this.rainGain = gain;
  }

  setRain(active) {
    if (!this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(active ? 0.12 : 0, this.ctx.currentTime, 0.5);
  }

  _buildWind() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(3);
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.6;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.02;
    src.connect(filter).connect(gain).connect(this.masterGain);
    src.start();
    this.windGain = gain;
  }

  _buildBirds() {
    // Occasional chirps via short oscillator bursts, scheduled randomly
    this.birdsEnabled = true;
    const chirp = () => {
      if (!this.birdsEnabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 2200 + Math.random() * 800;
      gain.gain.value = 0;
      osc.connect(gain).connect(this.masterGain);
      const t = this.ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.03, t + 0.05);
      gain.gain.linearRampToValueAtTime(0, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.2);
      setTimeout(chirp, 2000 + Math.random() * 4000);
    };
    setTimeout(chirp, 3000);
  }

  playHorn() {
    if (!this.ctx) return;
    this._hornOsc = this.ctx.createOscillator();
    this._hornGain = this.ctx.createGain();
    this._hornOsc.type = 'square';
    this._hornOsc.frequency.value = 220;
    this._hornGain.gain.value = 0.15;
    this._hornOsc.connect(this._hornGain).connect(this.masterGain);
    this._hornOsc.start();
  }

  stopHorn() {
    if (this._hornOsc) {
      this._hornOsc.stop();
      this._hornOsc.disconnect();
      this._hornOsc = null;
    }
  }

  playBrakeScreech() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.4);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500;
    filter.Q.value = 8;
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(filter).connect(gain).connect(this.masterGain);
    src.start();
  }

  playChime() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.001;
    osc.connect(gain).connect(this.masterGain);
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1320, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.6);
  }
}
