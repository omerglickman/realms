// Units (DESIGN §3.2, §3.2b — DECIDED by Omer 2026-11-07; numbers draft in
// data/units.json). A unit is people in the field: a proportional slice of a
// settlement's cohorts (a levy: men 15–44 only) with provisions, a home, and at
// most one order. Phase 2 session 1 (Session 14): SETTLERS — raised with a
// muster from several settlements, walking to a destination over months
// (src/sim/pathfinding.ts), eating their provisions, refilling inside the
// borders and foraging outside them, founding a village where they stop or
// disbanding into an own settlement. Work-bands (session 2) and levies
// (session 3) share the entity and the monthly step; their own rules come then.
// Rules here, numbers in data/, no DOM; every change goes through commands.ts.

import unitData from '../../data/units.json';
import type { GameState } from './state';
import { logEvent } from './state';
import type { MapData } from './map';
import { idx, inBounds } from './map';
import { axialDistance, axialRange, axialToOffset, offsetToAxial, type Axial } from './hex';
import { TERRAIN, terrainIndex } from './terrain';
import {
  type Settlement, TIERS, tierIndex, buildingDef, settlementAxial, settlementIdAt, makeSettlement, type FoundOptions, isCastle, isRuin,
} from './settlements';
import { type Population, emptyPopulation, totalPopulation, workingHands, takeSlice, addPopulation, applyHunger, DEMOGRAPHY, BAND_IDS } from './demography';
import { type Materials, emptyMaterials, MATERIAL_IDS, clusterStock, payFromCluster, type Payment, addMaterials } from './materials';
import { clusterMembers } from './clusters';
import { hexJobs, ECONOMY, type Job } from './economy';
import { findRoute, stepsThisMonth, isRiver, OPEN, type Route } from './pathfinding';
import { type BuildOrder, type WorkProject, buildMonth } from './workbands';

// ---- data ----

export interface UnitTypeDef {
  id: string;
  name: string;
  icon: string;
  /** may the player raise it in this build? */
  enabled: boolean;
  /** 'all' = a proportional slice of every cohort; 'men' = men 15–44 only (levies) */
  slice: 'all' | 'men';
  movePoints: number;
  cost: Partial<Materials> & { money?: number };
  defaultSize: number | 'destination';
  defaultProvisions: number | 'calendar';
  canSettle: boolean;
  /** may it build roads and bridges (work-bands)? */
  canBuild?: boolean;
  /** may it fortify the hex it stands on (Session 18, DESIGN §3.5)? Military units only; none yet */
  canFortify?: boolean;
  upkeepPerManPerMonth?: number;
  blurb?: string;
}

type UnitData = {
  types: UnitTypeDef[];
  provisions: { maxMonths: number; harvestMonth: number; afterHarvestMonths: number };
  foraging: { rings: number; share: Record<string, number> };
  staffing: { full: number; drop: number; slope: number };
  muster: { withinHexes: number };
  disband: { withinHexes: number };
  settle: { excludeTerrain: string[]; tier: string };
  naming: { pattern: string };
};
export const UNITS: UnitData = unitData as unknown as UnitData;
export const UNIT_TYPES: readonly UnitTypeDef[] = UNITS.types;

export function unitTypeDef(id: string): UnitTypeDef {
  const d = UNIT_TYPES.find((t) => t.id === id);
  if (!d) throw new Error(`Unknown unit type "${id}"`);
  return d;
}

// ---- the entity ----

/** What a unit is doing: walking to `dest`, and what it does on arrival. */
export interface MoveOrder {
  kind: 'move';
  dest: number;
  then: 'none' | 'settle' | 'disband';
  /** name for the village founded on arrival */
  name?: string;
  /** settlement to disband into on arrival */
  to?: string;
}
export type UnitOrder = MoveOrder | null;

/** Last month's figures for a unit (panels and the headless runner). */
export interface UnitReport {
  moved: number;
  /** food gathered outside the borders / drawn from granaries inside them */
  foraged: number;
  refilled: number;
  consumed: number;
  shortfall: number;
  hungerDeaths: number;
  inBorders: boolean;
  /** months of walking left on the current order, null when idle; Infinity when no route exists */
  monthsLeft: number | null;
  blocked: string | null;
  /** hexes of road / bridge finished this month (work-bands) */
  built?: number;
  /** the hexes the unit stood on this month, in order, for the glide (builders) */
  trail?: number[];
}

export function emptyUnitReport(): UnitReport {
  return { moved: 0, foraged: 0, refilled: 0, consumed: 0, shortfall: 0, hungerDeaths: 0, inBorders: true, monthsLeft: null, blocked: null };
}

export interface Unit {
  id: string;
  type: string;
  name: string;
  faction: string;
  col: number;
  row: number;
  /** river bank the unit stands on (0/1); -1 when not on a river or on an open / bridged river hex */
  bank: number;
  pop: Population;
  /** food carried (1 = one person for one month) */
  provisions: number;
  /** months of provisions the unit keeps topped up to inside the borders */
  provisionMonths: number;
  /** the settlement it was raised at */
  home: string;
  order: UnitOrder;
  /** a work-band's standing order: build a road or bridge along a route (Session 16); exclusive with `order` */
  build?: BuildOrder | null;
  /** the project in hand: item, hex, progress 0–1, whether its materials are paid */
  work?: WorkProject | null;
  raisedTurn: number;
  report: UnitReport;
}

export function unitCell(map: MapData, u: Unit): number {
  return idx(map, u.col, u.row);
}

/** Flat indices of the hexes within `rings` of `cell` that are on the map (centre included). */
export function cellsAround(map: MapData, cell: number, rings: number): number[] {
  const centre = offsetToAxial(cell % map.width, Math.floor(cell / map.width));
  const out: number[] = [];
  for (const h of axialRange(centre, rings)) {
    const o = axialToOffset(h.q, h.r);
    if (inBounds(map, o.col, o.row)) out.push(idx(map, o.col, o.row));
  }
  return out;
}

export function unitAxial(u: Unit): Axial {
  return offsetToAxial(u.col, u.row);
}

export function unitsAt(state: GameState, cell: number): Unit[] {
  const map = state.map;
  return Object.values(state.units).filter((u) => unitCell(map, u) === cell).sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Is the unit still forming (raised this month; it moves from the next end of turn)? */
export function isForming(state: GameState, u: Unit): boolean {
  return u.raisedTurn === state.turn;
}

// ---- sizes and provisions (rules 2 and 4) ----

const RECRUIT = DEMOGRAPHY.recruitBands.map((id) => BAND_IDS.indexOf(id));

/** Share of a population that are working hands (≈ 58 % in the stationary distribution). */
export function handsShare(pop: Population): number {
  const n = totalPopulation(pop);
  return n > 0 ? workingHands(pop) / n : 0.58;
}

/** The best food job of a hex (the one that feeds most), or null. */
export function bestJob(map: MapData, cell: number): Job | null {
  let best: Job | null = null;
  for (const j of hexJobs(map, cell)) if (!best || j.fedPerYear > best.fedPerYear) best = j;
  return best;
}

/**
 * Hands a new village at `cell` needs: its seven hexes' best jobs + the hall +
 * the granary (rule 2). With no destination, seven farm hexes.
 */
export function destinationHands(state: GameState, cell: number | null): number {
  const tier = TIERS[tierIndex(UNITS.settle.tier)];
  let hands = buildingDef(tier.hall).hands + buildingDef(tier.granary).hands;
  const map = state.map;
  const hexes = 1 + 3 * tier.workRings * (tier.workRings + 1); // hexes within the work rings (7 for one ring)
  if (cell === null) return hands + ECONOMY.farming.hands * hexes;
  for (const c of cellsAround(map, cell, tier.workRings)) {
    const j = bestJob(map, c);
    if (j) hands += j.hands;
  }
  return hands;
}

/** The default size of a party of `type` raised at `source` for `dest` (people, rounded to tens). */
export function defaultSize(state: GameState, type: string, source: Settlement, dest: number | null): number {
  const def = unitTypeDef(type);
  if (typeof def.defaultSize === 'number') return def.defaultSize;
  const share = Math.max(0.3, handsShare(source.pop));
  return Math.round(destinationHands(state, dest) / share / 10) * 10;
}

/** Default months of provisions for a unit raised in `month` (0 = January): the settlers' calendar rule or the type's number. */
export function defaultProvisionMonths(type: string, month: number): number {
  const def = unitTypeDef(type);
  const p = UNITS.provisions;
  if (typeof def.defaultProvisions === 'number') return Math.min(p.maxMonths, def.defaultProvisions);
  let until = (p.harvestMonth - month + 12) % 12;
  if (until === 0) until = 12;
  return Math.min(p.maxMonths, until + p.afterHarvestMonths);
}

// ---- raising with a muster (rules 1–3) ----

export interface MusterRow {
  id: string;
  people: number;
}

export interface RaiseSpec {
  type: string;
  /** the raising settlement — the party forms on its hex */
  at: string;
  muster: MusterRow[];
  provisionMonths: number;
  name?: string;
  /** optional destination, walked to from the first month (settlers: then settle) */
  dest?: number | null;
  then?: 'none' | 'settle' | 'disband';
}

/** Settlements a party raised at `id` may draw people from: the cluster's members and own settlements within reach, with their spare hands. */
export function musterSources(state: GameState, id: string): { settlement: Settlement; spareHands: number; distance: number }[] {
  const at = state.settlements[id];
  if (!at) return [];
  const ids = new Set(clusterMembers(state, id));
  const c = settlementAxial(at);
  for (const s of Object.values(state.settlements)) {
    if (s.faction === at.faction && axialDistance(c, settlementAxial(s)) <= UNITS.muster.withinHexes) ids.add(s.id);
  }
  return [...ids].map((sid) => state.settlements[sid]).filter((s) => s && !isCastle(s)).map((s) => ({
    settlement: s,
    spareHands: s.report.idleHands,
    distance: axialDistance(c, settlementAxial(s)),
  })).sort((a, b) => (a.settlement.id === id ? -1 : b.settlement.id === id ? 1 : a.distance - b.distance || (a.settlement.id < b.settlement.id ? -1 : 1)));
}

export interface RaiseCheck {
  ok: boolean;
  reason?: string;
  /** materials the cluster lacks, to be taken from the realm stockpile (zeros when the cluster pays it all) */
  fromRealm?: Materials;
  /** materials neither the cluster nor the realm has */
  lacking?: Materials;
  lackingMoney?: number;
  people: number;
}

export function raiseCheck(state: GameState, spec: RaiseSpec): RaiseCheck {
  const people = spec.muster.reduce((t, m) => t + Math.max(0, m.people), 0);
  const def = UNIT_TYPES.find((t) => t.id === spec.type);
  if (!def) return { ok: false, reason: `unknown unit type ${spec.type}`, people };
  if (!def.enabled) return { ok: false, reason: `${def.name} cannot be raised yet`, people };
  const at = state.settlements[spec.at];
  if (!at) return { ok: false, reason: 'no such settlement', people };
  if (!at.faction) return { ok: false, reason: 'the settlement belongs to no one', people };
  if (people <= 0) return { ok: false, reason: 'nobody was mustered', people };
  const allowed = new Set(musterSources(state, spec.at).map((m) => m.settlement.id));
  for (const m of spec.muster) {
    const s = state.settlements[m.id];
    if (!s) return { ok: false, reason: `no such settlement ${m.id}`, people };
    if (!allowed.has(m.id)) return { ok: false, reason: `${s.name} is too far to muster from`, people };
    const have = def.slice === 'men' ? recruitableMenOf(s.pop) : totalPopulation(s.pop);
    if (m.people > have + 1e-9) return { ok: false, reason: `${s.name} has only ${Math.floor(have)} ${def.slice === 'men' ? 'men to call' : 'people'}`, people };
  }
  if (spec.provisionMonths < 0 || spec.provisionMonths > UNITS.provisions.maxMonths) return { ok: false, reason: `provisions must be 0–${UNITS.provisions.maxMonths} months`, people };
  const f = state.factions[at.faction];
  const money = def.cost.money ?? 0;
  if (f && f.treasury + 1e-9 < money) return { ok: false, reason: `the treasury lacks ${Math.ceil(money - f.treasury)} coins`, lackingMoney: money - f.treasury, people };
  const pool = clusterStock(state, spec.at);
  const fromRealm = emptyMaterials(), lacking = emptyMaterials();
  let short = false;
  for (const k of MATERIAL_IDS) {
    const want = def.cost[k] ?? 0;
    const gap = Math.max(0, want - pool[k]);
    if (gap > 1e-9) {
      const realm = f ? f.stock[k] : 0;
      fromRealm[k] = Math.min(gap, realm);
      if (gap > realm + 1e-9) { lacking[k] = gap - realm; short = true; }
    }
  }
  if (short) return { ok: false, reason: `short of ${MATERIAL_IDS.filter((k) => lacking[k] > 0).map((k) => `${Math.ceil(lacking[k])} ${k}`).join(', ')}`, fromRealm, lacking, people };
  return { ok: true, fromRealm, people };
}

function recruitableMenOf(pop: Population): number {
  let t = 0;
  for (const b of RECRUIT) t += pop.m[b];
  return t;
}

/** Remove `n` men 15–44 from a population, proportionally across the recruit bands (levies — rule 1). */
export function takeMen(pop: Population, n: number): Population {
  const out = emptyPopulation();
  const have = recruitableMenOf(pop);
  if (have <= 0 || n <= 0) return out;
  const f = Math.min(1, n / have);
  for (const b of RECRUIT) { out.m[b] = pop.m[b] * f; pop.m[b] -= out.m[b]; }
  return out;
}

/** Who gave what to a party, so a cancelled raise can give it back exactly. */
export interface MusterTaken {
  id: string;
  pop: Population;
  food: number;
}

export interface RaiseResult {
  unit: Unit;
  taken: MusterTaken[];
  paid: Payment[];
  fromRealm: Materials;
  paidMoney: number;
}

/**
 * Raise a party (rule 3): the people and their provisions leave their
 * settlements at once; the unit stands on the raising settlement's hex and
 * acts from the next end of turn. Materials come from the cluster, the rest
 * from the realm stockpile; coins from the treasury. Throws when it cannot be done.
 */
export function raiseUnit(state: GameState, spec: RaiseSpec): RaiseResult {
  const check = raiseCheck(state, spec);
  if (!check.ok) throw new Error(`Cannot raise ${spec.type}: ${check.reason}`);
  const def = unitTypeDef(spec.type);
  const at = state.settlements[spec.at];
  const f = state.factions[at.faction!];
  const pop = emptyPopulation();
  const taken: MusterTaken[] = [];
  let food = 0;
  for (const m of spec.muster) {
    if (m.people <= 0) continue;
    const s = state.settlements[m.id];
    const total = totalPopulation(s.pop);
    const slice = def.slice === 'men' ? takeMen(s.pop, m.people) : takeSlice(s.pop, total > 0 ? m.people / total : 0);
    const want = m.people * spec.provisionMonths;
    const take = Math.min(s.food, want);
    s.food -= take;
    food += take;
    addPopulation(pop, slice);
    taken.push({ id: m.id, pop: slice, food: take });
  }
  // materials: the cluster first, then the realm stockpile (instant — PLACEHOLDER until roads and caravans)
  const pool = clusterStock(state, spec.at);
  const fromCluster: Partial<Materials> = {};
  const fromRealm = emptyMaterials();
  for (const k of MATERIAL_IDS) {
    const want = def.cost[k] ?? 0;
    fromCluster[k] = Math.min(want, pool[k]);
    fromRealm[k] = Math.max(0, want - pool[k]);
  }
  const paid = payFromCluster(state, at, fromCluster);
  if (f) for (const k of MATERIAL_IDS) f.stock[k] -= fromRealm[k];
  const money = def.cost.money ?? 0;
  if (f && money) { f.treasury -= money; f.year.spent += money; }
  const id = `u${state.nextId++}`;
  const unit: Unit = {
    id, type: spec.type, name: spec.name ?? `${def.name} of ${at.name}`, faction: at.faction!,
    col: at.col, row: at.row, bank: OPEN, pop, provisions: food, provisionMonths: spec.provisionMonths,
    home: at.id, order: null, build: null, work: null, raisedTurn: state.turn, report: emptyUnitReport(),
  };
  if (spec.dest !== undefined && spec.dest !== null && spec.dest !== unitCell(state.map, unit)) {
    unit.order = { kind: 'move', dest: spec.dest, then: spec.then ?? (def.canSettle ? 'settle' : 'none') };
  } else if (spec.dest !== undefined && spec.dest !== null && (spec.then ?? 'none') !== 'none') {
    unit.order = { kind: 'move', dest: spec.dest, then: spec.then ?? 'none' };
  }
  state.units[id] = unit;
  const realmNote = MATERIAL_IDS.some((k) => fromRealm[k] > 1e-9) ? ` (${MATERIAL_IDS.filter((k) => fromRealm[k] > 1e-9).map((k) => `${Math.ceil(fromRealm[k])} ${k}`).join(', ')} came from the realm stockpile)` : '';
  logEvent(state, 'raised', `${at.name} raised ${unit.name}: ${Math.round(totalPopulation(pop))} people with ${spec.provisionMonths} months of food${realmNote}.`);
  return { unit, taken, paid, fromRealm, paidMoney: money };
}

/** Undo a raise made this turn: everyone and everything goes back. */
export function cancelRaise(state: GameState, r: { unitId: string; taken: MusterTaken[]; paid: Payment[]; fromRealm: Materials; paidMoney: number }): void {
  const u = state.units[r.unitId];
  if (!u) throw new Error(`No unit "${r.unitId}"`);
  if (!isForming(state, u)) throw new Error(`${u.name} has already formed`);
  for (const t of r.taken) {
    const s = state.settlements[t.id] ?? state.settlements[u.home];
    if (!s) continue;
    addPopulation(s.pop, t.pop);
    s.food += t.food;
  }
  for (const p of r.paid) { const s = state.settlements[p.id] ?? state.settlements[u.home]; if (s) addMaterials(s.stock, p.amount); }
  const f = state.factions[u.faction];
  if (f) { addMaterials(f.stock, r.fromRealm); f.treasury += r.paidMoney; f.year.spent -= r.paidMoney; }
  delete state.units[r.unitId];
}

// ---- orders: move, settle, disband (rules 5–7, 11) ----

/** The route a unit would take to `dest`, or null. */
export function routeFor(state: GameState, u: Unit, dest: number): Route | null {
  return findRoute(state, { cell: unitCell(state.map, u), bank: u.bank }, dest, unitTypeDef(u.type).movePoints, u.faction);
}

export interface SettleCheck { ok: boolean; reason?: string }

const EXCLUDED_SETTLE = new Set(UNITS.settle.excludeTerrain.map(terrainIndex));

/** May a settlement be founded on `cell` (rule 6)? Land, not excluded terrain, no settlement there, outside every other settlement's work zone. */
export function canFoundAt(state: GameState, cell: number): SettleCheck {
  const map = state.map;
  if (cell < 0 || cell >= map.terrain.length) return { ok: false, reason: 'off the map' };
  const ti = map.terrain[cell];
  const t = TERRAIN[ti];
  if (!t.passable || EXCLUDED_SETTLE.has(ti)) return { ok: false, reason: `cannot settle on ${t.name.toLowerCase()}` };
  const col = cell % map.width, row = Math.floor(cell / map.width);
  if (settlementIdAt(state, col, row)) return { ok: false, reason: 'a settlement already stands here' };
  const here = offsetToAxial(col, row);
  for (const s of Object.values(state.settlements)) {
    if (axialDistance(here, settlementAxial(s)) <= TIERS[s.tier].workRings) return { ok: false, reason: `inside the lands of ${s.name}` };
  }
  return { ok: true };
}

export function canSettle(state: GameState, u: Unit): SettleCheck {
  const def = unitTypeDef(u.type);
  if (!def.canSettle) return { ok: false, reason: `${def.name} cannot found a settlement` };
  if (isForming(state, u)) return { ok: false, reason: 'the party is still forming' };
  if (totalPopulation(u.pop) < 1) return { ok: false, reason: 'nobody is left' };
  return canFoundAt(state, unitCell(state.map, u));
}

/** A name for the village a unit founds: the data pattern on its home's name, numbered when taken (PLACEHOLDER — DESIGN §4.10 naming). */
export function villageName(state: GameState, u: Unit, wanted?: string): string {
  if (wanted && wanted.trim()) return wanted.trim();
  const home = state.settlements[u.home]?.name ?? u.name.replace(/^.* of /, '');
  const base = UNITS.naming.pattern.replace('{home}', home);
  const names = new Set(Object.values(state.settlements).map((s) => s.name));
  if (!names.has(base)) return base;
  const roman = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  for (const r of roman) if (!names.has(`${base} ${r}`)) return `${base} ${r}`;
  let n = 11;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** The settlers become a village on their hex (rule 6): their people its cohorts, their provisions its granary. Removes the unit. */
export function settleUnit(state: GameState, u: Unit, name?: string): Settlement {
  const check = canSettle(state, u);
  if (!check.ok) throw new Error(`${u.name} cannot settle here: ${check.reason}`);
  const opts: FoundOptions = { name: villageName(state, u, name), tier: UNITS.settle.tier, col: u.col, row: u.row, faction: u.faction, population: totalPopulation(u.pop), pop: u.pop, food: u.provisions };
  const s = makeSettlement(state, opts);
  state.settlements[s.id] = s;
  delete state.units[u.id];
  logEvent(state, 'founded', `${u.name} founded ${s.name} with ${Math.round(totalPopulation(s.pop))} people.`);
  return s;
}

export interface DisbandCheck { ok: boolean; reason?: string; target?: Settlement; distance?: number }

/**
 * Where a unit may disband (rules 7 and 11): the closest own settlement within
 * reach that is not starving — the least starving if all are. None in reach →
 * refused.
 */
export function disbandTarget(state: GameState, u: Unit): DisbandCheck {
  if (isForming(state, u)) return { ok: false, reason: 'the party is still forming' };
  const here = unitAxial(u);
  const reach = UNITS.disband.withinHexes;
  const cands = Object.values(state.settlements)
    .filter((s) => s.faction === u.faction)
    .map((s) => ({ s, d: axialDistance(here, settlementAxial(s)), starving: s.report.shortfall > 0 ? s.report.shortfall : 0 }))
    .filter((c) => c.d <= reach);
  if (cands.length === 0) return { ok: false, reason: `no own settlement within ${reach} hexes` };
  cands.sort((a, b) => (a.starving > 0 ? 1 : 0) - (b.starving > 0 ? 1 : 0) || a.d - b.d || a.starving - b.starving || (a.s.id < b.s.id ? -1 : 1));
  return { ok: true, target: cands[0].s, distance: cands[0].d };
}

/** The people rejoin `target`'s cohorts and their provisions its granary. Removes the unit. */
export function disbandInto(state: GameState, u: Unit, target: Settlement): void {
  addPopulation(target.pop, u.pop);
  target.food += u.provisions;
  target.report.migrantsIn += totalPopulation(u.pop);
  delete state.units[u.id];
  logEvent(state, 'disbanded', `${u.name} disbanded into ${target.name} (${Math.round(totalPopulation(u.pop))} people).`);
}

// ---- the monthly step (rules 4 and 5) ----

/** The own settlement whose influence covers `cell` (the nearest when several), or null outside the borders. */
export function coveringSettlement(state: GameState, faction: string, cell: number): Settlement | null {
  const map = state.map;
  const here = offsetToAxial(cell % map.width, Math.floor(cell / map.width));
  let best: Settlement | null = null, bestD = Infinity, bestRank = -1;
  for (const s of Object.values(state.settlements)) {
    if (s.faction !== faction || isRuin(s)) continue;
    const d = axialDistance(here, settlementAxial(s));
    if (d > TIERS[s.tier].influenceRings) continue;
    const rank = TIERS[s.tier].rank;
    if (d < bestD || (d === bestD && rank > bestRank) || (d === bestD && rank === bestRank && best && s.id < best.id)) { best = s; bestD = d; bestRank = rank; }
  }
  return best;
}

/**
 * Food a unit forages this month from its hex and ring 1 with its own hands
 * (rule 4): the hexes' food jobs, best yield per hand first, each kind at the
 * data share of its yield, a twelfth a month.
 */
export function forage(state: GameState, u: Unit): number {
  const map = state.map;
  const hands0 = workingHands(u.pop);
  if (hands0 <= 0) return 0;
  const shares = UNITS.foraging.share;
  const jobs: Job[] = [];
  for (const cell of cellsAround(map, unitCell(map, u), UNITS.foraging.rings)) {
    for (const j of hexJobs(map, cell)) {
      const sh = shares[j.kind] ?? 0;
      if (sh > 0) jobs.push({ ...j, fedPerYear: j.fedPerYear * sh });
    }
  }
  jobs.sort((a, b) => b.fedPerYear / b.hands - a.fedPerYear / a.hands || a.cell - b.cell);
  let hands = hands0, food = 0;
  for (const j of jobs) {
    if (hands <= 0) break;
    const got = Math.min(hands, j.hands);
    hands -= got;
    food += (j.fedPerYear * (got / j.hands)) / 12;
  }
  return food;
}

/** Walk the unit along `route` for one month; returns the steps taken. */
function walk(state: GameState, u: Unit, route: Route): number {
  const map = state.map;
  const { steps } = stepsThisMonth(state, unitCell(map, u), route.nodes, unitTypeDef(u.type).movePoints);
  if (steps > 0) {
    const n = route.nodes[steps - 1];
    u.col = n.cell % map.width; u.row = Math.floor(n.cell / map.width);
    u.bank = n.bank;
    // a unit that left a bridged / open river hex onto a banked one keeps the bank the path gave it; anywhere else -1
    if (!isRiver(map, n.cell)) u.bank = OPEN;
  }
  return steps;
}

/** One month for every unit, in id order: movement and arrival orders, then provisions, foraging and hunger. */
export function unitsMonth(state: GameState, month: number): void {
  const map = state.map;
  const ids = Object.keys(state.units).sort();
  for (const id of ids) {
    const u = state.units[id];
    if (!u) continue;
    const r = emptyUnitReport();
    const forming = isForming(state, u);
    // 1. movement — or a work-band's building (Session 16)
    if (u.build && !forming) {
      buildMonth(state, u, r);
    } else if (u.order && !forming) {
      const here = unitCell(map, u);
      if (here !== u.order.dest) {
        const route = routeFor(state, u, u.order.dest);
        if (!route || route.nodes.length === 0 || !Number.isFinite(route.months)) {
          r.blocked = 'no route';
          r.monthsLeft = Infinity;
          if (!u.report.blocked) logEvent(state, 'blocked', `${u.name} cannot find a way to its destination and waits.`);
        } else {
          r.moved = walk(state, u, route);
          const rest = routeFor(state, u, u.order.dest);
          r.monthsLeft = rest ? rest.months : Infinity;
        }
      }
      if (unitCell(map, u) === u.order.dest) {
        r.monthsLeft = 0;
        const then = u.order.then;
        if (then === 'settle') {
          const check = canSettle(state, u);
          if (check.ok) { settleUnit(state, u, u.order.name); continue; }
          r.blocked = check.reason ?? 'cannot settle';
          logEvent(state, 'blocked', `${u.name} arrived but cannot settle: ${r.blocked}.`);
          u.order = null;
        } else if (then === 'disband') {
          const t = u.order.to ? state.settlements[u.order.to] : undefined;
          if (t && t.col === u.col && t.row === u.row && t.faction === u.faction) { disbandInto(state, u, t); continue; }
          const d = disbandTarget(state, u);
          if (d.ok && d.target && d.target.col === u.col && d.target.row === u.row) { disbandInto(state, u, d.target); continue; }
          r.blocked = 'cannot disband here';
          u.order = null;
        } else u.order = null;
      }
    } else if (u.order && forming) {
      const route = routeFor(state, u, u.order.dest);
      r.monthsLeft = route ? route.months : Infinity;
    }
    // 2. provisions: refill inside the borders, forage outside; eat; hunger when the bags are empty
    const people = totalPopulation(u.pop);
    const need = people; // 1 food per person per month (data/economy.json foodPerPersonPerMonth)
    const cell = unitCell(map, u);
    const owner = coveringSettlement(state, u.faction, cell);
    r.inBorders = owner !== null;
    const cap = people * UNITS.provisions.maxMonths;
    if (owner) {
      // eat from the cluster's granaries and top the bags up to the chosen months (owner first, then its cluster)
      const target = Math.min(cap, people * u.provisionMonths);
      let want = need + Math.max(0, target - u.provisions);
      const order = [owner.id, ...clusterMembers(state, owner.id).filter((m) => m !== owner.id)];
      let got = 0;
      for (const mid of order) {
        if (want <= 1e-9) break;
        const s = state.settlements[mid];
        if (!s || isCastle(s)) continue; // a castle's reserve is for its garrison and a siege (DESIGN §3.5)
        const take = Math.min(s.food, want);
        s.food -= take; want -= take; got += take;
      }
      u.provisions += got;
      r.refilled = Math.max(0, got - need);
      r.foraged = got;
    } else {
      r.foraged = forage(state, u);
      u.provisions = Math.min(cap, u.provisions + r.foraged);
    }
    if (need > 0) {
      if (u.provisions >= need) { u.provisions -= need; r.consumed = need; }
      else {
        r.consumed = u.provisions;
        r.shortfall = (need - u.provisions) / need;
        u.provisions = 0;
        r.hungerDeaths = applyHunger(u.pop, r.shortfall);
        if (r.hungerDeaths > 0.5) logEvent(state, 'hunger', `${u.name} is starving in the field: ${Math.round(r.hungerDeaths)} died.`);
      }
    }
    u.report = r;
    if (totalPopulation(u.pop) < 1) {
      delete state.units[u.id];
      logEvent(state, 'lost', `${u.name} perished in the field.`);
    }
  }
}
