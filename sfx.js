const PRESETS = {
  success: { freq: 660, end: 990, duration: 0.22, type: "triangle", volume: 0.22 },
  fail:    { freq: 240, end: 150, duration: 0.18, type: "square",   volume: 0.16 },
  skip:    { freq: 520, end: 380, duration: 0.18, type: "sine",     volume: 0.18 },
  tick:    { freq: 880, end: 880, duration: 0.04, type: "square",   volume: 0.1  },
  hit:     { freq: 720, end: 1100,duration: 0.16, type: "triangle", volume: 0.22 },
  miss:    { freq: 320, end: 180, duration: 0.22, type: "square",   volume: 0.18 },
  win:     { chord: [660, 880, 1320], duration: 0.32, type: "triangle", volume: 0.22 },
  lose:    { chord: [440, 330, 220], duration: 0.34, type: "sawtooth", volume: 0.18 },
};

class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._bindUnlock();
  }

  _bindUnlock() {
    const unlock = () => {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) { this.enabled = false; return; }
        this.ctx = new Ctx();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
  }

  play(name) {
    if (!this.enabled || !this.ctx) return;
    const preset = PRESETS[name];
    if (!preset) return;
    if (preset.chord) {
      preset.chord.forEach((freq, i) => {
        this._tone({ ...preset, freq, end: freq, duration: preset.duration }, i * 0.09);
      });
      return;
    }
    this._tone(preset, 0);
  }

  _tone(preset, delay) {
    const ctx = this.ctx;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = preset.type || "sine";
    osc.frequency.setValueAtTime(preset.freq, now);
    if (preset.end !== preset.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, preset.end), now + preset.duration);
    }
    const vol = preset.volume ?? 0.2;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + preset.duration + 0.02);
  }
}

export const sfx = new Sfx();
