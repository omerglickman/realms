// Economy, Phase 1: the food loop (DESIGN §4.2), materials and buildings
// (Session 11), the private economy (DESIGN §4.2b, Session 12) and migration (DESIGN §4.1).
// Runs once per month for every settlement, in this order:
//   plan labour (buildings first, then fields best-per-hand first; the rest are
//   SPARE hands in a village — PRIVATE hands in a town or above — who build the
//   current project and then gather timber and stone; the private hands left
//   over pay tax and make goods by themselves)
//   → produce food (harvest timing, building effects) → tithe up → consume (+ hunger)
//   → gather materials, tax, make and sell goods, advance construction → spoil & cap
//   → clusters overflow their stockpile caps to the realm (which overflows to loss)
//   → share surplus up to the parent (villages first, then towns)
//   → migrate idle hands from a hungry settlement to its parent.
// Every number comes from data/economy.json, data/buildings.json and data/demography.json.
// Deterministic apart from the seeded noise knobs (src/sim/noise.ts).

import economyData from '../../data/economy.json';
import unitData from '../../data/units.json';
import type { GameState } from './state';
import type { MapData } from './map';
import { TERRAIN } from './terrain';
import { RESOURCES } from './resources';
import {
  type Settlement, TIERS, buildingDef, workedCellsBySettlement, resolveAllParents, settlementsByRank, emptyReport, emptyYearTotals, POP_HISTORY_YEARS, abandonBelow,
  isCastle, isRuin, foodParentOf, newCastleState,
} from './settlements';
import { CASTLES, castleKindOf, castleNeed, allocateService, type ServicePlan } from './castles';
import { logEvent } from './state';
import { isFishable, isShore } from './water';
import { MATERIALS, MATERIAL_IDS, clusterStock, clusterCap, realmCap, takeFromCluster, emptyMaterials, type Materials } from './materials';
import { sumEffects, hasStone, type BuildingEffects } from './buildings';
import { clustersOf } from './clusters';
import { emptyFactionYear } from './factions';
import { upgradeMonth } from './upgrades';
export { isShore };
import { DEMOGRAPHY, workingHands, totalPopulation, applyHunger, takeSlice, addPopulation, yearlyUpdate, granaryBrakeFactor } from './demography';
import { seedRng, nextFloat, nextGaussian, nextU32 } from './rng';
import { noise } from './noise';

export const ECONOMY = economyData;

/** Tithe share (DESIGN §4.2, DECIDED 2026-11-05) — read live so the runner and tests can change it. */
export function titheShare(): number {
  return (ECONOMY.sharing as { titheShare?: number }).titheShare ?? 0;
}
export function setTitheShare(x: number): void {
  (ECONOMY.sharing as { titheShare?: number }).titheShare = x;
}

/** The private economy (DESIGN §4.2b, DECIDED 2026-11-05) — data/economy.json `privateEconomy`, read live. */
type PrivateEconomyData = { appliesTo: string[]; taxPerHandPerYear: number; goodsPerHandPerYear: number; salesSharePerYear: number; goodsPrice: number };
export const PRIVATE: PrivateEconomyData = (economyData as unknown as { privateEconomy: PrivateEconomyData }).privateEconomy;
export function hasPrivateEconomy(tierId: string): boolean {
  return PRIVATE.appliesTo.includes(tierId);
}
export function taxRate(): number {
  return PRIVATE.taxPerHandPerYear;
}
export function setTaxRate(x: number): void {
  PRIVATE.taxPerHandPerYear = x;
}

import { hexJobs, type Job, type JobKind } from './hexjobs';
export { hexJobs };
export type { Job, JobKind };
export type GatherKind = 'timber' | 'stone';

/** A materials job a hex offers (Session 11): timber by terrain yield, stone on a Stone hex. */
export interface GatherJob {
  kind: GatherKind;
  cell: number;
  /** units per year at full labour */
  perYear: number;
  hands: number;
}

export function hexGatherJobs(map: MapData, cell: number): GatherJob[] {
  const t = TERRAIN[map.terrain[cell]];
  const jobs: GatherJob[] = [];
  if (t.timber > 0) jobs.push({ kind: 'timber', cell, perYear: MATERIALS.timber.perYearByTimber[t.timber] ?? 0, hands: MATERIALS.timber.hands });
  if (hasStone(map, cell)) jobs.push({ kind: 'stone', cell, perYear: MATERIALS.stone.perYearOnStoneHex, hands: MATERIALS.stone.hands });
  return jobs;
}

export interface StaffedGatherJob extends GatherJob {
  fraction: number;
}

export interface StaffedBuilding {
  id: string;
  hands: number;
  /** 0–1 share of required hands actually present */
  fraction: number;
}

export interface StaffedJob extends Job {
  /** share of the hex's yield produced (after the partial-staffing curve) */
  fraction: number;
  /** share of the hex's hands present */
  staffing: number;
}

/** Partial staffing of a hex (DESIGN §3.2b rule 1, DECIDED 2026-11-07; numbers in data/units.json `staffing`) — read live. */
type StaffingCurve = { full: number; drop: number; slope: number };
const STAFFING: StaffingCurve = (unitData as unknown as { staffing: StaffingCurve }).staffing;

/**
 * Output share of a food hex staffed at `staffing` (0–1): the staffing itself
 * from `full` up; below it each point costs `slope` points; under `drop` the
 * hex is not worked at all (0).
 */
export function staffingOutput(staffing: number): number {
  const f = Math.max(0, Math.min(1, staffing));
  if (f >= STAFFING.full) return f;
  if (f < STAFFING.drop) return 0;
  return Math.max(0, STAFFING.full - STAFFING.slope * (STAFFING.full - f));
}

export interface LabourPlan {
  hands: number;
  buildings: StaffedBuilding[];
  staffedHands: number;
  /** Session 18: hands lent to the castles in reach (after the buildings, before the fields; DESIGN §3.5) */
  serviceHands: number;
  jobs: StaffedJob[];
  fieldHands: number;
  /** SPARE hands: not needed by buildings or fields (they build and gather, and are the crowding / migration pool) */
  idleHands: number;
  /** yearly food if every job were fully worked */
  landCapacity: number;
  /** yearly food actually planned */
  plannedPerYear: number;
  /** 0–1 staffing of the granary */
  granaryStaffing: number;
  /** Session 11 */
  effects: BuildingEffects;
  /** spare hands on the current project and the share of full construction speed they give */
  constructionHands: number;
  constructionFraction: number;
  gather: StaffedGatherJob[];
  gatherHands: number;
  /** hands the buildings, fields and construction could use but the settlement does not have (shown in the panel) */
  vacancies: number;
  /** Session 12 (DESIGN §4.2b): the private economy of a town, city or metropolis (all zero in a village) */
  privateHands: number;
  /** private hands actually paying tax and making goods this month (not on the site, not gathering) */
  taxableHands: number;
  /** administration quality 0–1: the hall's staffing (institutions, policy and order later) */
  adminQuality: number;
  /** coins and goods the private hands yield at this plan, per year */
  taxPerYear: number;
  goodsPerYear: number;
  /** coins per year forgone because private hands are building or gathering */
  taxLostPerYear: number;
  /** share of the cluster's goods this settlement sells per year (0 in a village) */
  salesSharePerYear: number;
}

/**
 * Allocate a settlement's hands: buildings first, then food jobs best-per-hand
 * first (DESIGN §4.2); the SPARE hands left over build the current project and
 * then gather timber and stone (Session 11). Vacancies count the hands that
 * buildings, fields and construction wanted but did not get.
 */
export function planLabour(map: MapData, s: Settlement, cells: number[], serviceHands = 0): LabourPlan {
  const hands = workingHands(s.pop);
  let left = hands;
  let vacancies = 0;
  const buildings: StaffedBuilding[] = [];
  let granaryStaffing = 0, hallStaffing = 1;
  for (const id of s.buildings) {
    const def = buildingDef(id);
    const got = Math.min(left, def.hands);
    left -= got;
    vacancies += def.hands - got;
    const fraction = def.hands > 0 ? got / def.hands : 1;
    buildings.push({ id, hands: got, fraction });
    if (def.family === 'granary') granaryStaffing = fraction;
    if (def.family === 'hall') hallStaffing = fraction;
  }
  const staffedHands = hands - left;
  // castle service (DESIGN §3.5): after the home's own buildings, before its fields
  const service = Math.max(0, Math.min(left, serviceHands));
  left -= service;
  const effects = sumEffects(buildings);

  const jobs: Job[] = [];
  for (const c of cells) for (const j of hexJobs(map, c)) jobs.push(j);
  jobs.sort((a, b) => b.fedPerYear / b.hands - a.fedPerYear / a.hands || a.cell - b.cell);
  const staffed: StaffedJob[] = [];
  let landCapacity = 0, plannedPerYear = 0, fieldHands = 0;
  // hexes fill in yield order, so at most one is partly staffed; under the drop line (DESIGN §3.2b rule 1) a
  // hex is not worked and its hands stay free for a smaller job further down the list
  for (const j of jobs) {
    landCapacity += j.fedPerYear;
    let got = Math.min(left, j.hands);
    let staffing = got / j.hands;
    let fraction = staffingOutput(staffing);
    if (fraction <= 0) { got = 0; staffing = 0; }
    left -= got;
    fieldHands += got;
    vacancies += j.hands - got;
    plannedPerYear += j.fedPerYear * fraction;
    staffed.push({ ...j, fraction, staffing });
  }
  const idleHands = left;

  // spare hands: construction first, then gathering (best output per hand first)
  let spare = left;
  let constructionHands = 0, constructionFraction = 0;
  if (s.build) {
    const need = buildingDef(s.build.building).buildHands ?? 0;
    constructionHands = Math.min(spare, need);
    spare -= constructionHands;
    vacancies += need - constructionHands;
    constructionFraction = need > 0 ? constructionHands / need : 1;
  }
  const gjobs: GatherJob[] = [];
  for (const c of cells) for (const g of hexGatherJobs(map, c)) gjobs.push(g);
  gjobs.sort((a, b) => b.perYear / b.hands - a.perYear / a.hands || a.cell - b.cell);
  const gather: StaffedGatherJob[] = [];
  let gatherHands = 0;
  for (const g of gjobs) {
    const got = Math.min(spare, g.hands);
    spare -= got;
    gatherHands += got;
    gather.push({ ...g, fraction: g.hands > 0 ? got / g.hands : 0 });
  }

  // the private economy (DESIGN §4.2b): in a town or above the spare hands are private hands; those not drawn
  // to the site or to gathering pay tax and make goods, scaled by administration quality (the hall's staffing)
  const priv = hasPrivateEconomy(TIERS[s.tier].id);
  const privateHands = priv ? idleHands : 0;
  const taxableHands = priv ? Math.max(0, idleHands - constructionHands - gatherHands) : 0;
  const adminQuality = hallStaffing;
  const taxPerYear = taxableHands * PRIVATE.taxPerHandPerYear * adminQuality;
  const taxLostPerYear = priv ? (privateHands - taxableHands) * PRIVATE.taxPerHandPerYear * adminQuality : 0;
  const goodsPerYear = taxableHands * PRIVATE.goodsPerHandPerYear * adminQuality * effects.goodsMult;
  const salesSharePerYear = priv ? PRIVATE.salesSharePerYear + effects.salesShare : 0; // goods become money only through a Market (Omer, Session 12c)
  return { hands, buildings, staffedHands, serviceHands: service, jobs: staffed, fieldHands, idleHands, landCapacity, plannedPerYear, granaryStaffing, effects, constructionHands, constructionFraction, gather, gatherHands, vacancies,
    privateHands, taxableHands, adminQuality, taxPerYear, goodsPerYear, taxLostPerYear, salesSharePerYear };
}

/** Materials gathered and goods made this month by a labour plan (units per year / 12). */
export function monthlyMaterials(plan: LabourPlan): Materials {
  const out = emptyMaterials();
  for (const g of plan.gather) out[g.kind] += (g.perYear * g.fraction) / 12;
  out.goods += plan.goodsPerYear / 12;
  return out;
}

/**
 * Food arriving this month from a labour plan (month 0 = January).
 * A job's fedPerYear is PEOPLE fed for a year; in food units that is
 * fedPerYear × 12 (1 food = one person for one month). `harvestFactor`
 * multiplies the farming part only (PROPOSED harvest variance, Session 9).
 */
export function monthlyProduction(plan: LabourPlan, month: number, harvestFactor = 1): number {
  let food = 0;
  const harvestShare = ECONOMY.farming.harvest.shares[month] ?? 0;
  for (const j of plan.jobs) {
    const yearlyFood = j.fedPerYear * j.fraction * 12 * ECONOMY.foodPerPersonPerMonth;
    if (j.kind === 'farm') food += yearlyFood * harvestShare * harvestFactor * plan.effects.farmingMult;
    else if (j.kind === 'fish') food += (yearlyFood / 12) * plan.effects.fishingMult;
    else food += yearlyFood / 12;
  }
  return food;
}

/**
 * January: draw this year's harvest factor for every settlement (PROPOSED, Session 9).
 * factor = 1 + sd × (√share × regional + √(1 − share) × local), floored at minFactor.
 * The regional part is one gaussian per block of regionSize×regionSize hexes per year,
 * so neighbours share good and bad years; the local part is per settlement.
 * Deterministic: everything derives from state.rng in id order.
 */
export function rollHarvestFactors(state: GameState): void {
  const k = noise();
  const list = Object.values(state.settlements).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!(k.harvestSd > 0)) { for (const s of list) s.harvestFactor = 1; return; }
  const yearSeed = nextU32(state.rng);
  const regional = new Map<string, number>();
  const wr = Math.sqrt(Math.max(0, Math.min(1, k.harvestRegionalShare)));
  const wl = Math.sqrt(1 - wr * wr);
  for (const s of list) {
    const key = `${Math.floor(s.col / k.harvestRegionSize)}:${Math.floor(s.row / k.harvestRegionSize)}`;
    let r = regional.get(key);
    if (r === undefined) { r = nextGaussian(seedRng(`${yearSeed}:${key}`)); regional.set(key, r); }
    const local = nextGaussian(state.rng);
    s.harvestFactor = Math.max(k.harvestMinFactor, 1 + k.harvestSd * (wr * r + wl * local));
  }
}

export function granaryTerms(staffing: number, effects?: BuildingEffects): { capacityMonths: number; spoilage: number } {
  const u = ECONOMY.granary.unstaffed, f = ECONOMY.granary.staffed;
  const k = Math.max(0, Math.min(1, staffing));
  return {
    capacityMonths: u.capacityMonths + (f.capacityMonths - u.capacityMonths) * k + (effects?.granaryExtraMonths ?? 0),
    spoilage: (u.spoilagePerMonth + (f.spoilagePerMonth - u.spoilagePerMonth) * k) * (effects?.granarySpoilageMult ?? 1),
  };
}

function monthlyNeed(s: Settlement): number {
  return totalPopulation(s.pop) * ECONOMY.foodPerPersonPerMonth;
}

const HARVEST_START = ECONOMY.farming.harvest.shares.findIndex((x) => x > 0);
/** the month the yearly demographic update runs in (December) */
const DEMOGRAPHY_YEAR_MONTH = 11;

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

/**
 * Food the settlement expects to have left when the next harvest arrives:
 * stock + the monthly income of the months in between − consumption in those
 * months (DESIGN §4.1 migration trigger). Negative = it will run out first.
 */
export function forecastBeforeHarvest(s: Settlement, plan: LabourPlan, month: number): number {
  const k = monthsUntilHarvest(month) - 1; // months to get through before the harvest month
  let food = s.food;
  const need = monthlyNeed(s);
  for (let j = 1; j <= k; j++) food += monthlyProduction(plan, (month + j) % 12) - need;
  return food;
}

/** One month of the food economy for every settlement in the state. */
export function economyMonth(state: GameState, month: number): void {
  resolveAllParents(state);
  if (month === 0) rollHarvestFactors(state);
  const worked = workedCellsBySettlement(state);
  const plans = new Map<string, LabourPlan>();
  const order = settlementsByRank(state);
  const titheIn = new Map<string, number>();
  const service = allocateService(state, worked);

  // produce (→ tithe up) → consume → spoil & cap
  for (const s of order) {
    if (isCastle(s)) { castleMonth(state, s, worked.get(s.id) ?? [], service, month); continue; }
    const plan = planLabour(state.map, s, worked.get(s.id) ?? [], service.given.get(s.id) ?? 0);
    plans.set(s.id, plan);
    const r = emptyReport();
    r.titheIn = titheIn.get(s.id) ?? 0;
    // yearly figures survive the monthly reset until the next December overwrites them
    r.births = s.report.births;
    r.deaths = s.report.deaths;
    r.trickleOut = s.report.trickleOut;
    r.trickleIn = s.report.trickleIn;
    r.epidemic = s.report.epidemic;
    r.sufficiency = s.report.sufficiency;
    r.hands = plan.hands;
    r.staffedHands = plan.staffedHands;
    r.fieldHands = plan.fieldHands;
    r.idleHands = plan.idleHands;
    r.landCapacity = plan.landCapacity;
    r.constructionHands = plan.constructionHands;
    r.gatherHands = plan.gatherHands;
    r.vacancies = plan.vacancies;
    r.privateHands = plan.privateHands;
    r.adminQuality = plan.adminQuality;

    r.produced = monthlyProduction(plan, month, s.harvestFactor);
    s.food += r.produced;

    // tithe (DESIGN §4.2): the parent takes its share of the food the moment it is produced,
    // before this settlement eats or reckons its reserve. Subordinates are processed before
    // their parents (villages → towns → cities), so the grain arrives before the parent eats.
    const tithe = titheShare();
    if (tithe > 0 && r.produced > 0 && s.parent) {
      const p = foodParentOf(state, s); // a castle takes no tithe (DESIGN §3.5)
      if (p) {
        const take = r.produced * tithe;
        s.food -= take;
        p.food += take;
        r.titheOut = take;
        // the parent's report for this month is built when its own turn comes; keep the figure aside
        titheIn.set(p.id, (titheIn.get(p.id) ?? 0) + take);
      }
    }

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

    // materials (Session 11): spare hands gather timber and stone; the private hands make goods (Session 12)
    const made = monthlyMaterials(plan);
    s.stock.timber += made.timber; s.stock.stone += made.stone; s.stock.goods += made.goods;
    r.timber = made.timber; r.stone = made.stone; r.goods = made.goods;
    // the private economy (DESIGN §4.2b): tax into the faction treasury; a share of the cluster's goods sold
    const f = s.faction ? state.factions[s.faction] : undefined;
    if (f && plan.privateHands > 0) {
      r.tax = plan.taxPerYear / 12;
      r.taxLost = plan.taxLostPerYear / 12;
      f.treasury += r.tax;
      f.year.tax += r.tax;
      if (plan.salesSharePerYear > 0) {
        const have = clusterStock(state, s.id).goods;
        const sell = Math.min(have, have * plan.salesSharePerYear / 12);
        if (sell > 1e-9) {
          const taken = takeFromCluster(state, s.id, { goods: sell });
          r.sold = taken.goods * PRIVATE.goodsPrice;
          f.treasury += r.sold;
          f.year.sales += r.sold;
        }
      }
    }
    // construction: the project advances by the share of full labour it got
    if (s.build) {
      const def = buildingDef(s.build.building);
      s.build.progress += plan.constructionFraction / Math.max(1, def.buildMonths ?? 1);
      if (s.build.progress >= 1 - 1e-9) {
        s.buildings.push(s.build.building);
        s.build = null;
        logEvent(state, 'built', `${s.name} finished its ${def.name}.`);
      }
    }
    // a tier upgrade (Session 15b): the hall grows month by month, no builders needed
    upgradeMonth(state, s);

    const g = granaryTerms(plan.granaryStaffing, plan.effects);
    r.spoiled = s.food * g.spoilage;
    s.food -= r.spoiled;
    r.capacity = g.capacityMonths * monthlyNeed(s);
    if (s.food > r.capacity) {
      r.spoiled += s.food - r.capacity;
      s.food = r.capacity;
    }
    s.report = r;
  }

  // stockpile caps (DESIGN §4.2, Session 12): what a cluster holds above its cap flows to the realm stockpile
  // (taken from the members in proportion to what each holds); what the realm holds above its cap is lost
  for (const c of clustersOf(state)) {
    const f = c.faction ? state.factions[c.faction] : undefined;
    const pool = clusterStock(state, c.root);
    const cap = clusterCap(state, c.root);
    const want: Partial<Materials> = {};
    let any = false;
    for (const m of MATERIAL_IDS) if (pool[m] > cap[m] + 1e-9) { want[m] = pool[m] - cap[m]; any = true; }
    if (!any) continue;
    const taken = takeFromCluster(state, c.root, want);
    const total = taken.timber + taken.stone + taken.goods;
    if (total <= 0) continue;
    state.settlements[c.root].report.overflow += total;
    state.settlements[c.root].year.surplusOut += total;
    if (f) { for (const m of MATERIAL_IDS) { f.stock[m] += taken[m]; f.year.overflowIn[m] += taken[m]; } }
  }
  const rcap = realmCap();
  for (const f of Object.values(state.factions)) {
    for (const m of MATERIAL_IDS) if (f.stock[m] > rcap[m]) { f.year.lost[m] += f.stock[m] - rcap[m]; f.stock[m] = rcap[m]; }
    f.year.months += 1;
  }

  // share surplus up (villages first, then towns, so a chain works in one month). The castles above a
  // settlement fill their reserves first, up to the room they have (DESIGN §3.5); the rest goes to its
  // nearest ancestor that is not a castle.
  for (const s of order) {
    if (isCastle(s) || !s.parent) continue;
    let surplus = s.food - reserveFood(s, month);
    if (surplus <= 0) continue;
    const seen = new Set<string>([s.id]);
    let p = state.settlements[s.parent];
    while (p && !seen.has(p.id) && surplus > 1e-9) {
      seen.add(p.id);
      const room = p.report.capacity - p.food;
      const give = Math.max(0, Math.min(surplus, room));
      if (give > 0) {
        s.food -= give;
        p.food += give;
        s.report.sent += give;
        p.report.received += give;
        surplus -= give;
      }
      if (!isCastle(p)) break;
      p = p.parent ? state.settlements[p.parent] : undefined as unknown as Settlement;
    }
  }

  abandonEmptySettlements(state);

  // migration (DESIGN §4.1): a settlement that forecasts running out of food before the
  // next harvest, has idle hands and a parent → 10 % of idle hands leave with dependants
  const mig = DEMOGRAPHY.migration;
  for (const s of order) {
    if (isCastle(s) || !s.parent) continue;
    const p = foodParentOf(state, s);
    if (!p) continue;
    const plan = plans.get(s.id)!;
    if (plan.idleHands <= 0 || plan.hands <= 0) continue;
    if (forecastBeforeHarvest(s, plan, month) >= mig.triggerSafetyMonths * monthlyNeed(s)) continue;
    const movingHands = plan.idleHands * mig.idleHandsSharePerMonth;
    const slice = takeSlice(s.pop, movingHands / plan.hands);
    const n = totalPopulation(slice);
    addPopulation(p.pop, slice);
    s.report.migrantsOut += n;
    p.report.migrantsIn += n;
  }

  // yearly running totals (Session 10): the month's figures added to the calendar year
  for (const s of Object.values(state.settlements)) {
    const y = s.year, r = s.report;
    y.produced += r.produced; y.consumed += r.consumed; y.hungerDeaths += r.hungerDeaths;
    y.sent += r.sent; y.received += r.received; y.titheOut += r.titheOut; y.titheIn += r.titheIn;
    y.migrantsOut += r.migrantsOut; y.migrantsIn += r.migrantsIn;
    y.timber += r.timber; y.stone += r.stone; y.goods += r.goods; y.sold += r.sold;
    y.tax += r.tax; y.taxLost += r.taxLost;
    y.months += 1;
  }
}

/**
 * One month of a castle (DESIGN §3.5, Session 18). It has no residents: the
 * hands that staff it were lent by the settlements in its reach (`allocateService`),
 * and staffing (got / need) scales its worked hexes and its garrison capacity.
 * It produces food from its hexes into its own reserve, the treasury pays wages
 * per staffed hand and a yearly upkeep (PLACEHOLDER: the treasury may go
 * negative — nothing yet makes a bankrupt realm do anything), the reserve spoils
 * like a granary and is capped at `capacity` people for `reserve.months` months,
 * and a castle nobody serves for `ruin.afterMonths` months becomes a ruin.
 */
export function castleMonth(state: GameState, s: Settlement, cells: number[], service: ServicePlan, month: number): void {
  const c = s.castle ?? (s.castle = newCastleState());
  const r = emptyReport();
  if (c.ruin) { c.staffing = 0; c.gotHands = 0; c.wages = 0; c.upkeep = 0; c.garrisonCapacity = 0; s.report = r; return; }
  const kind = castleKindOf(s);
  const f = s.faction ? state.factions[s.faction] : undefined;
  const info = service.byCastle.get(s.id) ?? { need: 0, got: 0, staffing: 0, reach: 0, from: [] };
  c.staffing = info.staffing;
  c.gotHands = info.got;
  c.needHands = info.need;
  c.garrisonCapacity = kind.capacity * info.staffing;
  c.unstaffedMonths = info.got > 1e-9 ? 0 : c.unstaffedMonths + 1;
  if (c.unstaffedMonths >= CASTLES.ruin.afterMonths) {
    c.ruin = true; c.staffing = 0; c.gotHands = 0; c.garrisonCapacity = 0; c.wages = 0; c.upkeep = 0;
    s.food = 0; s.parent = null; s.upgrade = null;
    logEvent(state, 'ruin', `${s.name} fell into ruin — nobody was left to serve it.`);
    s.report = r;
    return;
  }
  // its worked hexes, staffed in proportion (the partial-staffing curve of a food hex)
  const jobs = castleNeed(state, s, cells).jobs.map((j) => ({ ...j, staffing: info.staffing, fraction: staffingOutput(info.staffing) }));
  const plan = planLabour(state.map, s, []);
  plan.jobs = jobs;
  plan.landCapacity = jobs.reduce((t, j) => t + j.fedPerYear, 0);
  plan.plannedPerYear = jobs.reduce((t, j) => t + j.fedPerYear * j.fraction, 0);
  r.landCapacity = plan.landCapacity;
  r.produced = monthlyProduction(plan, month, s.harvestFactor);
  s.food += r.produced;
  // money: wages for the hands in service and the yearly upkeep
  c.wages = info.got * CASTLES.service.wagePerHandPerMonth;
  c.upkeep = kind.upkeepPerYear / 12;
  if (f) { f.treasury -= c.wages + c.upkeep; f.year.upkeep += c.wages + c.upkeep; }
  // the reserve: granary spoilage by staffing, capped at the siege reserve
  const g = granaryTerms(info.staffing);
  r.spoiled = s.food * g.spoilage;
  s.food -= r.spoiled;
  r.capacity = kind.capacity * CASTLES.reserve.months * ECONOMY.foodPerPersonPerMonth;
  if (s.food > r.capacity) { r.spoiled += s.food - r.capacity; s.food = r.capacity; }
  s.report = r;
  // an upgrade in place runs at the share of its hands that are there (spare hands in reach, a band on the hex)
  if (s.upgrade) upgradeMonth(state, s);
}

/**
 * Abandonment (DECIDED 2026-11-05): a settlement below ABANDON_BELOW people is
 * removed; whoever is left walks to its parent (people are conserved when
 * there is one); its granary is lost. Logged as an event.
 */
export function abandonEmptySettlements(state: GameState): string[] {
  const gone: string[] = [];
  const threshold = abandonBelow();
  if (!(threshold > 0)) return gone;
  for (const s of settlementsByRank(state)) {
    if (isCastle(s)) continue; // a castle has no residents; its fate is the ruin rule
    const n = totalPopulation(s.pop);
    if (n >= threshold) continue;
    const p = foodParentOf(state, s);
    if (p && n > 0) { addPopulation(p.pop, s.pop); p.report.migrantsIn += n; }
    delete state.settlements[s.id];
    gone.push(s.id);
    logEvent(state, 'abandoned', `${s.name} (${TIERS[s.tier].name.toLowerCase()}) was abandoned${p ? ` — the last ${Math.round(n)} people walked to ${p.name}` : ''}.`);
  }
  if (gone.length) resolveAllParents(state);
  return gone;
}

/**
 * The yearly demographic update for every settlement (run in December):
 * epidemic roll, births/deaths/aging, year-end bookkeeping, then the
 * migration trickle to parents (PROPOSED, Session 9). Settlements are
 * processed in id order so the RNG draws are reproducible.
 */
export function demographyYear(state: GameState): void {
  const k = noise();
  const list = Object.values(state.settlements).filter((s) => !isCastle(s)).sort((a, b) => (a.id < b.id ? -1 : 1));
  // the year's sufficiency per settlement, before anything is reset (the trickle checks the parent's)
  for (const s of list) s.report.sufficiency = s.yearMonths > 0 ? s.yearSufficiency / s.yearMonths : 1;
  for (const s of list) {
    const suff = s.report.sufficiency;
    const plenty = s.food > 12 * monthlyNeed(s);
    const crowdable = (DEMOGRAPHY as { crowdingAppliesTo: string[] }).crowdingAppliesTo.includes(TIERS[s.tier].id);
    const idleShare = crowdable && s.report.hands > 0 ? s.report.idleHands / s.report.hands : 0;
    const epidemic = k.epidemicChance > 0 && nextFloat(state.rng) < k.epidemicChance;
    // granary brake (DESIGN §4.1, DECIDED 2026-11-05): towns and cities breed less when their stock is thin
    const need = monthlyNeed(s);
    const spare = (need > 0 ? s.food / need : 0) - monthsUntilHarvest(DEMOGRAPHY_YEAR_MONTH);
    const birthFactor = granaryBrakeFactor(TIERS[s.tier].id, spare);
    const res = yearlyUpdate(s.pop, suff, plenty, idleShare, { rng: state.rng, deathMultiplier: epidemic ? k.epidemicDeathMultiplier : 1, birthFactor });
    s.report.births = res.births;
    s.report.deaths = res.deaths;
    s.report.epidemic = epidemic;
    s.yearMonths = 0;
    s.yearSufficiency = 0;
  }
  // the PULL FACTOR (DESIGN §4.1, Session 11; condition revised Session 11b): idle hands above the threshold
  // drift, with dependants, to a parent that is PROSPEROUS — fully fed this year and fed with margin (spare
  // months at the next harvest ≥ the threshold, the granary brake's measure). Spare months are reckoned on the
  // parent's stock before anyone moves, so every subordinate sees the same parent.
  for (const s of list) s.report.trickleOut = s.report.trickleIn = 0;
  if (k.trickleShare > 0) {
    const prosperous = new Map<string, boolean>();
    for (const p of list) {
      const need = monthlyNeed(p);
      const spare = (need > 0 ? p.food / need : 0) - monthsUntilHarvest(DEMOGRAPHY_YEAR_MONTH);
      prosperous.set(p.id, spare >= k.trickleProsperousSpare);
    }
    for (const s of settlementsByRank(state)) {
      if (isCastle(s) || !s.parent) continue;
      const p = foodParentOf(state, s);
      if (!p) continue;
      if (k.trickleRequireFedParent && p.report.sufficiency < 0.999) continue;
      if (k.trickleRequireProsperous && !prosperous.get(p.id)) continue;
      const hands = s.report.hands, idle = s.report.idleHands;
      if (hands <= 0 || idle / hands <= k.trickleMinIdle) continue;
      const jitter = k.trickleSpread > 0 ? 1 + k.trickleSpread * (2 * nextFloat(state.rng) - 1) : 1;
      const movingHands = Math.min(idle, idle * k.trickleShare * jitter);
      const slice = takeSlice(s.pop, movingHands / hands);
      const n = totalPopulation(slice);
      addPopulation(p.pop, slice);
      s.report.trickleOut += n;
      p.report.trickleIn += n;
    }
  }
  // close the factions' calendar year (Session 12): tax, sales, spending, overflow, losses
  for (const f of Object.values(state.factions)) {
    f.lastYear = f.year;
    f.year = emptyFactionYear();
  }
  for (const s of list) {
    s.popHistory.push(totalPopulation(s.pop));
    if (s.popHistory.length > POP_HISTORY_YEARS) s.popHistory.splice(0, s.popHistory.length - POP_HISTORY_YEARS);
    // close the calendar year's totals (Session 10)
    s.lastYear = s.year;
    s.year = emptyYearTotals();
  }
}

/** Convenience for panels and tests: the tier definition of a settlement. */
export function tierOf(s: Settlement) {
  return TIERS[s.tier];
}
