import { describe, it, expect } from 'vitest';
import { createMap, getTerrain, setTerrain, neighborsOffset, countTerrain, MAX_MAP_WIDTH, MAX_MAP_HEIGHT } from '../src/sim/map';
import { TERRAIN, terrainIndex, terrainByIndex, colorToNumber } from '../src/sim/terrain';
import { generateDraftMap } from '../src/sim/mapgen';
import { seedRng, nextFloat, nextInt } from '../src/sim/rng';
import { createGameState, serializeState, deserializeState, calendar } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';

describe('terrain data', () => {
  it('has the eleven terrain types from DESIGN §2.3 in a stable order', () => {
    expect(TERRAIN.map((t) => t.id)).toEqual([
      'plains', 'grassland', 'river', 'hills', 'mountains', 'woodland',
      'forest', 'tundra', 'swamp', 'lake', 'sea',
    ]);
  });
  it('indexes and colours resolve', () => {
    expect(terrainByIndex(terrainIndex('forest')).id).toBe('forest');
    expect(colorToNumber('#ff0000')).toBe(0xff0000);
    expect(() => terrainIndex('desert')).toThrow();
  });
});

describe('map store', () => {
  it('creates, sets and gets', () => {
    const m = createMap(10, 6, terrainIndex('sea'));
    expect(m.terrain).toHaveLength(60);
    setTerrain(m, 3, 2, terrainIndex('hills'));
    expect(getTerrain(m, 3, 2)).toBe(terrainIndex('hills'));
    expect(countTerrain(m)[terrainIndex('hills')]).toBe(1);
  });
  it('supports the maximum 400x250 and rejects larger', () => {
    expect(createMap(MAX_MAP_WIDTH, MAX_MAP_HEIGHT).terrain).toHaveLength(100_000);
    expect(() => createMap(MAX_MAP_WIDTH + 1, 10)).toThrow();
  });
  it('clips neighbours at the edges', () => {
    const m = createMap(5, 5);
    expect(neighborsOffset(m, 0, 0)).toHaveLength(2);
    expect(neighborsOffset(m, 2, 2)).toHaveLength(6);
  });
});

describe('rng', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = seedRng('realms'), b = seedRng('realms'), c = seedRng('kings');
    const sa = Array.from({ length: 5 }, () => nextFloat(a));
    const sb = Array.from({ length: 5 }, () => nextFloat(b));
    const sc = Array.from({ length: 5 }, () => nextFloat(c));
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });
  it('nextInt stays within bounds', () => {
    const s = seedRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = nextInt(s, 3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
});

describe('draft map generator', () => {
  it('is deterministic and produces a mix of land and sea', () => {
    const a = generateDraftMap({ width: 80, height: 50, seed: 'test' });
    const b = generateDraftMap({ width: 80, height: 50, seed: 'test' });
    expect(a.terrain).toEqual(b.terrain);
    const counts = countTerrain(a);
    const sea = counts[terrainIndex('sea')] ?? 0;
    const total = a.terrain.length;
    expect(sea).toBeGreaterThan(total * 0.2);
    expect(sea).toBeLessThan(total * 0.8);
    // every terrain index is valid
    for (const t of a.terrain) expect(t >= 0 && t < TERRAIN.length).toBe(true);
  });
  it('generates a full-size 400x250 map in reasonable time', () => {
    const t0 = performance.now();
    const m = generateDraftMap({ width: 400, height: 250, seed: 'big' });
    expect(m.terrain).toHaveLength(100_000);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});

describe('game state', () => {
  it('serializes and deserializes losslessly; the clock advances by months', () => {
    const map = generateDraftMap({ width: 20, height: 10, seed: 's' });
    const s = createGameState('s', map);
    expect(calendar(s.turn)).toMatchObject({ year: 1, month: 0, monthName: 'January' });
    for (let i = 0; i < 14; i++) endTurn(s);
    expect(calendar(s.turn)).toMatchObject({ year: 2, month: 2, monthName: 'March' });
    const copy = deserializeState(serializeState(s));
    expect(copy).toEqual(s);
  });
});
