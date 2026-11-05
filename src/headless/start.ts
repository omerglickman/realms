// Run Omer's starting position (scenarios/start.json) forward and report how the
// realm's demography behaves under the Session 9 knobs.
// Usage: npm run sim -- --scenario start [--years 60] [--file scenarios/start.json]
//        [--preset baseline|noise|trickle|all] [--seed x] [--csv out.csv]
//        [--sampling 0|1] [--harvestSd 0.15] [--epidemic 0.01] [--trickle 0.04] [--minIdle 0.15] [--tithe 0.10] [--brake 0|1]
//        [--vacancies 0|1] [--builder 0|1] [--surplus 0.10]
// Presets: baseline = every knob off (the deterministic model); noise = sampling + harvest + epidemic;
//          trickle = the migration trickle only (0.04 if the data file has it off); all = the data-file values (Omer's decisions).
// --builder 1 (Session 11): a crude scripted builder queues, every January, the first affordable building from a
// per-tier priority list in every settlement with no project — to exercise materials, effects and the pull factor.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadScenarioFile } from '../sim/scenario';
import { calendar, type GameState } from '../sim/state';
import { endTurn } from '../sim/turn';
import { TIERS, workedCellsBySettlement, type Settlement } from '../sim/settlements';
import { totalPopulation } from '../sim/demography';
import { setNoise, NO_NOISE, noise, type NoiseKnobs } from '../sim/noise';
import { seedRng } from '../sim/rng';
import { titheShare, setTitheShare } from '../sim/economy';
import { granaryBrakeTiers, setGranaryBrakeTiers } from '../sim/demography';
import { applyCommand } from '../sim/commands';
import { canBuild, hasStone } from '../sim/buildings';
import { surplusShare, setSurplusShare, clusterStock } from '../sim/materials';
import { clustersOf } from '../sim/clusters';

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
  trickle: { ...NO_NOISE, trickleShare: DATA_DEFAULTS.trickleShare || 0.04, trickleMinIdle: DATA_DEFAULTS.trickleMinIdle, trickleSpread: 0, trickleRequireFedParent: DATA_DEFAULTS.trickleRequireFedParent, trickleRequireVacancies: DATA_DEFAULTS.trickleRequireVacancies },
  all: DATA_DEFAULTS,
};
const knobs: NoiseKnobs = { ...(PRESETS[PRESET] ?? DATA_DEFAULTS) };
if (process.argv.includes('--sampling')) knobs.vitalSampling = Number(arg('sampling', '1'));
if (process.argv.includes('--harvestSd')) knobs.harvestSd = Number(arg('harvestSd', '0'));
if (process.argv.includes('--epidemic')) knobs.epidemicChance = Number(arg('epidemic', '0'));
if (process.argv.includes('--trickle')) knobs.trickleShare = Number(arg('trickle', '0'));
if (process.argv.includes('--minIdle')) knobs.trickleMinIdle = Number(arg('minIdle', '0.15'));
if (process.argv.includes('--vacancies')) knobs.trickleRequireVacancies = arg('vacancies', '1') !== '0';
setNoise(knobs);
if (process.argv.includes('--surplus')) setSurplusShare(Number(arg('surplus', '0.1')));
const BUILDER = arg('builder', '0') === '1';
const PRIORITY: Record<number, string[]> = {
  0: ['mill', 'wharf', 'chapel'],
  1: ['workshop', 'market', 'great_granary', 'mill', 'wharf', 'chapel'],
  2: ['workshop', 'market', 'great_granary', 'mill', 'wharf', 'chapel'],
  3: ['workshop', 'market', 'great_granary', 'mill', 'wharf', 'chapel'],
};
let queued = 0, built = 0;
function runBuilder(st: GameState): void {
  for (const s of Object.values(st.settlements).sort((a, b) => TIERS[b.tier].rank - TIERS[a.tier].rank || (a.id < b.id ? -1 : 1))) {
    if (s.build) continue;
    for (const b of PRIORITY[TIERS[s.tier].rank] ?? []) {
      if (s.buildings.includes(b)) continue;
      if (canBuild(st, s, b).ok) { applyCommand(st, { type: 'queueBuilding', id: s.id, building: b }); queued++; break; }
    }
  }
}
if (process.argv.includes('--tithe')) setTitheShare(Number(arg('tithe', '0')));
else if (PRESET === 'baseline') setTitheShare(0);
const TITHE = titheShare();
if (process.argv.includes('--brake') ? arg('brake', '1') === '0' : PRESET === 'baseline') setGranaryBrakeTiers([]);
const BRAKE = granaryBrakeTiers().length > 0;

const { state, name } = loadScenarioFile(JSON.parse(readFileSync(FILE, 'utf8')));
if (SEED) state.rng = seedRng(SEED);
const cal0 = calendar(state.turn);
console.log(`scenario "${name}" from ${cal0.monthName}, year ${cal0.year} · ${Object.keys(state.settlements).length} settlements · preset ${PRESET}${SEED ? ` · seed ${SEED}` : ''}`);
console.log(`knobs: sampling ${knobs.vitalSampling} · harvest sd ${knobs.harvestSd} (regional ${knobs.harvestRegionalShare}) · epidemic ${knobs.epidemicChance}×${knobs.epidemicDeathMultiplier} · pull ${knobs.trickleShare} above ${knobs.trickleMinIdle} idle ±${knobs.trickleSpread}${knobs.trickleRequireFedParent ? ' (fed parent only)' : ''}${knobs.trickleRequireVacancies ? ' (into vacancies only)' : ''} · tithe ${TITHE} · granary brake ${BRAKE ? 'on' : 'off'} · surplus share ${surplusShare()} · builder ${BUILDER ? 'on' : 'off'}`);

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
const hungerByRank = [0, 0, 0, 0];
let yHunger: Record<string, number> = {}, yFamine: Record<string, number> = {};

interface YearRow { year: number; total: number; byGroup: number[]; hunger: number; epidemics: number; trickle: number; famineMig: number; harvest: number; timber: number; stone: number; goods: number; vacancies: number; buildings: number; treasury: number; fTimber: number; fStone: number }
const rows: YearRow[] = [];
let hunger = 0, epidemics = 0, trickle = 0, famineMig = 0, harvestSum = 0, harvestN = 0;
const builtBefore = () => Object.values(state.settlements).reduce((t, s) => t + s.buildings.length - 2, 0);
const csv: string[] = ['year,id,name,tier,parent,pop,foodMonths,idleShare,hunger,harvestFactor,epidemic,trickleOut,trickleIn,famineMigrantsOut'];

const t0 = performance.now();
// a "year" here is the game's calendar year: we run to the next December regardless of the starting month
for (let y = 1; y <= YEARS; y++) {
  hunger = 0; epidemics = 0; trickle = 0; famineMig = 0; harvestSum = 0; harvestN = 0;
  yHunger = {}; yFamine = {};
  do {
    if (BUILDER && calendar(state.turn).month === 0) runBuilder(state);
    endTurn(state);
    for (const s of list()) {
      hunger += s.report.hungerDeaths; famineMig += s.report.migrantsOut;
      yHunger[s.id] = (yHunger[s.id] ?? 0) + s.report.hungerDeaths; yFamine[s.id] = (yFamine[s.id] ?? 0) + s.report.migrantsOut;
      hungerBy[s.id] = (hungerBy[s.id] ?? 0) + s.report.hungerDeaths; famineBy[s.id] = (famineBy[s.id] ?? 0) + s.report.migrantsOut;
      hungerByRank[rankOf(s)] += s.report.hungerDeaths;
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
  const f = state.factions[state.playerFaction];
  const stockAll = all.reduce((t, s) => ({ timber: t.timber + s.stock.timber, stone: t.stone + s.stock.stone, goods: t.goods + s.stock.goods }), { timber: 0, stone: 0, goods: 0 });
  built = builtBefore();
  rows.push({ year: y, total: pop(all), byGroup: groups.map(([, f]) => pop(all.filter(f))), hunger, epidemics, trickle, famineMig, harvest: harvestN ? harvestSum / harvestN : 1,
    timber: stockAll.timber, stone: stockAll.stone, goods: stockAll.goods, vacancies: sum(all, (s) => s.report.vacancies), buildings: built, treasury: f?.treasury ?? 0, fTimber: f?.stock.timber ?? 0, fStone: f?.stock.stone ?? 0 });
}
const ms = performance.now() - t0;

// ---- yearly table (every 5 years + last) ----
console.log(`\n  year    total  ${groups.map(([g]) => g.padStart(14)).join('')}   hunger  epid  trickle  famine-mig  harvest`);
const show = (r: YearRow) => console.log(`${String(r.year).padStart(6)} ${Math.round(r.total).toLocaleString('en-US').padStart(8)}  ${r.byGroup.map((x) => Math.round(x).toLocaleString('en-US').padStart(14)).join('')}  ${String(Math.round(r.hunger)).padStart(7)} ${String(r.epidemics).padStart(5)} ${String(Math.round(r.trickle)).padStart(8)} ${String(Math.round(r.famineMig)).padStart(11)}  ${r.harvest.toFixed(2).padStart(7)}`);
const startRow: YearRow = { year: 0, total: Object.values(start).reduce((t, x) => t + x, 0), byGroup: groups.map(([, f]) => list().filter(f).reduce((t, s) => t + start[s.id], 0)), hunger: 0, epidemics: 0, trickle: 0, famineMig: 0, harvest: 1, timber: 0, stone: 0, goods: 0, vacancies: 0, buildings: 0, treasury: 0, fTimber: 0, fStone: 0 };
show(startRow);
for (const r of rows) if (r.year % 5 === 0 || r.year === YEARS) show(r);

// ---- materials and buildings (Session 11) ----
console.log(`\n  year   timber    stone    goods  vacancies  buildings  treasury  faction-timber  faction-stone`);
for (const r of rows) if (r.year % 5 === 0 || r.year === YEARS) console.log(`${String(r.year).padStart(6)} ${Math.round(r.timber).toLocaleString('en-US').padStart(8)} ${Math.round(r.stone).toLocaleString('en-US').padStart(8)} ${Math.round(r.goods).toLocaleString('en-US').padStart(8)} ${Math.round(r.vacancies).toLocaleString('en-US').padStart(10)} ${String(r.buildings).padStart(10)} ${Math.round(r.treasury).toLocaleString('en-US').padStart(9)} ${Math.round(r.fTimber).toLocaleString('en-US').padStart(15)} ${Math.round(r.fStone).toLocaleString('en-US').padStart(14)}`);
if (BUILDER) {
  console.log(`  builder: ${queued} projects queued, ${built} buildings finished`);
  const counts: Record<string, number> = {};
  for (const s of list()) for (const b of s.buildings.slice(2)) counts[b] = (counts[b] ?? 0) + 1;
  console.log(`  built: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join(', ') || 'nothing'}`);
}
const worked = workedCellsBySettlement(state);
console.log('\n  cluster (head)         members   people    timber    stone    goods   stone hexes');
for (const c of clustersOf(state).filter((c) => c.members.length > 1)) {
  const st = clusterStock(state, c.root);
  const head = state.settlements[c.root];
  let stoneHexes = 0;
  for (const id of c.members) for (const cell of worked.get(id) ?? []) if (hasStone(state.map, cell)) stoneHexes++;
  console.log(`  ${head.name.padEnd(22)} ${String(c.members.length).padStart(7)} ${Math.round(c.totals.population).toLocaleString('en-US').padStart(8)} ${Math.round(st.timber).toLocaleString('en-US').padStart(9)} ${Math.round(st.stone).toLocaleString('en-US').padStart(8)} ${Math.round(st.goods).toLocaleString('en-US').padStart(8)} ${String(stoneHexes).padStart(13)}`);
}

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
console.log(`  hunger deaths per year by tier: villages ${Math.round(hungerByRank[0] / YEARS).toLocaleString('en-US')} · towns ${Math.round(hungerByRank[1] / YEARS).toLocaleString('en-US')} · cities ${Math.round(hungerByRank[2] / YEARS).toLocaleString('en-US')} · metropolis ${Math.round(hungerByRank[3] / YEARS).toLocaleString('en-US')} · famine migrants per year ${Math.round(rows.reduce((t, r) => t + r.famineMig, 0) / YEARS).toLocaleString('en-US')}`);
console.log(`  ran ${YEARS} years in ${ms.toFixed(0)} ms`);

if (CSV) {
  mkdirSync(dirname(CSV), { recursive: true });
  writeFileSync(CSV, csv.join('\n'));
  console.log(`  wrote ${CSV}`);
}
