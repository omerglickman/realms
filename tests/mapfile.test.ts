import { describe, it, expect } from 'vitest';
import { saveMapFile, loadMapFile } from '../src/sim/mapfile';
import { generateDraftMap } from '../src/sim/mapgen';
import { TERRAIN } from '../src/sim/terrain';
import testmap from '../maps/testmap.json';

describe('map file', () => {
  it('round-trips through JSON', () => {
    const m = generateDraftMap({ width: 30, height: 20, seed: 'x' });
    const f = JSON.parse(JSON.stringify(saveMapFile(m, 'test')));
    const back = loadMapFile(f);
    expect(back.name).toBe('test');
    expect(back.map).toEqual(m);
  });
  it('re-maps terrain by id if the table order differs', () => {
    const m = generateDraftMap({ width: 10, height: 10, seed: 'y' });
    const f = saveMapFile(m, 't');
    // pretend the file was written with sea at index 0
    const ids = f.terrainIds.slice();
    const seaIdx = ids.indexOf('sea');
    [ids[0], ids[seaIdx]] = [ids[seaIdx], ids[0]];
    const swapped = f.terrain.map((t) => (t === 0 ? seaIdx : t === seaIdx ? 0 : t));
    const back = loadMapFile({ ...f, terrainIds: ids, terrain: swapped });
    expect(back.map.terrain).toEqual(m.terrain);
  });
  it('rejects garbage', () => {
    expect(() => loadMapFile({ hello: 1 })).toThrow();
    expect(() => loadMapFile({ format: 'realms-map', width: 2, height: 2, terrain: [0] })).toThrow();
  });
  it('the shipped test map is valid, 160x100, and uses every terrain index legally', () => {
    const { map, name } = loadMapFile(testmap);
    expect(name).toContain('vinral');
    expect(map.width).toBe(160);
    expect(map.height).toBe(100);
    for (const t of map.terrain) expect(t >= 0 && t < TERRAIN.length).toBe(true);
  });
});
