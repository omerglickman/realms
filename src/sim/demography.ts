// Demographics (DESIGN §4.1): the cohort model.
// A Population is counts by sex × age band (5 bands → 10 numbers). Counts are
// real numbers, not integers, so small settlements still move smoothly under
// fractional rates; the UI rounds for display. All rates come from
// data/demography.json (ROADMAP B.3 rule 6). No randomness here: the yearly
// update is a deterministic function of the population and the year's food.

import demographyData from '../../data/demography.json';
import { type RngState, nextPoisson } from './rng';
import { noise } from './noise';

export const DEMOGRAPHY = demographyData;

export const BAND_IDS = DEMOGRAPHY.bands.map((b) => b.id);
export const BANDS = BAND_IDS.length;
const bandIndex = (id: string): number => {
  const i = BAND_IDS.indexOf(id);
  if (i < 0) throw new Error(`Unknown age band "${id}" in data/demography.json`);
  return i;
};
const WORKING = DEMOGRAPHY.workingBands.map(bandIndex);
const FERTILE = DEMOGRAPHY.fertileBands.map(bandIndex);
const RECRUIT = DEMOGRAPHY.recruitBands.map(bandIndex);
const VULNERABLE = new Set(DEMOGRAPHY.hunger.vulnerableBands.map(bandIndex));
const DEATH_RATE: number[] = BAND_IDS.map((id) => (DEMOGRAPHY.deathRatePerYear as Record<string, number>)[id] ?? 0);
const START_SHARE: number[] = BAND_IDS.map((id) => (DEMOGRAPHY.startingDistribution as unknown as Record<string, number>)[id] ?? 0);

/** Counts per band, men (m) and women (f). Plain JSON data. */
export interface Population {
  m: number[];
  f: number[];
}

export function emptyPopulation(): Population {
  return { m: new Array<number>(BANDS).fill(0), f: new Array<number>(BANDS).fill(0) };
}

/** A population of `n` people in the stationary starting distribution, split evenly by sex. */
export function createPopulation(n: number): Population {
  const p = emptyPopulation();
  for (let b = 0; b < BANDS; b++) {
    p.m[b] = (n * START_SHARE[b]) / 2;
    p.f[b] = (n * START_SHARE[b]) / 2;
  }
  return p;
}

export function totalPopulation(p: Population): number {
  let t = 0;
  for (let b = 0; b < BANDS; b++) t += p.m[b] + p.f[b];
  return t;
}

/** Working hands: everyone in the working bands (15–59). */
export function workingHands(p: Population): number {
  let t = 0;
  for (const b of WORKING) t += p.m[b] + p.f[b];
  return t;
}

/** Women in the fertile bands (15–44). */
export function fertileWomen(p: Population): number {
  let t = 0;
  for (const b of FERTILE) t += p.f[b];
  return t;
}

/** Men in the recruitable bands (15–44). */
export function recruitableMen(p: Population): number {
  let t = 0;
  for (const b of RECRUIT) t += p.m[b];
  return t;
}

export function addPopulation(into: Population, from: Population): void {
  for (let b = 0; b < BANDS; b++) {
    into.m[b] += from.m[b];
    into.f[b] += from.f[b];
  }
}

/** Remove and return a proportional slice (fraction 0–1) of every cohort. */
export function takeSlice(p: Population, fraction: number): Population {
  const f = Math.max(0, Math.min(1, fraction));
  const out = emptyPopulation();
  for (let b = 0; b < BANDS; b++) {
    out.m[b] = p.m[b] * f;
    out.f[b] = p.f[b] * f;
    p.m[b] -= out.m[b];
    p.f[b] -= out.f[b];
  }
  return out;
}

export interface YearlyResult {
  births: number;
  deaths: number;
}

/**
 * The yearly demographic update (run in December): deaths by band, aging,
 * births. `foodSufficiency` is the year's average share of need that was met
 * (0–1); `plenty` is true when the granary holds more than a year's need;
 * `idleShare` is the share of working hands that had no work (crowding).
 */
export interface YearlyOptions {
  /** seeded game RNG; with data noise.vitalSampling on, births and deaths are Poisson draws (PROPOSED, Session 9) */
  rng?: RngState;
  /** multiplies this year's death rates (epidemic year); 1 = normal */
  deathMultiplier?: number;
  /** extra multiplier on births (the granary brake, DESIGN §4.1); 1 = none */
  birthFactor?: number;
}

/** Which tiers the granary brake applies to (read live; the runner and tests can change it — [] = off). */
export function granaryBrakeTiers(): string[] {
  return (DEMOGRAPHY as { granaryBrake?: { appliesTo: string[] } }).granaryBrake?.appliesTo ?? [];
}
export function setGranaryBrakeTiers(tiers: string[]): void {
  const g = (DEMOGRAPHY as { granaryBrake?: { appliesTo: string[] } }).granaryBrake;
  if (g) g.appliesTo = tiers;
}

/**
 * Granary brake (DECIDED 2026-11-05): birth multiplier for a settlement of `tierId`
 * whose December stock will leave `spareMonths` months of food when the next harvest
 * arrives (negative = it will run out first). 1 for tiers the brake does not apply to.
 */
export function granaryBrakeFactor(tierId: string, spareMonths: number): number {
  const g = (DEMOGRAPHY as { granaryBrake?: { appliesTo: string[]; spareFull: number; spareEmpty: number; minFactor: number } }).granaryBrake;
  if (!g || !g.appliesTo.includes(tierId)) return 1;
  const span = Math.max(1e-9, g.spareFull - g.spareEmpty);
  const t = Math.max(0, Math.min(1, (spareMonths - g.spareEmpty) / span));
  return g.minFactor + (1 - g.minFactor) * t;
}

/** Expected count → realized count: exact when sampling is off or no rng is given, Poisson otherwise. */
function realize(expected: number, rng: RngState | undefined, cap: number): number {
  if (!rng || noise().vitalSampling <= 0 || expected <= 0) return Math.min(cap, expected);
  return Math.min(cap, nextPoisson(rng, expected));
}

export function yearlyUpdate(p: Population, foodSufficiency: number, plenty: boolean, idleShare = 0, opts: YearlyOptions = {}): YearlyResult {
  const rng = opts.rng;
  const dmul = opts.deathMultiplier ?? 1;
  // 1. deaths by band
  let deaths = 0;
  for (let b = 0; b < BANDS; b++) {
    const dm = realize(p.m[b] * DEATH_RATE[b] * dmul, rng, p.m[b]);
    const df = realize(p.f[b] * DEATH_RATE[b] * dmul, rng, p.f[b]);
    p.m[b] -= dm;
    p.f[b] -= df;
    deaths += dm + df;
  }
  // 2. births (before aging so newborns stay in the child band)
  const suff = Math.max(0, Math.min(1, foodSufficiency));
  let mult = suff;
  if (plenty && suff >= 1) mult *= DEMOGRAPHY.plentyBirthMultiplier;
  // Crowding lowers births in villages (DESIGN §4.1, DECIDED 2026-11-04); penalty 0 turns it off
  mult *= Math.max(0, 1 - DEMOGRAPHY.crowdingBirthPenalty * Math.max(0, Math.min(1, idleShare)));
  mult *= opts.birthFactor ?? 1;
  const births = realize(fertileWomen(p) * DEMOGRAPHY.birthsPerWomanPerYear * mult, rng, Infinity);
  // 3. aging: 1/width of each band moves up; the last band is terminal
  const share = 1 / DEMOGRAPHY.bandWidthYears;
  for (let b = BANDS - 2; b >= 0; b--) {
    const am = p.m[b] * share;
    const af = p.f[b] * share;
    p.m[b] -= am;
    p.f[b] -= af;
    p.m[b + 1] += am;
    p.f[b + 1] += af;
  }
  p.m[0] += births * DEMOGRAPHY.boySexRatio;
  p.f[0] += births * (1 - DEMOGRAPHY.boySexRatio);
  return { births, deaths };
}

/**
 * Hunger deaths for one month with an empty granary. `shortfall` is the share
 * of this month's need that was NOT met (0–1). Children and the old die at
 * double weight. Returns the number who died.
 */
export function applyHunger(p: Population, shortfall: number): number {
  const s = Math.max(0, Math.min(1, shortfall));
  if (s <= 0) return 0;
  const total = totalPopulation(p);
  if (total <= 0) return 0;
  const deaths = s * DEMOGRAPHY.hunger.deathRatePerMonthAtFullShortfall * total;
  let weightSum = 0;
  for (let b = 0; b < BANDS; b++) {
    const w = VULNERABLE.has(b) ? DEMOGRAPHY.hunger.vulnerableWeight : 1;
    weightSum += w * (p.m[b] + p.f[b]);
  }
  if (weightSum <= 0) return 0;
  let actual = 0;
  for (let b = 0; b < BANDS; b++) {
    const w = VULNERABLE.has(b) ? DEMOGRAPHY.hunger.vulnerableWeight : 1;
    const dm = Math.min(p.m[b], (deaths * w * p.m[b]) / weightSum);
    const df = Math.min(p.f[b], (deaths * w * p.f[b]) / weightSum);
    p.m[b] -= dm;
    p.f[b] -= df;
    actual += dm + df;
  }
  return actual;
}

/** Round every cohort for display / export (does not mutate). */
export function roundedPopulation(p: Population): Population {
  return { m: p.m.map(Math.round), f: p.f.map(Math.round) };
}
