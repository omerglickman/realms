import { describe, it, expect } from 'vitest';
import { createMap, getTerrain } from '../src/sim/map';
import { createGameState } from '../src/sim/state';
import { terrainIndex } from '../src/sim/terrain';
import { applyCommand, brushCells, paintCommand, floodFillCommand, isNoop } from '../src/sim/commands';

const SEA = terrainIndex('sea'), HILLS = terrainIndex('hills'), PLAINS = terrainIndex('plains');

describe('commands', () => {
  it('setTerrain applies and its inverse restores exactly', () => {
    const s = createGameState('t', createMap(10, 10, SEA));
    const cmd = paintCommand(s.map, brushCells(s.map, 5, 5, 1), HILLS);
    expect(cmd.cells).toHaveLength(7);
    const inv = applyCommand(s, cmd);
    expect(getTerrain(s.map, 5, 5)).toBe(HILLS);
    expect(getTerrain(s.map, 6, 5)).toBe(HILLS);
    expect(getTerrain(s.map, 8, 5)).toBe(SEA);
    applyCommand(s, inv);
    expect(s.map.terrain.every((t) => t === SEA)).toBe(true);
  });

  it('brush is clipped at the map edge and radius 0 is one hex', () => {
    const m = createMap(10, 10);
    expect(brushCells(m, 0, 0, 1).length).toBeLessThan(7);
    expect(brushCells(m, 0, 0, 1).length).toBeGreaterThan(1);
    expect(brushCells(m, 4, 4, 0)).toEqual([44]);
    expect(brushCells(m, 4, 4, 2)).toHaveLength(19);
  });

  it('painting the same terrain is a no-op', () => {
    const m = createMap(5, 5, SEA);
    expect(isNoop(paintCommand(m, brushCells(m, 2, 2, 1), SEA))).toBe(true);
  });

  it('flood fill changes only the connected region', () => {
    const s = createGameState('t', createMap(6, 6, SEA));
    // a wall of hills down column 3 splits the sea in two
    for (let r = 0; r < 6; r++) s.map.terrain[r * 6 + 3] = HILLS;
    const cmd = floodFillCommand(s.map, 0, 0, PLAINS);
    applyCommand(s, cmd);
    expect(getTerrain(s.map, 0, 0)).toBe(PLAINS);
    expect(getTerrain(s.map, 2, 5)).toBe(PLAINS);
    expect(getTerrain(s.map, 3, 2)).toBe(HILLS);
    // the right side: on odd rows column 4 touches column 3 only, so it stays sea
    expect(getTerrain(s.map, 5, 0)).toBe(SEA);
    expect(getTerrain(s.map, 5, 5)).toBe(SEA);
  });

  it('replaceMap swaps the map and the inverse brings the old one back', () => {
    const s = createGameState('t', createMap(4, 4, SEA));
    const inv = applyCommand(s, { type: 'replaceMap', map: createMap(8, 3, HILLS) });
    expect(s.map.width).toBe(8);
    expect(s.map.terrain[0]).toBe(HILLS);
    applyCommand(s, inv);
    expect(s.map.width).toBe(4);
    expect(s.map.terrain[0]).toBe(SEA);
  });
});
