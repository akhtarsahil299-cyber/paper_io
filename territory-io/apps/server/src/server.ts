import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { MODES, SKIN_COUNT, type Mode } from '@territory/shared';
import { Leaderboard } from './leaderboard';
import { RoomManager } from './manager';

/** Token bucket: `rate` events/second with a burst allowance. */
class Bucket {
  private tokens: number; private last = Date.now();
  constructor(private rate: number, private burst: number) { this.tokens = burst; }
  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens--; return true;
  }
}
const cleanName = (v: unknown): string =>
  (typeof v === 'string' ? v : '').replace(/[^\p{L}\p{N} _\-.!]/gu, '').trim().slice(0, 14) || 'Player';
const validToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(v);
const validMode = (v: unknown): v is Mode => typeof v === 'string' && (MODES as string[]).includes(v);

export function createGameServer() {
  const app = express();
  app.disable('x-powered-by');
  const http = createServer(app);
  const origins = process.env.CLIENT_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean);
  const io = new Server(http, { cors: origins ? { origin: origins } : undefined, maxHttpBufferSize: 1e4 });
  const lb = new Leaderboard();
  const mgr = new RoomManager(io, lb);

  const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  app.get('/health', (_q, r) => { r.json({ ok: true, rooms: mgr.rooms.size, online: io.engine.clientsCount }); });
  if (existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h' }));
    app.use((_q, r) => r.sendFile(resolve(dist, 'index.html')));
  }

  const onlineTimer = setInterval(() => io.emit('online', io.engine.clientsCount), 5000);

  io.on('connection', socket => {
    const slow = new Bucket(4, 8);       // menu actions
    const fast = new Bucket(40, 60);     // direction inputs
    const guard = (fn: (d: any) => void) => (d: unknown) => {
      if (!slow.take()) return;
      try { fn(d as any); } catch (e) { console.error('handler error', e); socket.emit('err', 'Something went wrong.'); }
    };
    const ready = () => validToken((socket.data as { token?: unknown }).token);

    socket.emit('online', io.engine.clientsCount);

    socket.on('hello', guard(d => {
      if (!validToken(d?.token)) return;
      const skin = Number.isInteger(d.skin) && d.skin >= 0 && d.skin < SKIN_COUNT ? d.skin : 0;
      socket.data = { token: d.token, name: cleanName(d.name), skin };
      mgr.resume(socket);
    }));
    socket.on('quick', guard(d => { if (ready() && validMode(d?.mode)) mgr.quick(socket, d.mode); }));
    socket.on('create', guard(d => { if (ready() && validMode(d?.mode)) mgr.create(socket, d.mode, !!d.bots); }));
    socket.on('join', guard(d => {
      if (!ready()) return;
      const code = typeof d?.code === 'string' ? d.code.trim().toUpperCase() : '';
      if (!/^[A-Z0-9]{5}$/.test(code)) return void socket.emit('err', 'Room codes have 5 letters or numbers.');
      const err = mgr.join(socket, code);
      if (err) socket.emit('err', err);
    }));
    socket.on('start', guard(() => { if (ready()) mgr.roomOf(socket)?.startByHost(socket.data.token); }));
    socket.on('leave', guard(() => { if (ready()) mgr.leave(socket); }));
    socket.on('lb', (_d: unknown, ack: unknown) => {
      if (slow.take() && typeof ack === 'function') ack({ global: lb.top(0), weekly: lb.top(7 * 864e5) });
    });
    socket.on('dir', (d: unknown) => {
      if (!fast.take() || !ready() || typeof d !== 'number') return;
      mgr.roomOf(socket)?.setDir(socket.data.token, d);
    });
    socket.on('disconnect', () => mgr.disconnect(socket));
  });

  return {
    http, io, mgr, lb,
    listen: (port: number) => new Promise<number>(res => http.listen(port, () => res((http.address() as { port: number }).port))),
    close: () => new Promise<void>(res => {
      clearInterval(onlineTimer);
      for (const r of mgr.rooms.values()) r.destroy();
      io.close(() => res());
    })
  };
}
