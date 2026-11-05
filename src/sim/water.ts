// Water hexes (DESIGN §3.1): lakes and rivers are always workable; a sea hex is
// workable only when it is a SHORE (touches land). Kept in its own module so
// both the economy and the building rules can use it without a cycle.

import economyData from '../../data/economy.json';
import type { MapData } from './map';
import { neighborsOffset } from './map';
import { terrainIndex } from './terrain';

const SEA = terrainIndex('sea');
const LAKE = terrainIndex('lake');
const WATER = new Set(economyData.fishing.waterTerrains.map(terrainIndex));

/** Is this sea hex a shore (touches land)? Lakes and rivers are always workable. */
export function isShore(map: MapData, col: number, row: number): boolean {
  for (const n of neighborsOffset(map, col, row)) {
    const t = map.terrain[n.row * map.width + n.col];
    if (t !== SEA && t !== LAKE) return true;
  }
  return false;
}

/** Can this hex be fished from the land (lake, river, or shore sea)? */
export function isFishable(map: MapData, cell: number): boolean {
  const ti = map.terrain[cell];
  if (!WATER.has(ti)) return false;
  if (ti !== SEA || !economyData.fishing.seaNeedsLandNeighbour) return true;
  return isShore(map, cell % map.width, Math.floor(cell / map.width));
}
