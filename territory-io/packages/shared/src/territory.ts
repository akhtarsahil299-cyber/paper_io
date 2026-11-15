import { Cell, Grid } from './grid';

/**
 * Close a trail: the trail cells become territory, then every cell that the
 * outside of the arena cannot reach without crossing the player's territory
 * is enclosed and also becomes territory.
 *
 * Returns every cell whose owner changed (so callers can redraw/broadcast
 * only the delta).
 */
export function captureTerritory(grid: Grid, playerId: number, trail: Cell[]): Cell[] {
  const { width, height } = grid;
  const changed: Cell[] = [];

  for (const c of trail) {
    if (grid.getOwner(c.x, c.y) !== playerId) {
      grid.setOwner(c.x, c.y, playerId);
      changed.push({ x: c.x, y: c.y });
    }
  }

  // Flood fill from the arena border through every cell that is not ours.
  const reached = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;

  const seed = (x: number, y: number) => {
    const i = grid.idx(x, y);
    if (!reached[i] && grid.owner[i] !== playerId) { reached[i] = 1; queue[tail++] = i; }
  };
  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }

  while (head < tail) {
    const i = queue[head++];
    const x = i % width, y = (i - x) / width;
    if (x > 0) seed(x - 1, y);
    if (x < width - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < height - 1) seed(x, y + 1);
  }

  // Anything unreached and not ours is enclosed.
  for (let i = 0; i < reached.length; i++) {
    if (!reached[i] && grid.owner[i] !== playerId) {
      grid.owner[i] = playerId;
      const x = i % width;
      changed.push({ x, y: (i - x) / width });
    }
  }
  return changed;
}
