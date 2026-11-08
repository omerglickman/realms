// Roads and bridges on the map (Phase 2 session 2; UI-DESIGN.md §4): drawn
// between the terrain and the settlements. A road hex is a dot; between two
// hexes whose roads are linked (both built, or one a settlement) a segment runs
// centre to centre — a dirt road a brown ribbon with an ink casing, a paved road
// a pale stone band with dark edges. A bridge is a tan deck with ink rails on
// the river hex, along the road through it. Sparse, so one Graphics redrawn when
// the infrastructure (or the zoom's line weight) changes. Purely visual.

import { Container, Graphics } from 'pixi.js';
import type { GameState } from '../../sim/state';
import { offsetToPixel } from '../../sim/hex';
import { neighbourCells } from '../../sim/pathfinding';
import { settlementIdAt } from '../../sim/settlements';
import { HEX_SIZE } from './mapRenderer';

const INK = 0x2b1d12;
const DIRT = 0x8a6238;
const STONE = 0xc9c1ad;
const STONE_EDGE = 0x5a5246;
const DECK = 0xc8a266;
/** How far a road may wander sideways, as a share of the hex-to-hex distance (Omer 2026-11-08: slightly meandering, not straight). */
const MEANDER = 0.42; // control-point offset as a share of the segment length (min 40% of it is guaranteed)
const BRIDGE_BEND = 0.25; // a deck stays nearly straight

export class InfraLayer {
  readonly root = new Container();
  private g = new Graphics();
  private lastKey = '';

  constructor() { this.root.addChild(this.g); }

  /** Redraw when the roads / bridges (or the zoom bucket) changed. */
  update(state: GameState, zoom: number, previewCells?: number[] | null): void {
    const roads = state.infra?.roads ?? {};
    const bridges = state.infra?.bridges ?? {};
    const rk = Object.keys(roads), bk = Object.keys(bridges);
    const key = `${rk.length}:${bk.length}:${rk.reduce((t, c) => t + Number(c) * (roads[c] ?? 0), 0)}:${Math.round(Math.log2(zoom) * 2)}:${state.map.width}`;
    if (key === this.lastKey && !previewCells) return;
    this.lastKey = key;
    const map = state.map;
    const w = map.width;
    const g = this.g;
    g.clear();
    const level = (cell: number): number => {
      const b = roads[cell] ?? 0;
      if (b > 0) return b;
      return settlementIdAt(state, cell % w, Math.floor(cell / w)) !== null ? 1 : 0;
    };
    const centre = (cell: number) => offsetToPixel(cell % w, Math.floor(cell / w), HEX_SIZE);
    // the weight is nearly constant on screen: thinner in world units when zoomed in
    const k = Math.max(0.55, Math.min(1.6, 1 / Math.sqrt(Math.max(0.25, zoom))));
    const segs: { a: number; b: number; lvl: number; bridge: boolean }[] = [];
    const dots: number[] = [];
    for (const c of rk) {
      const cell = Number(c);
      const lv = roads[cell] ?? 0;
      if (lv <= 0) continue;
      let linked = false;
      for (const n of neighbourCells(map, cell)) {
        if (n === null) continue;
        const ln = level(n);
        if (ln <= 0) continue;
        linked = true;
        const nIsBuilt = (roads[n] ?? 0) > 0;
        if (nIsBuilt && n < cell) continue; // each built-built pair once
        segs.push({ a: cell, b: n, lvl: Math.min(lv, ln), bridge: !!bridges[cell] || !!bridges[n] });
      }
      if (!linked) dots.push(cell);
    }
    // a road wanders a little: a cubic S-curve from centre to centre whose two
    // bends come from a fixed hash of the pair, so it looks the same on every redraw
    const hash01 = (n: number): number => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const line = (a: number, b: number, width: number, color: number, alpha = 1, bend = 1) => {
      const pa = centre(a), pb = centre(b);
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const seed = Math.min(a, b) * 7919 + Math.max(a, b);
      const sign = a < b ? 1 : -1; // same curve whichever way the pair is given
      // each bend has a random side and a magnitude of 40–100% of MEANDER, so no road is ever straight
      const bendOf = (h: number, h2: number): number => (0.4 + 0.6 * h) * (h2 < 0.5 ? -1 : 1);
      const o1 = bendOf(hash01(seed), hash01(seed + 0.25)) * MEANDER * len * bend * sign;
      const o2 = bendOf(hash01(seed + 0.5), hash01(seed + 0.75)) * MEANDER * len * bend * sign;
      g.moveTo(pa.x, pa.y)
        .bezierCurveTo(pa.x + dx / 3 + nx * o1, pa.y + dy / 3 + ny * o1, pa.x + 2 * dx / 3 + nx * o2, pa.y + 2 * dy / 3 + ny * o2, pb.x, pb.y)
        .stroke({ width, color, alpha, cap: 'round', join: 'round' });
    };
    // casings first, then fills, so crossings join cleanly
    for (const s of segs) {
      if (s.bridge) line(s.a, s.b, 5.2 * k, INK, 1, BRIDGE_BEND);
      else line(s.a, s.b, (s.lvl >= 2 ? 4.2 : 3.6) * k, INK, s.lvl >= 2 ? 1 : 0.85);
    }
    for (const s of segs) {
      if (s.bridge) line(s.a, s.b, 3.8 * k, DECK, 1, BRIDGE_BEND);
      else if (s.lvl >= 2) { line(s.a, s.b, 3.4 * k, STONE_EDGE); line(s.a, s.b, 2.2 * k, STONE); }
      else line(s.a, s.b, 2.3 * k, DIRT);
    }
    for (const cell of dots) {
      const p = centre(cell);
      g.circle(p.x, p.y, 2.2 * k).fill({ color: roads[cell] >= 2 ? STONE : DIRT }).stroke({ width: 0.9 * k, color: INK });
    }
    // a bridge hex not (yet) joined to anything: a small deck so it still shows
    for (const c of bk) {
      const cell = Number(c);
      if (segs.some((s) => s.a === cell || s.b === cell)) continue;
      const p = centre(cell);
      g.roundRect(p.x - 3.5 * k, p.y - 1.6 * k, 7 * k, 3.2 * k, 0.8 * k).fill({ color: DECK }).stroke({ width: 0.9 * k, color: INK });
    }
  }
}
