// Unit layer for PixiJS 8 (Phase 2 session 1b; UI-DESIGN.md §4, §6): every
// unit as a heater shield in its faction's colour with an ink border and the
// unit type's icon in parchment; several units on one hex are one shield with
// a count; a party still forming is drawn at 60 % on its settlement's hex,
// offset to the upper-left of the settlement marker; a selected unit has a
// white ring and shows its remaining route as a dotted ink line; a unit that
// cannot move shows a small vermilion mark. Movement is animated: after End
// month the shields glide hex to hex along the path they walked (≈ 120 ms a
// hex, ease-in-out). Also draws the route preview while the player is choosing
// a destination. Purely visual: never changes state.

import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import type { GameState } from '../../sim/state';
import { type Unit, unitTypeDef, isForming, unitCell, routeFor } from '../../sim/units';
import { settlementIdAt } from '../../sim/settlements';
import { factionColor } from '../../sim/factions';
import { colorToNumber } from '../../sim/terrain';
import { offsetToPixel } from '../../sim/hex';
import { HEX_SIZE } from './mapRenderer';
import { SettlementLayer } from './settlementLayer';
import { iconTexture, MAP_MARK } from '../icons';
import { zoomLevel } from '../zoomLevels';

export interface UnitView {
  hover: string | null;
  selected: string | null;
  zoom: number;
  /** a route being previewed (world-space path of hexes, months) while the player picks a destination */
  preview: { cells: number[]; months: number; label: string } | null;
}

/** A unit's path this month, for the gliding animation: the hexes it passed through, in order (the start first). */
export interface UnitPath { id: string; cells: number[] }

const MS_PER_HEX = 120;
const SHIELD_H = HEX_SIZE * 1.1; // ≈ 0.55 hex tall
const COUNT_STYLE = new TextStyle({ fontFamily: 'Alegreya, Georgia, serif', fontSize: 11, fontWeight: '700', fill: 0xf6eed8, stroke: { color: 0x2b1d12, width: 3 } });
const MONTHS_STYLE = new TextStyle({ fontFamily: 'Alegreya, Georgia, serif', fontSize: 12, fontWeight: '700', fill: 0xffffff, stroke: { color: 0x2b1d12, width: 3 } });

interface Marker {
  root: Container;
  shield: Graphics;
  icon: Sprite;
  count: Text | null;
  /** the hex the marker stands for */
  cell: number;
}

interface Tween {
  marker: Marker;
  /** world points to glide through, the start first */
  pts: { x: number; y: number }[];
  /** the per-hex offset applied at the end (a settlement on the destination hex) */
  endOffset: { x: number; y: number };
  t0: number;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** The shield's world size at this zoom: never under 7 screen px tall. */
export function shieldSize(zoom: number): { w: number; h: number } {
  const h = Math.max(7 / zoom, SHIELD_H);
  return { w: h * 0.82, h };
}

/** Where a unit's shield sits for its hex: the hex centre, or the upper-left of the settlement marker when one stands there. */
export function shieldOffset(state: GameState, cell: number, zoom: number): { x: number; y: number } {
  const w = state.map.width;
  const col = cell % w, row = Math.floor(cell / w);
  const sid = settlementIdAt(state, col, row);
  if (!sid) return { x: 0, y: 0 };
  const s = state.settlements[sid];
  const r = SettlementLayer.markerRadius(s, zoom);
  const sz = shieldSize(zoom);
  return { x: -(r * 0.75 + sz.w * 0.45), y: -(r * 0.45 + sz.h * 0.35) };
}

export class UnitLayer {
  readonly root = new Container();
  private routes = new Graphics();
  private marks = new Container();
  private previewG = new Graphics();
  private previewLabel: Text | null = null;
  private byKey = new Map<string, Marker>();
  private tweens: Tween[] = [];
  /** the hex every drawn unit stands on, after `update` */
  private cellOfUnit = new Map<string, number>();

  constructor() {
    this.root.addChild(this.routes, this.previewG, this.marks);
  }

  /** Unit ids of the shield at `cell` (several units on one hex share a shield). */
  private groupKey(u: Unit): string { return `c${u.col},${u.row}`; }

  /** Centre of the shield drawn for `cell`, in world units, or null when nothing stands there. */
  shieldAt(state: GameState, cell: number, zoom: number): { x: number; y: number; w: number; h: number } | null {
    const w = state.map.width;
    const m = this.byKey.get(`c${cell % w},${Math.floor(cell / w)}`);
    if (!m) return null;
    const sz = shieldSize(zoom);
    return { x: m.root.position.x, y: m.root.position.y, w: sz.w, h: sz.h };
  }

  /** Redraw from the state. Markers are reused per hex so a running glide is not interrupted. */
  update(state: GameState, view: UnitView): void {
    const map = state.map;
    const list = Object.values(state.units).sort((a, b) => (a.id < b.id ? -1 : 1));
    const groups = new Map<string, Unit[]>();
    for (const u of list) {
      const k = this.groupKey(u);
      const g = groups.get(k) ?? [];
      g.push(u);
      groups.set(k, g);
    }
    const sz = shieldSize(view.zoom);
    const lvl = zoomLevel(view.zoom);
    const lw = Math.max(0.9, 1.1 / view.zoom);
    const seen = new Set<string>();
    this.cellOfUnit.clear();
    for (const [key, units] of groups) {
      seen.add(key);
      const u0 = units[0];
      const cell = unitCell(map, u0);
      for (const u of units) this.cellOfUnit.set(u.id, cell);
      let m = this.byKey.get(key);
      if (!m) {
        const root = new Container();
        const shield = new Graphics();
        const icon = new Sprite(iconTexture(unitTypeDef(u0.type).icon, MAP_MARK));
        icon.anchor.set(0.5);
        root.addChild(shield, icon);
        this.marks.addChild(root);
        m = { root, shield, icon, count: null, cell };
        this.byKey.set(key, m);
      }
      m.cell = cell;
      const tweening = this.tweens.some((t) => t.marker === m);
      if (!tweening) {
        const p = offsetToPixel(u0.col, u0.row, HEX_SIZE);
        const off = shieldOffset(state, cell, view.zoom);
        m.root.position.set(p.x + off.x, p.y + off.y);
      }
      // the shield: faction colour, ink border; a selected / hovered unit gets a white ring
      const color = colorToNumber(factionColor(state.factions, u0.faction));
      const sel = units.some((u) => u.id === view.selected);
      const hov = !sel && units.some((u) => u.id === view.hover);
      const forming = units.every((u) => isForming(state, u));
      const blocked = units.some((u) => u.report.blocked && !isForming(state, u));
      const g = m.shield;
      g.clear();
      if (sel || hov) {
        this.shieldPath(g, sz.w + 2 * Math.max(2, 2.4 / view.zoom), sz.h + 2 * Math.max(2, 2.4 / view.zoom));
        g.stroke({ width: Math.max(1.2, 1.6 / view.zoom), color: 0xffffff, alpha: sel ? 1 : 0.7 });
      }
      this.shieldPath(g, sz.w, sz.h);
      g.fill(color);
      g.stroke({ width: lw, color: 0x2b1d12, alpha: 0.9 });
      if (blocked) {
        g.circle(sz.w * 0.42, -sz.h * 0.42, Math.max(1.6, 2.2 / view.zoom));
        g.fill(0xa8321e);
        g.stroke({ width: lw * 0.7, color: 0x2b1d12, alpha: 0.9 });
      }
      m.root.alpha = forming ? 0.6 : 1;
      // the icon (hidden at the farthest zoom level)
      const tex = iconTexture(unitTypeDef(u0.type).icon, MAP_MARK);
      if (m.icon.texture !== tex) m.icon.texture = tex;
      m.icon.visible = lvl < 3;
      const d = sz.w * 0.78;
      m.icon.width = d; m.icon.height = d;
      m.icon.position.set(0, -sz.h * 0.06);
      // the count for a group
      if (units.length > 1) {
        if (!m.count) { m.count = new Text({ text: '', style: COUNT_STYLE }); m.count.anchor.set(0.5); m.root.addChild(m.count); }
        m.count.text = String(units.length);
        m.count.scale.set(1 / view.zoom);
        m.count.position.set(sz.w * 0.5, sz.h * 0.4);
        m.count.visible = true;
      } else if (m.count) m.count.visible = false;
    }
    for (const [key, m] of this.byKey) {
      if (!seen.has(key)) {
        this.tweens = this.tweens.filter((t) => t.marker !== m);
        m.root.destroy({ children: true });
        this.byKey.delete(key);
      }
    }
    // remaining route of the selected unit, dotted
    this.routes.clear();
    const su = view.selected ? state.units[view.selected] : null;
    if (su && su.order && su.order.dest !== unitCell(map, su)) {
      const route = routeFor(state, su, su.order.dest);
      if (route && Number.isFinite(route.months)) {
        this.dotted(this.routes, [unitCell(map, su), ...route.nodes.map((n) => n.cell)], map.width, Math.max(1.2, 1.6 / view.zoom), 0x2b1d12, 0.8);
        const w = map.width;
        const dp = offsetToPixel(su.order.dest % w, Math.floor(su.order.dest / w), HEX_SIZE);
        this.routes.circle(dp.x, dp.y, Math.max(2.5, 3 / view.zoom));
        this.routes.stroke({ width: Math.max(1.2, 1.6 / view.zoom), color: 0x2b1d12, alpha: 0.9 });
      }
    }
    // the preview while choosing a destination
    this.previewG.clear();
    if (this.previewLabel) { this.previewLabel.destroy(); this.previewLabel = null; }
    if (view.preview && view.preview.cells.length > 1) {
      const w = map.width;
      this.dotted(this.previewG, view.preview.cells, w, Math.max(1.4, 2 / view.zoom), 0xffffff, 0.95);
      const last = view.preview.cells[view.preview.cells.length - 1];
      const dp = offsetToPixel(last % w, Math.floor(last / w), HEX_SIZE);
      this.previewG.circle(dp.x, dp.y, Math.max(3, 3.5 / view.zoom));
      this.previewG.stroke({ width: Math.max(1.4, 2 / view.zoom), color: 0xffffff, alpha: 0.95 });
      this.previewLabel = new Text({ text: view.preview.label, style: MONTHS_STYLE });
      this.previewLabel.anchor.set(0.5, 1);
      this.previewLabel.scale.set(1 / view.zoom);
      this.previewLabel.position.set(dp.x, dp.y - HEX_SIZE * 0.6);
      this.root.addChild(this.previewLabel);
    }
  }

  /** A heater shield centred on (0, 0): flat top, straight shoulders, sides curving to a point. */
  private shieldPath(g: Graphics, w: number, h: number): void {
    const hw = w / 2, top = -h / 2, bottom = h / 2;
    g.moveTo(-hw, top);
    g.lineTo(hw, top);
    g.lineTo(hw, top + h * 0.38);
    g.quadraticCurveTo(hw, bottom - h * 0.12, 0, bottom);
    g.quadraticCurveTo(-hw, bottom - h * 0.12, -hw, top + h * 0.38);
    g.closePath();
  }

  /** A dotted line through the centres of `cells`. */
  private dotted(g: Graphics, cells: number[], w: number, width: number, color: number, alpha: number): void {
    const dash = HEX_SIZE * 0.22, gap = HEX_SIZE * 0.2;
    for (let i = 1; i < cells.length; i++) {
      const a = offsetToPixel(cells[i - 1] % w, Math.floor(cells[i - 1] / w), HEX_SIZE);
      const b = offsetToPixel(cells[i] % w, Math.floor(cells[i] / w), HEX_SIZE);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      for (let t = dash * 0.5; t < len; t += dash + gap) {
        const e = Math.min(len, t + dash);
        g.moveTo(a.x + ux * t, a.y + uy * t).lineTo(a.x + ux * e, a.y + uy * e);
      }
    }
    g.stroke({ width, color, alpha });
  }

  /**
   * Start the gliding animation for the units that moved this month. Called
   * after `update` placed every marker at its new hex: each marker is set back
   * to the start of its path and glides from there. `paths` give the hexes
   * walked (start first); a unit's current marker is the one at its final hex.
   */
  animate(state: GameState, paths: UnitPath[], zoom: number): void {
    const w = state.map.width;
    const now = performance.now();
    const done = new Set<Marker>();
    for (const p of paths) {
      if (p.cells.length < 2) continue;
      const u = state.units[p.id];
      if (!u) continue;
      const m = this.byKey.get(this.groupKey(u));
      if (!m || done.has(m)) continue;
      done.add(m);
      const pts = p.cells.map((c) => offsetToPixel(c % w, Math.floor(c / w), HEX_SIZE));
      const endOffset = shieldOffset(state, p.cells[p.cells.length - 1], zoom);
      this.tweens = this.tweens.filter((t) => t.marker !== m);
      this.tweens.push({ marker: m, pts, endOffset, t0: now });
      m.root.position.set(pts[0].x, pts[0].y);
    }
  }

  get animating(): boolean { return this.tweens.length > 0; }

  /** Advance the glides; call every frame. */
  tick(): void {
    if (!this.tweens.length) return;
    const now = performance.now();
    this.tweens = this.tweens.filter((t) => {
      const total = (t.pts.length - 1) * MS_PER_HEX;
      const k = Math.min(1, (now - t.t0) / total);
      const last = t.pts[t.pts.length - 1];
      if (k >= 1) {
        t.marker.root.position.set(last.x + t.endOffset.x, last.y + t.endOffset.y);
        return false;
      }
      const seg = Math.min(t.pts.length - 2, Math.floor(k * (t.pts.length - 1)));
      const local = ease(k * (t.pts.length - 1) - seg);
      const a = t.pts[seg], b = t.pts[seg + 1];
      // the settlement offset eases in over the last hex
      const endK = seg === t.pts.length - 2 ? local : 0;
      t.marker.root.position.set(a.x + (b.x - a.x) * local + t.endOffset.x * endK, a.y + (b.y - a.y) * local + t.endOffset.y * endK);
      return true;
    });
  }
}

/** The unit under a screen point, by shield bounds (world units); the topmost group wins. */
export function unitAtWorld(state: GameState, layer: UnitLayer, wx: number, wy: number, zoom: number): Unit | null {
  const map = state.map;
  let best: Unit | null = null, bestD = Infinity;
  const cells = new Set<number>();
  for (const u of Object.values(state.units)) cells.add(unitCell(map, u));
  for (const cell of cells) {
    const s = layer.shieldAt(state, cell, zoom);
    if (!s) continue;
    const dx = wx - s.x, dy = wy - s.y;
    if (Math.abs(dx) <= s.w * 0.6 && Math.abs(dy) <= s.h * 0.6) {
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        const here = Object.values(state.units).filter((u) => unitCell(map, u) === cell).sort((a, b) => (a.id < b.id ? -1 : 1));
        best = here[0] ?? null;
      }
    }
  }
  return best;
}
