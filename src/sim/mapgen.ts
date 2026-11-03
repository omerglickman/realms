// CRUDE DRAFT MAP GENERATOR (DESIGN §2.2). This is NOT the real procedural
// generator — it only produces a plausible starting canvas that Omer edits by
// hand in the map editor. Deterministic for a given seed.

import { createMap, type MapData, inBounds, idx, neighborsOffset } from './map';
import { terrainIndex } from './terrain';
import { seedRng, nextFloat, nextInt, type RngState } from './rng';

export interface MapGenParams {
  width: number;
  height: number;
  seed: string | number;
  /** 0..1 — fraction of the map that should be land-ish. default 0.55 */
  landFraction?: number;
  /** base noise scale in hexes. default 28 */
  scale?: number;
  /** number of rivers to attempt. default ~ width*height/900 */
  rivers?: number;
}

// ---------- value noise with fBm ----------

function makeNoise(rng: RngState, size = 256): (x: number, y: number) => number {
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = nextFloat(rng);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const x0 = ((xi % size) + size) % size, x1 = (x0 + 1) % size;
    const y0 = ((yi % size) + size) % size, y1 = (y0 + 1) % size;
    const a = grid[y0 * size + x0], b = grid[y0 * size + x1];
    const c = grid[y1 * size + x0], d = grid[y1 * size + x1];
    return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves = 5): number {
  let v = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    v += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v / norm;
}

// ---------- generator ----------

export function generateDraftMap(p: MapGenParams): MapData {
  const { width, height } = p;
  const landFraction = p.landFraction ?? 0.55;
  const scale = p.scale ?? 28;
  const map = createMap(width, height, terrainIndex('sea'));
  const rng = seedRng(p.seed);
  const elevNoise = makeNoise(rng);
  const moistNoise = makeNoise(rng);

  const T = {
    plains: terrainIndex('plains'),
    grassland: terrainIndex('grassland'),
    river: terrainIndex('river'),
    hills: terrainIndex('hills'),
    mountains: terrainIndex('mountains'),
    woodland: terrainIndex('woodland'),
    forest: terrainIndex('forest'),
    tundra: terrainIndex('tundra'),
    swamp: terrainIndex('swamp'),
    lake: terrainIndex('lake'),
    sea: terrainIndex('sea'),
  };

  // 1. elevation field with edge falloff so the map is ringed by sea
  const elev = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const nx = col / scale, ny = row / scale;
      let e = fbm(elevNoise, nx + 100, ny + 100);
      const ex = Math.min(col, width - 1 - col) / (width * 0.18);
      const ey = Math.min(row, height - 1 - row) / (height * 0.18);
      const edge = Math.min(1, Math.min(ex, ey));
      e = e * (0.35 + 0.65 * edge);
      elev[idx(map, col, row)] = e;
    }
  }

  // 2. sea level from the requested land fraction
  const sorted = Array.from(elev).sort((a, b) => a - b);
  const seaLevel = sorted[Math.floor(sorted.length * (1 - landFraction))] ?? 0.5;
  const span = Math.max(1e-6, (sorted[sorted.length - 1] ?? 1) - seaLevel);

  // 3. classify
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = idx(map, col, row);
      const e = elev[i];
      if (e < seaLevel) { map.terrain[i] = T.sea; continue; }
      const h = (e - seaLevel) / span; // 0..1 above sea
      const m = fbm(moistNoise, col / (scale * 0.8) + 300, row / (scale * 0.8) + 300);
      const lat = row / (height - 1); // 0 = north, 1 = south
      const cold = lat < 0.12 || lat > 0.88;

      let t: number;
      if (h > 0.72) t = T.mountains;
      else if (h > 0.5) t = T.hills;
      else if (cold) t = m > 0.6 ? T.forest : T.tundra;
      else if (m > 0.68) t = T.forest;
      else if (m > 0.56) t = T.woodland;
      else if (m > 0.42) t = T.grassland;
      else if (m < 0.3 && h < 0.08) t = T.swamp;
      else t = T.plains;
      map.terrain[i] = t;
    }
  }

  // 4. lakes: low, wet, inland basins
  for (let row = 1; row < height - 1; row++) {
    for (let col = 1; col < width - 1; col++) {
      const i = idx(map, col, row);
      if (map.terrain[i] === T.sea) continue;
      const h = (elev[i] - seaLevel) / span;
      const m = fbm(moistNoise, col / (scale * 0.8) + 300, row / (scale * 0.8) + 300);
      if (h < 0.06 && m > 0.75) {
        const ns = neighborsOffset(map, col, row);
        if (ns.every((n) => map.terrain[idx(map, n.col, n.row)] !== T.sea)) map.terrain[i] = T.lake;
      }
    }
  }

  // 5. rivers: walk downhill from high ground until water; mark land hexes as River
  const riverCount = p.rivers ?? Math.round((width * height) / 900);
  const sources: number[] = [];
  for (let i = 0; i < map.terrain.length; i++) {
    if (map.terrain[i] === T.hills || map.terrain[i] === T.mountains) sources.push(i);
  }
  for (let n = 0; n < riverCount && sources.length > 0; n++) {
    const s = sources[nextInt(rng, 0, sources.length - 1)];
    let col = s % width;
    let row = Math.floor(s / width);
    const path: number[] = [];
    const seen = new Set<number>();
    for (let step = 0; step < 400; step++) {
      const i = idx(map, col, row);
      if (seen.has(i)) break;
      seen.add(i);
      const t = map.terrain[i];
      if (t === T.sea || t === T.lake) break;
      if (t !== T.mountains) path.push(i);
      // choose the lowest neighbour
      let best = -1, bestE = elev[i];
      for (const nb of neighborsOffset(map, col, row)) {
        const j = idx(map, nb.col, nb.row);
        if (elev[j] < bestE && !seen.has(j)) { bestE = elev[j]; best = j; }
      }
      if (best < 0) break;
      col = best % width; row = Math.floor(best / width);
      if (!inBounds(map, col, row)) break;
    }
    if (path.length >= 4) for (const i of path) {
      if (map.terrain[i] !== T.mountains) map.terrain[i] = T.river;
    }
  }

  return map;
}
