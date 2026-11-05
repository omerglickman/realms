// Command layer (ROADMAP B.3 rule 3). Every change to the game state is a
// plain-data command applied through `applyCommand`, which returns the inverse
// command so the UI can undo. The AI will issue the same commands as the player.
//
// Phase 0: map-editing commands. Phase 1: founding and removing settlements;
// Session 11: queueing and cancelling buildings, moving materials.

import type { GameState } from './state';
import type { MapData } from './map';
import { inBounds, idx, neighborsOffset, cloneMap } from './map';
import { axialRange, offsetToAxial, axialToOffset } from './hex';
import { makeSettlement, settlementIdAt, buildingDef, type FoundOptions, type Settlement, type BuildProject } from './settlements';
import { totalPopulation, createPopulation, type Population } from './demography';
import { canBuild, moneyCost } from './buildings';
import { payFromCluster, refund, addMaterials, MATERIAL_IDS, type Materials } from './materials';

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

export type Command =
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
    case 'transferMaterials': {
      const src = stockOf(state, cmd.from), dst = stockOf(state, cmd.to);
      const moved: Partial<Materials> = {};
      for (const k of MATERIAL_IDS) {
        const x = Math.max(0, Math.min(cmd.amount[k] ?? 0, src[k]));
        if (x > 0) { src[k] -= x; dst[k] += x; moved[k] = x; }
      }
      return { type: 'transferMaterials', from: cmd.to, to: cmd.from, amount: moved };
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
  return (cmd.type === 'setTerrain' || cmd.type === 'setResource') && cmd.cells.length === 0;
}

/** Does this command touch settlements (so zone/marker layers must redraw)? */
export function commandTouchesSettlements(cmd: Command): boolean {
  return cmd.type === 'foundSettlement' || cmd.type === 'removeSettlement' || cmd.type === 'restoreSettlement' || cmd.type === 'renameSettlement' || cmd.type === 'editSettlement' || cmd.type === 'replaceMap';
}

/** Cells touched by a command (for renderer invalidation); 'all' for whole-map commands. */
export function commandCells(cmd: Command): number[] | 'all' {
  if (cmd.type === 'setTerrain' || cmd.type === 'setResource') return cmd.cells.map((c) => c.i);
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
