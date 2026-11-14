# TERRITORY.IO

Real-time multiplayer territory conquest game (Phaser 3 + TypeScript + Socket.IO).
**Current status: Phase 1 complete (single-player core).** See DEVELOPMENT.md.

## Requirements
- Node.js 18+ and npm 9+

## Run
```bash
npm install
npm run dev        # http://localhost:5173 (also reachable on your LAN)
```
Other commands: `npm run build`, `npm run typecheck`, `npm test`.

## Controls
- Desktop: arrow keys or WASD
- Mobile: swipe in the direction you want to turn

## Structure
- `apps/client` — Vite + Phaser 3 game client
- `apps/server` — Node/Socket.IO server (Phase 3)
- `packages/shared` — grid + territory logic used by both client and server

## Environment variables
None yet. The server phases will add `DATABASE_URL`, `PORT`, `CLIENT_ORIGIN`, `JWT_SECRET`
(documented in `.env.example` when introduced).
