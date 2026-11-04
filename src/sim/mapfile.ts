// Map file format (maps/*.json). This is what the editor exports/imports and
// what the game ships as its default canvas. Plain JSON; terrain by index.

import { MAX_MAP_HEIGHT, MAX_MAP_WIDTH, type MapData } from './map';
import { TERRAIN } from './terrain';
import { RESOURCES, NO_RESOURCE } from './resources';

/** v1: terrain only. v2: + resource layer. Older versions are migrated on load. */
export const MAPFILE_VERSION = 2;

export interface MapFile {
  format: 'realms-map';
  version: number;
  name: string;
  width: number;
  height: number;
  /** terrain ids in index order at the time of saving, so a file can be
   *  re-mapped if data/terrain.json ever changes (it is index-stable, but belt and braces). */
  terrainIds: string[];
  terrain: number[];
  /** v2+: resource ids in index order at save time */
  resourceIds?: string[];
  /** v2+: resource index per hex, -1 = none */
  resource?: number[];
  meta?: Record<string, unknown>;
}

export function saveMapFile(map: MapData, name: string, meta?: Record<string, unknown>): MapFile {
  return {
    format: 'realms-map',
    version: MAPFILE_VERSION,
    name,
    width: map.width,
    height: map.height,
    terrainIds: TERRAIN.map((t) => t.id),
    terrain: map.terrain.slice(),
    resourceIds: RESOURCES.map((r) => r.id),
    resource: map.resource.slice(),
    meta,
  };
}

export function loadMapFile(file: unknown): { map: MapData; name: string } {
  const f = file as Partial<MapFile>;
  if (!f || f.format !== 'realms-map' || typeof f.width !== 'number' || typeof f.height !== 'number' || !Array.isArray(f.terrain)) {
    throw new Error('Not a Realms map file');
  }
  if (f.width < 1 || f.height < 1 || f.width > MAX_MAP_WIDTH || f.height > MAX_MAP_HEIGHT) {
    throw new Error(`Map size ${f.width}x${f.height} out of range`);
  }
  if (f.terrain.length !== f.width * f.height) throw new Error('Map file terrain length does not match its size');
  // Re-map terrain indices by id in case the terrain table order differs from the file's.
  const ids = f.terrainIds ?? TERRAIN.map((t) => t.id);
  const remap = ids.map((id) => {
    const i = TERRAIN.findIndex((t) => t.id === id);
    if (i < 0) throw new Error(`Map file uses unknown terrain "${id}"`);
    return i;
  });
  const identity = remap.every((v, i) => v === i);
  const terrain = identity ? f.terrain.slice() : f.terrain.map((t) => remap[t]);

  // resource layer: absent in v1 files → none everywhere
  let resource: number[];
  if (Array.isArray(f.resource)) {
    if (f.resource.length !== f.width * f.height) throw new Error('Map file resource length does not match its size');
    const rids = f.resourceIds ?? RESOURCES.map((r) => r.id);
    const rremap = rids.map((id) => {
      const i = RESOURCES.findIndex((r) => r.id === id);
      if (i < 0) throw new Error(`Map file uses unknown resource "${id}"`);
      return i;
    });
    const ridentity = rremap.every((v, i) => v === i);
    resource = ridentity ? f.resource.slice() : f.resource.map((r) => (r < 0 ? NO_RESOURCE : rremap[r]));
  } else {
    resource = new Array<number>(f.width * f.height).fill(NO_RESOURCE);
  }
  return { map: { width: f.width, height: f.height, terrain, resource }, name: f.name ?? 'untitled' };
}
