import { describe, it, expect } from 'vitest';
import { RESOURCES, resourceIndex, computeResourceSpawn, countResources, NO_RESOURCE } from '../src/sim/resources';
import { TERRAIN, terrainIndex } from '../src/sim/terrain';
import { createMap, idx, neighborsOffset } from '../src/sim/map';
import { generateDraftMap } from '../src/sim/mapgen';
import { seedRng } from '../src/sim/rng';
import { saveMapFile, loadMapFile } from '../src/sim/mapfile';
import { createGameState } from '../src/sim/state';
import { applyCommand, resourceLayerCommand, setResourceCommand } from '../src/sim/commands';
import { axialDistance, offsetToAxial } from '../src/sim/hex';
import testmap from '../maps/testmap.json';

describe('resource data', () => {
  it('has the ten DESIGN §3.1 resources in a stable order and only references known terrains', () => {
    expect(RESOURCES.map((r) => r.id)).toEqual([
      'fertile_soil', 'pasture', 'timber', 'stone', 'iron', 'fish', 'furs', 'salt', 'wine', 'silver',
    ]);
    const ids = new Set(TERRAIN.map((t) => t.id));
    for (const r of RESOURCES) for (const t of Object.keys(r.spawn)) expect(ids.has(t)).toBe(true);
    expect(resourceIndex('iron')).toBe(4);
  });
  it('total spawn chance per terrain never exceeds 100%', () => {
    for (const t of TERRAIN) {
      const total = RESOURCES.reduce((a, r) => a + (r.spawn[t.id] ?? 0), 0);
      expect(total).toBeLessThanOrEqual(1000);
    }
  });
});

describe('spawning', () => {
  const map = generateDraftMap({ width: 120, height: 80, seed: 'res', resources: false });

  it('is deterministic and respects terrain', () => {
    const a = computeResourceSpawn(map, seedRng('x'));
    const b = computeResourceSpawn(map, seedRng('x'));
    expect(a).toEqual(b);
    for (let i = 0; i < a.length; i++) {
      if (a[i] === NO_RESOURCE) continue;
      const tid = TERRAIN[map.terrain[i]].id;
      expect(RESOURCES[a[i]].spawn[tid]).toBeGreaterThan(0);
    }
    const counts = countResources({ ...map, resource: a });
    expect(counts.reduce((x, y) => x + y, 0)).toBeGreaterThan(100);
  });

  it('fish on sea only touches land; silver keeps its spacing', () => {
    const layer = computeResourceSpawn(map, seedRng('y'));
    const m = { ...map, resource: layer };
    const FISH = resourceIndex('fish'), SILVER = resourceIndex('silver'), SEA = terrainIndex('sea');
    const silverCells: number[] = [];
    for (let i = 0; i < layer.length; i++) {
      const col = i % map.width, row = Math.floor(i / map.width);
      if (layer[i] === FISH && map.terrain[i] === SEA) {
        expect(neighborsOffset(m, col, row).some((n) => TERRAIN[map.terrain[idx(m, n.col, n.row)]].passable)).toBe(true);
      }
      if (layer[i] === SILVER) silverCells.push(i);
    }
    const spacing = RESOURCES[SILVER].minSpacing ?? 0;
    for (const a of silverCells) for (const b of silverCells) {
      if (a === b) continue;
      const d = axialDistance(offsetToAxial(a % map.width, Math.floor(a / map.width)), offsetToAxial(b % map.width, Math.floor(b / map.width)));
      expect(d).toBeGreaterThan(spacing);
    }
  });

  it('replace=false keeps existing resources', () => {
    const m = createMap(10, 10, terrainIndex('grassland'));
    m.resource[0] = resourceIndex('silver');
    const layer = computeResourceSpawn(m, seedRng('z'), { replace: false });
    expect(layer[0]).toBe(resourceIndex('silver'));
  });

  it('density 0 spawns nothing', () => {
    const layer = computeResourceSpawn(map, seedRng('q'), { density: 0 });
    expect(layer.every((r) => r === NO_RESOURCE)).toBe(true);
  });
});

describe('resource commands and file', () => {
  it('setResource / resourceLayer commands apply and invert', () => {
    const s = createGameState('t', createMap(6, 6, terrainIndex('hills')));
    const inv = applyCommand(s, setResourceCommand(s.map, [3, 4], resourceIndex('iron')));
    expect(s.map.resource[3]).toBe(resourceIndex('iron'));
    applyCommand(s, inv);
    expect(s.map.resource[3]).toBe(NO_RESOURCE);
    const layer = computeResourceSpawn(s.map, seedRng('k'));
    const inv2 = applyCommand(s, resourceLayerCommand(s.map, layer));
    expect(s.map.resource).toEqual(layer);
    applyCommand(s, inv2);
    expect(s.map.resource.every((r) => r === NO_RESOURCE)).toBe(true);
  });

  it('v2 files round-trip resources; v1 files (like testmap rev 2) load with no resources', () => {
    const map = generateDraftMap({ width: 20, height: 12, seed: 'f' });
    const back = loadMapFile(JSON.parse(JSON.stringify(saveMapFile(map, 'r'))));
    expect(back.map.resource).toEqual(map.resource);
    expect(back.map.terrain).toEqual(map.terrain);
    const old = loadMapFile(testmap);
    expect(old.map.resource).toHaveLength(16000);
    expect(old.map.resource.every((r) => r === NO_RESOURCE) || (testmap as { version: number }).version >= 2).toBe(true);
  });
});
