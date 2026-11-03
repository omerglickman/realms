// Terrain definitions, loaded from data/terrain.json.
// The array is INDEX-STABLE: a map stores terrain as its index in this array.
import terrainData from '../../data/terrain.json';

export interface TerrainDef {
  id: string;
  name: string;
  color: string; // hex colour string, e.g. "#8fbf5a"
  moveCost: number;
  food: number;
  passable: boolean;
}

export const TERRAIN: readonly TerrainDef[] = terrainData.terrain;

export const TERRAIN_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  TERRAIN.map((t, i) => [t.id, i]),
);

export function terrainByIndex(i: number): TerrainDef {
  const t = TERRAIN[i];
  if (!t) throw new Error(`Unknown terrain index ${i}`);
  return t;
}

export function terrainIndex(id: string): number {
  const i = TERRAIN_INDEX[id];
  if (i === undefined) throw new Error(`Unknown terrain id "${id}"`);
  return i;
}

/** Parse "#rrggbb" into a 0xRRGGBB number (for PixiJS). */
export function colorToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
