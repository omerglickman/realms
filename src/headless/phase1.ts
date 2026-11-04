// Phase 1 headless scenario (ROADMAP Phase 1, session 1):
// Populations are at MODEL SCALE ×3 (DESIGN §5.8; data/economy.json modelScale).
// 20 years of settlements on synthetic land, no map UI. Prints yearly tables so
// the designer can judge the demographic and food numbers in data/*.json.
// Usage: npm run sim -- --scenario phase1 [--years 20] [--csv out/phase1.csv]

import { createMap, type MapData } from '../sim/map';
import { terrainIndex } from '../sim/terrain';
import { createGameState, type GameState } from '../sim/state';
import { endTurn } from '../sim/turn';
import { applyCommand } from '../sim/commands';
import { axialRing, axialToOffset, offsetToAxial, type Axial } from '../sim/hex';
import { totalPopulation, DEMOGRAPHY } from '../sim/demography';
import { TIERS, type Settlement } from '../sim/settlements';
import { ECONOMY } from '../sim/economy';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const YEARS = Number(arg('years', '20'));
const CSV = arg('csv', '');

// Tier overrides for A/B tests of the zone numbers (scenario only; data/settlements.json stays canonical).
// e.g. --cityRings 5 --metroRings 6 --metroPop 36000
const cityT = TIERS.find((t) => t.id === 'city')!, metroT = TIERS.find((t) => t.id === 'metropolis')!;
cityT.influenceRings = Number(arg('cityRings', String(cityT.influenceRings)));
metroT.influenceRings = Number(arg('metroRings', String(metroT.influenceRings)));
metroT.popMin = Number(arg('metroPop', String(metroT.popMin)));
cityT.popMax = metroT.popMin;
(DEMOGRAPHY as { crowdingBirthPenalty: number }).crowdingBirthPenalty = Number(arg('crowding', String(DEMOGRAPHY.crowdingBirthPenalty)));
console.log(`crowding birth penalty ${DEMOGRAPHY.crowdingBirthPenalty}`);
console.log(`tiers: city influence ${cityT.influenceRings} rings · metropolis from ${metroT.popMin} with ${metroT.influenceRings} rings`);

// ---- synthetic land: a repeating mix averaging fertility 3 (DESIGN §4.2 "average land") ----
const MIX = ['grassland', 'plains', 'grassland', 'hills', 'plains', 'woodland'].map(terrainIndex);
const SEA = terrainIndex('sea');

function landMap(w = 41, h = 41, seaCols = 0): MapData {
  const map = createMap(w, h, SEA);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      if (col < seaCols) continue;
      map.terrain[row * w + col] = MIX[(col * 7 + row * 3) % MIX.length];
    }
  }
  return map;
}

function found(state: GameState, name: string, tier: string, col: number, row: number, population: number, faction = 'A'): void {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col, row, population, faction } });
}

/** Offsets of n evenly spaced hexes on the ring at `radius` around (col,row). */
function ringSpots(col: number, row: number, radius: number, n: number): { col: number; row: number }[] {
  const ring: Axial[] = axialRing(offsetToAxial(col, row), radius);
  const out: { col: number; row: number }[] = [];
  for (let k = 0; k < n; k++) {
    const h = ring[Math.floor((k * ring.length) / n)];
    out.push(axialToOffset(h.q, h.r));
  }
  return out;
}

// ---- yearly accounting ----
interface YearRow {
  year: number;
  pop: number;
  months: number; // granary in months of consumption
  idle: number;
  landCap: number;
  hunger: number;
  births: number;
  deaths: number;
  migOut: number;
  migIn: number;
  sent: number;
  received: number;
}

function runCase(title: string, state: GameState, groupBy: (s: Settlement) => string): Record<string, YearRow[]> {
  const groups: Record<string, YearRow[]> = {};
  const acc: Record<string, { hunger: number; migOut: number; migIn: number; sent: number; received: number }> = {};
  for (let y = 0; y < YEARS; y++) {
    for (const k of Object.keys(acc)) acc[k] = { hunger: 0, migOut: 0, migIn: 0, sent: 0, received: 0 };
    for (let m = 0; m < 12; m++) {
      endTurn(state);
      for (const s of Object.values(state.settlements)) {
        const g = groupBy(s);
        acc[g] ??= { hunger: 0, migOut: 0, migIn: 0, sent: 0, received: 0 };
        acc[g].hunger += s.report.hungerDeaths;
        acc[g].migOut += s.report.migrantsOut;
        acc[g].migIn += s.report.migrantsIn;
        acc[g].sent += s.report.sent;
        acc[g].received += s.report.received;
      }
    }
    const byGroup: Record<string, Settlement[]> = {};
    for (const s of Object.values(state.settlements)) (byGroup[groupBy(s)] ??= []).push(s);
    for (const [g, list] of Object.entries(byGroup)) {
      const pop = list.reduce((t, s) => t + totalPopulation(s.pop), 0);
      const food = list.reduce((t, s) => t + s.food, 0);
      groups[g] ??= [];
      groups[g].push({
        year: y + 1,
        pop,
        months: pop > 0 ? food / (pop * ECONOMY.foodPerPersonPerMonth) : 0,
        idle: list.reduce((t, s) => t + s.report.idleHands, 0),
        landCap: list.reduce((t, s) => t + s.report.landCapacity, 0),
        hunger: acc[g].hunger,
        births: list.reduce((t, s) => t + s.report.births, 0),
        deaths: list.reduce((t, s) => t + s.report.deaths, 0),
        migOut: acc[g].migOut,
        migIn: acc[g].migIn,
        sent: acc[g].sent,
        received: acc[g].received,
      });
    }
  }
  console.log(`\n=== ${title} ===`);
  for (const [g, rows] of Object.entries(groups)) {
    console.log(`-- ${g}`);
    console.log('  year    pop  granary(mo)  idle  landCap  hunger  births deaths  migOut  migIn    sent  recvd');
    for (const r of rows) {
      if (!(r.year <= 5 || r.year % 5 === 0)) continue;
      console.log(
        `  ${String(r.year).padStart(4)} ${r.pop.toFixed(0).padStart(6)} ${r.months.toFixed(1).padStart(12)} ${r.idle.toFixed(0).padStart(5)} ${r.landCap.toFixed(0).padStart(8)} ${r.hunger.toFixed(0).padStart(7)} ${r.births.toFixed(0).padStart(7)} ${r.deaths.toFixed(0).padStart(6)} ${r.migOut.toFixed(0).padStart(7)} ${r.migIn.toFixed(0).padStart(6)} ${r.sent.toFixed(0).padStart(7)} ${r.received.toFixed(0).padStart(6)}`,
      );
    }
  }
  return groups;
}

const tierName = (s: Settlement) => TIERS[s.tier].name;
const csvRows: string[] = ['case,group,year,pop,granaryMonths,idleHands,landCapacity,hungerDeaths,births,deaths,migrantsOut,migrantsIn,sent,received'];
function record(title: string, groups: Record<string, YearRow[]>): void {
  for (const [g, rows] of Object.entries(groups)) {
    for (const r of rows) {
      csvRows.push([title, g, r.year, r.pop.toFixed(1), r.months.toFixed(2), r.idle.toFixed(1), r.landCap.toFixed(0), r.hunger.toFixed(1), r.births.toFixed(1), r.deaths.toFixed(1), r.migOut.toFixed(1), r.migIn.toFixed(1), r.sent.toFixed(0), r.received.toFixed(0)].join(','));
    }
  }
}

const t0 = performance.now();

// A — a lone village of 900 on average land
{
  const st = createGameState('p1a', landMap());
  found(st, 'Lone village', 'village', 20, 20, 900);
  record('A lone village 900', runCase('A — lone village of 900 (7 hexes, average land)', st, tierName));
}

// B — a lone town of 9,000
{
  const st = createGameState('p1b', landMap());
  found(st, 'Lone town', 'town', 20, 20, 9000);
  record('B lone town 9000', runCase('B — lone town of 9,000 (19 hexes)', st, tierName));
}

// C — a city of 24,000 with 10 villages of 1,800 (6 at distance 3, 4 at distance 4)
{
  const st = createGameState('p1c', landMap());
  found(st, 'City', 'city', 20, 20, 24000);
  ringSpots(20, 20, 3, 6).forEach((o, i) => found(st, `Village d3-${i + 1}`, 'village', o.col, o.row, 1800));
  ringSpots(20, 20, 4, 4).forEach((o, i) => found(st, `Village d4-${i + 1}`, 'village', o.col, o.row, 1800));
  record('C city 24000 + 10 villages', runCase('C — city of 24,000 with 10 villages of 1,800', st, tierName));
}

// D — the same city alone
{
  const st = createGameState('p1d', landMap());
  found(st, 'City alone', 'city', 20, 20, 24000);
  record('D city 24000 alone', runCase('D — city of 24,000 with no villages', st, tierName));
}

// E — a town of 9,000 with 6 villages of 1,800 at distance 3
{
  const st = createGameState('p1e', landMap());
  found(st, 'Town', 'town', 20, 20, 9000);
  ringSpots(20, 20, 3, 6).forEach((o, i) => found(st, `Village ${i + 1}`, 'village', o.col, o.row, 1800));
  record('E town 9000 + 6 villages', runCase('E — town of 9,000 with 6 villages of 1,800', st, tierName));
}

// G — a city of 24,000 with villages on rings 3, 4 and 5 (6 + 8 + 10 = 24 villages of 1,800)
{
  const st = createGameState('p1g', landMap(61, 61));
  found(st, 'City', 'city', 30, 30, 24000);
  ringSpots(30, 30, 3, 6).forEach((o, i) => found(st, `Village d3-${i + 1}`, 'village', o.col, o.row, 1800));
  ringSpots(30, 30, 4, 8).forEach((o, i) => found(st, `Village d4-${i + 1}`, 'village', o.col, o.row, 1800));
  ringSpots(30, 30, 5, 10).forEach((o, i) => found(st, `Village d5-${i + 1}`, 'village', o.col, o.row, 1800));
  record('G city 24000 + 24 villages r3-5', runCase('G — city of 24,000 with 24 villages of 1,800 on rings 3–5', st, tierName));
}

// H — a city of 36,000 (the metropolis gate) with the same 24 villages
{
  const st = createGameState('p1h', landMap(61, 61));
  found(st, 'City', 'city', 30, 30, 36000);
  ringSpots(30, 30, 3, 6).forEach((o, i) => found(st, `Village d3-${i + 1}`, 'village', o.col, o.row, 1800));
  ringSpots(30, 30, 4, 8).forEach((o, i) => found(st, `Village d4-${i + 1}`, 'village', o.col, o.row, 1800));
  ringSpots(30, 30, 5, 10).forEach((o, i) => found(st, `Village d5-${i + 1}`, 'village', o.col, o.row, 1800));
  record('H city 36000 + 24 villages r3-5', runCase('H — city of 36,000 with 24 villages of 1,800 on rings 3–5', st, tierName));
}

// F — coastal vs inland village of 600 (sea to the west; the coastal village has shore hexes in its ring)
{
  const st = createGameState('p1f', landMap(41, 41, 20));
  found(st, 'Coastal village', 'village', 20, 20, 600, 'A');
  found(st, 'Inland village', 'village', 32, 20, 600, 'B');
  record('F coastal vs inland 600', runCase('F — coastal vs inland village of 600', st, (s) => s.name));
}

console.log(`\nran in ${(performance.now() - t0).toFixed(0)} ms`);

if (CSV) {
  mkdirSync(dirname(CSV), { recursive: true });
  writeFileSync(CSV, csvRows.join('\n'));
  console.log(`wrote ${CSV}`);
}
