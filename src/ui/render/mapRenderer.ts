// Chunked hex map renderer for PixiJS 8.
// The map is split into CHUNK x CHUNK hex blocks; each block is one Graphics
// object (terrain fills) plus one for grid lines. Chunks are built lazily and
// only chunks intersecting the viewport are visible (culling). This is what
// lets a 400x250 map (100k hexes) pan and zoom smoothly.

import { Container, Graphics, Rectangle } from 'pixi.js';
import type { MapData } from '../../sim/map';
import { TERRAIN, colorToNumber } from '../../sim/terrain';
import { RESOURCES, type Glyph } from '../../sim/resources';
import { iconTexture, MAP_BADGE } from '../icons';
import { showResources as resourcesAtZoom } from '../zoomLevels';
import { Sprite } from 'pixi.js';
import { offsetToPixel, hexCorners, hexWidth, hexRowStep } from '../../sim/hex';

export const HEX_SIZE = 12; // world units (pixels at zoom 1), centre to corner
export const CHUNK = 32; // hexes per chunk side

interface Chunk {
  cx: number;
  cy: number;
  container: Container;
  fill: Graphics;
  res: Container;
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

  /** Mark a chunk dirty (after terrain edits) so it is rebuilt on next cull. */
  invalidateHex(col: number, row: number): void {
    const c = this.chunkAt(col, row);
    if (c) c.built = false;
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
        const grid = new Graphics();
        grid.visible = this.showGrid && this.gridZoomOk;
        res.visible = this.showResources && this.resZoomOk;
        container.addChild(fill, grid, res);
        container.visible = false;
        this.root.addChild(container);
        const x0 = cx * CHUNK * w - w;
        const y0 = cy * CHUNK * step - HEX_SIZE;
        const bounds = new Rectangle(x0, y0, (CHUNK + 1.5) * w, (CHUNK + 1) * step + HEX_SIZE);
        this.chunks.push({ cx, cy, container, fill, res, grid, built: false, bounds });
      }
    }
  }

  private buildChunk(c: Chunk): void {
    const { fill, grid, res } = c;
    fill.clear();
    grid.clear();
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
          const sp = new Sprite(iconTexture(def.icon, MAP_BADGE));
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
