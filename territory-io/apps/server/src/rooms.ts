import type { Server, Socket } from 'socket.io';
import {
  FILL_TO, Game, MAX_HUMANS, Mode, RECONNECT_GRACE_MS, RESULTS_SECONDS, SKIN_COUNT, TICK_MS,
  type EndMsg, type InitMsg, type LobbyMsg, type PlayerWire, type RosterEntry, type TickMsg
} from '@territory/shared';
import type { Leaderboard } from './leaderboard';

const BOT_NAMES = ['Nova', 'Blitz', 'Pixel', 'Echo', 'Rogue', 'Zen', 'Mango', 'Turbo', 'Ghost', 'Comet', 'Pogo', 'Rex'];

export interface Human { token: string; name: string; skin: number; slot: number; sid: string | null; discAt: number }

export class Room {
  humans = new Map<string, Human>();
  game: Game | null = null;
  phase: 'lobby' | 'playing' | 'results' = 'lobby';
  host = '';
  dead = false;
  private timer?: NodeJS.Timeout;
  private botSeq = 0;

  constructor(
    private io: Server, readonly code: string, readonly mode: Mode, readonly isPublic: boolean,
    private botsOn: boolean, private lb: Leaderboard, private onEmpty: (r: Room) => void
  ) {}

  private sock(h: Human): Socket | undefined { return h.sid ? this.io.sockets.sockets.get(h.sid) : undefined; }
  private connected(): Human[] { return [...this.humans.values()]; }

  add(h: Human, socket: Socket): void {
    this.humans.set(h.token, h);
    h.sid = socket.id; h.discAt = 0;
    socket.join(this.code);
    if (!this.host) this.host = h.token;
    if (this.phase === 'playing') { this.addToGame(h); this.balanceBots(); this.sendInit(h); this.broadcastRoster(); }
    else if (this.isPublic && this.phase === 'lobby') this.start();
    else this.sendLobbyAll();
  }

  rebind(h: Human, socket: Socket): void {
    h.sid = socket.id; h.discAt = 0;
    socket.join(this.code);
    if (this.phase === 'playing') { this.sendInit(h); } else this.sendLobbyAll();
  }

  disconnected(token: string): void {
    const h = this.humans.get(token);
    if (h) { h.sid = null; h.discAt = Date.now(); }
  }

  remove(token: string, socket?: Socket): void {
    const h = this.humans.get(token);
    if (!h) return;
    this.game?.removePlayer(h.slot);
    this.humans.delete(token);
    (socket ?? this.sock(h))?.leave(this.code);
    if (!this.humans.size) { this.destroy(); this.onEmpty(this); return; }
    if (this.host === token) this.host = this.humans.keys().next().value as string;
    if (this.phase === 'playing') { this.balanceBots(); this.broadcastRoster(); } else this.sendLobbyAll();
  }

  setDir(token: string, d: number): void {
    const h = this.humans.get(token);
    if (h && this.game && this.phase === 'playing') this.game.setDir(h.slot, d);
  }

  startByHost(token: string): void {
    if (token === this.host && this.phase === 'lobby') this.start();
  }

  // ---------- round lifecycle ----------
  private addToGame(h: Human): void {
    const g = this.game!;
    if (!g.freeSlot()) { // make space by dropping a bot
      const bot = [...g.players.values()].find(p => p.isBot);
      if (bot) g.removePlayer(bot.id);
    }
    h.slot = g.addPlayer(h.name, h.skin, false)?.id ?? 0;
  }

  private start(): void {
    clearInterval(this.timer);
    this.game = new Game(this.mode);
    this.phase = 'playing';
    for (const h of this.humans.values()) this.addToGame(h);
    this.balanceBots();
    for (const h of this.humans.values()) this.sendInit(h);
    this.timer = setInterval(() => this.onTick(), TICK_MS);
  }

  private balanceBots(): void {
    const g = this.game!;
    const humans = [...g.players.values()].filter(p => !p.isBot).length;
    const target = this.isPublic || this.botsOn ? Math.max(0, FILL_TO - humans) : 0;
    const bots = [...g.players.values()].filter(p => p.isBot);
    while (bots.length > target) g.removePlayer(bots.pop()!.id);
    while (bots.length < target && g.freeSlot()) {
      const used = new Set([...g.players.values()].map(q => q.skin));
      const free = Array.from({ length: SKIN_COUNT }, (_, i) => i).filter(i => !used.has(i));
      const skin = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * SKIN_COUNT);
      const p = g.addPlayer(BOT_NAMES[this.botSeq++ % BOT_NAMES.length], skin, true);
      if (!p) break;
      bots.push(p);
    }
  }

  private roster(): RosterEntry[] {
    return [...this.game!.players.values()].map(p => ({ id: p.id, name: p.name, skin: p.skin, bot: p.isBot }));
  }
  private broadcastRoster(): void { if (this.game) this.io.to(this.code).emit('roster', this.roster()); }

  private sendInit(h: Human): void {
    const g = this.game!;
    const msg: InitMsg = {
      code: this.code, mode: this.mode, you: h.slot, grid: g.grid.width, timeLeft: g.timeLeft,
      owner: Buffer.from(g.grid.owner), roster: this.roster()
    };
    this.sock(h)?.emit('init', msg);
  }

  private onTick(): void {
    const g = this.game!;
    const now = Date.now();
    for (const h of [...this.humans.values()])
      if (h.sid === null && now - h.discAt > RECONNECT_GRACE_MS) this.remove(h.token);
    if (this.dead) return;

    g.step();
    const p: PlayerWire[] = [];
    for (const q of g.players.values())
      p.push([q.id, q.x, q.y, q.dir, q.alive ? 1 : 0, q.kills, Math.round(q.pct * 10), q.trail]);
    const c: number[] = [];
    for (const [idx, owner] of g.dirty) c.push(idx, owner);
    const msg: TickMsg = { t: g.tick, time: g.timeLeft, p, c, ev: g.events };
    this.io.to(this.code).emit('tick', msg);

    for (const ev of g.events) {
      if (ev.t !== 'die') continue;
      const h = [...this.humans.values()].find(x => x.slot === ev.id);
      if (!h) continue;
      const by = ev.by && ev.by !== ev.id ? g.players.get(ev.by)?.name ?? '' : '';
      this.sock(h)?.emit('dead', { by, reason: ev.reason, respawn: g.mode === 'classic' });
    }
    if (g.over) this.endRound();
  }

  private endRound(): void {
    clearInterval(this.timer);
    const g = this.game!;
    this.phase = 'results';
    const ranking = g.ranking().map(p => ({
      id: p.id, name: p.name, skin: p.skin, bot: p.isBot,
      pct: Math.round(p.pct * 10) / 10, best: Math.round(p.best * 10) / 10, kills: p.kills, alive: p.alive
    }));
    for (const p of g.players.values())
      if (!p.isBot) this.lb.record({ name: p.name, pct: p.best, kills: p.kills, won: p.id === g.winner, ts: Date.now() });
    for (const h of this.humans.values()) {
      const msg: EndMsg = { ranking, winner: g.winner, you: h.slot, next: this.isPublic ? RESULTS_SECONDS : 0, seconds: g.mode === 'classic' ? 150 : 240 };
      this.sock(h)?.emit('end', msg);
    }
    setTimeout(() => {
      if (this.dead || !this.humans.size) return;
      if (this.isPublic) this.start();
      else { this.phase = 'lobby'; this.game = null; this.sendLobbyAll(); }
    }, RESULTS_SECONDS * 1000);
  }

  sendLobbyAll(): void {
    const players = this.connected().map(h => ({ name: h.name, skin: h.skin, host: h.token === this.host }));
    for (const h of this.humans.values()) {
      const msg: LobbyMsg = {
        code: this.code, mode: this.mode, isPublic: this.isPublic, bots: this.botsOn,
        youHost: h.token === this.host, players
      };
      this.sock(h)?.emit('lobby', msg);
    }
  }

  destroy(): void { this.dead = true; clearInterval(this.timer); }
  get size(): number { return this.humans.size; }
  get full(): boolean { return this.humans.size >= MAX_HUMANS; }
}
