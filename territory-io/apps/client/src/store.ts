const KEY = 'territory.profile.v1';

export interface Profile {
  token: string; name: string; skin: number; coins: number; owned: number[];
  stats: { matches: number; wins: number; kills: number; best: number; playtime: number };
  daily: { last: string; streak: number };
  volume: number; muted: boolean;
}
function rand(n: number): string {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789'; let s = '';
  for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}
function fresh(): Profile {
  return {
    token: rand(28), name: 'Player' + Math.floor(100 + Math.random() * 900), skin: 0, coins: 100,
    owned: [0, 1, 2, 3], stats: { matches: 0, wins: 0, kills: 0, best: 0, playtime: 0 },
    daily: { last: '', streak: 0 }, volume: 0.6, muted: false
  };
}
function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return fresh();
}
export const profile: Profile = load();
export function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* ignore */ }
}
save();
