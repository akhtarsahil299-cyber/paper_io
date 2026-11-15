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

test('host creates a room, friend joins by code on another connection, host starts, both play', async () => {
  const host = await client('Host', 'hhhhhhhhhhhhhhhhhhhh02');
  const friend = await client('Friend', 'ffffffffffffffffffff03');
  const lobby = once(host, 'lobby');
  host.emit('create', { mode: 'classic', bots: false });
  const l = await lobby;
  assert.match(l.code, /^[A-Z0-9]{5}$/);
  assert.equal(l.youHost, true);
  const friendLobby = once(friend, 'lobby');
  friend.emit('join', { code: l.code.toLowerCase() });
  const fl = await friendLobby;
  assert.equal(fl.players.length, 2);
  assert.equal(fl.youHost, false);
  const i1 = once(host, 'init'), i2 = once(friend, 'init');
  friend.emit('start');                 // a non-host must be ignored
  host.emit('start');
  const [a, b] = await Promise.all([i1, i2]);
  assert.notEqual(a.you, b.you);
  assert.equal(a.roster.length, 2);
  host.emit('dir', 1);
  await once(host, 'tick'); const t = await once(host, 'tick');
  assert.equal(t.p.find((p: any) => p[0] === a.you)[3], 1, 'server applied the host input');
  assert.equal(srv.mgr.rooms.size >= 1, true);
});

test('there is no public matchmaking any more', async () => {
  const c = await client('Nope', 'nnnnnnnnnnnnnnnnnnnn07');
  let got = false;
  c.on('init', () => { got = true; }); c.on('lobby', () => { got = true; });
  c.emit('quick', { mode: 'classic' });
  await new Promise(r => setTimeout(r, 400));
  assert.equal(got, false);
});

test('bad input is rejected without crashing the server', async () => {
  const c = await client('Eve', 'eeeeeeeeeeeeeeeeeeee04');
  const err = once(c, 'err');
  c.emit('join', { code: 'ZZZZZ' });
  assert.match(await err, /not found/i);
  c.emit('dir', 'DROP TABLE'); c.emit('create', { mode: 'hax' }); c.emit('dir', 99);
  const ok = once(c, 'lobby'); c.emit('create', { mode: 'survival', bots: true });
  await ok;
});

test('reconnect: same token resumes the round on a new socket', async () => {
  const a = await client('Rita', 'rrrrrrrrrrrrrrrrrrrr05');
  const lobby = once(a, 'lobby'); a.emit('create', { mode: 'classic', bots: true });
  await lobby;
  const first = once(a, 'init'); a.emit('start');
  const { you } = await first;
  a.close();
  await new Promise(r => setTimeout(r, 300));
  const s = connect(url, { transports: ['websocket'], forceNew: true }); clients.push(s);
  const got = once(s, 'init');
  s.on('connect', () => s.emit('hello', { token: 'rrrrrrrrrrrrrrrrrrrr05', name: 'Rita', skin: 3 }));
  assert.equal((await got).you, you);
});

test('leaderboard endpoint answers', async () => {
  const c = await client('Lee', 'llllllllllllllllllll06');
  const res: any = await new Promise(r => c.emit('lb', null, r));
  assert.ok(Array.isArray(res.global) && Array.isArray(res.weekly));
});
