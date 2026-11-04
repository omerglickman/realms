// CRUDE DRAFT MAP GENERATOR (DESIGN §2.2). This is NOT the real procedural
// generator — it only produces a plausible starting canvas that Omer edits by
// hand in the map editor. Deterministic for a given seed + parameters.
//
// Shape: the world is built from 1..3 "continent" land masses plus a number of
// islands. A land-mass field (radial falloffs around placed centres) is mixed
// with fractal noise for ragged coastlines; the sea level is then chosen so that
// the requested land fraction is met. Mountains come from a separate ridged
// noise so they form ranges rather than blobs. Rivers walk downhill.

import { createMap, type MapData, inBounds, idx, neighborsOffset } from './map';
import { terrainIndex } from './terrain';
import { seedRng, nextFloat, nextInt, type RngState } from './rng';

export interface MapGenParams {
  width: number;
  height: number;
  seed: string | number;
  /** 0..1 — fraction of the map that is land. default 0.45 */
  landFraction?: number;
  /** number of continents, 1..3. default 2 */
  continents?: number;
  /** number of islands (big-ish). default 6 */
  islands?: number;
  /** base noise scale in hexes. default 24 */
  scale?: number;
  /** number of rivers to attempt. default ~ land hexes / 350 */
  rivers?: number;
}

export const MAPGEN_DEFAULTS = {
  landFraction: 0.45,
  continents: 2,
  islands: 6,
  scale: 24,
} as const;

// ---------- value noise with fBm ----------

type Noise = (x: number, y: number) => number;

function makeNoise(rng: RngState, size = 256): Noise {
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

function fbm(noise: Noise, x: number, y: number, octaves = 5): number {
  let v = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    v += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v / norm;
}

/** Ridged multifractal: high values along thin lines → mountain ranges. */
function ridged(noise: Noise, x: number, y: number, octaves = 4): number {
  let v = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(2 * noise(x * freq, y * freq) - 1);
    v += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v / norm;
}

interface Mass {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number; // radians
  peak: number; // height of the core; islands get a boost so they clear the sea level
}

function massField(masses: Mass[], x: number, y: number): number {
  let best = 0;
  for (const m of masses) {
    const dx = x - m.cx, dy = y - m.cy;
    const c = Math.cos(m.rot), s = Math.sin(m.rot);
    const u = (dx * c + dy * s) / m.rx;
    const v = (-dx * s + dy * c) / m.ry;
    const d2 = u * u + v * v;
    const f = m.peak * Math.exp(-d2 * 1.6);
    if (f > best) best = f;
  }
  return best;
}

// ---------- generator ----------

export function generateDraftMap(p: MapGenParams): MapData {
  const { width, height } = p;
  const landFraction = Math.min(0.85, Math.max(0.1, p.landFraction ?? MAPGEN_DEFAULTS.landFraction));
  const continents = Math.min(3, Math.max(1, Math.round(p.continents ?? MAPGEN_DEFAULTS.continents)));
  const islands = Math.max(0, Math.round(p.islands ?? MAPGEN_DEFAULTS.islands));
  const scale = p.scale ?? MAPGEN_DEFAULTS.scale;

  const map = createMap(width, height, terrainIndex('sea'));
  const rng = seedRng(`${p.seed}|${continents}|${islands}|${landFraction}`);
  const elevNoise = makeNoise(rng);
  const moistNoise = makeNoise(rng);
  const ridgeNoise = makeNoise(rng);
  const tempNoise = makeNoise(rng);
  const warpX = makeNoise(rng);
  const warpY = makeNoise(rng);
  const warpX2 = makeNoise(rng);
  const warpY2 = makeNoise(rng);
  const inletNoise = makeNoise(rng);
  const detailNoise = makeNoise(rng);

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

  // 1. place land masses: continents in horizontal slots, islands anywhere
  const masses: Mass[] = [];
  const slot = width / continents;
  for (let i = 0; i < continents; i++) {
    const cx = slot * i + slot * (0.3 + 0.4 * nextFloat(rng));
    const cy = height * (0.3 + 0.4 * nextFloat(rng));
    // size so that `continents` ellipses roughly cover the land fraction
    const area = (width * height * landFraction) / continents;
    const base = Math.sqrt(area / Math.PI);
    const stretch = 1.2 + 0.8 * nextFloat(rng);
    masses.push({ cx, cy, rx: base * stretch, ry: base / stretch * 1.1, rot: nextFloat(rng) * Math.PI, peak: 1 });
  }
  for (let i = 0; i < islands; i++) {
    const cx = width * (0.06 + 0.88 * nextFloat(rng));
    const cy = height * (0.06 + 0.88 * nextFloat(rng));
    const r = Math.min(width, height) * (0.04 + 0.07 * nextFloat(rng));
    const stretch = 1 + nextFloat(rng);
    masses.push({ cx, cy, rx: r * stretch, ry: r / stretch, rot: nextFloat(rng) * Math.PI, peak: 1.4 });
  }

  // 2. elevation = land-mass field shaped by noise, with an edge falloff
  const elev = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const n = fbm(elevNoise, col / scale + 100, row / scale + 100);
      // domain warp: bend the coordinates before sampling the land masses so
      // coastlines are not ellipses
      const warp = Math.min(width, height) * 0.11;
      const warp2 = 5; // hexes — small-scale wobble for bays and headlands
      const wx = col
        + warp * (fbm(warpX, col / (scale * 2) + 700, row / (scale * 2) + 700, 3) - 0.5) * 2
        + warp2 * (fbm(warpX2, col / 6 + 1100, row / 6 + 1100, 2) - 0.5) * 2;
      const wy = row
        + warp * (fbm(warpY, col / (scale * 2) + 900, row / (scale * 2) + 900, 3) - 0.5) * 2
        + warp2 * (fbm(warpY2, col / 6 + 1300, row / 6 + 1300, 2) - 0.5) * 2;
      let m = massField(masses, wx, wy);
      // sea channels between continent slots so that 2 or 3 continents stay separate
      for (let b = 1; b < continents; b++) {
        const d = (wx - slot * b) / (width * 0.035);
        m *= 1 - 0.85 * Math.exp(-d * d);
      }
      let e = m * (0.3 + 0.7 * n) + 0.12 * n;
      // carve inlets: ridged noise at a few-hex scale subtracted from the elevation
      // cuts fjords, estuaries and narrow bays into the coast, and splits off
      // peninsulas and offshore islets. Strongest where the land is low (coasts).
      const inlet = ridged(inletNoise, col / 7 + 1500, row / 7 + 1500, 3);
      const detail = fbm(detailNoise, col / 3.5 + 1700, row / 3.5 + 1700, 2);
      const lowness = Math.max(0, 1 - m * 1.4);
      e -= 0.16 * inlet * (0.35 + 0.65 * lowness) + 0.05 * (detail - 0.5);
      const ex = Math.min(col, width - 1 - col) / (width * 0.08);
      const ey = Math.min(row, height - 1 - row) / (height * 0.08);
      const edge = Math.min(1, Math.min(ex, ey));
      e *= 0.2 + 0.8 * edge;
      elev[idx(map, col, row)] = e;
    }
  }

  // 3. sea level from the requested land fraction
  const sorted = Array.from(elev).sort((a, b) => a - b);
  const seaLevel = sorted[Math.floor(sorted.length * (1 - landFraction))] ?? 0.5;
  const span = Math.max(1e-6, (sorted[sorted.length - 1] ?? 1) - seaLevel);

  // 4. classify
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = idx(map, col, row);
      const e = elev[i];
      if (e < seaLevel) { map.terrain[i] = T.sea; continue; }
      const h = (e - seaLevel) / span; // 0..1 above sea
      const moist = fbm(moistNoise, col / (scale * 0.9) + 300, row / (scale * 0.9) + 300);
      const ridge = ridged(ridgeNoise, col / (scale * 1.6) + 500, row / (scale * 1.6) + 500);
      const lat = row / (height - 1); // 0 = north
      const temp = lat + 0.12 * (tempNoise(col / 9, row / 9) - 0.5);
      const cold = temp < 0.13;

      let t: number;
      if (ridge > 0.72 && h > 0.1) t = T.mountains;
      else if (ridge > 0.62 && h > 0.06) t = T.hills;
      else if (h > 0.85) t = T.hills;
      else if (cold) t = moist > 0.6 ? T.forest : T.tundra;
      else if (moist > 0.68) t = T.forest;
      else if (moist > 0.56) t = T.woodland;
      else if (moist > 0.42) t = T.grassland;
      else if (moist < 0.32 && h < 0.07) t = T.swamp;
      else t = T.plains;
      map.terrain[i] = t;
    }
  }

  // 5. lakes: low, wet, inland basins
  for (let row = 1; row < height - 1; row++) {
    for (let col = 1; col < width - 1; col++) {
      const i = idx(map, col, row);
      const t = map.terrain[i];
      if (t === T.sea || t === T.mountains || t === T.hills) continue;
      const h = (elev[i] - seaLevel) / span;
      const moist = fbm(moistNoise, col / (scale * 0.9) + 300, row / (scale * 0.9) + 300);
      if (h < 0.05 && moist > 0.74) {
        const ns = neighborsOffset(map, col, row);
        if (ns.every((n) => map.terrain[idx(map, n.col, n.row)] !== T.sea)) map.terrain[i] = T.lake;
      }
    }
  }

  // 6. rivers: walk downhill from high ground until water; mark land hexes as River
  const landCount = map.terrain.reduce((acc, t) => acc + (t === T.sea ? 0 : 1), 0);
  const riverCount = p.rivers ?? Math.round(landCount / 350);
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
      if (t === T.sea || t === T.lake || t === T.river) break;
      if (t !== T.mountains) path.push(i);
      // choose the lowest neighbour, with a little wobble so rivers meander
      let best = -1, bestE = Infinity;
      for (const nb of neighborsOffset(map, col, row)) {
        const j = idx(map, nb.col, nb.row);
        if (seen.has(j)) continue;
        const e = elev[j] + (nextFloat(rng) - 0.5) * 0.03;
        if (e < bestE) { bestE = e; best = j; }
      }
      if (best < 0 || elev[best] > elev[i] + 0.02) break;
      col = best % width; row = Math.floor(best / width);
      if (!inBounds(map, col, row)) break;
    }
    if (path.length >= 4) for (const i of path) {
      if (map.terrain[i] !== T.mountains) map.terrain[i] = T.river;
    }
  }

  return map;
}
