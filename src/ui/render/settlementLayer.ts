// Settlement layer for PixiJS 8: influence zones (faction-coloured fill with
// an outer border), cluster outlines (DESIGN §3.3 — one inset line around the
// union of a cluster's influence zones, faint for lone villages), the worked
// hexes of the hovered / selected settlement with a dotted outline of its own
// influence edge, tier markers and name labels, and — while the player is
// choosing where to settle — a hatch over every hex that is already worked plus
// the dotted influence edges of all towns and cities.
// Settlements are few, so this is a plain (unchunked) set of Graphics redrawn
// whenever the state or the zoom changes. Purely visual: never changes state.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameState } from '../../sim/state';
import { TIERS, influenceCells, workedCellsBySettlement, computeWorkAssignment, type Settlement } from '../../sim/settlements';
import { clustersOf, clusterInfluenceCells } from '../../sim/clusters';
import { factionColor } from '../../sim/factions';
import { colorToNumber } from '../../sim/terrain';
import { offsetToPixel, hexCorners, offsetToAxial, axialToOffset, AXIAL_DIRECTIONS, SQRT3 } from '../../sim/hex';
import { HEX_SIZE } from './mapRenderer';

/** For each axial direction, the two corner indices (of hexCorners) of the edge facing it. Built once by geometry. */
const EDGE_CORNERS: [number, number][] = (() => {
  const c = hexCorners(0, 0, 1);
  const out: [number, number][] = [];
  for (let d = 0; d < 6; d++) {
    const n = AXIAL_DIRECTIONS[d];
    const nx = SQRT3 * n.q + (SQRT3 / 2) * n.r;
    const ny = 1.5 * n.r;
    let best = 0, bestD = Infinity;
    for (let e = 0; e < 6; e++) {
      const a = e, b = (e + 1) % 6;
      const mx = (c[2 * a] + c[2 * b]) / 2, my = (c[2 * a + 1] + c[2 * b + 1]) / 2;
      const dd = (mx - nx / 2) ** 2 + (my - ny / 2) ** 2;
      if (dd < bestD) { bestD = dd; best = e; }
    }
    out.push([best, (best + 1) % 6]);
  }
  return out;
})();

export interface LayerView {
  hover: string | null;
  selected: string | null;
  zoom: number;
  /** settle mode: hatch every worked hex and dot the influence edges of all towns and cities */
  settling: boolean;
}

const MARKER_SCALE = [0.42, 0.6, 0.78, 0.95];

const LABEL_STYLE = new TextStyle({
  fontFamily: 'Lugrasimo, Georgia, serif',
  fontSize: 13,
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 3 },
});

/** Session 13: the map labels follow the header hand chosen in Settings (the style is shared by every label). */
export function setLabelFont(family: string): void {
  LABEL_STYLE.fontFamily = family;
}

type Segment = [number, number, number, number];

/** Mix a 0xRRGGBB colour toward white (k = 0 → unchanged, 1 → white). */
function lighten(color: number, k: number): number {
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  const f = (c: number) => Math.round(c + (255 - c) * k);
  return (f(r) << 16) | (f(g) << 8) | f(b);
}

function focusIn(members: string[], view: LayerView): boolean {
  const f = view.selected ?? view.hover;
  return f !== null && members.includes(f);
}

/** A boundary segment with the centre of the hex it belongs to. */
type EdgeSeg = { seg: Segment; cx: number; cy: number };

/**
 * Move each boundary edge inward (toward its hex centre) by `inset` and extend
 * its ends by inset·tan 30° so the inset outline still closes at the corners.
 */
function insetSegments(edges: EdgeSeg[], inset: number): Segment[] {
  const ext = inset * Math.tan(Math.PI / 6);
  const out: Segment[] = [];
  for (const { seg: [x1, y1, x2, y2], cx, cy } of edges) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    let nx = cx - mx, ny = cy - my;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    out.push([
      x1 + nx * inset - ux * ext, y1 + ny * inset - uy * ext,
      x2 + nx * inset + ux * ext, y2 + ny * inset + uy * ext,
    ]);
  }
  return out;
}

export class SettlementLayer {
  readonly root = new Container();
  private zones = new Graphics();
  private clusters = new Graphics();
  private hatch = new Graphics();
  private work = new Graphics();
  private edges = new Graphics();
  private markers = new Graphics();
  private labels = new Container();
  private labelById = new Map<string, Text>();
  private showZones = true;

  constructor() {
    this.root.addChild(this.zones, this.clusters, this.hatch, this.work, this.edges, this.markers, this.labels);
  }

  setZonesVisible(v: boolean): void { this.showZones = v; this.zones.visible = v; this.clusters.visible = v; }
  get zonesVisible(): boolean { return this.showZones; }

  /** Screen-independent marker radius in world units for a settlement at this zoom. */
  static markerRadius(s: Settlement, zoom: number): number {
    return Math.max(5 / zoom, HEX_SIZE * (MARKER_SCALE[TIERS[s.tier].rank] ?? 0.5));
  }

  /** Redraw everything from the state. Cheap for tens of settlements. */
  update(state: GameState, view: LayerView): void {
    const map = state.map;
    const w = map.width;
    const list = Object.values(state.settlements);
    const px = (i: number) => offsetToPixel(i % w, Math.floor(i / w), HEX_SIZE);

    // ---- influence zones: union per faction, light fill + outer border ----
    this.zones.clear();
    const byFaction = new Map<string, Set<number>>();
    for (const s of list) {
      const key = s.faction ?? '';
      let set = byFaction.get(key);
      if (!set) { set = new Set(); byFaction.set(key, set); }
      for (const i of influenceCells(map, s)) set.add(i);
    }
    const borderWidth = Math.max(1.2, 1.8 / view.zoom);
    for (const [fid, set] of byFaction) {
      const color = colorToNumber(factionColor(state.factions, fid || null));
      for (const i of set) {
        const p = px(i);
        this.zones.poly(hexCorners(p.x, p.y, HEX_SIZE + 0.35));
      }
      this.zones.fill({ color, alpha: 0.13 });
      for (const [x1, y1, x2, y2] of this.outerEdges(map, set)) this.zones.moveTo(x1, y1).lineTo(x2, y2);
      this.zones.stroke({ width: borderWidth, color, alpha: 0.9 });
    }

    // ---- cluster outlines (DESIGN §3.3): a solid line inset from the edge of each cluster's
    //      influence union, lighter than the faction border so the two read apart; lone
    //      villages faint. Replaces the always-on dotted influence line of Session 8. ----
    this.clusters.clear();
    const inset = HEX_SIZE * 0.16;
    for (const c of clustersOf(state)) {
      const base = colorToNumber(factionColor(state.factions, c.faction));
      const single = c.members.length === 1;
      const focused = focusIn(c.members, view);
      const segs = this.outerEdgeSegs(map, clusterInfluenceCells(state, c));
      for (const [x1, y1, x2, y2] of insetSegments(segs, inset)) this.clusters.moveTo(x1, y1).lineTo(x2, y2);
      this.clusters.stroke({
        width: single ? Math.max(0.8, 1 / view.zoom) : Math.max(1.4, (focused ? 2.6 : 2) / view.zoom),
        color: lighten(base, focused ? 0.75 : 0.55),
        alpha: single ? 0.35 : focused ? 1 : 0.8,
      });
    }

    // ---- settle mode: hatch every worked hex; dotted influence edges of all towns and cities ----
    this.hatch.clear();
    this.edges.clear();
    const dotted = (segs: Segment[], color: number, width: number) => {
      const dash = HEX_SIZE * 0.28, gap = HEX_SIZE * 0.18;
      for (const [x1, y1, x2, y2] of segs) {
        const len = Math.hypot(x2 - x1, y2 - y1);
        const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
        for (let t = 0; t < len; t += dash + gap) {
          const e = Math.min(len, t + dash);
          this.edges.moveTo(x1 + ux * t, y1 + uy * t).lineTo(x1 + ux * e, y1 + uy * e);
        }
      }
      this.edges.stroke({ width, color, alpha: 0.95 });
    };
    if (view.settling) {
      const assign = computeWorkAssignment(state);
      for (const i of assign.keys()) {
        const p = px(i);
        const hw = (SQRT3 / 2) * HEX_SIZE;
        for (const k of [-0.6, -0.2, 0.2, 0.6]) {
          const dy = k * HEX_SIZE;
          const taper = Math.abs(dy) <= HEX_SIZE / 2 ? 1 : 1 - (Math.abs(dy) - HEX_SIZE / 2) / (HEX_SIZE / 2);
          const half = hw * taper * 0.92;
          this.hatch.moveTo(p.x - half, p.y + dy).lineTo(p.x + half, p.y + dy);
        }
      }
      this.hatch.stroke({ width: Math.max(0.8, 1 / view.zoom), color: 0x000000, alpha: 0.35 });
      for (const s of list) {
        if (TIERS[s.tier].influenceRings <= TIERS[s.tier].workRings) continue;
        const color = colorToNumber(factionColor(state.factions, s.faction));
        dotted(this.outerEdges(map, new Set(influenceCells(map, s))), color, Math.max(1.2, 1.6 / view.zoom));
      }
    }

    // ---- worked hexes of the hovered / selected settlement + dotted edge of its influence zone ----
    this.work.clear();
    const focus = view.selected ?? view.hover;
    const fs = focus ? state.settlements[focus] : null;
    if (fs) {
      const worked = workedCellsBySettlement(state).get(fs.id) ?? [];
      for (const i of worked) {
        const p = px(i);
        this.work.poly(hexCorners(p.x, p.y, HEX_SIZE - 0.6));
      }
      this.work.fill({ color: 0xffffff, alpha: 0.16 });
      this.work.stroke({ width: Math.max(0.8, 1.2 / view.zoom), color: 0xffffff, alpha: 0.7 });
      if (!view.settling && TIERS[fs.tier].influenceRings > TIERS[fs.tier].workRings) {
        const color = colorToNumber(factionColor(state.factions, fs.faction));
        dotted(this.outerEdges(map, new Set(influenceCells(map, fs))), color, Math.max(1.4, 2 / view.zoom));
      }
    }

    // ---- markers ----
    this.markers.clear();
    for (const s of list) {
      const p = offsetToPixel(s.col, s.row, HEX_SIZE);
      const color = colorToNumber(factionColor(state.factions, s.faction));
      const r = SettlementLayer.markerRadius(s, view.zoom);
      this.drawMarker(s, p.x, p.y, r);
      this.markers.fill(color);
      this.markers.stroke({ width: Math.max(1, 1.2 / view.zoom), color: 0x000000, alpha: 0.8 });
      if (s.id === view.selected || s.id === view.hover) {
        this.drawMarker(s, p.x, p.y, r + Math.max(2, 2.5 / view.zoom));
        this.markers.stroke({ width: Math.max(1.2, 1.6 / view.zoom), color: 0xffffff, alpha: s.id === view.selected ? 1 : 0.7 });
      }
    }

    // ---- labels (constant screen size; hidden when zoomed far out) ----
    const seen = new Set<string>();
    const show = view.zoom >= 0.45;
    for (const s of list) {
      seen.add(s.id);
      let t = this.labelById.get(s.id);
      if (!t) {
        t = new Text({ text: s.name, style: LABEL_STYLE });
        t.anchor.set(0.5, 0);
        this.labels.addChild(t);
        this.labelById.set(s.id, t);
      }
      if (t.text !== s.name) t.text = s.name;
      const p = offsetToPixel(s.col, s.row, HEX_SIZE);
      const r = SettlementLayer.markerRadius(s, view.zoom);
      t.position.set(p.x, p.y + r + 4 / view.zoom);
      t.scale.set(1 / view.zoom);
      t.visible = show || TIERS[s.tier].rank >= 2; // cities stay labelled when zoomed out
    }
    for (const [id, t] of this.labelById) {
      if (!seen.has(id)) { t.destroy(); this.labelById.delete(id); }
    }
  }

  /** Segments (world coordinates) of the hex edges that separate `set` from everything outside it. */
  private outerEdges(map: GameState['map'], set: Set<number>): Segment[] {
    return this.outerEdgeSegs(map, set).map((e) => e.seg);
  }

  /** As outerEdges, with the centre of the owning hex kept for insetting. */
  private outerEdgeSegs(map: GameState['map'], set: Set<number>): EdgeSeg[] {
    const w = map.width;
    const out: EdgeSeg[] = [];
    for (const i of set) {
      const col = i % w, row = Math.floor(i / w);
      const a = offsetToAxial(col, row);
      const p = offsetToPixel(col, row, HEX_SIZE);
      const corners = hexCorners(p.x, p.y, HEX_SIZE);
      for (let d = 0; d < 6; d++) {
        const n = axialToOffset(a.q + AXIAL_DIRECTIONS[d].q, a.r + AXIAL_DIRECTIONS[d].r);
        const inside = n.col >= 0 && n.row >= 0 && n.col < w && n.row < map.height && set.has(n.row * w + n.col);
        if (inside) continue;
        const [ca, cb] = EDGE_CORNERS[d];
        out.push({ seg: [corners[2 * ca], corners[2 * ca + 1], corners[2 * cb], corners[2 * cb + 1]], cx: p.x, cy: p.y });
      }
    }
    return out;
  }

  private drawMarker(s: Settlement, x: number, y: number, r: number): void {
    switch (TIERS[s.tier].rank) {
      case 0: this.markers.circle(x, y, r); break;
      case 1: this.markers.circle(x, y, r); break;
      case 2: this.markers.poly([x, y - r, x + r, y, x, y + r, x - r, y]); break; // diamond
      default: {
        const pts: number[] = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 === 0 ? r : r * 0.5;
          pts.push(x + rr * Math.cos(a), y + rr * Math.sin(a));
        }
        this.markers.poly(pts);
      }
    }
  }
}
