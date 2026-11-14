/** Game constants shared by client and (later) server. */
export const GRID_SIZE = 100;      // arena is GRID_SIZE x GRID_SIZE cells
export const CELL_SIZE = 20;       // pixels per cell (client rendering only)
export const STEP_MS = 110;        // time to move one cell (server tick-friendly)
export const START_RADIUS = 1;     // starting territory is (2r+1)^2 cells
export const NO_OWNER = 0;         // owner id of unclaimed cells
