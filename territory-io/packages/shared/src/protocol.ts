import type { Mode } from './constants';

export interface RosterEntry { id: number; name: string; skin: number; bot: boolean }

/** [id, x, y, dir, alive(0|1), kills, pct*10, trailCellIndices] */
export type PlayerWire = [number, number, number, number, number, number, number, number[]];

export type GameEvent =
  | { t: 'spawn'; id: number }
  | { t: 'cap'; id: number; n: number }
  | { t: 'kill'; killer: number; victim: number }
  | { t: 'die'; id: number; by: number; reason: 'wall' | 'self' | 'clash' | 'enemy' | 'lost' };

export interface TickMsg {
  t: number;
  time: number;            // seconds left
  p: PlayerWire[];
  c: number[];             // flat [cellIndex, owner, cellIndex, owner, ...] territory delta
  ev: GameEvent[];
}
export interface InitMsg {
  code: string; mode: Mode; you: number; grid: number; timeLeft: number;
  owner: ArrayBuffer | Uint8Array; roster: RosterEntry[];
}
export interface LobbyMsg {
  code: string; mode: Mode; isPublic: boolean; youHost: boolean; bots: boolean;
  players: { name: string; skin: number; host: boolean }[];
}
export interface ResultRow { id: number; name: string; skin: number; bot: boolean; pct: number; best: number; kills: number; alive: boolean }
export interface EndMsg { ranking: ResultRow[]; winner: number; you: number; next: number; seconds: number }
export interface DeadMsg { by: string; reason: string; respawn: boolean }
export interface LbRow { name: string; best: number; wins: number; kills: number; rounds: number }
export interface LbMsg { global: LbRow[]; weekly: LbRow[] }
