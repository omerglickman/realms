// Chunked hex map renderer for PixiJS 8.
// The map is split into CHUNK x CHUNK hex blocks; each block is one Graphics
// object (terrain fills) plus one for grid lines. Chunks are built lazily and
// only chunks intersecting the viewport are visible (culling). This is what
// lets a 400x250 map (100k hexes) pan and zoom smoothly.

import { Container, Graphics, Rectangle } from 'pixi.js';
import type { MapData } from '../../sim/map';
import { TERRAIN, colorToNumber } from '../../sim/terrain';
import { RESOURCES, type Glyph } from '../../sim/resources';
import { iconTexture, MAP_BADGE, MAP_BADGE_IDLE } from '../icons';
import { showResources as resourcesAtZoom } from '../zoomLevels';
import { terrainIndex } from '../../sim/terrain';
import { offsetToAxial, axialToOffset, AXIAL_DIRECTIONS } from '../../sim/hex';
import { Sprite } from 'pixi.js';
import { offsetToPixel, hexCorners, hexWidth, hexRowStep } from '../../sim/hex';

/** Shoreline look (UI-DESIGN.md §6; IMPERIUM's values): depth of the whole fringe into the water hex as a
 *  fraction of the hex radius, the dark tide band's width within it, the meander amplitude, the two colours. */
const SHORE_SAND = 0.30;
const SHORE_BAND = 0.12;
const SHORE_AMP = 0.05;
const SHORE_SAND_COLOR = 0xd9b16a;
const SHORE_TIDE = 0xb8894a;
/** River banks use grassland's colour for the light band and this much darker for the meandering inner band. */
const BANK_DARKEN = 0.22;

function darken(color: number, k: number): number {
  const r = Math.round(((color >> 16) & 255) * (1 - k)), g = Math.round(((color >> 8) & 255) * (1 - k)), b = Math.round((color & 255) * (1 - k));
  return (r << 16) | (g << 8) | b;
}

/** Which axial direction each hex edge faces (edge i runs from corner i to corner i+1 of `hexCorners`),
 *  derived from the geometry itself so no convention is assumed. */
const EDGE_DIR: number[] = (() => {
  const c = hexCorners(0, 0, 1);
  const here = offsetToPixel(2, 2, 1);
  const a = offsetToAxial(2, 2);
  return Array.from({ length: 6 }, (_, i) => {
    const mx = (c[2 * i] + c[(2 * i + 2) % 12]) / 2, my = (c[2 * i + 1] + c[(2 * i + 3) % 12]) / 2;
    let best = 0, bestDot = -Infinity;
    AXIAL_DIRECTIONS.forEach((d, k) => {
      const o = axialToOffset(a.q + d.q, a.r + d.r);
      const np = offsetToPixel(o.col, o.row, 1);
      const dot = (np.x - here.x) * mx + (np.y - here.y) * my;
      if (dot > bestDot) { bestDot = dot; best = k; }
    });
    return best;
  });
})();

export const HEX_SIZE = 12; // world units (pixels at zoom 1), centre to corner
export const CHUNK = 32; // hexes per chunk side

interface Chunk {
  cx: number;
  cy: number;
  container: Container;
  fill: Graphics;
  res: Container;
  shore: Graphics;
  grid: Graphics;
  built: boolean;
  bounds: Rectangle; // world-space bounds
}

/** Draw a resource glyph centred at (x, y) with radius r. */
function drawGlyph(g: Graphics, glyph: Glyph, x: number, y: number, r: number): void {
  switch (glyph) {
    case 'circle': g.circle(x, y, r); break;
    case 'ring': g.circle(x, y, r * 0.72); break; // stroked, not filled (see buildChunk)
    case 'triangle': g.poly([x, y - r, x + r * 0.95, y + r * 0.7, x - r * 0.95, y + r * 0.7]); break;
    case 'square': g.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6); break;
    case 'diamond': g.poly([x, y - r, x + r * 0.75, y, x, y + r, x - r * 0.75, y]); break;
    case 'hex': g.poly(hexCorners(x, y, r)); break;
    case 'cross': g.rect(x - r * 0.3, y - r, r * 0.6, r * 2); g.rect(x - r, y - r * 0.3, r * 2, r * 0.6); break;
    case 'star': {
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        pts.push(x + rr * Math.cos(a), y + rr * Math.sin(a));
      }
      g.poly(pts);
      break;
    }
  }
}

export class MapRenderer {
  readonly root = new Container();
  private chunks: Chunk[] = [];
  private map: MapData;
  private terrainColors: number[];
  private showGrid = true;
  private gridZoomOk = true;
  private showResources = true;
  private resZoomOk = true;
  private resourceColors: number[];
  /** hexes worked by a settlement: their resource badges draw in the 'tapped' style (Session 13c) */
  private worked = new Set<number>();
  /** milliseconds spent building chunks during the last cull() call */
  lastBuildMs = 0;

  constructor(map: MapData) {
    this.map = map;
    this.terrainColors = TERRAIN.map((t) => colorToNumber(t.color));
    // Omer (Session 13e): a river hex is drawn as water — lake blue with grassland banks (the fringe below) —
    // whatever colour the data file gives it (that colour still serves the editor palette and the ledgers' chips).
    this.terrainColors[terrainIndex('river')] = this.terrainColors[terrainIndex('lake')];
    this.resourceColors = RESOURCES.map((r) => colorToNumber(r.color));
    this.rebuildChunks();
  }

  setMap(map: MapData): void {
    this.map = map;
    this.rebuildChunks();
  }

  /** Size of the whole map in world units. */
  worldSize(): { width: number; height: number } {
    const w = hexWidth(HEX_SIZE) * (this.map.width + 0.5);
    const h = hexRowStep(HEX_SIZE) * (this.map.height - 1) + 2 * HEX_SIZE;
    return { width: w, height: h };
  }

  setGridVisible(v: boolean): void {
    this.showGrid = v;
    this.applyGridVisibility();
  }

  setResourcesVisible(v: boolean): void {
    this.showResources = v;
    this.applyGridVisibility();
  }

  get resourcesVisible(): boolean {
    return this.showResources;
  }

  /** Grid lines are thinner than a pixel below zoom 0.5 and only cause moiré; resource icons follow the zoom levels (src/ui/zoomLevels.ts). */
  setZoom(zoom: number): void {
    const ok = zoom >= 0.5;
    const rok = resourcesAtZoom(zoom);
    if (ok !== this.gridZoomOk || rok !== this.resZoomOk) {
      this.gridZoomOk = ok;
      this.resZoomOk = rok;
      this.applyGridVisibility();
    }
  }

  private applyGridVisibility(): void {
    const v = this.showGrid && this.gridZoomOk;
    const rv = this.showResources && this.resZoomOk;
    for (const c of this.chunks) { c.grid.visible = v; c.res.visible = rv; }
  }

  get gridVisible(): boolean {
    return this.showGrid;
  }

  /** Tell the renderer which hexes are worked; chunks whose resource hexes changed state are rebuilt. */
  setWorkedCells(cells: Set<number>): void {
    const w = this.map.width;
    const changed = new Set<number>();
    for (const i of cells) if (!this.worked.has(i)) changed.add(i);
    for (const i of this.worked) if (!cells.has(i)) changed.add(i);
    this.worked = cells;
    for (const i of changed) if (this.map.resource[i] >= 0) this.invalidateHex(i % w, Math.floor(i / w));
  }

  /** Mark a chunk dirty (after terrain edits) so it is rebuilt on next cull. */
  invalidateHex(col: number, row: number): void {
    const c = this.chunkAt(col, row);
    if (c) c.built = false;
    // a terrain edit changes the shoreline of the six neighbours, which may sit in another chunk
    const a = offsetToAxial(col, row);
    for (const d of AXIAL_DIRECTIONS) {
      const o = axialToOffset(a.q + d.q, a.r + d.r);
      const n = this.chunkAt(o.col, o.row);
      if (n && n !== c) n.built = false;
    }
  }

  invalidateAll(): void {
    for (const c of this.chunks) c.built = false;
  }

  private chunkAt(col: number, row: number): Chunk | undefined {
    const cols = Math.ceil(this.map.width / CHUNK);
    const cx = Math.floor(col / CHUNK), cy = Math.floor(row / CHUNK);
    return this.chunks[cy * cols + cx];
  }

  private rebuildChunks(): void {
    for (const c of this.chunks) c.container.destroy({ children: true });
    this.chunks = [];
    this.root.removeChildren();
    const cols = Math.ceil(this.map.width / CHUNK);
    const rows = Math.ceil(this.map.height / CHUNK);
    const w = hexWidth(HEX_SIZE);
    const step = hexRowStep(HEX_SIZE);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const container = new Container();
        const fill = new Graphics();
        const res = new Container();
        const shore = new Graphics();
        const grid = new Graphics();
        grid.visible = this.showGrid && this.gridZoomOk;
        res.visible = this.showResources && this.resZoomOk;
        container.addChild(fill, shore, grid, res);
        container.visible = false;
        this.root.addChild(container);
        const x0 = cx * CHUNK * w - w;
        const y0 = cy * CHUNK * step - HEX_SIZE;
        const bounds = new Rectangle(x0, y0, (CHUNK + 1.5) * w, (CHUNK + 1) * step + HEX_SIZE);
        this.chunks.push({ cx, cy, container, fill, shore, res, grid, built: false, bounds });
      }
    }
  }

  private buildChunk(c: Chunk): void {
    const { fill, grid, res, shore } = c;
    fill.clear();
    grid.clear();
    shore.clear();
    const map = this.map;
    const c0 = c.cx * CHUNK, r0 = c.cy * CHUNK;
    const c1 = Math.min(map.width, c0 + CHUNK), r1 = Math.min(map.height, r0 + CHUNK);
    // Group by terrain to minimise fill() calls.
    const byTerrain: number[][] = this.terrainColors.map(() => []);
    for (let row = r0; row < r1; row++) {
      for (let col = c0; col < c1; col++) {
        byTerrain[map.terrain[row * map.width + col]].push(col, row);
      }
    }
    for (let t = 0; t < byTerrain.length; t++) {
      const cells = byTerrain[t];
      if (cells.length === 0) continue;
      for (let i = 0; i < cells.length; i += 2) {
        const p = offsetToPixel(cells[i], cells[i + 1], HEX_SIZE);
        fill.poly(hexCorners(p.x, p.y, HEX_SIZE + 0.35));
      }
      fill.fill(this.terrainColors[t]);
    }
    for (let row = r0; row < r1; row++) {
      for (let col = c0; col < c1; col++) {
        const p = offsetToPixel(col, row, HEX_SIZE);
        grid.poly(hexCorners(p.x, p.y, HEX_SIZE));
      }
    }
    grid.stroke({ width: 0.5, color: 0x000000, alpha: 0.18 });
    // shoreline (Session 13d; ported from IMPERIUM's collectShoreFringe, Omer 2026-11-06): on every
    // water hex, each edge facing land gets a light sand band from the edge inward (depth SHORE_SAND − SHORE_BAND)
    // over a darker tide band (depth SHORE_SAND) whose sea-side boundary meanders — a seeded sine, zero at
    // the vertices so neighbouring hexes agree — plus bridge wedges at each vertex toward the adjacent
    // edges, so coves close and no blue crack opens at a corner. Dark first, light on top.
    const SEA = terrainIndex('sea'), LAKE = terrainIndex('lake'), RIVER = terrainIndex('river');
    const isWater = (t: number) => t === SEA || t === LAKE || t === RIVER;
    // two fringes: sand on sea and lake shores, grassland banks on rivers (UI-DESIGN.md §6)
    const light: number[][] = [], dark: number[][] = [];
    const bankLight: number[][] = [], bankDark: number[][] = [];
    const S = HEX_SIZE + 0.35;
    const D = SHORE_SAND * S, Wd = SHORE_BAND * S, Dl = Math.max(0, D - Wd), amp = SHORE_AMP * S;
    const K = 6;
    for (let row = r0; row < r1; row++) {
      for (let col = c0; col < c1; col++) {
        const t = map.terrain[row * map.width + col];
        if (!isWater(t)) continue;
        const a = offsetToAxial(col, row);
        const p = offsetToPixel(col, row, HEX_SIZE);
        const corners = hexCorners(p.x, p.y, S);
        const facing = [false, false, false, false, false, false];
        for (let i = 0; i < 6; i++) {
          const d = AXIAL_DIRECTIONS[EDGE_DIR[i]];
          const o = axialToOffset(a.q + d.q, a.r + d.r);
          if (o.col < 0 || o.row < 0 || o.col >= map.width || o.row >= map.height) continue;
          facing[i] = !isWater(map.terrain[o.row * map.width + o.col]);
        }
        if (!facing.some(Boolean)) continue;
        const lightOut = t === RIVER ? bankLight : light, darkOut = t === RIVER ? bankDark : dark;
        const cn = (i: number): [number, number] => [corners[(i % 6) * 2], corners[(i % 6) * 2 + 1]];
        const unit = (fx: number, fy: number, tx: number, ty: number): [number, number] => { const dx = tx - fx, dy = ty - fy, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
        for (let i = 0; i < 6; i++) {
          if (!facing[i]) continue;
          const [ax, ay] = cn(i), [bx, by] = cn(i + 1);
          const mx = (ax + bx) / 2, my = (ay + by) / 2;
          let nx = p.x - mx, ny = p.y - my; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
          // the dark tide band: edge → meandered depth D
          const seed = ((col * 73856093) ^ (row * 19349663) ^ (i * 83492791)) >>> 0, phase = (seed % 628) / 100;
          const darkPoly: number[] = [ax, ay, bx, by];
          for (let k = K; k >= 0; k--) {
            const tt = k / K, px = ax + (bx - ax) * tt, py = ay + (by - ay) * tt;
            const off = D + amp * Math.sin(Math.PI * tt) * Math.sin(Math.PI * 2 * 1.25 * tt + phase);
            darkPoly.push(px + nx * off, py + ny * off);
          }
          darkOut.push(darkPoly);
          lightOut.push([ax, ay, bx, by, bx + nx * Dl, by + ny * Dl, ax + nx * Dl, ay + ny * Dl]);
          // bridges to the adjacent edges at the same depth (a point the neighbour computes identically)
          const [pax, pay] = cn(i + 5), [qcx, qcy] = cn(i + 2);
          const [tax, tay] = unit(ax, ay, pax, pay);
          const [tbx, tby] = unit(bx, by, qcx, qcy);
          darkOut.push([ax, ay, ax + nx * D, ay + ny * D, ax + tax * D, ay + tay * D]);
          darkOut.push([bx, by, bx + nx * D, by + ny * D, bx + tbx * D, by + tby * D]);
          lightOut.push([ax, ay, ax + nx * Dl, ay + ny * Dl, ax + tax * Dl, ay + tay * Dl]);
          lightOut.push([bx, by, bx + nx * Dl, by + ny * Dl, bx + tbx * Dl, by + tby * Dl]);
        }
      }
    }
    if (dark.length) {
      for (const d of dark) shore.poly(d);
      shore.fill(SHORE_TIDE);
      for (const l of light) shore.poly(l);
      shore.fill(SHORE_SAND_COLOR);
    }
    if (bankDark.length) {
      const grass = this.terrainColors[terrainIndex('grassland')];
      for (const d of bankDark) shore.poly(d);
      shore.fill(darken(grass, BANK_DARKEN));
      for (const l of bankLight) shore.poly(l);
      shore.fill(grass);
    }

    // resources: one badge sprite per hex — the resource's icon in ink on a parchment disc (Session 13b);
    // the data file's glyph/colour remain the fallback for a resource without an icon
    res.removeChildren().forEach((ch) => ch.destroy());
    const diameter = HEX_SIZE * 0.92;
    const fallback = new Graphics();
    let anyFallback = false;
    for (let row = r0; row < r1; row++) {
      for (let col = c0; col < c1; col++) {
        const r = map.resource[row * map.width + col];
        if (r < 0) continue;
        const p = offsetToPixel(col, row, HEX_SIZE);
        const def = RESOURCES[r];
        if (def.icon) {
          const sp = new Sprite(iconTexture(def.icon, this.worked.has(row * map.width + col) ? MAP_BADGE : MAP_BADGE_IDLE));
          sp.anchor.set(0.5);
          sp.width = diameter; sp.height = diameter;
          sp.position.set(p.x, p.y);
          res.addChild(sp);
        } else {
          drawGlyph(fallback, def.glyph, p.x, p.y, HEX_SIZE * 0.42);
          fallback.fill(this.resourceColors[r]);
          fallback.stroke({ width: 1, color: 0x000000, alpha: 0.55 });
          anyFallback = true;
        }
      }
    }
    if (anyFallback) res.addChild(fallback); else fallback.destroy();
    c.built = true;
  }

  /**
   * Show only chunks intersecting the given world-space rectangle, building
   * any that are not built yet. Call every frame (cheap) or on view change.
   */
  cull(view: Rectangle): number {
    let visible = 0;
    let buildMs = 0;
    for (const c of this.chunks) {
      const vis = c.bounds.intersects(view);
      if (vis) {
        if (!c.built) {
          const t0 = performance.now();
          this.buildChunk(c);
          buildMs += performance.now() - t0;
        }
        visible++;
      }
      c.container.visible = vis;
    }
    this.lastBuildMs = buildMs;
    return visible;
  }

  get chunkCount(): number {
    return this.chunks.length;
  }
}
