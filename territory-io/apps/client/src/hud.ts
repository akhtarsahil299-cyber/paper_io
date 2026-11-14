import { GRID_SIZE } from '@territory/shared';
import { skinOf } from './skins';
import { profile } from './store';
import { sfx } from './audio';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface HudData {
  name: string; pct: number; rank: number; kills: number; alive: number; time: number;
  board: { name: string; pct: number; me: boolean; color: string }[];
}

let toastTimer = 0;
const cache: Record<string, string> = {};
function setText(id: string, v: string): void { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }

export const hud = {
  show(v: boolean): void { $('hud').classList.toggle('hidden', !v); },
  update(d: HudData): void {
    setText('h-name', d.name);
    setText('h-pct', d.pct.toFixed(1) + '%');
    setText('h-rank', d.rank ? '#' + d.rank : '-');
    setText('h-kills', String(d.kills));
    setText('h-alive', String(d.alive));
    const m = Math.floor(d.time / 60), s = d.time % 60;
    setText('h-time', `${m}:${String(s).padStart(2, '0')}`);
    const html = d.board.map((b, i) =>
      `<li class="${b.me ? 'me' : ''}"><i style="background:${b.color}"></i><span>${i + 1}. ${esc(b.name)}</span><b>${b.pct.toFixed(1)}%</b></li>`).join('');
    if (cache.board !== html) { cache.board = html; $('h-board').innerHTML = html; }
  },
  minimap(owner: Uint8Array, skins: Map<number, number>, me?: { x: number; y: number }): void {
    const c = $<HTMLCanvasElement>('h-mini'), ctx = c.getContext('2d')!;
    const img = ctx.createImageData(GRID_SIZE, GRID_SIZE);
    const pal = new Map<number, number>();
    for (const [id, sk] of skins) pal.set(id, skinOf(sk).c1);
    for (let i = 0; i < owner.length; i++) {
      const col = owner[i] ? pal.get(owner[i]) ?? 0x888888 : 0xe6eaf6;
      img.data[i * 4] = col >> 16; img.data[i * 4 + 1] = (col >> 8) & 255; img.data[i * 4 + 2] = col & 255; img.data[i * 4 + 3] = owner[i] ? 255 : 150;
    }
    ctx.putImageData(img, 0, 0);
    if (me) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.fillRect(me.x - 2, me.y - 2, 5, 5); ctx.strokeRect(me.x - 2.5, me.y - 2.5, 6, 6); }
  },
  toast(text: string): void {
    const t = $('h-toast'); t.textContent = text; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t.classList.remove('on'), 1800);
  },
  bind(onMenu: () => void): void {
    $('h-menu').onclick = () => { sfx.click(); onMenu(); };
    const mute = $('h-mute');
    const paint = () => { mute.classList.toggle('off', profile.muted); };
    mute.onclick = () => { sfx.unlock(); sfx.setMuted(!profile.muted); paint(); sfx.click(); };
    paint();
  }
};
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
