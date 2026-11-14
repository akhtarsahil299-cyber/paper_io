import { NO_OWNER } from './constants';

export interface Cell { x: number; y: number }

/** Flat owner map. Pure data, no rendering — safe to run on the server. */
export class Grid {
  readonly owner: Uint8Array;
  constructor(readonly width: number, readonly height: number) {
    this.owner = new Uint8Array(width * height);
  }
  idx(x: number, y: number): number { return y * this.width + x; }
  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
  getOwner(x: number, y: number): number { return this.owner[this.idx(x, y)]; }
  setOwner(x: number, y: number, id: number): void { this.owner[this.idx(x, y)] = id; }
  count(id: number): number {
    let n = 0;
    for (let i = 0; i < this.owner.length; i++) if (this.owner[i] === id) n++;
    return n;
  }
  clear(): void { this.owner.fill(NO_OWNER); }
  /** Claim a square of cells centred on (cx, cy), clamped to the arena. */
  claimSquare(cx: number, cy: number, radius: number, id: number): Cell[] {
    const changed: Cell[] = [];
    for (let y = cy - radius; y <= cy + radius; y++)
      for (let x = cx - radius; x <= cx + radius; x++)
        if (this.inBounds(x, y) && this.getOwner(x, y) !== id) {
          this.setOwner(x, y, id);
          changed.push({ x, y });
        }
    return changed;
  }
}
