import Phaser from 'phaser';

export type Dir = { dx: number; dy: number };
export const UP: Dir = { dx: 0, dy: -1 };
export const DOWN: Dir = { dx: 0, dy: 1 };
export const LEFT: Dir = { dx: -1, dy: 0 };
export const RIGHT: Dir = { dx: 1, dy: 0 };

const SWIPE_MIN = 24; // px

/** Keyboard + swipe input. Emits intent only; the game decides if it is legal. */
export class InputSystem {
  private requested: Dir | null = null;
  private startX = 0;
  private startY = 0;
  private swiping = false;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const bind = (codes: string[], d: Dir) => codes.forEach(c => kb.on(`keydown-${c}`, () => (this.requested = d)));
    bind(['UP', 'W'], UP);
    bind(['DOWN', 'S'], DOWN);
    bind(['LEFT', 'A'], LEFT);
    bind(['RIGHT', 'D'], RIGHT);

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.startX = p.x; this.startY = p.y; this.swiping = true;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.swiping || !p.isDown) return;
      const ddx = p.x - this.startX, ddy = p.y - this.startY;
      if (Math.max(Math.abs(ddx), Math.abs(ddy)) < SWIPE_MIN) return;
      this.requested = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? RIGHT : LEFT) : (ddy > 0 ? DOWN : UP);
      this.startX = p.x; this.startY = p.y; // allow chained swipes without lifting
    });
    scene.input.on('pointerup', () => { this.swiping = false; });
  }

  /** Returns the latest requested direction and clears it. */
  consume(): Dir | null {
    const r = this.requested;
    this.requested = null;
    return r;
  }
}
