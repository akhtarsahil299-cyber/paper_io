# Development tracker

## Architecture
Server-authoritative. Clients send only a direction (0-3). The server runs one simulation per room at 10 ticks/s,
resolves movement, trail cuts, head-on crashes, loop capture (flood fill) and scoring, then broadcasts player
positions/trails and territory deltas. Clients interpolate between ticks. Input is rate limited and validated.

## Done and tested
- [x] Territory, trails, loop capture, elimination (own trail, wall, enemy cut, head-on, losing all land)
- [x] Server-authoritative multiplayer over Socket.IO (works across networks when deployed)
- [x] Public matchmaking (auto-fills rooms; bots top rounds up to 6 players)
- [x] Private rooms: 5-char codes, share link (`/?room=CODE`), lobby, host starts, optional bots
- [x] Reconnect: same device token re-attaches within 12 s
- [x] Modes: Classic (2:30, respawn) and Survival (one life)
- [x] HUD: name, territory %, rank, kills, minimap, alive count, timer, top-5 board, menu, mute
- [x] 20 skins (solid, gradient, neon, checker, stripe, animated) with rarity, coin shop, equip
- [x] Profile (stats), daily reward, settings (volume/mute), synthesized sound effects
- [x] Leaderboard (all-time and weekly) from real finished rounds
- [x] Automated tests: rules, bots, matchmaking, private rooms, bad input, reconnect
- [x] Browser smoke test (headless Chromium): menu -> matchmaking -> steering -> capture

## Not done yet (be aware)
- [ ] PostgreSQL/Prisma: leaderboard lives in server memory and resets on restart; coins, skins and stats are
      stored in the browser (localStorage), so they are not tamper-proof and not shared across devices
- [ ] Accounts / authentication beyond anonymous device tokens
- [ ] Team Battle mode
- [ ] Friends leaderboard
- [ ] Client-side prediction (inputs show after one network round trip + <=100 ms)
- [ ] Not yet load-tested; not yet tested on real phones over mobile data (test after deploying)
