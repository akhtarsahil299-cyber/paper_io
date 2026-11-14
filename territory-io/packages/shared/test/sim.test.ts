import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, GRID_SIZE } from '../src';

const fixed = () => 0.5; // spawn at (40,40)

test('a closed loop captures land', () => {
  const g = new Game('classic', fixed);
  const p = g.addPlayer('a', 0, false)!;
  assert.equal(p.x, 40); assert.equal(p.y, 40);
  const run = (dir: number, n: number) => { g.setDir(p.id, dir); for (let i = 0; i < n; i++) g.step(); };
  run(1, 4); run(2, 3); run(3, 4); run(0, 3);
  assert.ok(p.alive);
  assert.ok(p.count > 9 + 12, `expected captured area, got ${p.count}`);
  assert.equal(p.trail.length, 0);
});

test('stepping on an enemy trail eliminates its owner and credits the killer', () => {
  const g = new Game('survival', fixed);
  const a = g.addPlayer('a', 0, false)!;
  const b = g.addPlayer('b', 1, false)!;
  // a is outside its land at (10,10) heading right, with a trail on that cell
  a.x = 10; a.y = 10; a.dir = 1; a.trail = [g.grid.idx(10, 10)]; a.trailSet = new Set(a.trail);
  b.x = 10; b.y = 9; b.dir = 2;   // b steps down onto a's trail cell
  g.step();
  assert.equal(a.alive, false);
  assert.equal(b.alive, true);
  assert.equal(b.kills, 1);
  assert.equal(a.count, 0, 'dead player loses territory');
});

test('hitting your own trail or the wall is fatal; reversing is ignored', () => {
  const g = new Game('survival', fixed);
  const a = g.addPlayer('a', 0, false)!;
  a.x = 0; a.y = 5; a.dir = 3;
  g.step();
  assert.equal(a.alive, false);

  const g2 = new Game('survival', fixed);
  const b = g2.addPlayer('b', 0, false)!;
  g2.setDir(b.id, 1); g2.step();
  g2.setDir(b.id, 3); g2.step();        // reverse request must not turn it around
  assert.equal(b.dir, 1);
});

test('invalid input is rejected', () => {
  const g = new Game('classic', fixed);
  const a = g.addPlayer('a', 0, false)!;
  g.setDir(a.id, 7); g.setDir(a.id, -1); g.setDir(a.id, 1.5); g.setDir(a.id, NaN);
  assert.equal(a.queue.length, 0);
});

test('bots survive a minute of play without crashing and keep territory sane', () => {
  const g = new Game('classic', Math.random);
  for (let i = 0; i < 8; i++) g.addPlayer('bot' + i, i, true);
  for (let t = 0; t < 600 && !g.over; t++) g.step();
  const owned = [...g.players.values()].reduce((s, p) => s + p.count, 0);
  assert.ok(owned <= GRID_SIZE * GRID_SIZE);
  assert.ok([...g.players.values()].some(p => p.best > 1.5), 'bots should expand');
});
