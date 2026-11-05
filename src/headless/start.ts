// Run Omer's starting position (scenarios/start.json) forward and report how the
// realm's demography behaves under the Session 9 knobs.
// Usage: npm run sim -- --scenario start [--years 60] [--file scenarios/start.json]
//        [--preset baseline|noise|trickle|all] [--seed x] [--csv out.csv]
//        [--sampling 0|1] [--harvestSd 0.15] [--epidemic 0.01] [--trickle 0.04] [--minIdle 0.15]
// Presets: baseline = every knob off (the deterministic model); noise = sampling + harvest + epidemic;
//          trickle = the migration trickle only (0.04 if the data file has it off); all = the data-file values (Omer's decisions).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadScenarioFile } from '../sim/scenario';
import { calendar, type GameState } from '../sim/state';
import { endTurn } from '../sim/turn';
import { TIERS, type Settlement } from '../sim/settlements';
import { totalPopulation } from '../sim/demography';
import { setNoise, NO_NOISE, noise, type NoiseKnobs } from '../sim/noise';
import { seedRng } from '../sim/rng';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const YEARS = Number(arg('years', '60'));
const FILE = arg('file', 'scenarios/start.json');
const PRESET = arg('preset', 'all');
const SEED = arg('seed', '');
const CSV = arg('csv', '');

const DATA_DEFAULTS = noise(); // as the data files ship
const PRESETS: Record<string, NoiseKnobs> = {
  baseline: NO_NOISE,
  noise: { ...DATA_DEFAULTS, trickleShare: 0 },
  trickle: { ...NO_NOISE, trickleShare: DATA_DEFAULTS.trickleShare || 0.04, trickleMinIdle: DATA_DEFAULTS.trickleMinIdle, trickleSpread: 0, trickleRequireFedParent: DATA_DEFAULTS.trickleRequireFedParent },
  all: DATA_DEFAULTS,
};
const knobs: NoiseKnobs = { ...(PRESETS[PRESET] ?? DATA_DEFAULTS) };
if (process.argv.includes('--sampling')) knobs.vitalSampling = Number(arg('sampling', '1'));
if (process.argv.includes('--harvestSd')) knobs.harvestSd = Number(arg('harvestSd', '0'));
if (process.argv.includes('--epidemic')) knobs.epidemicChance = Number(arg('epidemic', '0'));
if (process.argv.includes('--trickle')) knobs.trickleShare = Number(arg('trickle', '0'));
if (process.argv.includes('--minIdle')) knobs.trickleMinIdle = Number(arg('minIdle', '0.15'));
setNoise(knobs);

const { state, name } = loadScenarioFile(JSON.parse(readFileSync(FILE, 'utf8')));
if (SEED) state.rng = seedRng(SEED);
const cal0 = calendar(state.turn);
console.log(`scenario "${name}" from ${cal0.monthName}, year ${cal0.year} · ${Object.keys(state.settlements).length} settlements · preset ${PRESET}${SEED ? ` · seed ${SEED}` : ''}`);
console.log(`knobs: sampling ${knobs.vitalSampling} · harvest sd ${knobs.harvestSd} (regional ${knobs.harvestRegionalShare}) · epidemic ${knobs.epidemicChance}×${knobs.epidemicDeathMultiplier} · trickle ${knobs.trickleShare} above ${knobs.trickleMinIdle} idle ±${knobs.trickleSpread}${knobs.trickleRequireFedParent ? ' (fed parent only)' : ''}`);

const list = (): Settlement[] => Object.values(state.settlements);
const rankOf = (s: Settlement) => TIERS[s.tier].rank;
const groups: [string, (s: Settlement) => boolean][] = [
  ['metropolis', (s) => rankOf(s) === 3],
  ['cities', (s) => rankOf(s) === 2],
  ['towns', (s) => rankOf(s) === 1],
  ['villages (with parent)', (s) => rankOf(s) === 0 && !!s.parent],
  ['villages (independent)', (s) => rankOf(s) === 0 && !s.parent],
];
const sum = (xs: Settlement[], f: (s: Settlement) => number) => xs.reduce((t, s) => t + f(s), 0);
const pop = (xs: Settlement[]) => sum(xs, (s) => totalPopulation(s.pop));

const start: Record<string, number> = {};
for (const s of list()) start[s.id] = totalPopulation(s.pop);
const minPop: Record<string, number> = { ...start }, maxPop: Record<string, number> = { ...start };
const hungerBy: Record<string, number> = {}, famineBy: Record<string, number> = {};
let yHunger: Record<string, number> = {}, yFamine: Record<string, number> = {};

interface YearRow { year: number; total: number; byGroup: number[]; hunger: number; epidemics: number; trickle: number; famineMig: number; harvest: number }
const rows: YearRow[] = [];
let hunger = 0, epidemics = 0, trickle = 0, famineMig = 0, harvestSum = 0, harvestN = 0;
const csv: string[] = ['year,id,name,tier,parent,pop,foodMonths,idleShare,hunger,harvestFactor,epidemic,trickleOut,trickleIn,famineMigrantsOut'];

const t0 = performance.now();
// a "year" here is the game's calendar year: we run to the next December regardless of the starting month
for (let y = 1; y <= YEARS; y++) {
  hunger = 0; epidemics = 0; trickle = 0; famineMig = 0; harvestSum = 0; harvestN = 0;
  yHunger = {}; yFamine = {};
  do {
    endTurn(state);
    for (const s of list()) {
      hunger += s.report.hungerDeaths; famineMig += s.report.migrantsOut;
      yHunger[s.id] = (yHunger[s.id] ?? 0) + s.report.hungerDeaths; yFamine[s.id] = (yFamine[s.id] ?? 0) + s.report.migrantsOut;
      hungerBy[s.id] = (hungerBy[s.id] ?? 0) + s.report.hungerDeaths; famineBy[s.id] = (famineBy[s.id] ?? 0) + s.report.migrantsOut;
    }
  } while (calendar(state.turn).month !== 0);
  for (const s of list()) {
    const p = totalPopulation(s.pop);
    minPop[s.id] = Math.min(minPop[s.id] ?? p, p);
    maxPop[s.id] = Math.max(maxPop[s.id] ?? p, p);
    if (s.report.epidemic) epidemics++;
    trickle += s.report.trickleOut;
    harvestSum += s.harvestFactor; harvestN++;
    if (CSV) csv.push([y, s.id, s.name, TIERS[s.tier].id, s.parent ?? '', p.toFixed(1), (s.food / Math.max(1, p)).toFixed(2), s.report.hands ? (s.report.idleHands / s.report.hands).toFixed(3) : '0', (yHunger[s.id] ?? 0).toFixed(1), s.harvestFactor.toFixed(3), s.report.epidemic ? 1 : 0, s.report.trickleOut.toFixed(1), s.report.trickleIn.toFixed(1), (yFamine[s.id] ?? 0).toFixed(1)].join(','));
  }
  const all = list();
  rows.push({ year: y, total: pop(all), byGroup: groups.map(([, f]) => pop(all.filter(f))), hunger, epidemics, trickle, famineMig, harvest: harvestN ? harvestSum / harvestN : 1 });
}
const ms = performance.now() - t0;

// ---- yearly table (every 5 years + last) ----
console.log(`\n  year    total  ${groups.map(([g]) => g.padStart(14)).join('')}   hunger  epid  trickle  famine-mig  harvest`);
const show = (r: YearRow) => console.log(`${String(r.year).padStart(6)} ${Math.round(r.total).toLocaleString('en-US').padStart(8)}  ${r.byGroup.map((x) => Math.round(x).toLocaleString('en-US').padStart(14)).join('')}  ${String(Math.round(r.hunger)).padStart(7)} ${String(r.epidemics).padStart(5)} ${String(Math.round(r.trickle)).padStart(8)} ${String(Math.round(r.famineMig)).padStart(11)}  ${r.harvest.toFixed(2).padStart(7)}`);
const startRow: YearRow = { year: 0, total: Object.values(start).reduce((t, x) => t + x, 0), byGroup: groups.map(([, f]) => list().filter(f).reduce((t, s) => t + start[s.id], 0)), hunger: 0, epidemics: 0, trickle: 0, famineMig: 0, harvest: 1 };
show(startRow);
for (const r of rows) if (r.year % 5 === 0 || r.year === YEARS) show(r);

// ---- per-settlement: the big ones and the spread among villages ----
console.log('\n  settlement            tier        start      end     min      max   food(mo)  idle%   hunger/yr');
const big = list().filter((s) => rankOf(s) >= 1).sort((a, b) => rankOf(b) - rankOf(a) || a.name.localeCompare(b.name));
for (const s of big) {
  const p = totalPopulation(s.pop);
  console.log(`  ${s.name.padEnd(20)} ${TIERS[s.tier].id.padEnd(10)} ${Math.round(start[s.id]).toLocaleString('en-US').padStart(8)} ${Math.round(p).toLocaleString('en-US').padStart(8)} ${Math.round(minPop[s.id]).toLocaleString('en-US').padStart(7)} ${Math.round(maxPop[s.id]).toLocaleString('en-US').padStart(8)} ${(s.food / Math.max(1, p)).toFixed(1).padStart(9)} ${s.report.hands ? (100 * s.report.idleHands / s.report.hands).toFixed(0).padStart(6) : '     -'} ${Math.round((hungerBy[s.id] ?? 0) / YEARS).toLocaleString('en-US').padStart(10)}`);
}
const villages = list().filter((s) => rankOf(s) === 0);
const vp = villages.map((s) => totalPopulation(s.pop));
const mean = vp.reduce((t, x) => t + x, 0) / vp.length;
const sd = Math.sqrt(vp.reduce((t, x) => t + (x - mean) ** 2, 0) / vp.length);
const distinct = new Set(vp.map((x) => Math.round(x))).size;
console.log(`\n  ${villages.length} villages: mean ${Math.round(mean).toLocaleString('en-US')}, sd ${Math.round(sd)}, min ${Math.round(Math.min(...vp))}, max ${Math.round(Math.max(...vp))}, ${distinct} distinct sizes`);
const last = rows[rows.length - 1];
const first = startRow;
console.log(`  realm: ${Math.round(first.total).toLocaleString('en-US')} → ${Math.round(last.total).toLocaleString('en-US')} (${((100 * (last.total / first.total - 1))).toFixed(1)} % over ${YEARS} years) · hunger deaths total ${Math.round(rows.reduce((t, r) => t + r.hunger, 0)).toLocaleString('en-US')} · epidemic-years ${rows.reduce((t, r) => t + r.epidemics, 0)} · trickle total ${Math.round(rows.reduce((t, r) => t + r.trickle, 0)).toLocaleString('en-US')}`);
console.log(`  ran ${YEARS} years in ${ms.toFixed(0)} ms`);

if (CSV) {
  mkdirSync(dirname(CSV), { recursive: true });
  writeFileSync(CSV, csv.join('\n'));
  console.log(`  wrote ${CSV}`);
}
