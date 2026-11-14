type H = (d: any) => void;
const map = new Map<string, Set<H>>();
/** Tiny event bus connecting network, UI and the Phaser scene. */
export const bus = {
  on(ev: string, h: H): () => void {
    if (!map.has(ev)) map.set(ev, new Set());
    map.get(ev)!.add(h);
    return () => map.get(ev)?.delete(h);
  },
  emit(ev: string, d?: unknown): void { map.get(ev)?.forEach(h => h(d)); }
};
