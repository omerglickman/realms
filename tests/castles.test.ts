import { describe, it, expect } from 'vitest';
import { createMap, idx } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { createGameState, serializeState, deserializeState, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand } from '../src/sim/commands';
import {
  TIERS, tierIndex, setAbandonBelow, resolveAllParents, foodParentOf, workedCellsBySettlement, canSettleAt, isCastle, isRuin, influenceCells, type Settlement,
} from '../src/sim/settlements';
import { CASTLES, allocateService, castleNeed, castleAt } from '../src/sim/castles';
import { setNoise, NO_NOISE } from '../src/sim/noise';
import { setStockCaps } from '../src/sim/materials';
import { setTitheShare } from '../src/sim/economy';
import { totalPopulation, workingHands } from '../src/sim/demography';
import { OPEN, findRoute } from '../src/sim/pathfinding';
import { type Unit } from '../src/sim/units';
import { makeBuildOrder, orderSummary } from '../src/sim/workbands';
import { fortify, canFortify, fortAt } from '../src/sim/forts';
import { UNIT_TYPES } from '../src/sim/units';

setNoise(NO_NOISE);
setAbandonBelow(0);
setStockCaps(false);

const P = terrainIndex('plains'), H = terrainIndex('hills'), M = terrainIndex('mountains');

function world(fill = P, w = 30, h = 24) {
  const map = createMap(w, h, fill);
  const state = createGameState('castles', map);
  const f = state.factions[state.playerFaction];
  f.treasury = 500_000; f.stock.timber = 20_000; f.stock.stone = 20_000;
  return { map, state, f };
}

function found(state: GameState, name: string, tier: string, col: number, row: number, population = 0): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col, row, population, faction: state.playerFaction } });
  const s = Object.values(state.settlements).find((x) => x.name === name)!;
  s.stock.timber = 1000; s.stock.stone = 1000;
  if (!isCastle(s)) s.food = 100_000;
  return s;
}

describe('castles on the ladder (DESIGN §3.5)', () => {
  it('data: seven ranks, castle tiers appended, no residents', () => {
    const ranks = TIERS.slice().sort((a, b) => a.rank - b.rank).map((t) => t.id);
    expect(ranks).toEqual(['village', 'small_castle', 'town', 'medium_castle', 'city', 'large_castle', 'metropolis']);
    expect(TIERS.slice(0, 4).map((t) => t.id)).toEqual(['village', 'town', 'city', 'metropolis']); // index-stable
    expect(TIERS[tierIndex('large_castle')]).toMatchObject({ influenceRings: 5, workHexes: 3, castle: true });
    const { state } = world();
    const c = found(state, 'Keep', 'small_castle', 10, 10);
    expect(totalPopulation(c.pop)).toBe(0);
    expect(c.buildings).toEqual([]);
    expect(c.castle).toBeTruthy();
  });

  it('a village stays under its town when a medium castle also covers it; the town goes under the castle', () => {
    const { state } = world();
    const town = found(state, 'Town', 'town', 10, 10, 3000);
    const vil = found(state, 'Vil', 'village', 11, 10, 900);
    const castle = found(state, 'Keep', 'medium_castle', 9, 10);
    resolveAllParents(state);
    expect(vil.parent).toBe(town.id);
    expect(town.parent).toBe(castle.id);
    expect(foodParentOf(state, vil)?.id).toBe(town.id);
    expect(foodParentOf(state, town)).toBeNull(); // the castle takes no tithe and has no people
  });

  it('a small castle adopts villages no town covers', () => {
    const { state } = world();
    const vil = found(state, 'Lonely', 'village', 12, 10, 900);
    const castle = found(state, 'Post', 'small_castle', 11, 10);
    resolveAllParents(state);
    expect(vil.parent).toBe(castle.id);
  });

  it('where a castle may stand: mountains yes, a higher work zone no, water no', () => {
    const { state, map } = world();
    map.terrain[idx(map, 5, 5)] = M;
    found(state, 'City', 'city', 15, 12, 10000);
    expect(canSettleAt(state, 5, 5, tierIndex('small_castle')).ok).toBe(true);
    expect(canSettleAt(state, 5, 5, tierIndex('village')).ok).toBe(false);
    expect(canSettleAt(state, 16, 12, tierIndex('medium_castle')).ok).toBe(false); // inside a city's work zone
    expect(canSettleAt(state, 16, 12, tierIndex('large_castle')).ok).toBe(true);   // a higher rank than the city
    map.terrain[idx(map, 2, 2)] = terrainIndex('sea');
    expect(canSettleAt(state, 2, 2, tierIndex('small_castle')).ok).toBe(false);
  });

  it('a large castle works its own hex and the two best free neighbours; a town loses the hexes to it', () => {
    const { state, map } = world();
    const town = found(state, 'Town', 'town', 10, 10, 3000);
    const castle = found(state, 'Great Keep', 'large_castle', 11, 10);
    // make two neighbours of the castle richer than the rest
    map.terrain[idx(map, 12, 10)] = H;
    const worked = workedCellsBySettlement(state);
    const mine = worked.get(castle.id)!;
    expect(mine.length).toBe(3);
    expect(mine).toContain(idx(map, 11, 10));
    expect(worked.get(town.id)!.some((c) => mine.includes(c))).toBe(false);
  });
});

describe('castle service, reserve and money', () => {
  it('villages lend hands in proportion, never over a third, and the castle is staffed to what it got', () => {
    const { state, f } = world();
    const a = found(state, 'A', 'village', 12, 10, 900);
    const b = found(state, 'B', 'village', 14, 10, 1800);
    const castle = found(state, 'Post', 'small_castle', 13, 10);
    const worked = workedCellsBySettlement(state);
    const plan = allocateService(state, worked);
    const info = plan.byCastle.get(castle.id)!;
    expect(info.need).toBe(30);
    expect(info.staffing).toBeCloseTo(1, 6);
    expect(plan.given.get(b.id)! / plan.given.get(a.id)!).toBeCloseTo(2, 5); // in proportion to hands
    const before = f.treasury;
    endTurn(state);
    expect(castle.castle!.staffing).toBeCloseTo(1, 6);
    expect(castle.castle!.wages).toBeCloseTo(3, 6); // 30 hands × 0.1
    expect(before - f.treasury).toBeCloseTo(3 + 200 / 12, 4);
  });

  it('too small a reach staffs it in part: a lone village cannot give more than a third of its hands', () => {
    const { state } = world();
    const v = found(state, 'Lone', 'village', 12, 10, 900);
    const castle = found(state, 'Great Keep', 'large_castle', 14, 10);
    const plan = allocateService(state, workedCellsBySettlement(state));
    const hands = workingHands(v.pop);
    expect(plan.given.get(v.id)!).toBeCloseTo(hands * CASTLES.service.maxShareOfHands, 5);
    expect(plan.byCastle.get(castle.id)!.staffing).toBeLessThan(1);
    expect(plan.byCastle.get(castle.id)!.staffing).toBeGreaterThan(0);
  });

  it('the service comes out of the fields: the home produces less food', () => {
    const run = (withCastle: boolean) => {
      const { state } = world();
      const v = found(state, 'V', 'village', 12, 10, 900);
      v.food = 0;
      if (withCastle) found(state, 'Post', 'small_castle', 13, 10);
      for (let i = 0; i < 12; i++) endTurn(state);
      return v.year.produced + (v.lastYear?.produced ?? 0);
    };
    expect(run(true)).toBeLessThan(run(false));
  });

  it('a medium castle farms its own hex into its reserve; the reserve is capped at capacity × 12 months', () => {
    const { state } = world();
    for (const [n, c] of [['A', 11], ['B', 13], ['C', 15]] as const) found(state, n, 'village', c, 12, 1800);
    const castle = found(state, 'Keep', 'medium_castle', 13, 11);
    for (let i = 0; i < 24; i++) endTurn(state);
    expect(castle.report.capacity).toBe(500 * 12);
    expect(castle.food).toBeGreaterThan(0);
    expect(castle.food).toBeLessThanOrEqual(500 * 12 + 1e-6);
    expect(castleNeed(state, castle, workedCellsBySettlement(state).get(castle.id)!).hexHands).toBeGreaterThan(0);
  });

  it("subordinates' surplus fills the reserve first, then flows on", () => {
    const { state } = world();
    const vil = found(state, 'Farm', 'village', 12, 10, 900);
    const castle = found(state, 'Post', 'small_castle', 13, 10);
    vil.food = 500_000;
    endTurn(state);
    expect(castle.food).toBeGreaterThan(0);
    expect(vil.report.sent).toBeGreaterThan(0);
  });

  it('a castle takes no tithe: with only a castle above, the village keeps its grain', () => {
    setTitheShare(0.1);
    try {
      const { state } = world();
      const vil = found(state, 'Farm', 'village', 12, 10, 900);
      found(state, 'Post', 'small_castle', 13, 10);
      endTurn(state);
      expect(vil.report.titheOut).toBe(0);
    } finally { setTitheShare(0); }
  });

  it('nobody in its service for 12 months → a ruin: no influence, no capacity', () => {
    const { state } = world();
    const castle = found(state, 'Orphan', 'small_castle', 10, 10); // no settlement in reach
    for (let i = 0; i < CASTLES.ruin.afterMonths - 1; i++) endTurn(state);
    expect(isRuin(castle)).toBe(false);
    endTurn(state);
    expect(isRuin(castle)).toBe(true);
    expect(influenceCells(state.map, castle)).toEqual([]);
    expect(castle.castle!.garrisonCapacity).toBe(0);
    // and it is left alone by the ladder and by abandonment
    for (let i = 0; i < 24; i++) endTurn(state);
    expect(state.settlements[castle.id]).toBeTruthy();
  });

  it('saves round-trip and a v9 save migrates', () => {
    const { state } = world();
    found(state, 'Keep', 'medium_castle', 13, 11);
    const again = deserializeState(serializeState(state));
    expect(Object.values(again.settlements)[0].castle).toBeTruthy();
    const old = JSON.parse(serializeState(state));
    old.version = 9; delete old.forts;
    expect(deserializeState(JSON.stringify(old)).forts).toEqual({});
  });
});

function band(state: GameState, home: Settlement, people = 300): Unit {
  applyCommand(state, { type: 'raiseUnit', spec: { type: 'workband', at: home.id, muster: [{ id: home.id, people }], provisionMonths: 3 } });
  const u = Object.values(state.units).find((x) => x.type === 'workband')!;
  endTurn(state);
  const b = state.units[u.id];
  b.col = home.col + 2; b.row = home.row + 2; b.bank = OPEN; // a free hex, off the settlement
  return b;
}

describe('building castles (work-bands)', () => {
  it('a band of 300 raises a small castle in 12 months, paying coins and materials, and it appears with a name', () => {
    const { state, f } = world();
    const home = found(state, 'Home', 'town', 12, 10, 6000);
    const u = band(state, home);
    const here = idx(state.map, u.col, u.row);
    const made = makeBuildOrder(state, u, 'castle_small', null);
    expect(made.reason).toBeUndefined();
    const sum = orderSummary(state, u, made.order!);
    expect(sum.money).toBe(5000);
    expect(sum.materials.timber).toBe(300);
    expect(sum.months).toBeCloseTo(12, 6);
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: made.order! });
    const money = f.treasury;
    for (let i = 0; i < 11; i++) endTurn(state);
    expect(castleAt(state, here)).toBeNull();
    endTurn(state);
    const c = castleAt(state, here);
    expect(c).toBeTruthy();
    expect(c!.name).toMatch(/Castle/);
    expect(f.year.spent + (f.lastYear?.spent ?? 0)).toBeGreaterThanOrEqual(5000);
    expect(money).toBeGreaterThan(0);
    expect(c!.faction).toBe(state.playerFaction);
  });

  it('waits for coins it does not have, and refuses a hex in a city\'s work zone', () => {
    const { state, f } = world();
    const home = found(state, 'Home', 'town', 12, 10, 6000);
    const u = band(state, home);
    const stray = band(state, home);
    f.treasury = 100;
    const made = makeBuildOrder(state, u, 'castle_small', null);
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: made.order! });
    endTurn(state);
    expect(String(state.units[u.id].report.blocked)).toMatch(/coins/);
    const city = found(state, 'Metro', 'city', 3, 3, 10000);
    stray.col = city.col + 1; stray.row = city.row; stray.bank = OPEN;
    expect(makeBuildOrder(state, stray, 'castle_medium', null).reason).toMatch(/work zone/);
  });

  it('a ruin is rebuilt at half the price', () => {
    const { state } = world();
    const home = found(state, 'Home', 'town', 12, 10, 6000);
    const castle = found(state, 'Old Keep', 'small_castle', 20, 20); // out of reach: it falls
    for (let i = 0; i < CASTLES.ruin.afterMonths; i++) endTurn(state);
    expect(isRuin(castle)).toBe(true);
    const u = band(state, home);
    u.col = castle.col; u.row = castle.row; u.bank = OPEN;
    const made = makeBuildOrder(state, u, 'castle_small', null);
    const sum = orderSummary(state, u, made.order!);
    expect(sum.money).toBe(2500);
    expect(sum.materials.timber).toBe(150);
  });

  it('a castle is built over a fort in three quarters of the time', () => {
    const { state } = world();
    const home = found(state, 'Home', 'town', 12, 10, 6000);
    const u = band(state, home);
    state.forts.f1 = { id: 'f1', col: u.col, row: u.row, faction: u.faction, emptyMonths: 0, builtTurn: 0 };
    const made = makeBuildOrder(state, u, 'castle_small', null);
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: made.order! });
    for (let i = 0; i < 9; i++) endTurn(state);
    expect(castleAt(state, u.row * state.map.width + u.col)).toBeTruthy();
    expect(Object.keys(state.forts)).toHaveLength(0);
  });
});

describe('upgrading in place and the pathfinding hook', () => {
  it('a small castle becomes a medium one over the step\'s months when the hands are there', () => {
    const { state } = world();
    for (const [n, c] of [['A', 11], ['B', 13], ['C', 15]] as const) found(state, n, 'village', c, 12, 1800);
    const castle = found(state, 'Keep', 'small_castle', 13, 11);
    applyCommand(state, { type: 'upgradeSettlement', id: castle.id } as never);
    expect(castle.upgrade).toBeTruthy();
    for (let i = 0; i < 40; i++) endTurn(state);
    expect(TIERS[castle.tier].id).toBe('medium_castle');
    expect(castle.upgrade).toBeNull();
  });

  it("another faction's castle hex cannot be crossed", () => {
    const { state } = world();
    const c = found(state, 'Wall', 'small_castle', 10, 8);
    const start = { cell: idx(state.map, 7, 8), bank: OPEN };
    const dest = idx(state.map, 13, 8);
    const free = findRoute(state, start, dest, 4, state.playerFaction);
    expect(free!.nodes.some((n) => n.cell === idx(state.map, c.col, c.row))).toBe(true);
    const foe = findRoute(state, start, dest, 4, 'someone-else');
    expect(foe!.nodes.some((n) => n.cell === idx(state.map, c.col, c.row))).toBe(false);
  });
});

describe('forts', () => {
  it('a workband cannot fortify; with a unit that can, the fort is raised and disappears 12 months after it leaves', () => {
    const { state } = world();
    const home = found(state, 'Home', 'town', 12, 10, 6000);
    const u = band(state, home);
    expect(canFortify(state, u).ok).toBe(false);
    const def = UNIT_TYPES.find((t) => t.id === 'workband')!;
    def.canFortify = true;
    try {
      u.col = 3; u.row = 3;
      const timber = state.factions[u.faction].stock.timber;
      const { fort } = fortify(state, u);
      expect(fortAt(state, 3, 3)).toBe(fort);
      expect(state.factions[u.faction].stock.timber).toBe(timber - CASTLES.fort.fortifyTimber);
      u.col = 5; // leaves
      for (let i = 0; i < CASTLES.fort.decayMonths - 1; i++) endTurn(state);
      expect(fortAt(state, 3, 3)).toBeTruthy();
      endTurn(state);
      expect(fortAt(state, 3, 3)).toBeNull();
    } finally { delete def.canFortify; }
  });
});
