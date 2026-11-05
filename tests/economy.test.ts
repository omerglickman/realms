import { describe, it, expect } from 'vitest';
import { createMap, idx } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { resourceIndex } from '../src/sim/resources';
import { createGameState, serializeState, deserializeState, STATE_VERSION, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand } from '../src/sim/commands';
import { axialRing, axialToOffset, offsetToAxial } from '../src/sim/hex';
import { totalPopulation } from '../src/sim/demography';
import {
  computeWorkAssignment, resolveParent, workedCellsBySettlement, TIERS, tierIndex, type Settlement,
} from '../src/sim/settlements';
import {
  hexJobs, isShore, planLabour, monthlyProduction, granaryTerms, monthsUntilHarvest, economyMonth, ECONOMY,
} from '../src/sim/economy';

const G = terrainIndex('grassland'), P = terrainIndex('plains'), SEA = terrainIndex('sea'), RIVER = terrainIndex('river');
import { setNoise, NO_NOISE } from '../src/sim/noise';
setNoise(NO_NOISE); // these suites test the deterministic model (Session 9 knobs off)

function found(state: GameState, name: string, tier: string, col: number, row: number, population: number, faction = 'A'): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col, row, population, faction } });
  return Object.values(state.settlements).find((s) => s.name === name)!;
}

function ringSpots(col: number, row: number, radius: number, n: number) {
  const ring = axialRing(offsetToAxial(col, row), radius);
  return Array.from({ length: n }, (_, k) => {
    const h = ring[Math.floor((k * ring.length) / n)];
    return axialToOffset(h.q, h.r);
  });
}

describe('hex jobs', () => {
  it('grassland farms, plains farm and herd, deep sea gives nothing, shore fishes, river farms and fishes', () => {
    const m = createMap(10, 10, SEA);
    m.terrain[idx(m, 5, 5)] = G;
    m.terrain[idx(m, 6, 5)] = P;
    m.terrain[idx(m, 2, 2)] = RIVER;
    expect(hexJobs(m, idx(m, 5, 5)).map((j) => j.kind)).toEqual(['farm', 'herd']); // grassland pasture 1
    expect(hexJobs(m, idx(m, 5, 5))[0].fedPerYear).toBe(600); // fertility 4 at model scale ×3
    expect(hexJobs(m, idx(m, 6, 5)).map((j) => j.kind)).toEqual(['farm', 'herd']);
    expect(isShore(m, 4, 5)).toBe(true); // touches the grassland
    expect(isShore(m, 8, 8)).toBe(false);
    expect(hexJobs(m, idx(m, 4, 5)).map((j) => j.kind)).toEqual(['fish']);
    expect(hexJobs(m, idx(m, 8, 8))).toEqual([]);
    const river = hexJobs(m, idx(m, 2, 2)).map((j) => j.kind);
    expect(river).toContain('farm');
    expect(river).toContain('fish');
  });

  it('a Fish resource makes fishing richer and Game adds hunting', () => {
    const m = createMap(10, 10, SEA);
    m.terrain[idx(m, 5, 5)] = G;
    m.resource[idx(m, 4, 5)] = resourceIndex('fish');
    m.resource[idx(m, 5, 5)] = resourceIndex('game');
    const fish = hexJobs(m, idx(m, 4, 5)).find((j) => j.kind === 'fish')!;
    expect(fish.fedPerYear).toBe(450);
    expect(fish.hands).toBe(90);
    expect(hexJobs(m, idx(m, 5, 5)).map((j) => j.kind)).toContain('hunt');
  });
});

describe('labour and granary', () => {
  it('staffs buildings first, then the best jobs per hand, and reports idle hands', () => {
    const state = createGameState('t', createMap(20, 20, G));
    const s = found(state, 'v', 'village', 10, 10, 3000); // ~1,740 hands
    const cells = workedCellsBySettlement(state).get(s.id)!;
    expect(cells).toHaveLength(7);
    const plan = planLabour(state.map, s, cells);
    expect(plan.staffedHands).toBe(120); // moot hall 30 + granary 90
    expect(plan.granaryStaffing).toBe(1);
    expect(plan.fieldHands).toBe(7 * 105); // 7 × (farm 90 + herd 15)
    expect(plan.idleHands).toBeCloseTo(plan.hands - 120 - 735, 6);
    expect(plan.landCapacity).toBe(7 * (600 + 45));
  });

  it('a tiny village is hands-limited: fields are only partly worked', () => {
    const state = createGameState('t', createMap(20, 20, G));
    const s = found(state, 'v', 'village', 10, 10, 600);
    const plan = planLabour(state.map, s, workedCellsBySettlement(state).get(s.id)!);
    expect(plan.idleHands).toBe(0);
    expect(plan.plannedPerYear).toBeLessThan(plan.landCapacity);
    expect(plan.plannedPerYear).toBeGreaterThan(600); // but still feeds itself
  });

  it('harvest lands 60/40 in September/October; herding arrives monthly', () => {
    const state = createGameState('t', createMap(20, 20, G));
    const s = found(state, 'v', 'village', 10, 10, 3000);
    const plan = planLabour(state.map, s, workedCellsBySettlement(state).get(s.id)!);
    const farmYear = 7 * 600 * 12, herdMonth = (7 * 45 * 12) / 12;
    expect(monthlyProduction(plan, 8)).toBeCloseTo(farmYear * 0.6 + herdMonth, 6);
    expect(monthlyProduction(plan, 9)).toBeCloseTo(farmYear * 0.4 + herdMonth, 6);
    expect(monthlyProduction(plan, 3)).toBeCloseTo(herdMonth, 6);
    expect(monthsUntilHarvest(8)).toBe(12);
    expect(monthsUntilHarvest(7)).toBe(1);
    expect(monthsUntilHarvest(0)).toBe(8);
  });

  it('granary terms interpolate between unstaffed and staffed', () => {
    expect(granaryTerms(0).capacityMonths).toBeCloseTo(15, 9);
    expect(granaryTerms(0).spoilage).toBeCloseTo(0.015, 9);
    expect(granaryTerms(1).capacityMonths).toBeCloseTo(24, 9);
    expect(granaryTerms(1).spoilage).toBeCloseTo(0.005, 9);
    expect(granaryTerms(0.5).capacityMonths).toBeCloseTo(19.5, 6);
  });
});

describe('zones, contested hexes and parents', () => {
  it('higher tier wins contested hexes; a village at distance 3 from a city loses hexes to it', () => {
    const state = createGameState('t', createMap(30, 30, G));
    const city = found(state, 'c', 'city', 15, 15, 24000);
    const spot = ringSpots(15, 15, 3, 1)[0];
    const v = found(state, 'v', 'village', spot.col, spot.row, 1800);
    const worked = workedCellsBySettlement(state);
    expect(worked.get(city.id)).toHaveLength(19);
    expect(worked.get(v.id)!.length).toBeLessThan(7);
    expect(worked.get(v.id)!.length).toBeGreaterThanOrEqual(5);
    const spot4 = ringSpots(15, 15, 4, 2)[1]; // opposite side of the city from v
    const v4 = found(state, 'v4', 'village', spot4.col, spot4.row, 1800);
    expect(workedCellsBySettlement(state).get(v4.id)).toHaveLength(7);
    expect(computeWorkAssignment(state).size).toBe(19 + worked.get(v.id)!.length + 7);
  });

  it('resolves the parent by influence zone, tier and faction; override wins when valid', () => {
    const state = createGameState('t', createMap(40, 40, G));
    const city = found(state, 'c', 'city', 20, 20, 24000);
    const town = found(state, 't', 'town', 27, 20, 9000); // distance 7: outside the city's 5 rings
    const v = found(state, 'v', 'village', 24, 20, 1800); // distance 4 from the city, 3 from the town
    expect(resolveParent(state, v)).toBe(city.id); // higher tier wins
    v.parentOverride = town.id;
    expect(resolveParent(state, v)).toBe(town.id);
    v.parentOverride = null;
    const foreign = found(state, 'f', 'village', 18, 20, 1800, 'B');
    expect(resolveParent(state, foreign)).toBeNull();
    expect(resolveParent(state, city)).toBeNull();
    expect(resolveParent(state, town)).toBeNull();
    expect(TIERS[tierIndex('town')].influenceRings).toBe(3);
  });
});

describe('20-year scenarios (ROADMAP Phase 1 acceptance)', () => {
  const mixMap = () => {
    const MIX = ['grassland', 'plains', 'grassland', 'hills', 'plains', 'woodland'].map(terrainIndex);
    const m = createMap(41, 41, SEA);
    for (let i = 0; i < m.terrain.length; i++) m.terrain[i] = MIX[((i % 41) * 7 + Math.floor(i / 41) * 3) % MIX.length];
    return m;
  };
  const years = (state: GameState, n: number) => { for (let i = 0; i < n * 12; i++) endTurn(state); };

  it('a lone village survives and grows over 20 years without hunger', () => {
    const state = createGameState('a', mixMap());
    const v = found(state, 'v', 'village', 20, 20, 900);
    let hunger = 0;
    for (let i = 0; i < 240; i++) { endTurn(state); hunger += v.report.hungerDeaths; }
    expect(hunger).toBe(0);
    expect(totalPopulation(v.pop)).toBeGreaterThan(1140);
  });

  it('a city with no villages starves down toward what its own land feeds', () => {
    const state = createGameState('d', mixMap());
    const c = found(state, 'c', 'city', 20, 20, 24000);
    years(state, 20);
    const pop = totalPopulation(c.pop);
    expect(pop).toBeLessThan(12000);
    expect(pop).toBeGreaterThan(7500);
  });

  it('a city with ten villages is fed by them and keeps far more people; villages never starve', () => {
    const state = createGameState('c', mixMap());
    const c = found(state, 'c', 'city', 20, 20, 24000);
    const villages = [
      ...ringSpots(20, 20, 3, 6).map((o, i) => found(state, `v3-${i}`, 'village', o.col, o.row, 1800)),
      ...ringSpots(20, 20, 4, 4).map((o, i) => found(state, `v4-${i}`, 'village', o.col, o.row, 1800)),
    ];
    let villageHunger = 0, received = 0;
    for (let i = 0; i < 240; i++) {
      endTurn(state);
      for (const v of villages) villageHunger += v.report.hungerDeaths;
      received += c.report.received;
    }
    expect(villageHunger).toBe(0);
    expect(received).toBeGreaterThan(0);
    expect(totalPopulation(c.pop)).toBeGreaterThan(13500);
    for (const v of villages) expect(v.parent).toBe(c.id);
  });

  it('people are conserved: migration moves people, only births/deaths/hunger change the total', () => {
    const state = createGameState('m', mixMap());
    const t = found(state, 't', 'town', 20, 20, 9000);
    const v = found(state, 'v', 'village', ...Object.values(ringSpots(20, 20, 3, 1)[0]) as [number, number], 4200); // overfull village
    for (let m = 0; m < 11; m++) {
      const before = totalPopulation(t.pop) + totalPopulation(v.pop);
      economyMonth(state, m);
      const after = totalPopulation(t.pop) + totalPopulation(v.pop);
      expect(before - after).toBeCloseTo(t.report.hungerDeaths + v.report.hungerDeaths, 6);
    }
  });

  it('is deterministic and survives a save/load round trip', () => {
    const run = () => {
      const state = createGameState('x', mixMap());
      found(state, 'c', 'city', 20, 20, 24000);
      ringSpots(20, 20, 3, 6).forEach((o, i) => found(state, `v${i}`, 'village', o.col, o.row, 1800));
      years(state, 5);
      return state;
    };
    const a = run(), b = run();
    expect(serializeState(a)).toBe(serializeState(b));
    const c = deserializeState(serializeState(a));
    years(a, 1);
    years(c, 1);
    expect(serializeState(c)).toBe(serializeState(a));
  });

  it('loads a Phase 0 (version 1) save with no settlements', () => {
    const s = deserializeState(JSON.stringify({ version: 1, seed: 's', rng: { a: 1, b: 2, c: 3, d: 4 }, turn: 3, map: createMap(5, 5) }));
    expect(s.version).toBe(STATE_VERSION);
    expect(s.settlements).toEqual({});
    expect(s.factions.player).toBeDefined();
    expect(s.playerFaction).toBe('player');
  });

  it('settlement commands invert: found → remove → restore', () => {
    const state = createGameState('cmd', createMap(10, 10, G));
    const inv = applyCommand(state, { type: 'foundSettlement', settlement: { name: 'v', tier: 'village', col: 5, row: 5, population: 300 } });
    expect(Object.keys(state.settlements)).toHaveLength(1);
    const inv2 = applyCommand(state, inv);
    expect(Object.keys(state.settlements)).toHaveLength(0);
    applyCommand(state, inv2);
    expect(Object.keys(state.settlements)).toHaveLength(1);
    expect(() => applyCommand(state, { type: 'foundSettlement', settlement: { name: 'w', tier: 'village', col: 5, row: 5, population: 300 } })).toThrow();
    expect(ECONOMY.sharing.reserveMonths).toBe(3);
  });
});
