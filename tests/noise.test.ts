// Session 9 — the PROPOSED demographic-realism knobs: vital sampling,
// harvest variance, epidemics, migration trickle. Everything must come from the
// seeded RNG (reproducible) and vanish when the knobs are zero.

import { describe, it, expect, beforeEach } from 'vitest';
import { createMap } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { createGameState, serializeState, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand } from '../src/sim/commands';
import { axialRing, axialToOffset, offsetToAxial } from '../src/sim/hex';
import { totalPopulation } from '../src/sim/demography';
import { rollHarvestFactors, demographyYear, economyMonth } from '../src/sim/economy';
import { setNoise, NO_NOISE, noise } from '../src/sim/noise';
import { seedRng, nextPoisson, nextGaussian } from '../src/sim/rng';
import type { Settlement } from '../src/sim/settlements';

const G = terrainIndex('grassland');

function found(state: GameState, name: string, tier: string, col: number, row: number, population: number): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col, row, population } });
  return Object.values(state.settlements).find((s) => s.name === name)!;
}
function ringSpot(col: number, row: number, radius: number, k = 0) {
  const ring = axialRing(offsetToAxial(col, row), radius);
  return axialToOffset(ring[k].q, ring[k].r);
}
const years = (st: GameState, n: number) => { for (let i = 0; i < 12 * n; i++) endTurn(st); };

beforeEach(() => setNoise(NO_NOISE));

describe('random helpers', () => {
  it('poisson has the right mean and variance; gaussian is standard', () => {
    const r = seedRng('p');
    let sum = 0, sq = 0;
    const n = 4000, lam = 7.5;
    for (let i = 0; i < n; i++) { const x = nextPoisson(r, lam); sum += x; sq += x * x; }
    const mean = sum / n, varr = sq / n - mean * mean;
    expect(mean).toBeCloseTo(lam, 0);
    expect(varr / lam).toBeGreaterThan(0.8);
    expect(varr / lam).toBeLessThan(1.2);
    let gs = 0, gsq = 0;
    for (let i = 0; i < n; i++) { const z = nextGaussian(r); gs += z; gsq += z * z; }
    expect(gs / n).toBeCloseTo(0, 1);
    expect(gsq / n).toBeCloseTo(1, 0);
    // large-mean branch
    expect(Math.abs(nextPoisson(r, 10000) - 10000)).toBeLessThan(600);
  });
});

describe('vital sampling', () => {
  it('is off by NO_NOISE (identical runs) and on with the knob (seed-dependent, reproducible, same mean)', () => {
    const run = (seed: string) => { const st = createGameState(seed, createMap(12, 12, G)); const v = found(st, 'v', 'village', 5, 5, 900); years(st, 15); return totalPopulation(v.pop); };
    expect(run('a')).toBeCloseTo(run('b'), 9); // deterministic model ignores the seed
    setNoise({ vitalSampling: 1 });
    const a1 = run('a'), a2 = run('a'), b = run('b');
    expect(a1).toBe(a2); // reproducible
    expect(a1).not.toBe(b);
    // many seeds average close to the deterministic result; villages jitter more than cities (relative)
    setNoise(NO_NOISE);
    const det = run('x');
    setNoise({ vitalSampling: 1 });
    const vals = Array.from({ length: 12 }, (_, i) => run(`s${i}`));
    const mean = vals.reduce((t, x) => t + x, 0) / vals.length;
    expect(Math.abs(mean - det) / det).toBeLessThan(0.03);
    const cityRun = (seed: string) => { const st = createGameState(seed, createMap(30, 30, G)); const c = found(st, 'c', 'city', 15, 15, 24000); years(st, 3); return totalPopulation(c.pop); };
    const cv = Array.from({ length: 6 }, (_, i) => cityRun(`c${i}`));
    const rel = (xs: number[]) => { const m = xs.reduce((t, x) => t + x, 0) / xs.length; return Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / xs.length) / m; };
    expect(rel(cv)).toBeLessThan(rel(vals));
  });
});

describe('harvest variance', () => {
  it('draws factors around 1, floored, shared within a region when regionalShare is 1, and gone when sd is 0', () => {
    const st = createGameState('h', createMap(40, 40, G));
    const a = found(st, 'a', 'village', 5, 5, 900);
    const b = found(st, 'b', 'village', 8, 5, 900); // same 12×12 block as a
    const c = found(st, 'c', 'village', 30, 30, 900); // another block
    rollHarvestFactors(st);
    expect([a, b, c].every((s) => s.harvestFactor === 1)).toBe(true);
    setNoise({ harvestSd: 0.15, harvestRegionalShare: 1, harvestRegionSize: 12, harvestMinFactor: 0.3 });
    rollHarvestFactors(st);
    expect(a.harvestFactor).toBeCloseTo(b.harvestFactor, 12);
    expect(a.harvestFactor).not.toBeCloseTo(c.harvestFactor, 6);
    setNoise({ harvestSd: 0.15, harvestRegionalShare: 0.5 });
    let sum = 0, min = Infinity, max = -Infinity;
    const n = 300;
    for (let i = 0; i < n; i++) { rollHarvestFactors(st); sum += a.harvestFactor; min = Math.min(min, a.harvestFactor); max = Math.max(max, a.harvestFactor); }
    expect(sum / n).toBeCloseTo(1, 1);
    expect(min).toBeGreaterThanOrEqual(0.3);
    expect(max).toBeLessThan(1.8);
  });

  it('a bad year leaves less in the granary than an average one', () => {
    const run = (sd: number) => {
      setNoise({ harvestSd: sd, harvestRegionalShare: 0, harvestMinFactor: 0.3 });
      const st = createGameState('bad', createMap(12, 12, G));
      const v = found(st, 'v', 'village', 5, 5, 900);
      economyMonth(st, 0); // January: roll
      if (sd > 0) v.harvestFactor = 0.6; // force a bad year
      for (let m = 1; m < 11; m++) economyMonth(st, m);
      return v.food;
    };
    expect(run(0.15)).toBeLessThan(run(0));
  });
});

describe('epidemic', () => {
  it('doubles the year\'s deaths when it strikes; never strikes at chance 0', () => {
    const deathsWith = (chance: number) => {
      setNoise({ epidemicChance: chance, epidemicDeathMultiplier: 2 });
      const st = createGameState('e', createMap(12, 12, G));
      const v = found(st, 'v', 'village', 5, 5, 900);
      for (let m = 0; m < 11; m++) economyMonth(st, m);
      demographyYear(st);
      return { d: v.report.deaths, flag: v.report.epidemic };
    };
    const normal = deathsWith(0), sick = deathsWith(1);
    expect(normal.flag).toBe(false);
    expect(sick.flag).toBe(true);
    expect(sick.d).toBeCloseTo(2 * normal.d, 6);
  });
});

describe('migration trickle', () => {
  function orbit(seed = 't') {
    const st = createGameState(seed, createMap(30, 30, G));
    const t = found(st, 'Town', 'town', 15, 15, 9000);
    const spot = ringSpot(15, 15, 3);
    const v = found(st, 'Vill', 'village', spot.col, spot.row, 2400); // overfull: plenty of idle hands
    return { st, t, v };
  }

  it('moves sharePerYear of idle hands (with dependants) to a fed parent each December, conserving people', () => {
    setNoise({ trickleShare: 0.04, trickleMinIdle: 0.15, trickleSpread: 0, trickleRequireFedParent: true });
    const { st, t, v } = orbit();
    for (let m = 0; m < 11; m++) economyMonth(st, m);
    const idle = v.report.idleHands, hands = v.report.hands;
    expect(idle / hands).toBeGreaterThan(0.15);
    const before = totalPopulation(t.pop) + totalPopulation(v.pop);
    demographyYear(st);
    const after = totalPopulation(t.pop) + totalPopulation(v.pop);
    expect(after - before).toBeCloseTo(t.report.births + v.report.births - t.report.deaths - v.report.deaths, 6);
    expect(v.report.trickleOut).toBeGreaterThan(0);
    expect(t.report.trickleIn).toBeCloseTo(v.report.trickleOut, 9);
    // hands moved = 4 % of idle hands; people moved = that share of the whole population (dependants come along)
    const expectedPeople = (0.04 * idle / hands) * (totalPopulation(v.pop) + v.report.trickleOut);
    expect(v.report.trickleOut).toBeCloseTo(expectedPeople, 6);
  });

  it('does not fire below the idle threshold, to a hungry parent, or when the share is 0', () => {
    setNoise({ trickleShare: 0.04, trickleMinIdle: 0.9, trickleSpread: 0 });
    let o = orbit();
    for (let m = 0; m < 11; m++) economyMonth(o.st, m);
    demographyYear(o.st);
    expect(o.v.report.trickleOut).toBe(0);
    setNoise({ trickleShare: 0.04, trickleMinIdle: 0.15, trickleSpread: 0, trickleRequireFedParent: true });
    o = orbit();
    o.t.food = 0; o.t.yearSufficiency = 0; // starve the town this year
    for (let m = 0; m < 11; m++) economyMonth(o.st, m);
    expect(o.t.report.sufficiency ?? 1).toBe(1); // not yet computed
    demographyYear(o.st);
    expect(o.t.report.sufficiency).toBeLessThan(0.999);
    expect(o.v.report.trickleOut).toBe(0);
    setNoise({ trickleShare: 0 });
    o = orbit();
    for (let m = 0; m < 11; m++) economyMonth(o.st, m);
    demographyYear(o.st);
    expect(o.v.report.trickleOut).toBe(0);
  });

  it('spread randomizes the share but keeps it within ±spread', () => {
    setNoise({ trickleShare: 0.04, trickleMinIdle: 0.15, trickleSpread: 0.5, trickleRequireFedParent: false });
    const outs: number[] = [];
    for (let i = 0; i < 8; i++) {
      const { st, v } = orbit(`sp${i}`);
      for (let m = 0; m < 11; m++) economyMonth(st, m);
      const share = 0.04 * v.report.idleHands / v.report.hands; // of the population as it stands after the yearly update
      demographyYear(st);
      outs.push(v.report.trickleOut / (totalPopulation(v.pop) + v.report.trickleOut) / share);
    }
    expect(Math.min(...outs)).toBeGreaterThanOrEqual(0.5 - 1e-9);
    expect(Math.max(...outs)).toBeLessThanOrEqual(1.5 + 1e-9);
    expect(Math.max(...outs) - Math.min(...outs)).toBeGreaterThan(0.1);
  });
});

describe('with every knob on', () => {
  it('the game is still reproducible from its seed and the data defaults are what Omer will see', () => {
    setNoise({ vitalSampling: 1, epidemicChance: 0.05, epidemicDeathMultiplier: 2, harvestSd: 0.15, harvestRegionalShare: 0.5, harvestRegionSize: 12, trickleShare: 0.04, trickleMinIdle: 0.15, trickleSpread: 0.5 });
    const run = () => {
      const st = createGameState('all', createMap(30, 30, G));
      found(st, 'Town', 'town', 15, 15, 9000);
      const s3 = ringSpot(15, 15, 3), s4 = ringSpot(15, 15, 3, 9);
      found(st, 'a', 'village', s3.col, s3.row, 1800);
      found(st, 'b', 'village', s4.col, s4.row, 1800);
      years(st, 10);
      return serializeState(st);
    };
    expect(run()).toBe(run());
  });

  it('data defaults: the values Omer decided on 2026-11-05', () => {
    // beforeEach zeroed the knobs; re-import the file values through a fresh read of the JSON
    const d = JSON.parse(JSON.stringify(require('../data/demography.json')));
    const e = JSON.parse(JSON.stringify(require('../data/economy.json')));
    // Omer's decisions of 2026-11-05: sampling on, epidemics 1 %, harvest sd 0.125; the trickle is back on
    // at 0.04 as the PULL FACTOR (Session 11) and only moves people into vacancies
    expect(d.noise.vitalSampling).toBe(1);
    expect(d.noise.epidemic.chancePerYear).toBe(0.01);
    expect(d.migration.trickle.sharePerYear).toBe(0.04);
    expect(d.migration.trickle.requireVacancies).toBe(true);
    expect(e.farming.harvest.variance.sd).toBe(0.125);
    expect(noise().vitalSampling).toBe(0); // the test override is in force
  });
});
