# TERRITORY.IO

A real-time multiplayer territory-conquest game (Phaser 3 + TypeScript client, Node + Socket.IO server).
Drag out of your zone, loop back, and claim everything you enclose. Cut other players' trails to eliminate them.

## Run locally
Requires Node.js 18+.
```bash
npm install
npm run dev          # client http://localhost:5173, server :3001
```
Open the client URL. For a phone on the same Wi-Fi use `http://<your-computer-IP>:5173`.

Production-style run (one process serves the game and the sockets):
```bash
npm run build
npm start            # http://localhost:3001
```

## Controls
Arrow keys / WASD, or swipe on touch screens.

## Deploy on Render (one service, one link)
1. Push this repo to GitHub (repo root must contain `package.json`, `apps/`, `packages/`).
2. Render -> New -> **Web Service** -> connect the repo.
3. Settings:
   - Runtime: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Environment variable: `NODE_VERSION` = `20`
4. Deploy. Share the `https://<name>.onrender.com` link; anyone on any network can play.

Free instances sleep after ~15 minutes idle; the first visit then takes 30-60 s to wake up.
Health check path: `/health`.

## Environment variables
| Name | Where | Purpose |
|---|---|---|
| `PORT` | server | Port to listen on (Render sets it automatically; default 3001) |
| `CLIENT_ORIGIN` | server | Comma-separated allowed origins, only needed if the client is hosted elsewhere |
| `NODE_VERSION` | Render | Set to `20` |

## Tests
```bash
npm test         # engine rules + real Socket.IO matchmaking/rooms/reconnect tests
npm run typecheck
```

## Structure
- `packages/shared` game rules, bot AI, protocol (pure TypeScript, used by the server)
- `apps/server` Express + Socket.IO: rooms, matchmaking, tick loop, leaderboard
- `apps/client` Vite + Phaser 3: rendering, menus, HUD, audio
