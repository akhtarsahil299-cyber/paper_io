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

## If the menu says "Connecting to server..." forever
The page loaded but it cannot reach the game server. Check, in order:
1. Open `https://<your-app>.onrender.com/health`. You should see `{"ok":true,...}`. If you get "Not Found" or a blank page,
   the app was deployed as a **Static Site**. Create a **Web Service** instead (settings above); a Static Site cannot run the game server.
2. Free Web Services sleep when idle. Wait up to a minute and refresh.
3. Hosting the page somewhere else (Vercel/Netlify/Static Site)? Deploy the Web Service for the server, then build the page with
   `VITE_SERVER_URL=https://<your-server>.onrender.com npm run build` (set it as an environment variable in the page host's build settings).

## Environment variables
| Name | Where | Purpose |
|---|---|---|
| `PORT` | server | Port to listen on (Render sets it automatically; default 3001) |
| `CLIENT_ORIGIN` | server | Optional comma-separated allow-list of page origins (default: any) |
| `NODE_VERSION` | Render | Set to `20` |
| `VITE_SERVER_URL` | client build | Only when the page is hosted separately from the server |

## Tests
```bash
npm test         # engine rules + real Socket.IO matchmaking/rooms/reconnect tests
npm run typecheck
```

## Structure
- `packages/shared` game rules, bot AI, protocol (pure TypeScript, used by the server)
- `apps/server` Express + Socket.IO: rooms, matchmaking, tick loop, leaderboard
- `apps/client` Vite + Phaser 3: rendering, menus, HUD, audio
