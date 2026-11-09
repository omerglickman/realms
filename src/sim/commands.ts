// Command layer (ROADMAP B.3 rule 3). Every change to the game state is a
// plain-data command applied through `applyCommand`, which returns the inverse
// command so the UI can undo. The AI will issue the same commands as the player.
//
// Phase 0: map-editing commands. Phase 1: founding and removing settlements;
// Session 11: queueing and cancelling buildings, moving materials.

import type { GameState } from './state';
import { logEvent } from './state';
import type { MapData } from './map';
import { inBounds, idx, neighborsOffset, cloneMap } from './map';
import { axialRange, offsetToAxial, axialToOffset } from './hex';
import { makeSettlement, settlementIdAt, buildingDef, canOverrideParent, resolveAllParents, type FoundOptions, type Settlement, type BuildProject, type UpgradeProject } from './settlements';
import { startUpgrade, revertTier, completeUpgrade } from './upgrades';
import { totalPopulation, createPopulation, type Population } from './demography';
import { canBuild, moneyCost } from './buildings';
import { payFromCluster, refund, addMaterials, MATERIAL_IDS, type Materials } from './materials';
import {
  type Unit, type UnitOrder, type RaiseSpec, type MusterTaken, raiseUnit, cancelRaise, routeFor, unitTypeDef, settleUnit, canSettle,
  disbandTarget, disbandInto, unitCell,
} from './units';
import { type BuildOrder, checkBuildOrder } from './workbands';
import { infraCellAt, type InfraCell } from './infrastructure';
import type { Payment } from './materials';
import { addPopulation } from './demography';
import { clusterRootOf } from './clusters';
import { fortify, unfortify } from './forts';
import { idx as cellIndex } from './map';

export interface CellEdit {
  /** flat index = row * width + col */
  i: number;
  /** terrain index to set */
  t: number;
}

export interface SetTerrainCommand {
  type: 'setTerrain';
  cells: CellEdit[];
}

export interface SetResourceCommand {
  type: 'setResource';
  /** t = resource index, -1 = none */
  cells: CellEdit[];
}

export interface ReplaceMapCommand {
  type: 'replaceMap';
  map: MapData;
}

export interface FoundSettlementCommand {
  type: 'foundSettlement';
  settlement: FoundOptions;
}

export interface RemoveSettlementCommand {
  type: 'removeSettlement';
  id: string;
}

/** Inverse of removeSettlement: put a settlement object back exactly as it was. */
export interface RestoreSettlementCommand {
  type: 'restoreSettlement';
  settlement: Settlement;
}

/** Rename a settlement (its own inverse). */
export interface RenameSettlementCommand {
  type: 'renameSettlement';
  id: string;
  name: string;
}

/**
 * Edit a placed settlement (editor): name and/or population. A new population
 * keeps the age/sex structure (every cohort is scaled) and keeps the granary at
 * the same number of months. The inverse carries the exact previous cohorts.
 */
export interface EditSettlementCommand {
  type: 'editSettlement';
  id: string;
  name?: string;
  population?: number;
  /** exact cohorts to restore (used by inverses) */
  pop?: Population;
  food?: number;
}

/** Start building (DESIGN §3.3, Session 11): pays the cost from the cluster stockpile at once. Inverse: cancelBuilding. */
export interface QueueBuildingCommand {
  type: 'queueBuilding';
  id: string;
  building: string;
}

/** Cancel the running project and refund what was paid. Inverse: restoreProject. */
export interface CancelBuildingCommand {
  type: 'cancelBuilding';
  id: string;
}

/** Inverse of cancelBuilding: put a project back exactly as it was, taking the refund back. */
export interface RestoreProjectCommand {
  type: 'restoreProject';
  id: string;
  project: BuildProject;
}

/**
 * Move materials between the faction stockpile and a settlement (DESIGN §4.2;
 * instant — PLACEHOLDER until roads and caravans). `from`/`to` are a settlement id
 * or `faction:<id>`. Its own inverse with from/to swapped. Amounts are capped at
 * what the source holds; the inverse carries what actually moved.
 */
export interface TransferMaterialsCommand {
  type: 'transferMaterials';
  from: string;
  to: string;
  amount: Partial<Materials>;
}

// ---- units (Phase 2, DESIGN §3.2b, Session 14) ----

/** Raise a party at a settlement with a muster (rule 3). Inverse: cancelRaise (only while the party is still forming). */
export interface RaiseUnitCommand {
  type: 'raiseUnit';
  spec: RaiseSpec;
}

export interface CancelRaiseCommand {
  type: 'cancelRaise';
  unitId: string;
  spec: RaiseSpec;
  taken: MusterTaken[];
  paid: Payment[];
  fromRealm: Materials;
  paidMoney: number;
}

/** Give a unit an order (a destination and what to do on arrival) or clear it. Inverse: the previous order. */
export interface OrderUnitCommand {
  type: 'orderUnit';
  id: string;
  order: UnitOrder;
  /** a work-band's building order (Session 16); giving either order clears the other, and `order: null` with no `build` clears both */
  build?: BuildOrder | null;
}

/** Settlers found a village where they stand (rule 6). Inverse: unsettle. */
export interface SettleUnitCommand {
  type: 'settleUnit';
  id: string;
  name?: string;
}

export interface UnsettleCommand {
  type: 'unsettle';
  settlementId: string;
  unit: Unit;
}

/**
 * Disband a unit (rules 7, 11): into the own settlement on its hex at once, or
 * — when the nearest fit is within reach — as a move order there. Inverse:
 * undisband (people back out) or the previous order.
 */
export interface DisbandUnitCommand {
  type: 'disbandUnit';
  id: string;
}

/**
 * A unit that can fortify raises a fort on the hex it stands on (DESIGN §3.5).
 * Instant — PLACEHOLDER. Inverse: unfortify (exact refund).
 */
export interface FortifyCommand {
  type: 'fortify';
  unitId: string;
}

export interface UnfortifyCommand {
  type: 'unfortify';
  unitId: string;
  fortId: string;
  faction: string;
  paid: Payment[];
  fromRealm: number;
  fallbackId: string | null;
}

export interface UndisbandCommand {
  type: 'undisband';
  unit: Unit;
  into: string;
}

/**
 * Send food between two members of one cluster by hand (rule 6, DECIDED 2026-11-07;
 * never automatic). Instant — PLACEHOLDER until roads and caravans. Capped at
 * what the source holds; its own inverse with from/to swapped.
 */
export interface SendFoodCommand {
  type: 'sendFood';
  from: string;
  to: string;
  amount: number;
}

/** Start a tier upgrade (DESIGN §3.2b rule 10, Session 15b): pays at once. Inverse: cancelUpgrade. */
export interface UpgradeSettlementCommand {
  type: 'upgradeSettlement';
  id: string;
}

/** Cancel a running upgrade with a full refund. Inverse: restoreUpgrade. */
export interface CancelUpgradeCommand {
  type: 'cancelUpgrade';
  id: string;
}

export interface RestoreUpgradeCommand {
  type: 'restoreUpgrade';
  id: string;
  project: UpgradeProject;
}

/** Editor / debug: finish a running upgrade now. Inverse: revertUpgrade. */
export interface FinishUpgradeCommand {
  type: 'finishUpgrade';
  id: string;
}

export interface RevertUpgradeCommand {
  type: 'revertUpgrade';
  id: string;
  fromTier: number;
  project: UpgradeProject;
  parentOverride: string | null;
}

/**
 * Set explicit parents (DESIGN §3.3, Omer 2026-11-07): "make X the leader" of a
 * cluster puts every other top-tier member under X and frees X; "split off X"
 * clears X's override so it heads a cluster of its own. Self-inverse with the
 * previous values.
 */
export interface SetParentsCommand {
  type: 'setParents';
  changes: { id: string; parent: string | null }[];
}

/** Set the infrastructure of some hexes to absolute values (the editor's Infrastructure tab); the inverse restores the previous values. */
export interface SetInfraCommand {
  type: 'setInfra';
  cells: InfraCell[];
}

export type Command =
  | SetInfraCommand
  | SetParentsCommand
  | UpgradeSettlementCommand
  | CancelUpgradeCommand
  | RestoreUpgradeCommand
  | FinishUpgradeCommand
  | RevertUpgradeCommand
  | RaiseUnitCommand
  | CancelRaiseCommand
  | OrderUnitCommand
  | SettleUnitCommand
  | UnsettleCommand
  | DisbandUnitCommand
  | UndisbandCommand
  | FortifyCommand
  | UnfortifyCommand
  | SendFoodCommand
  | QueueBuildingCommand
  | CancelBuildingCommand
  | RestoreProjectCommand
  | TransferMaterialsCommand
  | SetTerrainCommand
  | SetResourceCommand
  | ReplaceMapCommand
  | FoundSettlementCommand
  | RemoveSettlementCommand
  | RestoreSettlementCommand
  | RenameSettlementCommand
  | EditSettlementCommand;

/** Apply a command, mutating the state, and return the inverse command. */
export function applyCommand(state: GameState, cmd: Command): Command {
  switch (cmd.type) {
    case 'setTerrain': {
      const map = state.map;
      const inverse: CellEdit[] = [];
      for (const c of cmd.cells) {
        if (c.i < 0 || c.i >= map.terrain.length) continue;
        const prev = map.terrain[c.i];
        if (prev === c.t) continue;
        inverse.push({ i: c.i, t: prev });
        map.terrain[c.i] = c.t;
      }
      return { type: 'setTerrain', cells: inverse };
    }
    case 'setResource': {
      const map = state.map;
      const inverse: CellEdit[] = [];
      for (const c of cmd.cells) {
        if (c.i < 0 || c.i >= map.resource.length) continue;
        const prev = map.resource[c.i];
        if (prev === c.t) continue;
        inverse.push({ i: c.i, t: prev });
        map.resource[c.i] = c.t;
      }
      return { type: 'setResource', cells: inverse };
    }
    case 'setInfra': {
      const inf = state.infra;
      const inverse: InfraCell[] = [];
      for (const c of cmd.cells) {
        const prev = infraCellAt(state, c.i);
        if (prev.road === c.road && prev.bridge === c.bridge && prev.site === c.site) continue;
        inverse.push(prev);
        if (c.road > 0) inf.roads[c.i] = c.road; else delete inf.roads[c.i];
        if (c.bridge) inf.bridges[c.i] = true; else delete inf.bridges[c.i];
        if (c.site) inf.sites[c.i] = c.site; else delete inf.sites[c.i];
      }
      return { type: 'setInfra', cells: inverse };
    }
    case 'replaceMap': {
      const prev = state.map;
      state.map = cloneMap(cmd.map);
      return { type: 'replaceMap', map: prev };
    }
    case 'foundSettlement': {
      const o = cmd.settlement;
      if (settlementIdAt(state, o.col, o.row)) throw new Error(`A settlement already stands at ${o.col},${o.row}`);
      const s = makeSettlement(state, o);
      state.settlements[s.id] = s;
      return { type: 'removeSettlement', id: s.id };
    }
    case 'removeSettlement': {
      const s = state.settlements[cmd.id];
      if (!s) throw new Error(`No settlement "${cmd.id}"`);
      delete state.settlements[cmd.id];
      return { type: 'restoreSettlement', settlement: s };
    }
    case 'restoreSettlement': {
      state.settlements[cmd.settlement.id] = cmd.settlement;
      return { type: 'removeSettlement', id: cmd.settlement.id };
    }
    case 'renameSettlement': {
      const s = state.settlements[cmd.id];
      if (!s) throw new Error(`No settlement "${cmd.id}"`);
      const prev = s.name;
      s.name = cmd.name;
      return { type: 'renameSettlement', id: cmd.id, name: prev };
    }
    case 'editSettlement': {
      const s = state.settlements[cmd.id];
      if (!s) throw new Error(`No settlement "${cmd.id}"`);
      const inverse: EditSettlementCommand = { type: 'editSettlement', id: cmd.id };
      if (cmd.name !== undefined) { inverse.name = s.name; s.name = cmd.name; }
      if (cmd.pop) {
        inverse.pop = s.pop; inverse.food = s.food;
        s.pop = { m: cmd.pop.m.slice(), f: cmd.pop.f.slice() };
        if (cmd.food !== undefined) s.food = cmd.food;
      } else if (cmd.population !== undefined) {
        const before = totalPopulation(s.pop);
        inverse.pop = s.pop; inverse.food = s.food;
        const target = Math.max(0, cmd.population);
        const k = before > 0 ? target / before : 0;
        s.pop = before > 0 ? { m: s.pop.m.map((x) => x * k), f: s.pop.f.map((x) => x * k) } : createPopulation(target);
        s.food = before > 0 ? s.food * k : target * 12;
      }
      return inverse;
    }
    case 'queueBuilding': {
      const s = state.settlements[cmd.id];
      if (!s) throw new Error(`No settlement "${cmd.id}"`);
      const check = canBuild(state, s, cmd.building);
      if (!check.ok) throw new Error(`${s.name} cannot build ${buildingDef(cmd.building).name}: ${check.reason}`);
      const def = buildingDef(cmd.building);
      const paid = payFromCluster(state, s, def.cost ?? {});
      const money = payMoney(state, s, moneyCost(def));
      s.build = { building: cmd.building, progress: 0, paid, paidMoney: money, startedTurn: state.turn };
      return { type: 'cancelBuilding', id: cmd.id };
    }
    case 'cancelBuilding': {
      const s = state.settlements[cmd.id];
      if (!s) throw new Error(`No settlement "${cmd.id}"`);
      if (!s.build) throw new Error(`${s.name} is not building anything`);
      const project = s.build;
      refund(state, project.paid, s.id);
      payMoney(state, s, -(project.paidMoney ?? 0));
      s.build = null;
      return { type: 'restoreProject', id: cmd.id, project };
    }
    case 'restoreProject': {
      const s = state.settlements[cmd.id];
      if (!s) throw new Error(`No settlement "${cmd.id}"`);
      // take the refund back from whoever got it (stocks may go slightly negative if spent since; clamp)
      for (const p of cmd.project.paid) {
        const m = state.settlements[p.id] ?? s;
        addMaterials(m.stock, p.amount, -1);
        for (const k of MATERIAL_IDS) if (m.stock[k] < 0) m.stock[k] = 0;
      }
      payMoney(state, s, cmd.project.paidMoney ?? 0);
      s.build = cmd.project;
      return { type: 'cancelBuilding', id: cmd.id };
    }
    case 'upgradeSettlement': {
      const s = state.settlements[cmd.id];
      if (!s) throw new Error(`No settlement "${cmd.id}"`);
      startUpgrade(state, s);
      return { type: 'cancelUpgrade', id: cmd.id };
    }
    case 'cancelUpgrade': {
      const s = state.settlements[cmd.id];
      if (!s) throw new Error(`No settlement "${cmd.id}"`);
      if (!s.upgrade) throw new Error(`${s.name} is not being upgraded`);
      const project = s.upgrade;
      refund(state, project.paid, s.id);
      payMoney(state, s, -project.paidMoney);
      s.upgrade = null;
      return { type: 'restoreUpgrade', id: cmd.id, project };
    }
    case 'restoreUpgrade': {
      const s = state.settlements[cmd.id];
      if (!s) throw new Error(`No settlement "${cmd.id}"`);
      for (const p of cmd.project.paid) {
        const m = state.settlements[p.id] ?? s;
        addMaterials(m.stock, p.amount, -1);
        for (const k of MATERIAL_IDS) if (m.stock[k] < 0) m.stock[k] = 0;
      }
      payMoney(state, s, cmd.project.paidMoney);
      s.upgrade = cmd.project;
      return { type: 'cancelUpgrade', id: cmd.id };
    }
    case 'finishUpgrade': {
      const s = state.settlements[cmd.id];
      if (!s) throw new Error(`No settlement "${cmd.id}"`);
      if (!s.upgrade) throw new Error(`${s.name} is not being upgraded`);
      const fromTier = s.tier, project = { ...s.upgrade }, parentOverride = s.parentOverride;
      completeUpgrade(state, s);
      resolveAllParents(state);
      return { type: 'revertUpgrade', id: cmd.id, fromTier, project, parentOverride };
    }
    case 'revertUpgrade': {
      const s = state.settlements[cmd.id];
      if (!s) throw new Error(`No settlement "${cmd.id}"`);
      revertTier(s, cmd.fromTier, cmd.project, cmd.parentOverride);
      resolveAllParents(state);
      return { type: 'finishUpgrade', id: cmd.id };
    }
    case 'setParents': {
      const before: { id: string; parent: string | null }[] = [];
      for (const ch of cmd.changes) {
        const s = state.settlements[ch.id];
        if (!s) throw new Error(`No settlement "${ch.id}"`);
        if (ch.parent !== null && !canOverrideParent(state, s, ch.parent)) throw new Error(`${state.settlements[ch.parent]?.name ?? ch.parent} cannot lead ${s.name}`);
        before.push({ id: s.id, parent: s.parentOverride });
        s.parentOverride = ch.parent;
      }
      resolveAllParents(state);
      return { type: 'setParents', changes: before };
    }
    case 'transferMaterials': {
      const src = stockOf(state, cmd.from), dst = stockOf(state, cmd.to);
      const moved: Partial<Materials> = {};
      for (const k of MATERIAL_IDS) {
        const x = Math.max(0, Math.min(cmd.amount[k] ?? 0, src[k]));
        if (x > 0) { src[k] -= x; dst[k] += x; moved[k] = x; }
      }
      return { type: 'transferMaterials', from: cmd.to, to: cmd.from, amount: moved };
    }
    case 'raiseUnit': {
      const r = raiseUnit(state, cmd.spec);
      return { type: 'cancelRaise', unitId: r.unit.id, spec: cmd.spec, taken: r.taken, paid: r.paid, fromRealm: r.fromRealm, paidMoney: r.paidMoney };
    }
    case 'cancelRaise': {
      cancelRaise(state, cmd);
      return { type: 'raiseUnit', spec: cmd.spec };
    }
    case 'orderUnit': {
      const u = state.units[cmd.id];
      if (!u) throw new Error(`No unit "${cmd.id}"`);
      const prev = u.order, prevBuild = u.build ?? null;
      if (cmd.build) {
        const chk = checkBuildOrder(state, u, cmd.build);
        if (!chk.ok) throw new Error(`${u.name} cannot build: ${chk.reason}`);
      }
      if (cmd.order) {
        const o = cmd.order;
        if (o.then === 'settle' && !unitTypeDef(u.type).canSettle) throw new Error(`${u.name} cannot found a settlement`);
        if (o.dest !== unitCell(state.map, u)) {
          const route = routeFor(state, u, o.dest);
          if (!route || !Number.isFinite(route.months)) throw new Error(`${u.name} has no way to get there`);
        }
      }
      u.order = cmd.order;
      u.build = cmd.build ?? null;
      return { type: 'orderUnit', id: cmd.id, order: prev, build: prevBuild };
    }
    case 'settleUnit': {
      const u = state.units[cmd.id];
      if (!u) throw new Error(`No unit "${cmd.id}"`);
      const snapshot: Unit = JSON.parse(JSON.stringify(u));
      const s = settleUnit(state, u, cmd.name);
      return { type: 'unsettle', settlementId: s.id, unit: snapshot };
    }
    case 'unsettle': {
      const s = state.settlements[cmd.settlementId];
      if (!s) throw new Error(`No settlement "${cmd.settlementId}"`);
      delete state.settlements[cmd.settlementId];
      state.units[cmd.unit.id] = cmd.unit;
      return { type: 'settleUnit', id: cmd.unit.id, name: s.name };
    }
    case 'disbandUnit': {
      const u = state.units[cmd.id];
      if (!u) throw new Error(`No unit "${cmd.id}"`);
      const d = disbandTarget(state, u);
      if (!d.ok || !d.target) throw new Error(`${u.name} cannot disband: ${d.reason}`);
      if (!(d.target.col === u.col && d.target.row === u.row) && !routeFor(state, u, cellIndex(state.map, d.target.col, d.target.row))) throw new Error(`${u.name} cannot disband: no way home`);
      if (d.target.col === u.col && d.target.row === u.row) {
        const snapshot: Unit = JSON.parse(JSON.stringify(u));
        disbandInto(state, u, d.target);
        return { type: 'undisband', unit: snapshot, into: d.target.id };
      }
      const prev = u.order, prevBuild = u.build ?? null;
      u.order = { kind: 'move', dest: cellIndex(state.map, d.target.col, d.target.row), then: 'disband', to: d.target.id };
      u.build = null;
      return { type: 'orderUnit', id: cmd.id, order: prev, build: prevBuild };
    }
    case 'fortify': {
      const u = state.units[cmd.unitId];
      if (!u) throw new Error(`No unit "${cmd.unitId}"`);
      const r = fortify(state, u);
      return { type: 'unfortify', unitId: u.id, fortId: r.fort.id, faction: u.faction, paid: r.paid, fromRealm: r.fromRealm, fallbackId: r.fallbackId };
    }
    case 'unfortify': {
      unfortify(state, cmd.fortId, cmd.paid, cmd.fromRealm, cmd.fallbackId, cmd.faction);
      return { type: 'fortify', unitId: cmd.unitId };
    }
    case 'undisband': {
      const s = state.settlements[cmd.into];
      if (!s) throw new Error(`No settlement "${cmd.into}"`);
      const back = { m: cmd.unit.pop.m.map((x) => -x), f: cmd.unit.pop.f.map((x) => -x) };
      addPopulation(s.pop, back);
      for (let b = 0; b < s.pop.m.length; b++) { if (s.pop.m[b] < 0) s.pop.m[b] = 0; if (s.pop.f[b] < 0) s.pop.f[b] = 0; }
      s.food = Math.max(0, s.food - cmd.unit.provisions);
      state.units[cmd.unit.id] = cmd.unit;
      return { type: 'disbandUnit', id: cmd.unit.id };
    }
    case 'sendFood': {
      const a = state.settlements[cmd.from], b = state.settlements[cmd.to];
      if (!a) throw new Error(`No settlement "${cmd.from}"`);
      if (!b) throw new Error(`No settlement "${cmd.to}"`);
      if (a.id === b.id) return { type: 'sendFood', from: cmd.to, to: cmd.from, amount: 0 };
      if (clusterRootOf(state, a.id) !== clusterRootOf(state, b.id)) throw new Error(`${a.name} and ${b.name} are not in the same cluster`);
      const x = Math.max(0, Math.min(cmd.amount, a.food));
      a.food -= x; b.food += x;
      a.report.sent += x; b.report.received += x;
      a.year.sent += x; b.year.received += x;
      if (x > 0) logEvent(state, 'sent', `${a.name} sent ${Math.round(x)} food to ${b.name}.`);
      return { type: 'sendFood', from: cmd.to, to: cmd.from, amount: x };
    }
  }
}

/**
 * Move `amount` coins out of the settlement's faction treasury (negative = refund).
 * Counted in the faction's yearly `spent`. Returns what was taken (0 without a faction).
 */
function payMoney(state: GameState, s: Settlement, amount: number): number {
  if (!amount || !s.faction) return 0;
  const f = state.factions[s.faction];
  if (!f) return 0;
  f.treasury -= amount;
  if (f.treasury < 0 && f.treasury > -1e-9) f.treasury = 0;
  f.year.spent += amount;
  return amount;
}

/** The faction key for transferMaterials. */
export function factionStockKey(factionId: string): string {
  return `faction:${factionId}`;
}

function stockOf(state: GameState, key: string): Materials {
  if (key.startsWith('faction:')) {
    const f = state.factions[key.slice('faction:'.length)];
    if (!f) throw new Error(`No faction "${key}"`);
    return f.stock;
  }
  const s = state.settlements[key];
  if (!s) throw new Error(`No settlement "${key}"`);
  return s.stock;
}

/** Does this command change anything? (used to skip empty undo entries) */
export function isNoop(cmd: Command): boolean {
  if (cmd.type === 'transferMaterials') return MATERIAL_IDS.every((k) => !(cmd.amount[k] && cmd.amount[k]! > 0));
  if (cmd.type === 'sendFood') return !(cmd.amount > 0);
  return (cmd.type === 'setTerrain' || cmd.type === 'setResource' || cmd.type === 'setInfra') && cmd.cells.length === 0;
}

/** Does this command touch settlements (so zone/marker layers must redraw)? */
export function commandTouchesSettlements(cmd: Command): boolean {
  return cmd.type === 'foundSettlement' || cmd.type === 'removeSettlement' || cmd.type === 'restoreSettlement' || cmd.type === 'renameSettlement' || cmd.type === 'editSettlement' || cmd.type === 'replaceMap'
    || cmd.type === 'settleUnit' || cmd.type === 'unsettle' || cmd.type === 'raiseUnit' || cmd.type === 'cancelRaise' || cmd.type === 'disbandUnit' || cmd.type === 'undisband'
    || cmd.type === 'finishUpgrade' || cmd.type === 'revertUpgrade' || cmd.type === 'setParents';
}

/** Does this command touch units (so the unit layer must redraw)? */
export function commandTouchesUnits(cmd: Command): boolean {
  return cmd.type === 'raiseUnit' || cmd.type === 'cancelRaise' || cmd.type === 'orderUnit' || cmd.type === 'settleUnit' || cmd.type === 'unsettle' || cmd.type === 'disbandUnit' || cmd.type === 'undisband' || cmd.type === 'fortify' || cmd.type === 'unfortify' || cmd.type === 'replaceMap';
}

/** Cells touched by a command (for renderer invalidation); 'all' for whole-map commands. */
export function commandCells(cmd: Command): number[] | 'all' {
  if (cmd.type === 'setTerrain' || cmd.type === 'setResource') return cmd.cells.map((c) => c.i);
  if (cmd.type === 'setInfra') return [];
  if (cmd.type === 'replaceMap') return 'all';
  return [];
}

export function setResourceCommand(map: MapData, cells: Iterable<number>, resource: number): SetResourceCommand {
  const edits: CellEdit[] = [];
  for (const i of cells) if (map.resource[i] !== resource) edits.push({ i, t: resource });
  return { type: 'setResource', cells: edits };
}

/** Replace the whole resource layer (from a spawn) as one undoable command. */
export function resourceLayerCommand(map: MapData, layer: number[]): SetResourceCommand {
  const edits: CellEdit[] = [];
  for (let i = 0; i < layer.length; i++) if (map.resource[i] !== layer[i]) edits.push({ i, t: layer[i] });
  return { type: 'setResource', cells: edits };
}

// ---- helpers that build commands (pure; they don't touch the state) ----

/** Cells of a round brush of the given radius centred on (col, row), clipped to the map. */
export function brushCells(map: MapData, col: number, row: number, radius: number): number[] {
  const out: number[] = [];
  const centre = offsetToAxial(col, row);
  for (const h of axialRange(centre, radius)) {
    const o = axialToOffset(h.q, h.r);
    if (inBounds(map, o.col, o.row)) out.push(idx(map, o.col, o.row));
  }
  return out;
}

export function paintCommand(map: MapData, cells: Iterable<number>, terrain: number): SetTerrainCommand {
  const edits: CellEdit[] = [];
  for (const i of cells) if (map.terrain[i] !== terrain) edits.push({ i, t: terrain });
  return { type: 'setTerrain', cells: edits };
}

/** Flood fill: all hexes connected to (col,row) with the same terrain get `terrain`. */
export function floodFillCommand(map: MapData, col: number, row: number, terrain: number, limit = 200_000): SetTerrainCommand {
  if (!inBounds(map, col, row)) return { type: 'setTerrain', cells: [] };
  const start = idx(map, col, row);
  const from = map.terrain[start];
  if (from === terrain) return { type: 'setTerrain', cells: [] };
  const seen = new Uint8Array(map.terrain.length);
  const stack = [start];
  seen[start] = 1;
  const cells: CellEdit[] = [];
  while (stack.length && cells.length < limit) {
    const i = stack.pop()!;
    cells.push({ i, t: terrain });
    const c = i % map.width, r = Math.floor(i / map.width);
    for (const n of neighborsOffset(map, c, r)) {
      const j = idx(map, n.col, n.row);
      if (!seen[j] && map.terrain[j] === from) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  return { type: 'setTerrain', cells };
}
