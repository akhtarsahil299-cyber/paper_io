# Development tracker

## Architecture
Server-authoritative. Game rules live in `packages/shared` as pure functions on a `Grid`
(owner map), so the same code runs in the client now and on the server in Phase 3.
Movement is tick-based (one cell per `STEP_MS`); the client only interpolates visuals.

## Phase 1 — Foundation (DONE, tested)
- [x] Monorepo (npm workspaces), TypeScript, Vite
- [x] Phaser canvas, responsive resize, camera follow
- [x] Grid movement: keyboard (arrows/WASD) and swipe
- [x] Start territory, trail drawing, closing a loop captures enclosed area (flood-fill)
- [x] Territory % HUD, best %
- [x] Unit tests for territory capture (3 passing)
- [x] Touching own trail resets the run (temporary stand-in for Phase 2 elimination)

## Phase 2 — Collisions, capture polish, bots (TODO)
## Phase 3 — Node server + Socket.IO sync (TODO)
## Phase 4 — Private rooms, matchmaking, reconnect (TODO)
## Phase 5 — Menu, skins, profiles, leaderboards (TODO)
## Phase 6 — Audio, animation, perf, security (TODO)
## Phase 7 — Deployment, cross-network tests, docs (TODO)

## Known limitations
- Single player only; no opponents, server, database, audio or skins yet.
- Not yet tested on a physical phone; browser run verified only via build + unit tests here.
