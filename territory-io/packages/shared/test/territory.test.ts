import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid, captureTerritory } from '../src';

const P = 1;

test('closing a loop captures the enclosed area', () => {
  const g = new Grid(12, 12);
  g.claimSquare(2, 2, 1, P);                 // start 3x3 at (1..3, 1..3)
  // leave from (3,2) east, loop around and return at (2,4)... build a rectangle trail
  const trail = [];
  for (let x = 4; x <= 8; x++) trail.push({ x, y: 2 });
  for (let y = 3; y <= 6; y++) trail.push({ x: 8, y });
  for (let x = 7; x >= 2; x--) trail.push({ x, y: 6 });
  for (let y = 5; y >= 4; y--) trail.push({ x: 2, y });
  const before = g.count(P);
  captureTerritory(g, P, trail);
  assert.ok(g.count(P) > before + trail.length - 1, 'interior should be captured');
  assert.equal(g.getOwner(5, 4), P, 'a cell inside the loop is owned');
  assert.equal(g.getOwner(10, 10), 0, 'a cell outside the loop is not owned');
});

test('open trail only claims the trail itself', () => {
  const g = new Grid(10, 10);
  g.claimSquare(1, 1, 1, P);
  const trail = [{ x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }];
  const before = g.count(P);
  captureTerritory(g, P, trail);
  assert.equal(g.count(P), before + 3);
});

test('returns only changed cells', () => {
  const g = new Grid(8, 8);
  g.claimSquare(1, 1, 1, P);
  const changed = captureTerritory(g, P, [{ x: 3, y: 1 }]);
  assert.equal(changed.length, 1);
});
