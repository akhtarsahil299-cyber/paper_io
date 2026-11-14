import { Cell } from '@territory/shared';
import { Dir } from '../systems/InputSystem';

/** Logical (grid) state of the local player. Rendering reads from this. */
export class Player {
  x = 0; y = 0;           // current cell
  prevX = 0; prevY = 0;   // previous cell, for smooth interpolation
  dir: Dir | null = null; // null until the first input
  trail: Cell[] = [];
  private trailKeys = new Set<number>();

  constructor(public readonly id: number) {}

  spawn(x: number, y: number): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.dir = null;
    this.clearTrail();
  }

  /** Reversing straight into your own trail is never allowed. */
  canTurnTo(d: Dir): boolean {
    return !this.dir || !(d.dx === -this.dir.dx && d.dy === -this.dir.dy);
  }

  addTrail(c: Cell, width: number): void {
    this.trail.push({ x: c.x, y: c.y });
    this.trailKeys.add(c.y * width + c.x);
  }
  onTrail(x: number, y: number, width: number): boolean { return this.trailKeys.has(y * width + x); }
  clearTrail(): void { this.trail = []; this.trailKeys.clear(); }
}
