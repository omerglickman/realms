// Resource definitions (data/resources.json) and spawning.
// The array is INDEX-STABLE: a map stores a resource as its index, -1 = none.

import resourceData from '../../data/resources.json';
import { type MapData, idx, neighborsOffset } from './map';
import { TERRAIN, terrainIndex } from './terrain';
import { type RngState, nextU32 } from './rng';
import { axialRange, offsetToAxial, axialToOffset } from './hex';
import { inBounds } from './map';

export type Glyph = 'circle' | 'ring' | 'triangle' | 'square' | 'diamond' | 'hex' | 'cross' | 'star';

export interface ResourceDef {
  /** a deposit a quarry / mine can work (Session 17b): stone, iron, silver, salt */
  mineable?: boolean;
  id: string;
  name: string;
  color: string;
  glyph: Glyph;
  /** icon id in src/ui/icons.ts (Session 13b); the glyph is the fallback */
  icon?: string;
  /** per-mille chance per hex, keyed by terrain id */
  spawn: Record<string, number>;
  coastalOnly?: boolean;
  minSpacing?: number;
  gives: Record<string, number>;
  notes?: string;
}

export const NO_RESOURCE = -1;

export const RESOURCES: readonly ResourceDef[] = resourceData.resources as unknown as ResourceDef[];

export const RESOURCE_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  RESOURCES.map((r, i) => [r.id, i]),
);

export function resourceIndex(id: string): number {
  const i = RESOURCE_INDEX[id];
  if (i === undefined) throw new Error(`Unknown resource id "${id}"`);
  return i;
}

export function resourceByIndex(i: number): ResourceDef | undefined {
  return i >= 0 ? RESOURCES[i] : undefined;
}

/** spawnTable[terrainIndex] = list of [resourceIndex, weight‰]. Built once. */
const SPAWN_TABLE: [number, number][][] = TERRAIN.map((t) =>
  RESOURCES.flatMap((r, ri) => {
    const w = r.spawn[t.id];
    return w && w > 0 ? [[ri, w] as [number, number]] : [];
  }),
);

const SEA = terrainIndex('sea');

function isCoastal(map: MapData, col: number, row: number): boolean {
  for (const n of neighborsOffset(map, col, row)) {
    const t = map.terrain[idx(map, n.col, n.row)];
    if (TERRAIN[t].passable) return true;
  }
  return false;
}

function tooClose(map: MapData, col: number, row: number, ri: number, spacing: number): boolean {
  if (spacing <= 0) return false;
  const c = offsetToAxial(col, row);
  for (const h of axialRange(c, spacing)) {
    const o = axialToOffset(h.q, h.r);
    if ((o.col === col && o.row === row) || !inBounds(map, o.col, o.row)) continue;
    if (map.resource[idx(map, o.col, o.row)] === ri) return true;
  }
  return false;
}

export interface SpawnOptions {
  /** multiply all spawn chances (1 = as in data). default 1 */
  density?: number;
  /** if false, hexes that already have a resource are left alone. default true */
  replace?: boolean;
}

/**
 * Deterministically compute a resource layer for the map. Returns the new
 * layer (does not mutate the map) so it can be applied as an undoable command.
 */
export function computeResourceSpawn(map: MapData, rng: RngState, opts: SpawnOptions = {}): number[] {
  const density = opts.density ?? 1;
  const replace = opts.replace ?? true;
  const out = replace ? new Array<number>(map.terrain.length).fill(NO_RESOURCE) : map.resource.slice();
  // work on a scratch map so spacing checks see resources placed so far
  const scratch: MapData = { width: map.width, height: map.height, terrain: map.terrain, resource: out };
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const i = idx(map, col, row);
      if (!replace && out[i] !== NO_RESOURCE) { nextU32(rng); continue; }
      const t = map.terrain[i];
      const table = SPAWN_TABLE[t];
      const roll = nextU32(rng) % 1000;
      if (table.length === 0) continue;
      let acc = 0;
      let chosen = NO_RESOURCE;
      for (const [ri, w] of table) {
        acc += w * density;
        if (roll < acc) { chosen = ri; break; }
      }
      if (chosen === NO_RESOURCE) continue;
      const def = RESOURCES[chosen];
      if (def.coastalOnly && t === SEA && !isCoastal(map, col, row)) continue;
      if (tooClose(scratch, col, row, chosen, def.minSpacing ?? 0)) continue;
      out[i] = chosen;
    }
  }
  return out;
}

export function countResources(map: MapData): number[] {
  const counts = new Array<number>(RESOURCES.length).fill(0);
  for (const r of map.resource) if (r >= 0) counts[r]++;
  return counts;
}
