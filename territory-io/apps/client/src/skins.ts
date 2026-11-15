export type SkinKind = 'solid' | 'gradient' | 'neon' | 'checker' | 'stripe' | 'anim';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export interface Skin { id: number; name: string; rarity: Rarity; price: number; kind: SkinKind; c1: number; c2: number }

const S = (id: number, name: string, rarity: Rarity, price: number, kind: SkinKind, c1: number, c2 = c1): Skin =>
  ({ id, name, rarity, price, kind, c1, c2 });

/** 20 original skins. Add a row here (and bump SKIN_COUNT in shared) to add more. */
export const SKINS: Skin[] = [
  S(0, 'Mint', 'common', 0, 'solid', 0x2fd6a6),
  S(1, 'Coral', 'common', 0, 'solid', 0xff6b6b),
  S(2, 'Sky', 'common', 0, 'solid', 0x4aa8ff),
  S(3, 'Lemon', 'common', 0, 'solid', 0xffc93c),
  S(4, 'Violet', 'common', 120, 'solid', 0x8e6bff),
  S(5, 'Lime', 'common', 120, 'solid', 0x8ad82f),
  S(6, 'Rose', 'common', 120, 'solid', 0xf264a8),
  S(7, 'Sunset', 'rare', 260, 'gradient', 0xff6a5c, 0xffc93c),
  S(8, 'Ocean', 'rare', 260, 'gradient', 0x1ec8e8, 0x3b5bff),
  S(9, 'Aurora', 'rare', 300, 'gradient', 0x38e8a6, 0x8e6bff),
  S(10, 'Candy', 'rare', 300, 'gradient', 0xff8ad1, 0x7ad7ff),
  S(11, 'Chess', 'rare', 360, 'checker', 0x30343f, 0xe8ebf2),
  S(12, 'Neon Pink', 'epic', 480, 'neon', 0xff2fa0),
  S(13, 'Neon Lime', 'epic', 480, 'neon', 0x9dff1a),
  S(14, 'Cyber Blue', 'epic', 520, 'neon', 0x19c6ff),
  S(15, 'Candy Stripe', 'epic', 540, 'stripe', 0xff4f6d, 0xffffff),
  S(16, 'Rainbow Pulse', 'legendary', 1200, 'anim', 0xff5db1),
  S(17, 'Plasma', 'legendary', 1500, 'anim', 0x7a5cff),
  S(18, 'Gold Rush', 'legendary', 2000, 'anim', 0xffbf1f),
  S(19, 'Void', 'legendary', 2600, 'anim', 0x2a1a63)
];
export const skinOf = (id: number): Skin => SKINS[id] ?? SKINS[0];
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9aa6c4', rare: '#4aa8ff', epic: '#c15bff', legendary: '#ffb81f'
};

export function lerpColor(a: number, b: number, t: number): number {
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255, br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t) | 0;
}
export const lighten = (c: number, t: number): number => lerpColor(c, 0xffffff, t);
export const darken = (c: number, t: number): number => lerpColor(c, 0x000000, t);
export function hue(h: number): number { // h in 0..1
  const f = (n: number) => { const k = (n + h * 12) % 12; return 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** CSS background for DOM previews (menus, lobby, leaderboard). */
export function skinCss(id: number): string {
  const s = skinOf(id), a = hex(s.c1), b = hex(s.c2);
  switch (s.kind) {
    case 'gradient': return `linear-gradient(135deg, ${a}, ${b})`;
    case 'checker': return `repeating-conic-gradient(${a} 0 25%, ${b} 0 50%) 0 0/16px 16px`;
    case 'stripe': return `repeating-linear-gradient(45deg, ${a} 0 7px, ${b} 7px 14px)`;
    case 'neon': return `radial-gradient(circle at 35% 30%, #fff8, ${a} 55%)`;
    case 'anim': return `conic-gradient(from 0deg, ${a}, #ffffff, ${hex(lighten(s.c1, .35))}, ${a})`;
    default: return a;
  }
}
