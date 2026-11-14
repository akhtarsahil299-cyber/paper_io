import Phaser from 'phaser';
import { CELL_SIZE, GRID_SIZE, START_RADIUS, STEP_MS, Grid, captureTerritory, Cell } from '@territory/shared';
import { InputSystem } from '../systems/InputSystem';
import { Player } from '../game/Player';

const PLAYER_ID = 1;
const COLORS = {
  floor: 0x0d1428,
  gridLine: 0x16203d,
  wall: 0x24305c,
  territory: 0x1fbfa0,
  territoryEdge: 0x3be8c4,
  trail: 0x8ff5e0,
  head: 0xffffff
};

export class GameScene extends Phaser.Scene {
  private grid!: Grid;
  private player!: Player;
  private inputSys!: InputSystem;

  private territoryGfx!: Phaser.GameObjects.Graphics;
  private trailGfx!: Phaser.GameObjects.Graphics;
  private head!: Phaser.GameObjects.Rectangle;

  private stepClock = 0;
  private territoryDirty = true;
  private trailDirty = true;
  private best = 0;

  private pctEl = document.getElementById('hud-pct')!;
  private bestEl = document.getElementById('hud-best')!;
  private hintEl = document.getElementById('hint')!;

  constructor() { super('GameScene'); }

  create(): void {
    const world = GRID_SIZE * CELL_SIZE;
    this.grid = new Grid(GRID_SIZE, GRID_SIZE);
    this.player = new Player(PLAYER_ID);
    this.inputSys = new InputSystem(this);

    this.drawBackground(world);
    this.territoryGfx = this.add.graphics().setDepth(1);
    this.trailGfx = this.add.graphics().setDepth(2);
    this.head = this.add.rectangle(0, 0, CELL_SIZE - 4, CELL_SIZE - 4, COLORS.head).setDepth(3);
    this.head.setStrokeStyle(2, COLORS.territoryEdge);

    this.cameras.main.setBounds(-120, -120, world + 240, world + 240);
    this.cameras.main.startFollow(this.head, true, 0.12, 0.12);

    this.resetMatch();
  }

  /** Start (or restart) with a small protected territory in the arena centre. */
  private resetMatch(): void {
    this.grid.clear();
    const c = Math.floor(GRID_SIZE / 2);
    this.grid.claimSquare(c, c, START_RADIUS, PLAYER_ID);
    this.player.spawn(c, c);
    this.stepClock = 0;
    this.territoryDirty = this.trailDirty = true;
    this.updateHud();
  }

  update(_t: number, delta: number): void {
    const req = this.inputSys.consume();
    if (req && this.player.canTurnTo(req)) {
      this.player.dir = req;
      this.hintEl.classList.add('hidden');
    }

    if (this.player.dir) {
      this.stepClock += delta;
      while (this.stepClock >= STEP_MS) {
        this.stepClock -= STEP_MS;
        this.step();
      }
    }
    this.render();
  }

  /** One logical move. Deterministic, so the server can run the same code later. */
  private step(): void {
    const p = this.player;
    const d = p.dir!;
    const nx = p.x + d.dx, ny = p.y + d.dy;

    p.prevX = p.x; p.prevY = p.y;
    if (!this.grid.inBounds(nx, ny)) return; // arena wall: hold position until player turns

    // Touching your own trail is fatal.
    if (p.onTrail(nx, ny, GRID_SIZE)) { this.eliminate(); return; }

    p.x = nx; p.y = ny;

    if (this.grid.getOwner(nx, ny) === PLAYER_ID) {
      if (p.trail.length > 0) {
        const trail = p.trail;
        p.clearTrail();
        const changed: Cell[] = captureTerritory(this.grid, PLAYER_ID, trail);
        if (changed.length) this.territoryDirty = true;
        this.trailDirty = true;
        this.updateHud();
      }
    } else {
      p.addTrail({ x: nx, y: ny }, GRID_SIZE);
      this.trailDirty = true;
    }
  }

  private eliminate(): void {
    this.cameras.main.shake(180, 0.006);
    this.hintEl.textContent = 'You hit your own trail. Back to the start.';
    this.hintEl.classList.remove('hidden');
    this.resetMatch();
  }

  private updateHud(): void {
    const pct = (this.grid.count(PLAYER_ID) / (GRID_SIZE * GRID_SIZE)) * 100;
    this.best = Math.max(this.best, pct);
    this.pctEl.textContent = `${pct.toFixed(1)}%`;
    this.bestEl.textContent = `${this.best.toFixed(1)}%`;
  }

  // ---------- rendering ----------

  private drawBackground(world: number): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(COLORS.wall, 1).fillRect(-8, -8, world + 16, world + 16);
    g.fillStyle(COLORS.floor, 1).fillRect(0, 0, world, world);
    g.lineStyle(1, COLORS.gridLine, 1);
    for (let i = 0; i <= GRID_SIZE; i++) {
      g.lineBetween(i * CELL_SIZE, 0, i * CELL_SIZE, world);
      g.lineBetween(0, i * CELL_SIZE, world, i * CELL_SIZE);
    }
  }

  private render(): void {
    const p = this.player;
    // Smoothly slide the head between the previous and current cell.
    const t = p.dir ? Math.min(this.stepClock / STEP_MS, 1) : 1;
    const vx = p.prevX + (p.x - p.prevX) * t;
    const vy = p.prevY + (p.y - p.prevY) * t;
    this.head.setPosition((vx + 0.5) * CELL_SIZE, (vy + 0.5) * CELL_SIZE);

    // Territory and trail are redrawn only when they change, not every frame.
    if (this.territoryDirty) {
      this.territoryDirty = false;
      const g = this.territoryGfx.clear();
      g.fillStyle(COLORS.territory, 1);
      for (let y = 0; y < GRID_SIZE; y++) {
        let runStart = -1;
        for (let x = 0; x <= GRID_SIZE; x++) {
          const mine = x < GRID_SIZE && this.grid.getOwner(x, y) === PLAYER_ID;
          if (mine && runStart < 0) runStart = x;
          if (!mine && runStart >= 0) {
            g.fillRect(runStart * CELL_SIZE, y * CELL_SIZE, (x - runStart) * CELL_SIZE, CELL_SIZE);
            runStart = -1;
          }
        }
      }
    }
    if (this.trailDirty) {
      this.trailDirty = false;
      const g = this.trailGfx.clear();
      g.fillStyle(COLORS.trail, 0.55);
      for (const c of p.trail) g.fillRect(c.x * CELL_SIZE + 2, c.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
  }
}
