import { profile, save } from './store';

class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.apply();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }
  apply(): void { if (this.master) this.master.gain.value = profile.muted ? 0 : profile.volume; }
  setVolume(v: number): void { profile.volume = v; this.apply(); save(); }
  setMuted(m: boolean): void { profile.muted = m; this.apply(); save(); }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  click(): void { this.tone(720, 0.05, 'square', 0.12); }
  start(): void { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.25, 0, i * 0.08)); }
  capture(): void { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.22, 0, i * 0.05)); }
  kill(): void { this.tone(180, 0.2, 'sawtooth', 0.25, 520); this.tone(660, 0.12, 'square', 0.15, 0, 0.1); }
  elim(): void { this.tone(330, 0.5, 'sawtooth', 0.28, 50); }
  win(): void { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.28, 0, i * 0.1)); }
  lose(): void { [392, 330, 262].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.25, 0, i * 0.14)); }
}
export const sfx = new Sfx();
