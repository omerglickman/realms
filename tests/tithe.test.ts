// Session 10: the tithe (DESIGN §4.2, DECIDED 2026-11-05) — a fixed share of a
// subordinate's food production goes to its parent in kind as it is produced.

import { describe, it, expect, afterEach } from 'vitest';
import { createMap } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { createGameState, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand } from '../src/sim/commands';
import { resolveAllParents, type Settlement } from '../src/sim/settlements';
import { ECONOMY, titheShare, setTitheShare } from '../src/sim/economy';
import { totalPopulation } from '../src/sim/demography';
import { setNoise, NO_NOISE } from '../src/sim/noise';
import { setAbandonBelow } from '../src/sim/settlements';
setNoise(NO_NOISE);

const G = terrainIndex('grassland');
const DEFAULT_TITHE = titheShare();
afterEach(() => setTitheShare(DEFAULT_TITHE));

function found(state: GameState, name: string, tier: string, col: number, row: number, population: number): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col, row, population } });
  return Object.values(state.settlements).find((s) => s.name === name)!;
}

/** a town with one village 3 hexes away on uniform grassland */
function pair(): { state: GameState; town: Settlement; village: Settlement } {
  const state = createGameState('t', createMap(30, 30, G));
  const town = found(state, 'Town', 'town', 15, 15, 9000);
  const village = found(state, 'Village', 'village', 18, 15, 900);
  resolveAllParents(state);
  return { state, town, village };
}

describe('tithe', () => {
  it('data declares the decided share', () => {
    expect(ECONOMY.sharing.titheShare).toBe(0.1);
    expect(titheShare()).toBe(0.1);
  });

  it('the parent receives exactly the share of what the subordinate produced, every month it produces', () => {
    const { state, town, village } = pair();
    expect(village.parent).toBe(town.id);
    for (let m = 0; m < 12; m++) {
      endTurn(state);
      const r = village.report;
      expect(r.titheOut).toBeCloseTo(r.produced * 0.1, 6);
      expect(town.report.titheIn).toBeCloseTo(r.titheOut, 6);
    }
    expect(village.lastYear!.titheOut).toBeGreaterThan(0);
    expect(town.lastYear!.titheIn).toBeCloseTo(village.lastYear!.titheOut, 6);
  });

  it('food is conserved: the tithe moves grain, it does not create or destroy it', () => {
    const { state, town, village } = pair();
    endTurn(state); // January: no harvest, only the monthly herding/fishing twelfths (none on pure grassland without pasture → farm only)
    // run to the end of the first harvest month and check the books of that month
    for (let m = 1; m < 9; m++) endTurn(state);
    const v = village.report, t = town.report;
    expect(v.titheOut).toBeGreaterThan(0);
    // the village's granary change = produced − tithe − eaten − spoiled − sent (up to rounding of the cap)
    expect(v.produced - v.titheOut - v.consumed - v.spoiled - v.sent).toBeGreaterThanOrEqual(-1e-6);
    expect(t.titheIn).toBeCloseTo(v.titheOut, 6);
  });

  it('a share of zero reproduces the old surplus-only model; a tithe leaves the village with less', () => {
    setTitheShare(0);
    const a = pair();
    for (let i = 0; i < 24; i++) endTurn(a.state);
    setTitheShare(0.1);
    const b = pair();
    for (let i = 0; i < 24; i++) endTurn(b.state);
    expect(a.village.report.titheOut).toBe(0);
    expect(b.village.lastYear!.titheOut).toBeGreaterThan(0);
    // a well-fed village keeps the same reserve either way: the tithe comes out of what it
    // would have sent up anyway (tithe + surplus sent ≈ surplus sent before), so the village's
    // stock is unchanged and the town gets the same grain by a different route
    expect(b.village.food).toBeCloseTo(a.village.food, 0);
    const upA = a.village.lastYear!.sent + a.village.lastYear!.titheOut;
    const upB = b.village.lastYear!.sent + b.village.lastYear!.titheOut;
    // (slightly MORE goes up with the tithe: grain taken at harvest never hits the village's
    // granary cap, so less of the harvest is wasted — a 24-month granary cannot hold a full harvest)
    expect(upB).toBeGreaterThanOrEqual(upA - 1e-6);
    expect(Math.abs(upA - upB) / upA).toBeLessThan(0.1);
    expect(b.village.lastYear!.sent).toBeLessThan(a.village.lastYear!.sent);
  });

  it('in a lean year the tithe is taken even though the village would have kept it', () => {
    // a village whose land cannot feed it: 3,300 people on 7 hill hexes (farming 2,100 + herding 630 a year)
    const H = terrainIndex('hills');
    const run = (share: number) => {
      setTitheShare(share);
      const map = createMap(30, 30, G);
      for (const [c, r] of [[18, 15], [17, 15], [19, 15], [17, 14], [18, 14], [17, 16], [18, 16]]) map.terrain[r * 30 + c] = H;
      const state = createGameState('lean', map);
      const town = found(state, 'Town', 'town', 15, 15, 9000);
      const village = found(state, 'Village', 'village', 18, 15, 3300);
      resolveAllParents(state);
      for (let i = 0; i < 12; i++) endTurn(state);
      return { town, village };
    };
    const a = run(0), b = run(0.1);
    expect(b.village.lastYear!.titheOut).toBeGreaterThan(0); // the tithe is taken regardless of need
    expect(b.village.food).toBeLessThan(a.village.food); // and the village is poorer for it
    expect(b.town.food).toBeGreaterThan(a.town.food);
  });

  it('no parent → no tithe', () => {
    const state = createGameState('l', createMap(20, 20, G));
    const v = found(state, 'Lone', 'village', 10, 10, 900);
    for (let i = 0; i < 12; i++) endTurn(state);
    expect(v.lastYear!.titheOut).toBe(0);
  });

  it('people are conserved with the tithe on (nothing but food moves)', () => {
    setAbandonBelow(0);
    const { state } = pair();
    const before = Object.values(state.settlements).reduce((a, s) => a + totalPopulation(s.pop), 0);
    for (let i = 0; i < 11; i++) endTurn(state); // no December → no births/deaths
    const after = Object.values(state.settlements).reduce((a, s) => a + totalPopulation(s.pop), 0);
    expect(after).toBeCloseTo(before, 6);
  });
});

describe('granary brake (DESIGN §4.1, DECIDED 2026-11-05)', () => {
  it('factor is 1 with a full granary, minFactor when empty, linear between, and 1 for villages', async () => {
    const { granaryBrakeFactor, DEMOGRAPHY } = await import('../src/sim/demography');
    const g = (DEMOGRAPHY as unknown as { granaryBrake: { spareFull: number; spareEmpty: number; minFactor: number } }).granaryBrake;
    expect(granaryBrakeFactor('city', g.spareFull)).toBe(1);
    expect(granaryBrakeFactor('city', g.spareFull + 10)).toBe(1);
    expect(granaryBrakeFactor('city', g.spareEmpty)).toBeCloseTo(g.minFactor, 9);
    expect(granaryBrakeFactor('city', -5)).toBeCloseTo(g.minFactor, 9);
    const mid = (g.spareFull + g.spareEmpty) / 2;
    expect(granaryBrakeFactor('town', mid)).toBeCloseTo((1 + g.minFactor) / 2, 9);
    expect(granaryBrakeFactor('village', 0)).toBe(1);
  });

  it('a lone city stops growing before it starves: fewer hunger deaths and a fuller granary than without the brake', async () => {
    const { setGranaryBrakeTiers, granaryBrakeTiers } = await import('../src/sim/demography');
    const saved = granaryBrakeTiers();
    const run = (on: boolean) => {
      setGranaryBrakeTiers(on ? saved : []);
      const state = createGameState('brake', createMap(30, 30, G));
      const c = found(state, 'City', 'city', 15, 15, 9000); // its 19 grassland hexes feed ~10,000
      let hunger = 0;
      for (let i = 0; i < 40 * 12; i++) { endTurn(state); hunger += c.report.hungerDeaths; }
      return { pop: totalPopulation(c.pop), hunger, months: c.food / Math.max(1, totalPopulation(c.pop)) };
    };
    const off = run(false), on = run(true);
    setGranaryBrakeTiers(saved);
    expect(on.hunger).toBeLessThan(off.hunger * 0.25);
    expect(on.months).toBeGreaterThan(off.months);
    expect(on.pop).toBeGreaterThan(8000); // it does not collapse — it levels off near what the land feeds
  });
});
