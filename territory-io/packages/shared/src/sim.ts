import {
  DX, DY, GRID_SIZE, MAX_PLAYERS, Mode, NO_OWNER, RESPAWN_TICKS, ROUND_SECONDS, START_RADIUS, TICK_MS
} from './constants';
import { Grid } from './grid';
import { captureTerritory } from './territory';
import { BotMem, botThink, newBotMem } from './bot';
import type { GameEvent } from './protocol';

export interface Player {
  id: number; name: string; skin: number; isBot: boolean;
  x: number; y: number; dir: number; queue: number[];
  trail: number[]; trailSet: Set<number>;
  alive: boolean; kills: number; count: number; pct: number; best: number;
  respawnAt: number; sx: number; sy: number; bot?: BotMem;
}
type Reason = 'wall' | 'self' | 'clash' | 'enemy' | 'lost';

/** Pure, deterministic-per-tick game simulation. The server is the only place that runs it. */
export class Game {
  readonly grid = new Grid(GRID_SIZE, GRID_SIZE);
  readonly players = new Map<number, Player>();
  tick = 0;
  events: GameEvent[] = [];
  dirty = new Map<number, number>();   // cell index -> new owner, for this tick
  over = false;
  winner = 0;
  private lastCapturer = 0;

  constructor(readonly mode: Mode, readonly rng: () => number = Math.random) {}

  get totalTicks(): number { return (ROUND_SECONDS[this.mode] * 1000) / TICK_MS; }
  get timeLeft(): number { return Math.max(0, Math.ceil(((this.totalTicks - this.tick) * TICK_MS) / 1000)); }

  freeSlot(): number {
    for (let i = 1; i <= MAX_PLAYERS; i++) if (!this.players.has(i)) return i;
    return 0;
  }

  addPlayer(name: string, skin: number, isBot: boolean): Player | null {
    const id = this.freeSlot();
    if (!id) return null;
    const p: Player = {
      id, name, skin, isBot, x: 0, y: 0, dir: -1, queue: [], trail: [], trailSet: new Set(),
      alive: false, kills: 0, count: 0, pct: 0, best: 0, respawnAt: 0, sx: 0, sy: 0
    };
    if (isBot) p.bot = newBotMem();
    this.players.set(id, p);
    this.spawn(p);
    return p;
  }

  removePlayer(id: number): void {
    if (!this.players.has(id)) return;
    this.wipe(id);
    this.players.delete(id);
  }

  /** Queue a turn. Ignores anything that is not an integer 0..3. Max 3 queued. */
  setDir(id: number, d: number): void {
    const p = this.players.get(id);
    if (!p || !p.alive || !Number.isInteger(d) || d < 0 || d > 3) return;
    const last = p.queue.length ? p.queue[p.queue.length - 1] : p.dir;
    if (d === last) return;
    if (p.queue.length < 3) p.queue.push(d);
  }

  private set(idx: number, owner: number): void {
    this.grid.owner[idx] = owner;
    this.dirty.set(idx, owner);
  }
  private wipe(id: number): void {
    const o = this.grid.owner;
    for (let i = 0; i < o.length; i++) if (o[i] === id) this.set(i, NO_OWNER);
  }

  private spawn(p: Player): void {
    const g = this.grid, r = START_RADIUS + 1;
    let sx = 0, sy = 0, ok = false;
    for (let a = 0; a < 80 && !ok; a++) {
      sx = 5 + Math.floor(this.rng() * (g.width - 10));
      sy = 5 + Math.floor(this.rng() * (g.height - 10));
      ok = true;
      for (let y = sy - r - 2; y <= sy + r + 2 && ok; y++)
        for (let x = sx - r - 2; x <= sx + r + 2; x++)
          if (g.inBounds(x, y) && g.getOwner(x, y) !== NO_OWNER) { ok = false; break; }
    }
    for (const c of g.claimSquare(sx, sy, START_RADIUS, p.id)) this.dirty.set(g.idx(c.x, c.y), p.id);
    Object.assign(p, { x: sx, y: sy, sx, sy, dir: -1, queue: [], alive: true, respawnAt: 0 });
    p.trail = []; p.trailSet.clear();
    if (p.bot) p.bot = newBotMem();
    this.events.push({ t: 'spawn', id: p.id });
  }

  private kill(p: Player, by: number, reason: Reason): void {
    if (!p.alive) return;
    p.alive = false; p.trail = []; p.trailSet.clear(); p.queue = [];
    this.wipe(p.id);
    p.count = 0; p.pct = 0;
    if (by && by !== p.id) {
      const k = this.players.get(by);
      if (k) { k.kills++; this.events.push({ t: 'kill', killer: by, victim: p.id }); }
    }
    this.events.push({ t: 'die', id: p.id, by, reason });
    p.respawnAt = this.mode === 'classic' ? this.tick + RESPAWN_TICKS : 0;
  }

  step(): void {
    this.tick++;
    this.events = [];
    this.dirty.clear();
    const g = this.grid, W = g.width;

    for (const p of this.players.values())
      if (!p.alive && p.respawnAt > 0 && this.tick >= p.respawnAt) this.spawn(p);
    for (const p of this.players.values()) if (p.alive && p.isBot) botThink(this, p);

    // 1) resolve intended moves against the pre-move state
    const trailOwner = new Map<number, number>();
    for (const p of this.players.values()) if (p.alive) for (const c of p.trail) trailOwner.set(c, p.id);

    const deaths = new Map<number, { by: number; reason: Reason }>();
    const mark = (id: number, by: number, reason: Reason) => { if (!deaths.has(id)) deaths.set(id, { by, reason }); };
    const movers: { p: Player; nx: number; ny: number; idx: number }[] = [];

    for (const p of this.players.values()) {
      if (!p.alive) continue;
      while (p.queue.length) {
        const d = p.queue.shift()!;
        if (d === p.dir || (p.dir >= 0 && (d + 2) % 4 === p.dir)) continue;
        p.dir = d; break;
      }
      if (p.dir < 0) continue;
      const nx = p.x + DX[p.dir], ny = p.y + DY[p.dir];
      if (!g.inBounds(nx, ny)) { mark(p.id, 0, 'wall'); continue; }
      const idx = g.idx(nx, ny);
      const o = trailOwner.get(idx);
      if (o === p.id) { mark(p.id, p.id, 'self'); continue; }
      if (o !== undefined) mark(o, p.id, 'enemy');
      movers.push({ p, nx, ny, idx });
    }
    const dest = new Map<number, Player[]>();
    for (const m of movers) { const l = dest.get(m.idx) ?? []; l.push(m.p); dest.set(m.idx, l); }
    for (const l of dest.values()) if (l.length > 1) for (const p of l) mark(p.id, 0, 'clash');

    for (const [id, d] of deaths) this.kill(this.players.get(id)!, d.by, d.reason);

    // 2) move survivors, extend trails, close loops
    for (const m of movers) {
      const p = m.p;
      if (!p.alive) continue;
      p.x = m.nx; p.y = m.ny;
      if (g.owner[m.idx] === p.id) {
        if (p.trail.length) {
          const cells = p.trail.map(i => ({ x: i % W, y: (i - (i % W)) / W }));
          p.trail = []; p.trailSet.clear();
          const changed = captureTerritory(g, p.id, cells);
          for (const c of changed) this.dirty.set(g.idx(c.x, c.y), p.id);
          this.lastCapturer = p.id;
          this.events.push({ t: 'cap', id: p.id, n: changed.length });
        }
      } else {
        p.trail.push(m.idx); p.trailSet.add(m.idx);
      }
    }

    // 3) scores; a player with no land left is out
    const counts = new Array(MAX_PLAYERS + 1).fill(0);
    for (let i = 0; i < g.owner.length; i++) counts[g.owner[i]]++;
    for (const p of this.players.values()) {
      p.count = counts[p.id];
      p.pct = (p.count / (W * g.height)) * 100;
      if (p.pct > p.best) p.best = p.pct;
    }
    for (const p of this.players.values()) if (p.alive && p.count === 0) this.kill(p, this.lastCapturer, 'lost');

    this.checkEnd();
  }

  ranking(): Player[] {
    return [...this.players.values()].sort((a, b) =>
      (this.mode === 'survival' && a.alive !== b.alive ? (a.alive ? -1 : 1) : 0) ||
      b.pct - a.pct || b.kills - a.kills);
  }

  private checkEnd(): void {
    if (this.over) return;
    const alive = [...this.players.values()].filter(p => p.alive).length;
    const timeUp = this.tick >= this.totalTicks;
    const lastStanding = this.mode === 'survival' && this.players.size > 1 && alive <= 1;
    if (timeUp || lastStanding) {
      this.over = true;
      this.winner = this.ranking()[0]?.id ?? 0;
    }
  }
}
