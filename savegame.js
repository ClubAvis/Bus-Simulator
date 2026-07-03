// ============================================================
// savegame.js — LocalStorage persistence layer
// Saves: coins, xp, level, unlocked buses, settings, position
// ============================================================
const STORAGE_KEY = 'bussimulator_save_v1';

const DEFAULT_SAVE = {
  coins: 0,
  xp: 0,
  level: 1,
  xpToNext: 100,
  unlockedBuses: ['classic_red'],
  currentBus: 'classic_red',
  settings: { volume: 0.6, shadows: true, rain: false, timeOfDay: 9 },
  position: { x: 0, y: 1, z: 0 },
  missionsCompleted: 0
};

export class SaveGame {
  constructor() {
    this.data = this.load() || JSON.parse(JSON.stringify(DEFAULT_SAVE));
  }

  hasSave() {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return { ...JSON.parse(JSON.stringify(DEFAULT_SAVE)), ...JSON.parse(raw) };
    } catch (e) {
      console.warn('SaveGame: failed to load save data', e);
      return null;
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.warn('SaveGame: failed to write save data', e);
      return false;
    }
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    this.save();
  }

  addCoins(amount) { this.data.coins += amount; }

  addXp(amount) {
    this.data.xp += amount;
    let leveledUp = false;
    while (this.data.xp >= this.data.xpToNext) {
      this.data.xp -= this.data.xpToNext;
      this.data.level += 1;
      this.data.xpToNext = Math.round(this.data.xpToNext * 1.25);
      leveledUp = true;
    }
    return leveledUp;
  }
}
