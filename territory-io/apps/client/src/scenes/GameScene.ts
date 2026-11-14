import Phaser from 'phaser';
import { CELL_SIZE as C, GRID_SIZE as N, TICK_MS, type InitMsg, type RosterEntry, type TickMsg } from '@territory/shared';
import { bus } from '../bus';
import { hud } from '../hud';
import { sfx } from '../audio';
import { net } from '../net';
import { profile } from '../store';
import { darken, hue, lerpColor, lighten, skinOf, type Skin } from '../skins';

interface PV { id: number; x: number; y: number; px: number; py: number; dir: number; alive: boolean; kills: number; pct: number; trail: number[] }

const DIRS: Record<string, number> = { UP: 0, W: 0, RIGHT: 1, D: 1, DOWN: 2, S: 2, LEFT: 3, A: 3 };

export class GameScene extends Phaser.Scene {
  private owner = new Uint8Array(N * N);
  private players = new Map<number, PV>();
  private roster = new Map<number, RosterEntry>();
  private me = 0;
  private active = false;
  private lastTickAt = 0;
  private timeLeft = 0;
  private territoryDirty = true;
  private territoryGfx!: Phaser.GameObjects.Graphics;
  private actorGfx!: Phaser.GameObjects.Graphics;
  private names = new Map<number, Phaser.GameObjects.Text>();
  private camTarget = new Phaser.Math.Vector2(N * C / 2, N * C / 2);
  private lastMini = 0;
  private lastHud = 0;
  private offs: (() => void)[] = [];
  private swipe = { x: 0, y: 0, on: false };

  constructor() { super('GameScene'); }

  create(): void {
    const world = N * C;
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x8c96bf, 1).fillRect(-3000, -3000, world + 6000, world + 6000);
    bg.fillStyle(0xf1f4fc, 1).fillRect(0, 0, world, world);
    bg.lineStyle(1, 0xe0e5f3, 1);
    for (let i = 0; i <= N; i++) { bg.lineBetween(i * C, 0, i * C, world); bg.lineBetween(0, i * C, world, i * C); }
    bg.lineStyle(6, 0x6872a0, 1).strokeRect(0, 0, world, world);

    if (location.search.includes('debug')) (window as any).__ts = this;
    this.territoryGfx = this.add.graphics().setDepth(1);
    this.actorGfx = this.add.graphics().setDepth(2);

    const dot = this.make.graphics({ x: 0, y: 0 }, false);
    dot.fillStyle(0xffffff, 1).fillCircle(5, 5, 5).generateTexture('dot', 10, 10).destroy();

    const cam = this.cameras.main;
    cam.setBounds(-400, -400, world + 800, world + 800);
    cam.startFollow(this.camTarget as unknown as Phaser.GameObjects.GameObject, true, 0.25, 0.25);
    this.fitZoom();
    this.scale.on('resize', () => this.fitZoom());

    const kb = this.input.keyboard!;
    for (const [k, d] of Object.entries(DIRS)) kb.on(`keydown-${k}`, () => this.steer(d));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { sfx.unlock(); this.swipe = { x: p.x, y: p.y, on: true }; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.swipe.on || !p.isDown) return;
      const dx = p.x - this.swipe.x, dy = p.y - this.swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
      this.steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
      this.swipe.x = p.x; this.swipe.y = p.y;
    });
    this.input.on('pointerup', () => { this.swipe.on = false; });

    this.offs.push(
      bus.on('init', m => this.onInit(m)),
      bus.on('tick', m => this.onTick(m)),
      bus.on('roster', r => this.setRoster(r)),
      bus.on('stop', () => { this.active = false; hud.show(false); })
    );
    this.events.once('shutdown', () => this.offs.forEach(o => o()));
  }

  private fitZoom(): void {
    const s = Math.min(this.scale.width, this.scale.height);
    this.cameras.main.setZoom(Phaser.Math.Clamp(s / (C * 20), 0.4, 1.6));
  }
  private steer(d: number): void { if (this.active) net.dir(d); }

  // ---------- network ----------
  private setRoster(r: RosterEntry[]): void {
    this.roster = new Map(r.map(e => [e.id, e]));
    for (const [id, t] of this.names) if (!this.roster.has(id)) { t.destroy(); this.names.delete(id); this.players.delete(id); }
  }
  private onInit(m: InitMsg): void {
    this.owner = new Uint8Array(m.owner as ArrayBuffer).slice();
    this.me = m.you; this.timeLeft = m.timeLeft; this.players.clear();
    for (const t of this.names.values()) t.destroy();
    this.names.clear();
    this.setRoster(m.roster);
    this.territoryDirty = true; this.active = true; this.lastTickAt = performance.now();
    net.resetDir();
    hud.show(true);
    sfx.start();
  }
  private onTick(m: TickMsg): void {
    if (!this.active) return;
    const now = performance.now();
    this.lastTickAt = now; this.timeLeft = m.time;
    for (const [id, x, y, dir, alive, kills, pct10, trail] of m.p) {
      let pv = this.players.get(id);
      if (!pv) { pv = { id, x, y, px: x, py: y, dir, alive: !!alive, kills, pct: 0, trail }; this.players.set(id, pv); }
      const respawned = !pv.alive && !!alive;
      pv.px = respawned ? x : pv.x; pv.py = respawned ? y : pv.y;
      Object.assign(pv, { x, y, dir, alive: !!alive, kills, pct: pct10 / 10, trail });
    }
    for (let i = 0; i < m.c.length; i += 2) this.owner[m.c[i]] = m.c[i + 1];
    if (m.c.length) this.territoryDirty = true;

    for (const ev of m.ev) {
      if (ev.t === 'spawn' && ev.id === this.me) { net.resetDir(); const p = this.players.get(ev.id); if (p) this.snapCam(p); }
      else if (ev.t === 'cap') {
        const p = this.players.get(ev.id);
        if (p && ev.id === this.me) { sfx.capture(); this.float(p, `+${((ev.n / (N * N)) * 100).toFixed(1)}%`, 0x1fae7a); }
      } else if (ev.t === 'die') {
        const p = this.players.get(ev.id);
        if (p) this.burst(p, skinOf(this.roster.get(ev.id)?.skin ?? 0));
        if (ev.id === this.me) sfx.elim();
      } else if (ev.t === 'kill' && ev.killer === this.me) {
        sfx.kill(); hud.toast(`You eliminated ${this.roster.get(ev.victim)?.name ?? 'a player'}!`);
      }
    }
  }
  private snapCam(p: PV): void {
    this.camTarget.set((p.x + 0.5) * C, (p.y + 0.5) * C);
    this.cameras.main.centerOn(this.camTarget.x, this.camTarget.y);
  }

  // ---------- effects ----------
  private float(p: PV, text: string, color: number): void {
    const t = this.add.text((p.x + 0.5) * C, (p.y - 0.4) * C, text, {
      fontFamily: 'Baloo 2, Nunito, sans-serif', fontSize: '26px', color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#ffffff', strokeThickness: 5
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
  private burst(p: PV, s: Skin): void {
    const em = this.add.particles((p.x + 0.5) * C, (p.y + 0.5) * C, 'dot', {
      speed: { min: 90, max: 280 }, lifespan: 650, scale: { start: 1.1, end: 0 }, tint: [s.c1, lighten(s.c1, .5), 0xffffff],
      emitting: false
    }).setDepth(9);
    em.explode(26);
    this.time.delayedCall(900, () => em.destroy());
    if (p.id === this.me) this.cameras.main.shake(220, 0.008);
  }

  // ---------- frame ----------
  update(): void {
    const now = performance.now();
    if (!this.active) return;
    const t = Math.min((now - this.lastTickAt) / TICK_MS, 1);
    if (this.territoryDirty) { this.territoryDirty = false; this.drawTerritory(); }

    const g = this.actorGfx.clear();
    const pulse = 0.5 + 0.5 * Math.sin(now / 220);
    for (const pv of this.players.values()) {
      const nameTxt = this.nameOf(pv);
      if (!pv.alive) { nameTxt.setVisible(false); continue; }
      const sk = skinOf(this.roster.get(pv.id)?.skin ?? 0);
      const main = sk.kind === 'anim' ? hue((now / 2400 + pv.id * 0.13) % 1) : sk.c1;
      const trailCol = sk.kind === 'anim' ? lighten(main, 0.3) : lighten(sk.kind === 'checker' ? sk.c2 : sk.c1, 0.35);

      g.fillStyle(trailCol, 0.85);
      for (const idx of pv.trail) g.fillRect((idx % N) * C + 2, Math.floor(idx / N) * C + 2, C - 4, C - 4);

      const rx = (pv.px + (pv.x - pv.px) * t + 0.5) * C, ry = (pv.py + (pv.y - pv.py) * t + 0.5) * C;
      if (sk.kind === 'neon' || sk.kind === 'anim') { g.fillStyle(main, 0.18 + 0.14 * pulse).fillCircle(rx, ry, C * (0.95 + 0.25 * pulse)); }
      g.fillStyle(0x000000, 0.18).fillEllipse(rx, ry + C * 0.42, C * 0.9, C * 0.35);
      g.fillStyle(0xffffff, 1).fillRoundedRect(rx - C * 0.5, ry - C * 0.5, C, C, 8);
      g.fillStyle(main, 1).fillRoundedRect(rx - C * 0.4, ry - C * 0.4, C * 0.8, C * 0.8, 6);
      if (pv.id === this.me) g.lineStyle(3, 0x1b1446, 0.9).strokeRoundedRect(rx - C * 0.5, ry - C * 0.5, C, C, 8);
      nameTxt.setVisible(true).setPosition(rx, ry - C * 0.95);

      if (pv.id === this.me) this.camTarget.set(rx, ry);
    }
    const me = this.players.get(this.me);
    if (me && !me.alive) {
      const lead = [...this.players.values()].filter(p => p.alive).sort((a, b) => b.pct - a.pct)[0];
      if (lead) this.camTarget.set((lead.x + 0.5) * C, (lead.y + 0.5) * C);
    }

    if (now - this.lastHud > 120) { this.lastHud = now; this.pushHud(); }
    if (now - this.lastMini > 450) {
      this.lastMini = now;
      const skins = new Map([...this.roster].map(([id, r]) => [id, r.skin]));
      hud.minimap(this.owner, skins, me?.alive ? { x: me.x, y: me.y } : undefined);
    }
  }

  private nameOf(pv: PV): Phaser.GameObjects.Text {
    let t = this.names.get(pv.id);
    if (!t) {
      t = this.add.text(0, 0, this.roster.get(pv.id)?.name ?? '', {
        fontFamily: 'Nunito, sans-serif', fontSize: '15px', fontStyle: '800', color: '#1b1446', stroke: '#ffffff', strokeThickness: 4
      }).setOrigin(0.5).setDepth(5);
      this.names.set(pv.id, t);
    }
    return t;
  }

  private pushHud(): void {
    const list = [...this.players.values()].sort((a, b) => b.pct - a.pct);
    const me = this.players.get(this.me);
    hud.update({
      name: profile.name, pct: me?.pct ?? 0, rank: me ? list.indexOf(me) + 1 : 0, kills: me?.kills ?? 0,
      alive: list.filter(p => p.alive).length, time: this.timeLeft,
      board: list.slice(0, 5).map(p => ({
        name: this.roster.get(p.id)?.name ?? '?', pct: p.pct, me: p.id === this.me,
        color: '#' + skinOf(this.roster.get(p.id)?.skin ?? 0).c1.toString(16).padStart(6, '0')
      }))
    });
  }

  private drawTerritory(): void {
    const g = this.territoryGfx.clear(), o = this.owner;
    for (let y = 0; y < N; y++) {
      let x = 0;
      while (x < N) {
        const id = o[y * N + x];
        if (!id) { x++; continue; }
        const sk = skinOf(this.roster.get(id)?.skin ?? 0);
        const percell = sk.kind === 'checker' || sk.kind === 'stripe';
        let x2 = x + 1;
        if (!percell) while (x2 < N && o[y * N + x2] === id) x2++;
        for (let cx = x; cx < x2; cx++) {
          let col = sk.c1;
          if (sk.kind === 'gradient') col = lerpColor(sk.c1, sk.c2, (y / N + cx / N) / 2);
          else if (sk.kind === 'checker') col = (cx + y) % 2 ? sk.c2 : sk.c1;
          else if (sk.kind === 'stripe') col = (cx + y) % 4 < 2 ? sk.c1 : sk.c2;
          if (percell || cx === x) {
            const w = percell ? 1 : x2 - x;
            g.fillStyle(lighten(col, 0.08), 1).fillRect(cx * C, y * C, w * C, C);
          }
          const below = y + 1 < N ? o[(y + 1) * N + cx] : 0;
          if (below !== id) g.fillStyle(darken(col, 0.28), 1).fillRect(cx * C, y * C + C - 5, C, 5);
        }
        x = x2;
      }
    }
  }
}
