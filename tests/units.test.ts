import { describe, it, expect } from 'vitest';
import { createMap, idx } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { resourceIndex } from '../src/sim/resources';
import { createGameState, serializeState, deserializeState, STATE_VERSION, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand, type Command } from '../src/sim/commands';
import { totalPopulation, workingHands } from '../src/sim/demography';
import { type Settlement, setAbandonBelow } from '../src/sim/settlements';
import { setNoise, NO_NOISE } from '../src/sim/noise';
import { setStockCaps } from '../src/sim/materials';
import { planLabour, staffingOutput, hexJobs } from '../src/sim/economy';
import {
  raiseCheck, defaultSize, defaultProvisionMonths, destinationHands, musterSources, forage, canFoundAt, disbandTarget, unitCell, UNITS,
} from '../src/sim/units';
import { OPEN } from '../src/sim/pathfinding';

setNoise(NO_NOISE);
setAbandonBelow(0);
setStockCaps(false);

const G = terrainIndex('grassland'), P = terrainIndex('plains'), SEA = terrainIndex('sea'), M = terrainIndex('mountains'), F = terrainIndex('forest');

function world(fill = P, w = 20, h = 16) {
  const map = createMap(w, h, fill);
  const state = createGameState('units', map);
  const f = state.factions[state.playerFaction];
  f.treasury = 50_000;
  f.stock.timber = 1000;
  return { map, state, f, at: (c: number, r: number) => idx(map, c, r) };
}

function found(state: GameState, name: string, tier: string, col: number, row: number, population: number, faction = state.playerFaction): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col, row, population, faction } });
  const s = Object.values(state.settlements).find((s) => s.name === name)!;
  s.stock.timber = 500;
  return s;
}

/** Run one month so reports exist and the party forms. */
function month(state: GameState, n = 1) { for (let i = 0; i < n; i++) endTurn(state); }

describe('the partial-staffing curve (DESIGN §3.2b rule 1)', () => {
  it('is the staffing from 75 %, drops twice as fast below it and is zero under 50 %', () => {
    expect(staffingOutput(1)).toBe(1);
    expect(staffingOutput(0.8)).toBeCloseTo(0.8);
    expect(staffingOutput(0.75)).toBeCloseTo(0.75);
    expect(staffingOutput(0.6)).toBeCloseTo(0.45);
    expect(staffingOutput(0.5)).toBeCloseTo(0.25);
    expect(staffingOutput(0.49)).toBe(0);
  });

  it('a hex under half staffed is left unworked and its hands try a smaller job', () => {
    const { map, state, at } = world(SEA);
    // one grassland hex (farm 90 hands) and one plains hex (farm 90 / herd 15) around the centre, rest sea
    map.terrain[at(5, 5)] = G; map.terrain[at(6, 5)] = P;
    const s = found(state, 'Tiny', 'village', 5, 5, 100); // ≈ 58 hands: hall 30, granary 28 → nothing left; raise it
    applyCommand(state, { type: 'editSettlement', id: s.id, population: 250 }); // ≈ 145 hands: 120 to buildings, 25 for the fields
    const plan = planLabour(map, s, [at(5, 5), at(6, 5)]);
    const farms = plan.jobs.filter((j) => j.kind === 'farm');
    const plainsHerd = plan.jobs.find((j) => j.kind === 'herd' && j.cell === at(6, 5))!;
    const grassHerd = plan.jobs.find((j) => j.kind === 'herd' && j.cell === at(5, 5))!;
    // best per hand first: the plains pasture (15 hands) is fully staffed; 10 hands on a 90-hand farm is 11 % →
    // both farms are left unworked; the 10 go to the grassland's small pasture at 67 % (output 2 × 0.67 − 0.75 = 0.58)
    expect(farms.length).toBe(2);
    for (const f of farms) { expect(f.fraction).toBe(0); expect(f.staffing).toBe(0); }
    expect(plainsHerd.staffing).toBeCloseTo(1);
    expect(grassHerd.staffing).toBeCloseTo(10 / 15, 2);
    expect(grassHerd.fraction).toBeCloseTo(2 * (10 / 15) - 0.75, 2);
    expect(plan.fieldHands).toBeCloseTo(25);
  });
});

describe('raising a party (rules 2–4)', () => {
  it('default size follows the destination hexes and the hands share; provisions follow the calendar', () => {
    const { state, at } = world(G);
    const s = found(state, 'Home', 'town', 5, 5, 9000);
    expect(destinationHands(state, null)).toBe(7 * 90 + 30 + 90);
    expect(destinationHands(state, at(12, 8))).toBe(7 * 90 + 30 + 90); // seven grassland hexes
    const n = defaultSize(state, 'settlers', s, at(12, 8));
    expect(n).toBeGreaterThan(1200);
    expect(n).toBeLessThan(1400);
    expect(defaultProvisionMonths('settlers', 2)).toBe(9); // March
    expect(defaultProvisionMonths('settlers', 7)).toBe(4); // August
    expect(defaultProvisionMonths('settlers', 9)).toBe(12); // October: next harvest is a year away, capped
    expect(defaultProvisionMonths('workband', 2)).toBe(3);
  });

  it('musters from the cluster and own settlements within reach, takes people, food, coins and timber; forms next month', () => {
    const { state, f, at } = world(G);
    const town = found(state, 'Town', 'town', 5, 5, 9000);
    const v1 = found(state, 'Near', 'village', 7, 5, 1200); // in the town's influence → cluster member
    const v2 = found(state, 'Far', 'village', 15, 5, 1200); // 10 hexes away: not a source
    month(state); // parents resolve, reports exist
    const sources = musterSources(state, town.id).map((m) => m.settlement.id);
    expect(sources).toContain(town.id);
    expect(sources).toContain(v1.id);
    expect(sources).not.toContain(v2.id);
    const before = { town: totalPopulation(town.pop), v1: totalPopulation(v1.pop), food: town.food + v1.food, treasury: f.treasury };
    const spec = { type: 'settlers', at: town.id, muster: [{ id: town.id, people: 600 }, { id: v1.id, people: 300 }], provisionMonths: 6 };
    expect(raiseCheck(state, spec).ok).toBe(true);
    expect(raiseCheck(state, { ...spec, muster: [{ id: v2.id, people: 100 }] }).ok).toBe(false);
    const inv = applyCommand(state, { type: 'raiseUnit', spec });
    const u = Object.values(state.units)[0];
    expect(u).toBeDefined();
    expect(totalPopulation(u.pop)).toBeCloseTo(900);
    expect(totalPopulation(town.pop)).toBeCloseTo(before.town - 600);
    expect(totalPopulation(v1.pop)).toBeCloseTo(before.v1 - 300);
    expect(u.provisions).toBeCloseTo(900 * 6);
    expect(town.food + v1.food).toBeCloseTo(before.food - 900 * 6);
    expect(f.treasury).toBeCloseTo(before.treasury - 1000);
    expect(town.stock.timber).toBeCloseTo(500 - 90);
    expect(u.col).toBe(5); expect(u.row).toBe(5);
    expect(u.home).toBe(town.id);
    // the inverse puts everything back
    applyCommand(state, inv);
    expect(Object.keys(state.units).length).toBe(0);
    expect(totalPopulation(town.pop)).toBeCloseTo(before.town);
    expect(town.food + v1.food).toBeCloseTo(before.food);
    expect(f.treasury).toBeCloseTo(before.treasury);
    expect(town.stock.timber).toBeCloseTo(500);
  });

  it('takes the timber from the realm stockpile when the cluster lacks it, and refuses when nobody has it', () => {
    const { state, f } = world(G);
    const town = found(state, 'Town', 'town', 5, 5, 9000);
    town.stock.timber = 20;
    month(state);
    const spec = { type: 'settlers', at: town.id, muster: [{ id: town.id, people: 600 }], provisionMonths: 3 };
    const check = raiseCheck(state, spec);
    expect(check.ok).toBe(true);
    expect(check.fromRealm?.timber).toBeCloseTo(70);
    applyCommand(state, { type: 'raiseUnit', spec });
    expect(f.stock.timber).toBeCloseTo(1000 - 70);
    expect(town.stock.timber).toBe(0);
    f.stock.timber = 0; town.stock.timber = 0;
    const again = raiseCheck(state, spec);
    expect(again.ok).toBe(false);
    expect(again.lacking?.timber).toBeCloseTo(90);
    f.treasury = 10;
    expect(raiseCheck(state, spec).reason).toMatch(/treasury/);
    expect(() => applyCommand(state, { type: 'raiseUnit', spec })).toThrow();
  });
});

describe('the field (rules 4–6)', () => {
  it('a party walks to its destination over months and founds a village there with its people and provisions', () => {
    const { state, at } = world(G);
    const town = found(state, 'Town', 'town', 3, 5, 9000);
    month(state);
    const dest = at(12, 5); // 9 hexes east, plains cost 1 → 4 + 4 + 1 = 3 months at 4 points
    applyCommand(state, { type: 'raiseUnit', spec: { type: 'settlers', at: town.id, muster: [{ id: town.id, people: 1200 }], provisionMonths: 8, dest, then: 'settle' } });
    const u = Object.values(state.units)[0];
    expect(u.order?.dest).toBe(dest);
    month(state); // forms — does not move yet
    expect(unitCell(state.map, u)).toBe(at(3, 5));
    expect(u.report.monthsLeft).toBe(3);
    month(state);
    expect(u.report.moved).toBe(4);
    expect(u.report.inBorders).toBe(false); // the town's influence is 3 rings; 7 hexes out is beyond it
    expect(u.report.foraged).toBeGreaterThan(0); // grassland: 20 % of the farming yield
    month(state);
    expect(u.report.moved).toBe(4);
    const peopleBefore = totalPopulation(u.pop), foodBefore = u.provisions;
    month(state); // the last hex, then it settles
    expect(state.units[u.id]).toBeUndefined();
    const v = Object.values(state.settlements).find((s) => s.name === 'New Town')!;
    expect(v).toBeDefined();
    expect(v.col).toBe(12); expect(v.row).toBe(5);
    // the people are the settlers (after that month's eating the economy also ran once in the new village)
    expect(totalPopulation(v.pop)).toBeCloseTo(peopleBefore, 0);
    expect(v.food).toBeLessThan(foodBefore);
    expect(v.food).toBeGreaterThan(0);
    expect(v.faction).toBe(state.playerFaction);
    expect(state.events.some((e) => e.kind === 'founded')).toBe(true);
  });

  it('inside the borders the party eats from the granary and keeps its bags full; outside it eats its bags and starves when they are empty', () => {
    const { map, state, at } = world(SEA);
    for (let c = 0; c < 20; c++) for (let r = 4; r <= 8; r++) map.terrain[at(c, r)] = M; // a mountain band: nothing to forage
    for (let c = 0; c < 20; c++) for (let r = 0; r < 4; r++) map.terrain[at(c, r)] = G;
    map.terrain[at(10, 6)] = P; map.terrain[at(10, 5)] = P; map.terrain[at(10, 4)] = P; // a plains corridor into the band
    const town = found(state, 'Town', 'town', 10, 1, 9000);
    month(state);
    applyCommand(state, { type: 'raiseUnit', spec: { type: 'settlers', at: town.id, muster: [{ id: town.id, people: 600 }], provisionMonths: 2 } });
    const u = Object.values(state.units)[0];
    month(state);
    expect(u.report.inBorders).toBe(true);
    expect(u.provisions).toBeCloseTo(600 * 2); // still its two months: the month's food came from the granary
    expect(u.report.foraged).toBeCloseTo(600);
    expect(u.report.refilled).toBe(0);
    u.provisions = 600; // short a month: the next month tops the bags up
    month(state);
    expect(u.provisions).toBeCloseTo(600 * 2);
    expect(u.report.refilled).toBeCloseTo(600);
    // walk out into the mountains: (10,6) is 5 rows down, beyond the town's 3 influence rings
    applyCommand(state, { type: 'orderUnit', id: u.id, order: { kind: 'move', dest: at(10, 6), then: 'none' } });
    month(state, 3);
    expect(unitCell(state.map, u)).toBe(at(10, 6));
    expect(u.report.inBorders).toBe(false);
    // around (10,6): plains at (10,5) and (10,6) only → a little herding/farming forage, far below 600 mouths
    const n0 = totalPopulation(u.pop);
    month(state, 3);
    expect(u.provisions).toBe(0);
    expect(u.report.shortfall).toBeGreaterThan(0.5);
    expect(u.report.hungerDeaths).toBeGreaterThan(0);
    expect(totalPopulation(u.pop)).toBeLessThan(n0);
  });

  it('foraging takes fish and game at full rate and farming at a fifth', () => {
    const { map, state, at } = world(SEA);
    map.terrain[at(5, 5)] = P;
    const town = found(state, 'Town', 'town', 5, 5, 9000);
    month(state);
    applyCommand(state, { type: 'raiseUnit', spec: { type: 'settlers', at: town.id, muster: [{ id: town.id, people: 900 }], provisionMonths: 3 } });
    const u = Object.values(state.units)[0];
    const hands = workingHands(u.pop);
    // on open plains: herding 135 × 0.3 / 15 hands per hex is the best job per hand, then farming 450 × 0.2 / 90
    const plainsOnly = forage(state, u);
    expect(plainsOnly).toBeGreaterThan(0);
    // fish at full rate adds more
    map.resource[at(6, 5)] = resourceIndex('fish'); // a shore sea hex with Fish: 450 / 90 hands
    const withFish = forage(state, u);
    expect(withFish).toBeGreaterThan(plainsOnly);
    expect(hands).toBeGreaterThan(400);
  });

  it('may not settle on mountains, on a settlement, or inside another settlement\'s lands', () => {
    const { map, state, at } = world(G);
    found(state, 'Town', 'town', 5, 5, 9000);
    map.terrain[at(15, 5)] = M;
    expect(canFoundAt(state, at(5, 5)).ok).toBe(false);
    expect(canFoundAt(state, at(7, 5)).ok).toBe(false); // in the town's two work rings
    expect(canFoundAt(state, at(8, 5)).ok).toBe(true); // just outside them (influence rings do not block)
    expect(canFoundAt(state, at(15, 5)).ok).toBe(false);
    expect(canFoundAt(state, at(15, 7)).ok).toBe(true);
  });
});

describe('disbanding and send food (rules 6, 7, 11)', () => {
  it('disbands into the closest non-starving own settlement within three hexes, else is refused', () => {
    const { state, at } = world(G);
    const town = found(state, 'Town', 'town', 5, 5, 9000);
    const far = found(state, 'Far', 'village', 15, 5, 1200);
    month(state);
    applyCommand(state, { type: 'raiseUnit', spec: { type: 'settlers', at: town.id, muster: [{ id: town.id, people: 600 }], provisionMonths: 3 } });
    const u = Object.values(state.units)[0];
    month(state);
    const before = totalPopulation(town.pop), food = town.food;
    const t = disbandTarget(state, u);
    expect(t.ok).toBe(true); expect(t.target?.id).toBe(town.id);
    const inv = applyCommand(state, { type: 'disbandUnit', id: u.id });
    expect(state.units[u.id]).toBeUndefined();
    expect(totalPopulation(town.pop)).toBeCloseTo(before + 600, 0);
    expect(town.food).toBeGreaterThan(food);
    applyCommand(state, inv);
    const u2 = state.units[u.id];
    expect(u2).toBeDefined();
    expect(totalPopulation(town.pop)).toBeCloseTo(before, 0);
    // walk out of reach and ask again
    applyCommand(state, { type: 'orderUnit', id: u2.id, order: { kind: 'move', dest: at(10, 5), then: 'none' } });
    month(state, 2);
    expect(unitCell(state.map, u2)).toBe(at(10, 5));
    expect(disbandTarget(state, u2).ok).toBe(false); // town 5 away, Far 5 away
    expect(() => applyCommand(state, { type: 'disbandUnit', id: u2.id })).toThrow(/within 3/);
    expect(far.id).toBeTruthy();
  });

  it('disbanding from a hex away becomes a walk home that disbands on arrival', () => {
    const { state, at } = world(G);
    const town = found(state, 'Town', 'town', 5, 5, 9000);
    month(state);
    applyCommand(state, { type: 'raiseUnit', spec: { type: 'settlers', at: town.id, muster: [{ id: town.id, people: 600 }], provisionMonths: 3, dest: at(7, 5), then: 'none' } });
    const u = Object.values(state.units)[0];
    month(state, 2);
    expect(unitCell(state.map, u)).toBe(at(7, 5));
    applyCommand(state, { type: 'disbandUnit', id: u.id });
    expect(u.order?.then).toBe('disband');
    month(state);
    expect(state.units[u.id]).toBeUndefined();
    expect(state.events.some((e) => e.kind === 'disbanded')).toBe(true);
  });

  it('send food moves grain between cluster members by hand and refuses across clusters', () => {
    const { state } = world(G);
    const town = found(state, 'Town', 'town', 5, 5, 9000);
    const v = found(state, 'Near', 'village', 7, 5, 1200);
    const other = found(state, 'Other', 'village', 15, 10, 1200);
    month(state);
    const tf = town.food, vf = v.food;
    const inv = applyCommand(state, { type: 'sendFood', from: town.id, to: v.id, amount: 2000 });
    expect(town.food).toBeCloseTo(tf - 2000);
    expect(v.food).toBeCloseTo(vf + 2000);
    applyCommand(state, inv);
    expect(town.food).toBeCloseTo(tf);
    expect(() => applyCommand(state, { type: 'sendFood', from: town.id, to: other.id, amount: 100 })).toThrow(/cluster/);
    // capped at what the source holds
    applyCommand(state, { type: 'sendFood', from: v.id, to: town.id, amount: 1e9 });
    expect(v.food).toBe(0);
  });
});

describe('saving', () => {
  it('units survive a save and load; an old save gets an empty unit table', () => {
    const { state } = world(G);
    const town = found(state, 'Town', 'town', 5, 5, 9000);
    month(state);
    applyCommand(state, { type: 'raiseUnit', spec: { type: 'settlers', at: town.id, muster: [{ id: town.id, people: 600 }], provisionMonths: 3 } });
    const json = serializeState(state);
    const back = deserializeState(json);
    expect(Object.keys(back.units).length).toBe(1);
    expect(back.version).toBe(STATE_VERSION);
    const old = JSON.parse(json); old.version = 5; delete old.units;
    const migrated = deserializeState(JSON.stringify(old));
    expect(migrated.units).toEqual({});
    expect(UNITS.types.length).toBe(3);
    const cmd: Command = { type: 'orderUnit', id: Object.keys(back.units)[0], order: null };
    expect(() => applyCommand(back, cmd)).not.toThrow();
    expect(hexJobs(state.map, 0).length).toBeGreaterThan(0);
    expect(OPEN).toBe(-1);
  });
});
