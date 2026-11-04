// The rectangular hex map store. Plain data, JSON-serializable.
// Storage is odd-r offset: index = row * width + col. Terrain is the index
// into TERRAIN (data/terrain.json). Resources/ownership layers come in later phases.

import { offsetToAxial, axialToOffset, type Axial } from './hex';

export const MAX_MAP_WIDTH = 400;
export const MAX_MAP_HEIGHT = 250;

export interface MapData {
  width: number;
  height: number;
  /** terrain index per hex, row-major, odd-r offset. Length = width*height. */
  terrain: number[];
  /** resource index per hex (data/resources.json), -1 = none. Length = width*height. */
  resource: number[];
}

export function createMap(width: number, height: number, fill = 0): MapData {
  if (width < 1 || height < 1 || width > MAX_MAP_WIDTH || height > MAX_MAP_HEIGHT) {
    throw new Error(`Map size ${width}x${height} out of range (max ${MAX_MAP_WIDTH}x${MAX_MAP_HEIGHT})`);
  }
  return {
    width,
    height,
    terrain: new Array<number>(width * height).fill(fill),
    resource: new Array<number>(width * height).fill(-1),
  };
}

export function cloneMap(map: MapData): MapData {
  return { width: map.width, height: map.height, terrain: map.terrain.slice(), resource: map.resource.slice() };
}

export function inBounds(map: MapData, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < map.width && row < map.height;
}

export function idx(map: MapData, col: number, row: number): number {
  return row * map.width + col;
}

export function getTerrain(map: MapData, col: number, row: number): number {
  return map.terrain[idx(map, col, row)];
}

export function setTerrain(map: MapData, col: number, row: number, t: number): void {
  map.terrain[idx(map, col, row)] = t;
}

export function getResource(map: MapData, col: number, row: number): number {
  return map.resource[idx(map, col, row)];
}

export function axialInBounds(map: MapData, h: Axial): boolean {
  const o = axialToOffset(h.q, h.r);
  return inBounds(map, o.col, o.row);
}

export function getTerrainAxial(map: MapData, h: Axial): number {
  const o = axialToOffset(h.q, h.r);
  return getTerrain(map, o.col, o.row);
}

/** Offset-coordinate neighbours that are inside the map. */
export function neighborsOffset(map: MapData, col: number, row: number): { col: number; row: number }[] {
  const a = offsetToAxial(col, row);
  const out: { col: number; row: number }[] = [];
  const dirs = [
    [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
  ] as const;
  for (const [dq, dr] of dirs) {
    const o = axialToOffset(a.q + dq, a.r + dr);
    if (inBounds(map, o.col, o.row)) out.push(o);
  }
  return out;
}

export function countTerrain(map: MapData): number[] {
  const counts: number[] = [];
  for (const t of map.terrain) counts[t] = (counts[t] ?? 0) + 1;
  return counts;
}
