// Economy, Phase 1: the food loop (DESIGN §4.2) and migration (DESIGN §4.1).
// Runs once per month for every settlement, in this order:
//   plan labour (buildings first, then fields best-per-hand first; rest = idle)
//   → produce (harvest timing) → consume (+ hunger) → spoil & cap
//   → share surplus up to the parent (villages first, then towns)
//   → migrate idle hands from a hungry settlement to its parent.
// Every number comes from data/economy.json and data/demography.json.
// Deterministic; no randomness yet.

import economyData from '../../data/economy.json';
import type { GameState } from './state';
import type { MapData } from './map';
import { neighborsOffset } from './map';
import { TERRAIN, terrainIndex } from './terrain';
import { RESOURCES } from './resources';
import {
  type Settlement, TIERS, buildingDef, workedCellsBySettlement, resolveAllParents, settlementsByRank, emptyReport,
} from './settlements';
import { DEMOGRAPHY, workingHands, totalPopulation, applyHunger, takeSlice, addPopulation, yearlyUpdate } from './demography';

export const ECONOMY = economyData;

const WATER = new Set(ECONOMY.fishing.waterTerrains.map(terrainIndex));
const SEA = terrainIndex('sea');
const LAKE = terrainIndex('lake');
const FISH_RES = RESOURCES.findIndex((r) => r.id === 'fish');
const GAME_RES = RESOURCES.findIndex((r) => r.id === 'game');

export type JobKind = 'farm' | 'herd' | 'fish' | 'hunt';

export interface Job {
  kind: JobKind;
  cell: number;
  /** people fed per year at full labour */
  fedPerYear: number;
  /** hands for full labour */
  hands: number;
}

/** Is this sea hex a shore (touches land)? Lakes and rivers are always workable. */
export function isShore(map: MapData, col: number, row: number): boolean {
  for (const n of neighborsOffset(map, col, row)) {
    const t = map.terrain[n.row * map.width + n.col];
    if (t !== SEA && t !== LAKE) return true;
  }
  return false;
}

/** The food jobs a single hex offers (DESIGN §3.1, §4.2). */
export function hexJobs(map: MapData, cell: number): Job[] {
  const t = TERRAIN[map.terrain[cell]];
  const res = map.resource[cell];
  const col = cell % map.width, row = Math.floor(cell / map.width);
  const jobs: Job[] = [];
  if (t.fertility > 0) {
    jobs.push({ kind: 'farm', cell, fedPerYear: ECONOMY.farming.fedPerYearByFertility[t.fertility], hands: ECONOMY.farming.hands });
  }
  if (t.pasture > 0) {
    jobs.push({ kind: 'herd', cell, fedPerYear: ECONOMY.herding.fedPerYearByPasture[t.pasture], hands: ECONOMY.herding.hands });
  }
  const ti = map.terrain[cell];
  if (WATER.has(ti) && (ti !== SEA || !ECONOMY.fishing.seaNeedsLandNeighbour || isShore(map, col, row))) {
    if (res === FISH_RES) jobs.push({ kind: 'fish', cell, fedPerYear: ECONOMY.fishing.withFish.fedPerYear, hands: ECONOMY.fishing.withFish.hands });
    else jobs.push({ kind: 'fish', cell, fedPerYear: ECONOMY.fishing.fedPerYear, hands: ECONOMY.fishing.hands });
  }
  if (res === GAME_RES) {
    jobs.push({ kind: 'hunt', cell, fedPerYear: ECONOMY.hunting.fedPerYear, hands: ECONOMY.hunting.hands });
  }
  return jobs;
}

export interface StaffedBuilding {
  id: string;
  hands: number;
  /** 0–1 share of required hands actually present */
  fraction: number;
}

export interface StaffedJob extends Job {
  fraction: number;
}

export interface LabourPlan {
  hands: number;
  buildings: StaffedBuilding[];
  staffedHands: number;
  jobs: StaffedJob[];
  fieldHands: number;
  idleHands: number;
  /** yearly food if every job were fully worked */
  landCapacity: number;
  /** yearly food actually planned */
  plannedPerYear: number;
  /** 0–1 staffing of the granary */
  granaryStaffing: number;
}

/** Allocate a settlement's hands: buildings first, then jobs best-per-hand first (DESIGN §4.2). */
export function planLabour(map: MapData, s: Settlement, cells: number[]): LabourPlan {
  const hands = workingHands(s.pop);
  let left = hands;
  const buildings: StaffedBuilding[] = [];
  let granaryStaffing = 0;
  for (const id of s.buildings) {
    const def = buildingDef(id);
    const got = Math.min(left, def.hands);
    left -= got;
    const fraction = def.hands > 0 ? got / def.hands : 1;
    buildings.push({ id, hands: got, fraction });
    if (def.family === 'granary') granaryStaffing = fraction;
  }
  const staffedHands = hands - left;

  const jobs: Job[] = [];
  for (const c of cells) for (const j of hexJobs(map, c)) jobs.push(j);
  jobs.sort((a, b) => b.fedPerYear / b.hands - a.fedPerYear / a.hands || a.cell - b.cell);
  const staffed: StaffedJob[] = [];
  let landCapacity = 0, plannedPerYear = 0, fieldHands = 0;
  for (const j of jobs) {
    landCapacity += j.fedPerYear;
    const got = Math.min(left, j.hands);
    left -= got;
    fieldHands += got;
    const fraction = got / j.hands;
    plannedPerYear += j.fedPerYear * fraction;
    staffed.push({ ...j, fraction });
  }
  return { hands, buildings, staffedHands, jobs: staffed, fieldHands, idleHands: left, landCapacity, plannedPerYear, granaryStaffing };
}

/**
 * Food arriving this month from a labour plan (month 0 = January).
 * A job's fedPerYear is PEOPLE fed for a year; in food units that is
 * fedPerYear × 12 (1 food = one person for one month).
 */
export function monthlyProduction(plan: LabourPlan, month: number): number {
  let food = 0;
  const harvestShare = ECONOMY.farming.harvest.shares[month] ?? 0;
  for (const j of plan.jobs) {
    const yearlyFood = j.fedPerYear * j.fraction * 12 * ECONOMY.foodPerPersonPerMonth;
    food += j.kind === 'farm' ? yearlyFood * harvestShare : yearlyFood / 12;
  }
  return food;
}

export function granaryTerms(staffing: number): { capacityMonths: number; spoilage: number } {
  const u = ECONOMY.granary.unstaffed, f = ECONOMY.granary.staffed;
  const k = Math.max(0, Math.min(1, staffing));
  return {
    capacityMonths: u.capacityMonths + (f.capacityMonths - u.capacityMonths) * k,
    spoilage: u.spoilagePerMonth + (f.spoilagePerMonth - u.spoilagePerMonth) * k,
  };
}

function monthlyNeed(s: Settlement): number {
  return totalPopulation(s.pop) * ECONOMY.foodPerPersonPerMonth;
}

const HARVEST_START = ECONOMY.farming.harvest.shares.findIndex((x) => x > 0);

/** Months from this month to the start of the next harvest (1–12; 12 in the harvest month itself). */
export function monthsUntilHarvest(month: number): number {
  const k = (HARVEST_START - month + 12) % 12;
  return k === 0 ? 12 : k;
}

/**
 * Food a settlement keeps before sending surplus up (DESIGN §4.2): what it will
 * eat until the next harvest plus the reserve months. (Ignores its own monthly
 * herding/fishing income, so it errs on the safe side.)
 */
export function reserveFood(s: Settlement, month: number): number {
  return monthlyNeed(s) * (monthsUntilHarvest(month) + ECONOMY.sharing.reserveMonths);
}

/** One month of the food economy for every settlement in the state. */
export function economyMonth(state: GameState, month: number): void {
  resolveAllParents(state);
  const worked = workedCellsBySettlement(state);
  const plans = new Map<string, LabourPlan>();
  const order = settlementsByRank(state);

  // produce → consume → spoil & cap
  for (const s of order) {
    const plan = planLabour(state.map, s, worked.get(s.id) ?? []);
    plans.set(s.id, plan);
    const r = emptyReport();
    r.births = s.report.births;
    r.deaths = s.report.deaths;
    r.hands = plan.hands;
    r.staffedHands = plan.staffedHands;
    r.fieldHands = plan.fieldHands;
    r.idleHands = plan.idleHands;
    r.landCapacity = plan.landCapacity;

    r.produced = monthlyProduction(plan, month);
    s.food += r.produced;

    const need = monthlyNeed(s);
    if (need > 0) {
      if (s.food >= need) {
        s.food -= need;
        r.consumed = need;
      } else {
        r.consumed = s.food;
        r.shortfall = (need - s.food) / need;
        s.food = 0;
        r.hungerDeaths = applyHunger(s.pop, r.shortfall);
      }
    }
    s.yearMonths += 1;
    s.yearSufficiency += 1 - r.shortfall;

    const g = granaryTerms(plan.granaryStaffing);
    r.spoiled = s.food * g.spoilage;
    s.food -= r.spoiled;
    r.capacity = g.capacityMonths * monthlyNeed(s);
    if (s.food > r.capacity) {
      r.spoiled += s.food - r.capacity;
      s.food = r.capacity;
    }
    s.report = r;
  }

  // share surplus up (villages first, then towns, so a chain works in one month)
  for (const s of order) {
    if (!s.parent) continue;
    const p = state.settlements[s.parent];
    if (!p) continue;
    const surplus = s.food - reserveFood(s, month);
    if (surplus <= 0) continue;
    const room = p.report.capacity - p.food;
    const give = Math.max(0, Math.min(surplus, room));
    if (give <= 0) continue;
    s.food -= give;
    p.food += give;
    s.report.sent += give;
    p.report.received += give;
  }

  // migration (DESIGN §4.1): hungry + idle hands + a parent → 10 % of idle hands leave with dependants
  const mig = DEMOGRAPHY.migration;
  for (const s of order) {
    if (!s.parent) continue;
    const p = state.settlements[s.parent];
    if (!p) continue;
    const plan = plans.get(s.id)!;
    if (plan.idleHands <= 0 || plan.hands <= 0) continue;
    if (s.food >= mig.triggerReserveMonths * monthlyNeed(s)) continue;
    const movingHands = plan.idleHands * mig.idleHandsSharePerMonth;
    const slice = takeSlice(s.pop, movingHands / plan.hands);
    const n = totalPopulation(slice);
    addPopulation(p.pop, slice);
    s.report.migrantsOut += n;
    p.report.migrantsIn += n;
  }
}

/** The yearly demographic update for every settlement (run in December). */
export function demographyYear(state: GameState): void {
  for (const s of Object.values(state.settlements)) {
    const suff = s.yearMonths > 0 ? s.yearSufficiency / s.yearMonths : 1;
    const plenty = s.food > 12 * monthlyNeed(s);
    const res = yearlyUpdate(s.pop, suff, plenty);
    s.report.births = res.births;
    s.report.deaths = res.deaths;
    s.yearMonths = 0;
    s.yearSufficiency = 0;
  }
}

/** Convenience for panels and tests: the tier definition of a settlement. */
export function tierOf(s: Settlement) {
  return TIERS[s.tier];
}
