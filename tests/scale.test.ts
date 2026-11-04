// Scale invariance (DESIGN §5.8, Omer 2026-11-04): the model is linear in population.
// Multiplying every yield, every hands figure and every starting population by the
// same factor k must reproduce the same curves with all people-counts × k and all
// ratios (granary months, idle share, hunger fraction) unchanged.
//
// The canonical data files are at modelScale = 3. This test divides them back to ×1
// in place, runs the Phase 1 scenario cases, restores the ×3 data, runs them again,
// and compares year by year.

import { describe, it, expect } from 'vitest';
import { createMap, type MapData } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { createGameState, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand } from '../src/sim/commands';
import { axialRing, axialToOffset, offsetToAxial } from '../src/sim/hex';
import { totalPopulation, workingHands } from '../src/sim/demography';
import { BUILDINGS, type Settlement } from '../src/sim/settlements';
import { ECONOMY } from '../src/sim/economy';

const MIX = ['grassland', 'plains', 'grassland', 'hills', 'plains', 'woodland'].map(terrainIndex);
const SEA = terrainIndex('sea');

function landMap(w = 41, h = 41, seaCols = 0): MapData {
  const map = createMap(w, h, SEA);
  for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
    if (col < seaCols) continue;
    map.terrain[row * w + col] = MIX[(col * 7 + row * 3) % MIX.length];
  }
  return map;
}

function ringSpots(col: number, row: number, radius: number, n: number) {
  const ring = axialRing(offsetToAxial(col, row), radius);
  return Array.from({ length: n }, (_, k) => {
    const h = ring[Math.floor((k * ring.length) / n)];
    return axialToOffset(h.q, h.r);
  });
}

/** Multiply every yield / hands number of the model in place by f. */
function scaleModel(f: number): void {
  const e = ECONOMY as unknown as {
    farming: { fedPerYearByFertility: number[]; hands: number };
    herding: { fedPerYearByPasture: number[]; hands: number };
    fishing: { fedPerYear: number; hands: number; withFish: { fedPerYear: number; hands: number } };
    hunting: { fedPerYear: number; hands: number };
  };
  e.farming.fedPerYearByFertility = e.farming.fedPerYearByFertility.map((x) => x * f);
  e.farming.hands *= f;
  e.herding.fedPerYearByPasture = e.herding.fedPerYearByPasture.map((x) => x * f);
  e.herding.hands *= f;
  e.fishing.fedPerYear *= f; e.fishing.hands *= f;
  e.fishing.withFish.fedPerYear *= f; e.fishing.withFish.hands *= f;
  e.hunting.fedPerYear *= f; e.hunting.hands *= f;
  for (const b of BUILDINGS as unknown as { hands: number }[]) b.hands *= f;
}

interface Row { pop: number; hands: number; idleShare: number; months: number; hunger: number; births: number; deaths: number; migOut: number; sent: number; received: number }

/** Found the Phase 1 cases with every population × k, run `years`, return yearly rows per settlement. */
function runCases(k: number, years: number): Row[] {
  const out: Row[] = [];
  const cases: ((st: GameState) => void)[] = [
    (st) => found(st, 'v', 'village', 20, 20, 300 * k),
    (st) => found(st, 't', 'town', 20, 20, 3000 * k),
    (st) => {
      found(st, 'c', 'city', 20, 20, 8000 * k);
      ringSpots(20, 20, 3, 6).forEach((o, i) => found(st, `d3-${i}`, 'village', o.col, o.row, 600 * k));
      ringSpots(20, 20, 4, 4).forEach((o, i) => found(st, `d4-${i}`, 'village', o.col, o.row, 600 * k));
    },
    (st) => found(st, 'c', 'city', 20, 20, 8000 * k), // starves: exercises hunger + capping
    (st) => {
      found(st, 't', 'town', 20, 20, 3000 * k);
      ringSpots(20, 20, 3, 6).forEach((o, i) => found(st, `v${i}`, 'village', o.col, o.row, 1400 * k)); // overfull → migration
    },
  ];
  cases.forEach((setup, ci) => {
    const st = createGameState(`scale-${ci}`, ci === 4 ? landMap(41, 41, 20) : landMap());
    setup(st);
    const ids = Object.keys(st.settlements);
    for (let y = 0; y < years; y++) {
      const acc: Record<string, Row> = {};
      for (const id of ids) acc[id] = { pop: 0, hands: 0, idleShare: 0, months: 0, hunger: 0, births: 0, deaths: 0, migOut: 0, sent: 0, received: 0 };
      for (let m = 0; m < 12; m++) {
        endTurn(st);
        for (const id of ids) {
          const s = st.settlements[id], r = s.report, a = acc[id];
          a.hunger += r.hungerDeaths; a.migOut += r.migrantsOut; a.sent += r.sent; a.received += r.received;
        }
      }
      for (const id of ids) {
        const s = st.settlements[id], r = s.report, a = acc[id];
        a.pop = totalPopulation(s.pop);
        a.hands = workingHands(s.pop);
        a.idleShare = r.hands > 0 ? r.idleHands / r.hands : 0;
        a.months = a.pop > 0 ? s.food / a.pop : 0;
        a.births = r.births; a.deaths = r.deaths;
        out.push(a);
      }
    }
  });
  return out;
}

function found(state: GameState, name: string, tier: string, col: number, row: number, population: number): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col, row, population, faction: 'A' } });
  return Object.values(state.settlements).find((s) => s.name === name)!;
}

const K = (ECONOMY as { modelScale: number }).modelScale;

describe('model scale ×3 (DESIGN §5.8)', () => {
  it('data files declare modelScale 3 and carry ×3 numbers', () => {
    expect(K).toBe(3);
    expect(ECONOMY.farming.fedPerYearByFertility).toEqual([0, 150, 300, 450, 600]);
    expect(ECONOMY.farming.hands).toBe(90);
    expect(BUILDINGS.find((b) => b.id === 'moot_hall')!.hands).toBe(30);
    expect(BUILDINGS.find((b) => b.id === 'granary_city')!.hands).toBe(360);
  });

  it('the curves at ×1 and ×3 are identical up to the factor 3 (people) and unchanged (ratios)', () => {
    const years = 20;
    const x3 = runCases(1, years); // canonical data = ×3, populations as the scenario defines them × 1
    scaleModel(1 / K);
    let x1: Row[];
    try {
      x1 = runCases(1 / K, years); // ×1 data, populations ÷ 3
    } finally {
      scaleModel(K);
    }
    expect(x1.length).toBe(x3.length);
    expect(x1.length).toBeGreaterThan(5 * years); // several settlements × years
    let totalHunger = 0, totalMig = 0, totalSent = 0;
    for (let i = 0; i < x3.length; i++) {
      const a = x1[i], b = x3[i];
      const tol = 1e-6 * Math.max(1, b.pop);
      expect(Math.abs(b.pop - K * a.pop)).toBeLessThan(tol);
      expect(Math.abs(b.hands - K * a.hands)).toBeLessThan(tol);
      expect(Math.abs(b.births - K * a.births)).toBeLessThan(tol);
      expect(Math.abs(b.deaths - K * a.deaths)).toBeLessThan(tol);
      expect(Math.abs(b.hunger - K * a.hunger)).toBeLessThan(tol);
      expect(Math.abs(b.migOut - K * a.migOut)).toBeLessThan(tol);
      expect(Math.abs(b.sent - K * a.sent)).toBeLessThan(tol * 12);
      expect(Math.abs(b.received - K * a.received)).toBeLessThan(tol * 12);
      expect(Math.abs(b.months - a.months)).toBeLessThan(1e-6);
      expect(Math.abs(b.idleShare - a.idleShare)).toBeLessThan(1e-9);
      totalHunger += b.hunger; totalMig += b.migOut; totalSent += b.sent;
    }
    // the comparison must have exercised hunger, migration and sharing, not just growth
    expect(totalHunger).toBeGreaterThan(0);
    expect(totalMig).toBeGreaterThan(0);
    expect(totalSent).toBeGreaterThan(0);
    // and the data really was restored
    expect(ECONOMY.farming.hands).toBe(90);
    expect(BUILDINGS.find((b) => b.id === 'moot_hall')!.hands).toBe(30);
  });

  it('the tier gates were NOT scaled: town 1,500, city 6,000; the metropolis gate was: 36,000', async () => {
    const { TIERS } = await import('../src/sim/settlements');
    const t = (id: string) => TIERS.find((x) => x.id === id)!;
    expect(t('town').popMin).toBe(1500);
    expect(t('city').popMin).toBe(6000);
    expect(t('metropolis').popMin).toBe(36000);
  });
});
