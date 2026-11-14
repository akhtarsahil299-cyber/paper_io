import type { LbRow } from '@territory/shared';

interface Entry { name: string; pct: number; kills: number; won: boolean; ts: number }

/** In-memory leaderboard fed only by real finished rounds. Resets when the server restarts. */
export class Leaderboard {
  private entries: Entry[] = [];
  record(e: Entry): void {
    this.entries.push(e);
    if (this.entries.length > 5000) this.entries.splice(0, this.entries.length - 5000);
  }
  top(sinceMs: number, n = 20): LbRow[] {
    const cutoff = sinceMs ? Date.now() - sinceMs : 0;
    const by = new Map<string, LbRow>();
    for (const e of this.entries) {
      if (e.ts < cutoff) continue;
      const k = e.name.toLowerCase();
      const r = by.get(k) ?? { name: e.name, best: 0, wins: 0, kills: 0, rounds: 0 };
      r.best = Math.max(r.best, e.pct); r.wins += e.won ? 1 : 0; r.kills += e.kills; r.rounds++;
      by.set(k, r);
    }
    return [...by.values()].sort((a, b) => b.best - a.best).slice(0, n)
      .map(r => ({ ...r, best: Math.round(r.best * 10) / 10 }));
  }
}
