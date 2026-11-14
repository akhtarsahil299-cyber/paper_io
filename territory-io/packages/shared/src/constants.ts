export const GRID_SIZE = 80;        // arena is GRID_SIZE x GRID_SIZE cells
export const CELL_SIZE = 28;        // px per cell (client rendering only)
export const TICK_MS = 100;         // server simulation step (one cell per tick)
export const START_RADIUS = 1;      // starting territory (2r+1)^2
export const NO_OWNER = 0;
export const MAX_PLAYERS = 10;      // entities (humans + bots) per round
export const MAX_HUMANS = 8;
export const FILL_TO = 6;           // bots top the round up to this many entities
export const RESPAWN_TICKS = 25;
export const RESULTS_SECONDS = 8;
export const RECONNECT_GRACE_MS = 12000;
export const SKIN_COUNT = 20;
export const DX = [0, 1, 0, -1];    // 0 up, 1 right, 2 down, 3 left
export const DY = [-1, 0, 1, 0];

export type Mode = 'classic' | 'survival';
export const MODES: Mode[] = ['classic', 'survival'];
export const ROUND_SECONDS: Record<Mode, number> = { classic: 150, survival: 240 };
