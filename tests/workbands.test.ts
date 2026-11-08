import { describe, it, expect } from 'vitest';
import { createMap, idx } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { createGameState, serializeState, deserializeState, STATE_VERSION, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand } from '../src/sim/commands';
import { setAbandonBelow, type Settlement } from '../src/sim/settlements';
import { setNoise, NO_NOISE } from '../src/sim/noise';
import { setStockCaps } from '../src/sim/materials';
import { totalPopulation } from '../src/sim/demography';
import { unitCell, type Unit } from '../src/sim/units';
import { findRoute, OPEN, needsBridge, isBridged } from '../src/sim/pathfinding';
import { stepCostBetween, builtRoad } from '../src/sim/infrastructure';
import { makeBuildOrder, pendingSteps, orderSummary } from '../src/sim/workbands';

setNoise(NO_NOISE);
setAbandonBelow(0);
setStockCaps(false);

const P = terrainIndex('plains'), F = terrainIndex('forest'), R = terrainIndex('river'), M = terrainIndex('mountains'), SEA = terrainIndex('sea');

function world(fill = P, w = 24, h = 16) {
  const map = createMap(w, h, fill);
  const state = createGameState('work', map);
  const f = state.factions[state.playerFaction];
  f.treasury = 50_000; f.stock.timber = 2000; f.stock.stone = 2000;
  return { map, state, f, at: (c: number, r: number) => idx(map, c, r) };
}

function found(state: GameState, name: string, col: number, row: number, population = 3000): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier: 'town', col, row, population, faction: state.playerFaction } });
  const s = Object.values(state.settlements).find((x) => x.name === name)!;
  s.stock.timber = 500; s.stock.stone = 500;
  s.food = 200_000;
  return s;
}

/** A work-band of `people` standing at `cell`, formed. */
function band(state: GameState, home: Settlement, people = 300): Unit {
  applyCommand(state, { type: 'raiseUnit', spec: { type: 'workband', at: home.id, muster: [{ id: home.id, people }], provisionMonths: 3 } });
  const u = Object.values(state.units).find((x) => x.type === 'workband')!;
  endTurn(state); // forms
  return state.units[u.id];
}

function put(u: Unit, map: { width: number }, cell: number) {
  u.col = cell % map.width; u.row = Math.floor(cell / map.width); u.bank = OPEN;
}

describe('roads and bridges on the map', () => {
  it('state v8 carries an empty infra and v7 saves migrate', () => {
    const { state } = world();
    expect(STATE_VERSION).toBe(8);
    expect(state.infra).toEqual({ roads: {}, bridges: {} });
    const old = JSON.parse(serializeState(state));
    delete old.infra; old.version = 7;
    const back = deserializeState(JSON.stringify(old));
    expect(back.infra).toEqual({ roads: {}, bridges: {} });
  });

  it('a road halves the cost of rough ground between two road hexes, never under the road minimum (dirt 0.5, paved 0.25); mountains stop being a month', () => {
    const { map, state, at } = world();
    map.terrain[at(3, 4)] = F; map.terrain[at(4, 4)] = M;
    expect(stepCostBetween(state, at(2, 4), at(3, 4), 4)).toBe(3);
    state.infra.roads[at(2, 4)] = 1; state.infra.roads[at(3, 4)] = 1; state.infra.roads[at(4, 4)] = 1;
    expect(stepCostBetween(state, at(2, 4), at(3, 4), 4)).toBe(1.5);
    state.infra.roads[at(1, 4)] = 1;
    expect(stepCostBetween(state, at(1, 4), at(2, 4), 4)).toBe(0.5); // plains: 1 × 0.5, at the dirt minimum
    expect(stepCostBetween(state, at(3, 4), at(4, 4), 4)).toBe(2); // mountains 4 × 0.5, not the whole month
    state.infra.roads[at(3, 4)] = 2;
    expect(stepCostBetween(state, at(2, 4), at(3, 4), 4)).toBe(1.5); // link = the lower level
    state.infra.roads[at(2, 4)] = 2;
    expect(stepCostBetween(state, at(2, 4), at(3, 4), 4)).toBe(1); // paved both: 3 × 0.3333 ≈ 1
    expect(stepCostBetween(state, at(1, 4), at(2, 4), 4)).toBe(0.5); // plains, link = dirt
    state.infra.roads[at(1, 4)] = 2;
    expect(stepCostBetween(state, at(1, 4), at(2, 4), 4)).toBe(0.33); // plains, paved both: 1 × ⅓ (above the 0.25 floor)
  });

  it('a road makes a route shorter in months', () => {
    const { state, at } = world(F); // forest everywhere, cost 3 a hex
    const before = findRoute(state, { cell: at(1, 4), bank: OPEN }, at(10, 4), 4)!;
    for (let c = 1; c <= 10; c++) state.infra.roads[at(c, 4)] = 1;
    const after = findRoute(state, { cell: at(1, 4), bank: OPEN }, at(10, 4), 4)!;
    expect(after.cost).toBeLessThan(before.cost);
    expect(after.months).toBeLessThan(before.months);
  });

  it('a built bridge opens a two-bank river hex', () => {
    const { map, state, at } = world();
    for (let r = 0; r < 16; r++) map.terrain[at(8, r)] = R; // a river column
    // make it a through river: rows 0 and 15 are map edge so banks exist for the middle
    expect(needsBridge(state, at(8, 7))).toBe(true);
    expect(findRoute(state, { cell: at(5, 7), bank: OPEN }, at(11, 7), 4)).toBeNull();
    state.infra.bridges[at(8, 7)] = true;
    expect(isBridged(state, at(8, 7))).toBe(true);
    expect(needsBridge(state, at(8, 7))).toBe(false);
    expect(findRoute(state, { cell: at(5, 7), bank: OPEN }, at(11, 7), 4)).not.toBeNull();
  });
});

describe('work-bands build (DESIGN §3.2b rule 7)', () => {
  it('a band raised from a town builds a dirt road on its hex in two months and pays 30 timber', () => {
    const { state, at, map } = world();
    const town = found(state, 'Home', 6, 6);
    const u = band(state, town);
    put(u, map, at(8, 6));
    const mk = makeBuildOrder(state, u, 'dirt', null);
    expect(mk.order).toBeTruthy();
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: mk.order! });
    const timber = () => town.stock.timber + state.factions[state.playerFaction].stock.timber;
    const t0 = timber();
    endTurn(state);
    expect(builtRoad(state, at(8, 6))).toBe(0); // half done
    expect(state.units[u.id].work!.progress).toBeCloseTo(0.5, 1);
    expect(t0 - timber()).toBeCloseTo(30, 5);
    endTurn(state);
    expect(builtRoad(state, at(8, 6))).toBe(1);
    expect(state.units[u.id].build).toBeNull(); // the order is done
    expect(state.units[u.id].work).toBeNull();
  });

  it('a bigger band is faster, a smaller slower', () => {
    const { state, at, map } = world();
    const town = found(state, 'Home', 6, 6, 9000);
    const big = band(state, town, 600);
    put(big, map, at(8, 6));
    applyCommand(state, { type: 'orderUnit', id: big.id, order: null, build: makeBuildOrder(state, big, 'dirt', null).order! });
    endTurn(state);
    expect(builtRoad(state, at(8, 6))).toBe(1); // 600 people: rate 2, two months of work in one
  });

  it('"road from X to Y" lays dirt on every hex of the route, in order, walking as it goes', () => {
    const { state, at, map } = world();
    const town = found(state, 'Home', 5, 6);
    const u = band(state, town, 600);
    const dest = at(12, 6);
    const mk = makeBuildOrder(state, u, 'dirt', dest);
    expect(mk.order).toBeTruthy();
    expect(mk.order!.route[mk.order!.route.length - 1]).toBe(dest);
    const sum = orderSummary(state, u, mk.order!);
    expect(sum.bridges).toBe(0);
    expect(sum.materials.timber).toBe(30 * pendingSteps(state, mk.order!).length);
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: mk.order! });
    for (let i = 0; i < 40 && state.units[u.id]?.build; i++) endTurn(state);
    expect(state.units[u.id].build).toBeNull();
    for (const c of mk.order!.route) expect(builtRoad(state, c) >= 1 || c === at(5, 6)).toBe(true);
    expect(unitCell(map, state.units[u.id])).toBe(dest);
    // and the finished road is faster to walk than the grass beside it (forest check elsewhere)
    expect(state.events.some((e) => e.kind === 'built')).toBe(true);
  });

  it('a road across a river gets its bridge, built from the bank, and the road carries over', () => {
    const { state, at, map } = world();
    for (let r = 0; r < 16; r++) map.terrain[at(9, r)] = R;
    const town = found(state, 'Home', 5, 6);
    const u = band(state, town, 600);
    const dest = at(13, 6);
    const mk = makeBuildOrder(state, u, 'dirt', dest);
    expect(mk.order).toBeTruthy();
    const steps = pendingSteps(state, mk.order!);
    expect(steps.filter((s) => s.item === 'bridge').length).toBe(1);
    expect(mk.order!.route).toContain(at(9, 6));
    const sum = orderSummary(state, u, mk.order!);
    expect(sum.materials.stone).toBe(30); // the bridge's stone only
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: mk.order! });
    for (let i = 0; i < 60 && state.units[u.id]?.build; i++) endTurn(state);
    expect(state.infra.bridges[at(9, 6)]).toBe(true);
    expect(builtRoad(state, at(9, 6))).toBe(1);
    expect(unitCell(map, state.units[u.id])).toBe(dest);
  });

  it('a paved road goes over a dirt road and takes stone', () => {
    const { state, at, map } = world();
    const town = found(state, 'Home', 6, 6);
    const u = band(state, town, 600);
    put(u, map, at(9, 6));
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: makeBuildOrder(state, u, 'paved', null).order! });
    for (let i = 0; i < 10 && state.units[u.id]?.build; i++) endTurn(state);
    expect(builtRoad(state, at(9, 6))).toBe(2); // dirt first, then stone
    const stone = town.stock.stone + state.factions[state.playerFaction].stock.stone;
    expect(stone).toBeLessThanOrEqual(500 + 2000 - 60);
  });

  it('waits when neither the cluster nor the realm has the materials', () => {
    const { state, at, map, f } = world();
    const town = found(state, 'Home', 6, 6);
    const u = band(state, town);
    f.stock.timber = 0; town.stock.timber = 0;
    put(u, map, at(9, 6));
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: makeBuildOrder(state, u, 'dirt', null).order! });
    endTurn(state);
    const uu = state.units[u.id];
    expect(uu.report.blocked).toMatch(/timber/);
    expect(uu.work?.progress ?? 0).toBe(0);
    f.stock.timber = 100;
    endTurn(state);
    expect(state.units[u.id].work!.progress).toBeGreaterThan(0);
  });

  it('refuses sea, a bridge off a river, and settlers building', () => {
    const { state, at, map } = world();
    map.terrain[at(10, 6)] = SEA;
    const town = found(state, 'Home', 6, 6);
    const u = band(state, town);
    put(u, map, at(8, 6));
    expect(makeBuildOrder(state, u, 'bridge', null).reason).toMatch(/river/);
    expect(makeBuildOrder(state, u, 'dirt', at(10, 6)).reason).toMatch(/sea/);
    applyCommand(state, { type: 'raiseUnit', spec: { type: 'settlers', at: town.id, muster: [{ id: town.id, people: 300 }], provisionMonths: 3 } });
    const settlers = Object.values(state.units).find((x) => x.type === 'settlers')!;
    expect(makeBuildOrder(state, settlers, 'dirt', null).reason).toMatch(/cannot build/);
  });

  it('orderUnit with a build order undoes cleanly and a move order clears it', () => {
    const { state, at, map } = world();
    const town = found(state, 'Home', 6, 6);
    const u = band(state, town);
    put(u, map, at(9, 6));
    const b = makeBuildOrder(state, u, 'dirt', null).order!;
    const inv = applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: b });
    expect(state.units[u.id].build).toEqual(b);
    applyCommand(state, { type: 'orderUnit', id: u.id, order: { kind: 'move', dest: at(12, 6), then: 'none' } });
    expect(state.units[u.id].build).toBeNull();
    applyCommand(state, inv);
    expect(state.units[u.id].build).toBeNull();
    expect(totalPopulation(state.units[u.id].pop)).toBeGreaterThan(0);
  });

  it('survives a save and load mid-project', () => {
    const { state, at, map } = world();
    const town = found(state, 'Home', 6, 6);
    const u = band(state, town);
    put(u, map, at(9, 6));
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: makeBuildOrder(state, u, 'dirt', null).order! });
    endTurn(state);
    const copy = deserializeState(serializeState(state));
    endTurn(state); endTurn(copy);
    expect(builtRoad(copy, at(9, 6))).toBe(builtRoad(state, at(9, 6)));
    expect(builtRoad(copy, at(9, 6))).toBe(1);
  });

  it('a cancelled project keeps its progress and materials; the same order resumes it without paying twice', () => {
    const { state, at, map } = world();
    const town = found(state, 'Home', 6, 6);
    const u = band(state, town);
    put(u, map, at(9, 6));
    const timber = () => town.stock.timber + state.factions[state.playerFaction].stock.timber;
    const t0 = timber();
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: makeBuildOrder(state, u, 'dirt', null).order! });
    endTurn(state);
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null });
    expect(state.units[u.id].build).toBeNull();
    expect(state.units[u.id].work!.progress).toBeCloseTo(0.5, 1);
    endTurn(state); // idle: nothing changes
    expect(state.units[u.id].work!.progress).toBeCloseTo(0.5, 1);
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: makeBuildOrder(state, u, 'dirt', null).order! });
    endTurn(state);
    expect(builtRoad(state, at(9, 6))).toBe(1);
    expect(t0 - timber()).toBeCloseTo(30, 5);
  });

  it('settlement hexes count as dirt road, so a road out of a village starts at once', () => {
    const { map, state, at } = world(F);
    const town = found(state, 'Home', 6, 6);
    expect(stepCostBetween(state, at(6, 6), at(7, 6), 4)).toBe(3);
    state.infra.roads[at(7, 6)] = 1;
    expect(stepCostBetween(state, at(6, 6), at(7, 6), 4)).toBe(1.5);
    expect(town.col).toBe(6);
    expect(map.width).toBe(24);
  });
});
