// ============================================================
// loading.js — Loading screen controller
// Since all assets are procedurally generated at runtime (no
// binary downloads required), this manager reports progress
// through each generation stage so the loading bar reflects
// real work being done, not a fake timer.
// ============================================================
const TIPS = [
  'Tip: Press H to honk your horn.',
  'Tip: Press L to toggle your headlights at night.',
  'Tip: Use Q and E for turn indicators before turning.',
  'Tip: Press C to cycle between camera views.',
  'Tip: Watch your fuel gauge — running out will strand you!',
  'Tip: Press Space for the hand brake on steep stops.',
  'Tip: Complete routes to earn coins and XP.'
];

export class LoadingManager {
  constructor() {
    this.el = document.getElementById('loadingScreen');
    this.bar = document.getElementById('progressBar');
    this.text = document.getElementById('progressText');
    this.tip = document.getElementById('loadingTip');
    this.stages = [];
    this.tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  }

  // Register named stages with relative weights, run sequentially
  async run(stages) {
    const totalWeight = stages.reduce((s, st) => s + st.weight, 0);
    let done = 0;
    for (const stage of stages) {
      this.text.textContent = `Loading... ${stage.label}`;
      // Yield to the browser so the progress bar can paint before heavy work runs
      await new Promise((r) => requestAnimationFrame(r));
      await stage.fn();
      done += stage.weight;
      const pct = Math.round((done / totalWeight) * 100);
      this.bar.style.width = pct + '%';
      this.text.textContent = `Loading... ${pct}%`;
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  hide() {
    this.el.classList.add('hidden');
  }
}
