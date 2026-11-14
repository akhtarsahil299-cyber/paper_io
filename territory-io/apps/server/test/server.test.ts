import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect, Socket } from 'socket.io-client';
import { createGameServer } from '../src/server';

let srv: ReturnType<typeof createGameServer>;
let url = '';
const clients: Socket[] = [];

before(async () => { srv = createGameServer(); url = `http://localhost:${await srv.listen(0)}`; });
after(async () => { clients.forEach(c => c.close()); await srv.close(); });

function client(name: string, token: string): Promise<Socket> {
  return new Promise(res => {
    const s = connect(url, { transports: ['websocket'], forceNew: true });
    clients.push(s);
    s.on('connect', () => { s.emit('hello', { token, name, skin: 3 }); res(s); });
  });
}
const once = <T = any>(s: Socket, ev: string, ms = 3000) =>
  new Promise<T>((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms); s.once(ev, d => { clearTimeout(t); res(d); }); });

test('public matchmaking: player gets init, ticks, bots, and can steer', async () => {
  const a = await client('Alice', 'aaaaaaaaaaaaaaaaaaaa01');
  const init = once(a, 'init');
  a.emit('quick', { mode: 'classic' });
  const msg = await init;
  assert.equal(msg.grid, 80);
  assert.ok(msg.you >= 1);
  assert.ok(msg.roster.length >= 6, 'bots fill the round');
  assert.ok(msg.roster.some((r: any) => r.bot));
  const tick = await once(a, 'tick');
  assert.ok(tick.p.length >= 6);
  a.emit('dir', 1);
  await once(a, 'tick'); const t2 = await once(a, 'tick');
  const me = t2.p.find((p: any) => p[0] === msg.you);
  assert.equal(me[3], 1, 'server applied the direction');
});

test('private room: create, join by code, host starts, both receive the round', async () => {
  const host = await client('Host', 'hhhhhhhhhhhhhhhhhhhh02');
  const friend = await client('Friend', 'ffffffffffffffffffff03');
  const lobby = once(host, 'lobby');
  host.emit('create', { mode: 'survival', bots: false });
  const l = await lobby;
  assert.match(l.code, /^[A-Z0-9]{5}$/);
  assert.equal(l.youHost, true);
  const friendLobby = once(friend, 'lobby');
  friend.emit('join', { code: l.code });
  const fl = await friendLobby;
  assert.equal(fl.players.length, 2);
  assert.equal(fl.youHost, false);
  const i1 = once(host, 'init'), i2 = once(friend, 'init');
  friend.emit('start');                 // non-host must be ignored
  host.emit('start');
  const [a, b] = await Promise.all([i1, i2]);
  assert.notEqual(a.you, b.you);
  assert.equal(a.roster.length, 2);
});

test('bad input is rejected without crashing the server', async () => {
  const c = await client('Eve', 'eeeeeeeeeeeeeeeeeeee04');
  const err = once(c, 'err');
  c.emit('join', { code: 'ZZZZZ' });
  assert.match(await err, /not found/i);
  c.emit('dir', 'DROP TABLE'); c.emit('quick', { mode: 'hax' }); c.emit('dir', 99);
  const ok = once(c, 'init'); c.emit('quick', { mode: 'classic' });
  await ok;
});

test('reconnect: same token resumes the round on a new socket', async () => {
  const a = await client('Rita', 'rrrrrrrrrrrrrrrrrrrr05');
  const first = once(a, 'init'); a.emit('quick', { mode: 'classic' });
  const { you } = await first;
  a.close();
  await new Promise(r => setTimeout(r, 300));
  const b = await new Promise<Socket>(res => {
    const s = connect(url, { transports: ['websocket'], forceNew: true }); clients.push(s);
    s.on('init', () => {}); const got = once(s, 'init');
    s.on('connect', () => { s.emit('hello', { token: 'rrrrrrrrrrrrrrrrrrrr05', name: 'Rita', skin: 3 }); got.then(m => { assert.equal(m.you, you); res(s); }); });
  });
  assert.ok(b.connected);
});

test('leaderboard endpoint answers', async () => {
  const c = await client('Lee', 'llllllllllllllllllll06');
  const res: any = await new Promise(r => c.emit('lb', null, r));
  assert.ok(Array.isArray(res.global) && Array.isArray(res.weekly));
});
