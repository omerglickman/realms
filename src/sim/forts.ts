// Forts (DESIGN §3.5, DECIDED 2026-11-08): the "fortify" order of a military
// unit. A fort is NOT a settlement: it has no staff, no cluster and no ladder
// rank; it extends the border by one ring, holds 100 men, and disappears 12
// months after the last unit leaves. A castle may be built on it, saving a
// quarter of the time. Omer's reading (2026-11-08): the fort is built now, but
// no unit type can fortify yet (levies arrive next session, with garrisons),
// so nothing creates one in play — `canFortify` in data/units.json is the switch.
// PLACEHOLDER: the order is instant (the design says one month). No DOM.

import type { GameState } from './state';
import { logEvent } from './state';
import { CASTLES } from './castles';
import { settlementIdAt } from './settlements';
import { clusterStock, payFromCluster } from './materials';
import { coveringSettlement, type Unit, unitCell, unitTypeDef } from './units';
import { TERRAIN } from './terrain';
import { offsetToAxial, axialRange, axialToOffset } from './hex';

export interface Fort {
  id: string;
  col: number;
  row: number;
  faction: string;
  /** consecutive months with no unit of the faction on the hex */
  emptyMonths: number;
  builtTurn: number;
}

export function fortAt(state: GameState, col: number, row: number): Fort | null {
  for (const f of Object.values(state.forts)) if (f.col === col && f.row === row) return f;
  return null;
}

export interface FortifyCheck { ok: boolean; reason?: string }

/** May this unit fortify the hex it stands on? */
export function canFortify(state: GameState, u: Unit): FortifyCheck {
  const def = unitTypeDef(u.type);
  if (!def.canFortify) return { ok: false, reason: `${def.name} cannot fortify` };
  const t = TERRAIN[state.map.terrain[unitCell(state.map, u)]];
  if (t.id === 'sea' || t.id === 'lake') return { ok: false, reason: 'no fort on water' };
  if (settlementIdAt(state, u.col, u.row)) return { ok: false, reason: 'a settlement stands here' };
  if (fortAt(state, u.col, u.row)) return { ok: false, reason: 'already fortified' };
  const f = state.factions[u.faction];
  const owner = coveringSettlement(state, u.faction, unitCell(state.map, u));
  const have = (owner ? clusterStock(state, owner.id).timber : 0) + (f ? f.stock.timber : 0);
  if (have + 1e-9 < CASTLES.fort.fortifyTimber) return { ok: false, reason: `needs ${CASTLES.fort.fortifyTimber} timber` };
  return { ok: true };
}

/** Pay and raise the fort (timber from the covering cluster, else the realm). Returns the fort. */
export function fortify(state: GameState, u: Unit): Fort {
  const c = canFortify(state, u);
  if (!c.ok) throw new Error(c.reason);
  const need = CASTLES.fort.fortifyTimber;
  const owner = coveringSettlement(state, u.faction, unitCell(state.map, u));
  const fromCluster = owner ? Math.min(need, clusterStock(state, owner.id).timber) : 0;
  if (owner && fromCluster > 0) payFromCluster(state, owner, { timber: fromCluster });
  const f = state.factions[u.faction];
  if (f) f.stock.timber -= need - fromCluster;
  const id = `f${state.nextId++}`;
  const fort: Fort = { id, col: u.col, row: u.row, faction: u.faction, emptyMonths: 0, builtTurn: state.turn };
  state.forts[id] = fort;
  logEvent(state, 'fortified', `${u.name} fortified (${u.col}, ${u.row}).`);
  return fort;
}

/** Monthly: a fort with no unit of its faction on the hex for `decayMonths` disappears. */
export function fortsMonth(state: GameState): void {
  for (const f of Object.values(state.forts)) {
    const held = Object.values(state.units).some((u) => u.faction === f.faction && u.col === f.col && u.row === f.row);
    f.emptyMonths = held ? 0 : f.emptyMonths + 1;
    if (f.emptyMonths >= CASTLES.fort.decayMonths) {
      delete state.forts[f.id];
      logEvent(state, 'fortified', `The fort at (${f.col}, ${f.row}) fell into disuse.`);
    }
  }
}

/** Hex indices within a fort's influence (its border contribution). */
export function fortCells(state: GameState, f: Fort): number[] {
  const out: number[] = [];
  const map = state.map;
  for (const h of axialRange(offsetToAxial(f.col, f.row), CASTLES.fort.influenceRings)) {
    const o = axialToOffset(h.q, h.r);
    if (o.col >= 0 && o.row >= 0 && o.col < map.width && o.row < map.height) out.push(o.row * map.width + o.col);
  }
  return out;
}
