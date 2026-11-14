import type { Server, Socket } from 'socket.io';
import type { Mode } from '@territory/shared';
import { Human, Room } from './rooms';
import type { Leaderboard } from './leaderboard';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  rooms = new Map<string, Room>();
  byToken = new Map<string, Room>();
  constructor(private io: Server, private lb: Leaderboard) {}

  private code(): string {
    for (;;) {
      let c = '';
      for (let i = 0; i < 5; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      if (!this.rooms.has(c)) return c;
    }
  }
  private make(mode: Mode, isPublic: boolean, bots: boolean): Room {
    const r = new Room(this.io, this.code(), mode, isPublic, bots, this.lb, room => this.drop(room));
    this.rooms.set(r.code, r);
    return r;
  }
  private drop(room: Room): void {
    this.rooms.delete(room.code);
    for (const [t, r] of this.byToken) if (r === room) this.byToken.delete(t);
  }
  private human(socket: Socket): Human {
    const d = socket.data as { token: string; name: string; skin: number };
    return { token: d.token, name: d.name, skin: d.skin, slot: 0, sid: socket.id, discAt: 0 };
  }

  /** Called on every hello: re-attach a returning player to the round they were in. */
  resume(socket: Socket): boolean {
    const token = (socket.data as { token: string }).token;
    const room = this.byToken.get(token);
    const h = room?.humans.get(token);
    if (!room || !h) return false;
    if (h.sid !== socket.id) room.rebind(h, socket);
    return true;
  }
  roomOf(socket: Socket): Room | undefined { return this.byToken.get((socket.data as { token: string }).token); }

  leave(socket: Socket): void {
    const token = (socket.data as { token: string }).token;
    const room = this.byToken.get(token);
    this.byToken.delete(token);
    room?.remove(token, socket);
  }
  disconnect(socket: Socket): void {
    const token = (socket.data as { token?: string }).token;
    if (!token) return;
    const room = this.byToken.get(token);
    const h = room?.humans.get(token);
    if (room && h && h.sid === socket.id) room.disconnected(token);
  }

  create(socket: Socket, mode: Mode, bots: boolean): void {
    this.leave(socket);
    this.attach(this.make(mode, false, bots), socket);
  }
  join(socket: Socket, code: string): string | null {
    const room = this.rooms.get(code);
    if (!room || room.dead) return 'Room not found. Check the code and try again.';
    if (room.full) return 'That room is full.';
    this.leave(socket);
    this.attach(room, socket);
    return null;
  }
  private attach(room: Room, socket: Socket): void {
    const h = this.human(socket);
    this.byToken.set(h.token, room);
    room.add(h, socket);
  }
}
