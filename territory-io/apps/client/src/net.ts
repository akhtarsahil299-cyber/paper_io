import { io, Socket } from 'socket.io-client';
import type { LbMsg, Mode } from '@territory/shared';
import { bus } from './bus';
import { profile } from './store';

let socket: Socket | null = null;
let lastDir = -2;

const forward = ['joined', 'lobby', 'init', 'tick', 'roster', 'dead', 'end', 'err', 'online'];

export const net = {
  connect(): void {
    // Same origin in production and (via Vite proxy) in dev; works across any network.
    socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 3000 });
    socket.on('connect', () => { this.hello(); bus.emit('net', true); });
    socket.on('disconnect', () => bus.emit('net', false));
    socket.on('connect_error', () => bus.emit('net', false));
    for (const ev of forward) socket.on(ev, d => bus.emit(ev, d));
  },
  hello(): void { socket?.emit('hello', { token: profile.token, name: profile.name, skin: profile.skin }); },
  get connected(): boolean { return !!socket?.connected; },
  quick(mode: Mode): void { this.hello(); lastDir = -2; socket?.emit('quick', { mode }); },
  create(mode: Mode, bots: boolean): void { this.hello(); lastDir = -2; socket?.emit('create', { mode, bots }); },
  join(code: string): void { this.hello(); lastDir = -2; socket?.emit('join', { code }); },
  start(): void { socket?.emit('start'); },
  leave(): void { socket?.emit('leave'); },
  dir(d: number): void { if (d !== lastDir) { lastDir = d; socket?.emit('dir', d); } },
  resetDir(): void { lastDir = -2; },
  leaderboard(): Promise<LbMsg> {
    return new Promise(res => {
      if (!socket?.connected) return res({ global: [], weekly: [] });
      const t = setTimeout(() => res({ global: [], weekly: [] }), 4000);
      socket.emit('lb', null, (r: LbMsg) => { clearTimeout(t); res(r); });
    });
  }
};
