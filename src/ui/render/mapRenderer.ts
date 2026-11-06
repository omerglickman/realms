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

/** Shoreline look (UI-DESIGN.md §6): the band's depth into the water hex as a fraction of the centre distance, the lighter line's depth, and the two sand colours. */
const SHORE_BAND = 0.26;
const SHORE_LINE = 0.09;
const SHORE_SAND = 0xd9c48c;
const SHORE_FOAM = 0xefe2b6;

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
    // shoreline (Session 13d, Omer): on every water hex, a sand band along each edge that touches land —
    // a wide pale band inset into the water plus a thinner, lighter line right at the edge
    const SEA = terrainIndex('sea'), LAKE = terrainIndex('lake');
    const isWater = (t: number) => t === SEA || t === LAKE;
    const bands: number[][] = [];
    const lines: number[][] = [];
    for (let row = r0; row < r1; row++) {
      for (let col = c0; col < c1; col++) {
        const t = map.terrain[row * map.width + col];
        if (!isWater(t)) continue;
        const a = offsetToAxial(col, row);
        const p = offsetToPixel(col, row, HEX_SIZE);
        const corners = hexCorners(p.x, p.y, HEX_SIZE + 0.35);
        for (let i = 0; i < 6; i++) {
          // edge i (corner i → corner i+1) faces the neighbour in AXIAL_DIRECTIONS[i]
          const d = AXIAL_DIRECTIONS[i];
          const o = axialToOffset(a.q + d.q, a.r + d.r);
          if (o.col < 0 || o.row < 0 || o.col >= map.width || o.row >= map.height) continue;
          if (isWater(map.terrain[o.row * map.width + o.col])) continue;
          const x0 = corners[2 * i], y0 = corners[2 * i + 1];
          const x1 = corners[(2 * i + 2) % 12], y1 = corners[(2 * i + 3) % 12];
          const inset = (x: number, y: number, k: number) => [x + (p.x - x) * k, y + (p.y - y) * k];
          const [bx0, by0] = inset(x0, y0, SHORE_BAND), [bx1, by1] = inset(x1, y1, SHORE_BAND);
          bands.push([x0, y0, x1, y1, bx1, by1, bx0, by0]);
          const [lx0, ly0] = inset(x0, y0, SHORE_LINE), [lx1, ly1] = inset(x1, y1, SHORE_LINE);
          lines.push([x0, y0, x1, y1, lx1, ly1, lx0, ly0]);
        }
      }
    }
    if (bands.length) {
      for (const b of bands) shore.poly(b);
      shore.fill({ color: SHORE_SAND, alpha: 0.95 });
      for (const l of lines) shore.poly(l);
      shore.fill({ color: SHORE_FOAM, alpha: 0.9 });
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
