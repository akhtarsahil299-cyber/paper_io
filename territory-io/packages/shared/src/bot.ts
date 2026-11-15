import { DX, DY } from './constants';
import type { Game, Player } from './sim';

export interface BotMem { phase: 'idle' | 'out' | 'turn' | 'home'; n: number }
export const newBotMem = (): BotMem => ({ phase: 'idle', n: 0 });

function shuffle<T>(a: T[], rng: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function safe(g: Game, p: Player, d: number, look: number): boolean {
  if (p.dir >= 0 && (d + 2) % 4 === p.dir) return false;
  let x = p.x, y = p.y;
  for (let i = 0; i < look; i++) {
    x += DX[d]; y += DY[d];
    if (!g.grid.inBounds(x, y)) return false;
    if (p.trailSet.has(g.grid.idx(x, y))) return false;
  }
  return true;
}
function choose(g: Game, p: Player, pref: number[]): number {
  for (const look of [3, 1]) for (const d of pref) if (safe(g, p, d, look)) return d;
  for (const d of shuffle([0, 1, 2, 3], g.rng)) if (safe(g, p, d, 1)) return d;
  return p.dir;
}
function toward(p: Player, tx: number, ty: number): number[] {
  const dx = tx - p.x, dy = ty - p.y;
  const h = dx > 0 ? 1 : 3, v = dy > 0 ? 2 : 0;
  const first = Math.abs(dx) >= Math.abs(dy);
  const list: number[] = [];
  if (first) { if (dx) list.push(h); if (dy) list.push(v); } else { if (dy) list.push(v); if (dx) list.push(h); }
  return list;
}

/** Simple rectangle-looping bot that also tries to cut nearby enemy trails. */
export function botThink(g: Game, p: Player): void {
  const m = p.bot!;
  const rng = g.rng;
  const W = g.grid.width;
  if (p.dir < 0) { g.setDir(p.id, choose(g, p, shuffle([0, 1, 2, 3], rng))); return; }

  const onOwn = g.grid.getOwner(p.x, p.y) === p.id;
  if (onOwn && p.trail.length === 0) m.phase = 'idle';
  else if (m.phase === 'idle') { m.phase = 'out'; m.n = 2 + Math.floor(rng() * 6); }

  switch (m.phase) {
    case 'idle': {
      if (rng() < 0.3) {
        m.phase = 'out'; m.n = 3 + Math.floor(rng() * 8);
        g.setDir(p.id, choose(g, p, shuffle([0, 1, 2, 3], rng)));
      } else if (!safe(g, p, p.dir, 2)) g.setDir(p.id, choose(g, p, shuffle([0, 1, 2, 3], rng)));
      break;
    }
    case 'out': {
      m.n--;
      // opportunistic: steer at a nearby enemy trail
      if (rng() < 0.3) {
        let best = 99, bx = -1, by = -1;
        for (const q of g.players.values()) {
          if (q === p || !q.alive) continue;
          for (const c of q.trail) {
            const cx = c % W, cy = (c - cx) / W, dist = Math.abs(cx - p.x) + Math.abs(cy - p.y);
            if (dist < best && dist <= 7) { best = dist; bx = cx; by = cy; }
          }
        }
        if (bx >= 0) { g.setDir(p.id, choose(g, p, toward(p, bx, by))); m.n = Math.max(m.n, 3); break; }
      }
      if (m.n <= 0 || !safe(g, p, p.dir, 2)) {
        m.phase = 'turn'; m.n = 2 + Math.floor(rng() * 6);
        g.setDir(p.id, choose(g, p, shuffle([(p.dir + 1) % 4, (p.dir + 3) % 4], rng)));
      }
      break;
    }
    case 'turn': {
      m.n--;
      if (m.n <= 0 || !safe(g, p, p.dir, 2)) m.phase = 'home';
      break;
    }
    case 'home': {
      const want = toward(p, p.sx, p.sy);
      if (want.includes(p.dir) && safe(g, p, p.dir, 2)) break;
      g.setDir(p.id, choose(g, p, want));
      break;
    }
  }
}
