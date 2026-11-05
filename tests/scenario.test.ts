// Phase 1 session 3: factions in the state, population history / growth trend,
// the settle check, the rename command, and scenario files.

import { describe, it, expect } from 'vitest';
import { createMap, idx } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { createGameState, serializeState, deserializeState, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand } from '../src/sim/commands';
import { growthTrend, canSettleAt, childrenOf, POP_HISTORY_YEARS, type Settlement } from '../src/sim/settlements';
import { totalPopulation } from '../src/sim/demography';
import { saveScenarioFile, loadScenarioFile, detectFile } from '../src/sim/scenario';
import { saveMapFile } from '../src/sim/mapfile';
import { FACTION_DEFS, PLAYER_FACTION, factionColor } from '../src/sim/factions';

const G = terrainIndex('grassland'), SEA = terrainIndex('sea'), MTN = terrainIndex('mountains');

function found(state: GameState, name: string, tier: string, col: number, row: number, population: number, faction?: string | null): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col, row, population, ...(faction === undefined ? {} : { faction }) } });
  return Object.values(state.settlements).find((s) => s.name === name)!;
}

describe('factions in the state', () => {
  it('a new state carries every faction from data/factions.json and the player id', () => {
    const s = createGameState('f', createMap(10, 10, G));
    expect(Object.keys(s.factions)).toEqual(FACTION_DEFS.map((f) => f.id));
    expect(s.playerFaction).toBe(PLAYER_FACTION);
    expect(s.factions[s.playerFaction].player).toBe(true);
    expect(s.factions[s.playerFaction].treasury).toBe(0);
  });

  it('a settlement founded without a faction belongs to the player; an explicit faction is kept', () => {
    const s = createGameState('f', createMap(10, 10, G));
    expect(found(s, 'a', 'village', 2, 2, 900).faction).toBe(PLAYER_FACTION);
    expect(found(s, 'b', 'village', 6, 6, 900, 'A').faction).toBe('A');
    expect(found(s, 'c', 'village', 2, 6, 900, null).faction).toBeNull();
    expect(factionColor(s.factions, PLAYER_FACTION)).toBe(s.factions[PLAYER_FACTION].color);
    expect(factionColor(s.factions, 'A')).toBe(factionColor(s.factions, null));
  });

  it('migrates a version-2 save: factions, player id, population history', () => {
    const s2 = createGameState('m', createMap(8, 8, G));
    found(s2, 'v', 'village', 3, 3, 900, 'A');
    const raw = JSON.parse(serializeState(s2));
    raw.version = 2;
    delete raw.factions;
    delete raw.playerFaction;
    for (const st of Object.values(raw.settlements) as Record<string, unknown>[]) { delete st.popHistory; delete st.foundedTurn; }
    const s = deserializeState(JSON.stringify(raw));
    expect(s.version).toBe(3);
    expect(s.playerFaction).toBe(PLAYER_FACTION);
    expect(s.factions[PLAYER_FACTION]).toBeDefined();
    const v = Object.values(s.settlements)[0];
    expect(v.popHistory).toEqual([]);
    expect(v.foundedTurn).toBe(0);
    expect(v.faction).toBe('A');
  });
});

describe('population history and growth trend', () => {
  it('records one total per December, caps the history, and reports a yearly trend after two year-ends', () => {
    const s = createGameState('h', createMap(12, 12, G));
    const v = found(s, 'v', 'village', 5, 5, 900);
    expect(growthTrend(v)).toBeNull();
    for (let i = 0; i < 12; i++) endTurn(s);
    expect(v.popHistory).toHaveLength(1);
    expect(growthTrend(v)).toBeNull();
    for (let i = 0; i < 12; i++) endTurn(s);
    expect(v.popHistory).toHaveLength(2);
    const t = growthTrend(v)!;
    expect(t).toBeCloseTo(v.popHistory[1] / v.popHistory[0] - 1, 12);
    expect(t).toBeGreaterThan(0.005);
    expect(t).toBeLessThan(0.03);
    expect(v.popHistory[1]).toBeCloseTo(totalPopulation(v.pop), 6);
    for (let y = 2; y < POP_HISTORY_YEARS + 5; y++) for (let i = 0; i < 12; i++) endTurn(s);
    expect(v.popHistory).toHaveLength(POP_HISTORY_YEARS);
  });

  it('foundedTurn is the turn of founding', () => {
    const s = createGameState('h', createMap(12, 12, G));
    for (let i = 0; i < 7; i++) endTurn(s);
    expect(found(s, 'v', 'village', 5, 5, 900).foundedTurn).toBe(7);
  });
});

describe('settling rules and commands', () => {
  it('canSettleAt refuses water, mountains, occupied hexes and off-map', () => {
    const s = createGameState('c', createMap(10, 10, G));
    s.map.terrain[idx(s.map, 1, 1)] = SEA;
    s.map.terrain[idx(s.map, 2, 2)] = MTN;
    expect(canSettleAt(s, 1, 1).ok).toBe(false);
    expect(canSettleAt(s, 2, 2).ok).toBe(false);
    expect(canSettleAt(s, 50, 50).ok).toBe(false);
    expect(canSettleAt(s, 5, 5).ok).toBe(true);
    found(s, 'v', 'village', 5, 5, 900);
    expect(canSettleAt(s, 5, 5).ok).toBe(false);
  });

  it('renameSettlement is its own inverse; childrenOf follows resolved parents', () => {
    const s = createGameState('r', createMap(30, 30, G));
    const t = found(s, 'Town', 'town', 15, 15, 9000);
    const v = found(s, 'Vill', 'village', 18, 15, 900);
    const inv = applyCommand(s, { type: 'renameSettlement', id: v.id, name: 'Newname' });
    expect(v.name).toBe('Newname');
    expect(inv).toEqual({ type: 'renameSettlement', id: v.id, name: 'Vill' });
    applyCommand(s, inv);
    expect(v.name).toBe('Vill');
    endTurn(s); // resolves parents
    expect(v.parent).toBe(t.id);
    expect(childrenOf(s, t.id).map((c) => c.id)).toEqual([v.id]);
  });
});

describe('editSettlement command', () => {
  it('scales every cohort to the new total, keeps the granary months, and inverts exactly', () => {
    const s = createGameState('e', createMap(12, 12, G));
    const v = found(s, 'v', 'village', 5, 5, 900);
    for (let i = 0; i < 5; i++) endTurn(s);
    const before = { pop: JSON.parse(JSON.stringify(v.pop)), food: v.food, total: totalPopulation(v.pop) };
    const monthsBefore = v.food / before.total;
    const inv = applyCommand(s, { type: 'editSettlement', id: v.id, population: 2700, name: 'Big' });
    expect(v.name).toBe('Big');
    expect(totalPopulation(v.pop)).toBeCloseTo(2700, 6);
    expect(v.food / 2700).toBeCloseTo(monthsBefore, 9);
    // structure preserved: each cohort scaled by the same factor
    const k = 2700 / before.total;
    for (let b = 0; b < v.pop.m.length; b++) {
      expect(v.pop.m[b]).toBeCloseTo(before.pop.m[b] * k, 9);
      expect(v.pop.f[b]).toBeCloseTo(before.pop.f[b] * k, 9);
    }
    applyCommand(s, inv);
    expect(v.name).toBe('v');
    expect(v.pop).toEqual(before.pop);
    expect(v.food).toBe(before.food);
  });
});

describe('scenario files', () => {
  it('round-trips the whole state and is told apart from a map file', () => {
    const s = createGameState('sc', createMap(20, 20, G));
    found(s, 'Town', 'town', 10, 10, 9000);
    found(s, 'V', 'village', 13, 10, 900);
    for (let i = 0; i < 30; i++) endTurn(s);
    const file = saveScenarioFile(s, 'test', { note: 'x' });
    expect(file.format).toBe('realms-scenario');
    expect(file.meta?.settlements).toBe(2);
    expect(file.meta?.date).toBe('July, year 3');
    const json = JSON.stringify(file);
    const back = loadScenarioFile(JSON.parse(json));
    expect(back.name).toBe('test');
    expect(serializeState(back.state)).toBe(serializeState(s));
    // both continue identically
    endTurn(back.state); endTurn(s);
    expect(serializeState(back.state)).toBe(serializeState(s));
    expect(detectFile(file)).toBe('scenario');
    expect(detectFile(saveMapFile(s.map, 'm'))).toBe('map');
    expect(detectFile({ hello: 1 })).toBe('unknown');
    expect(() => loadScenarioFile(saveMapFile(s.map, 'm'))).toThrow();
  });
});
