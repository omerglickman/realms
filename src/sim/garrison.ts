// Garrisons (DESIGN §3.5, Session 19): military units standing on a castle's
// hex of their own faction are inside it, up to the castle's capacity (last
// month's `garrisonCapacity`: kind capacity × staffing); the rest are camped
// outside. The garrison eats from the castle's reserve and is paid by the
// treasury as any unit (src/sim/units.ts). A fort holds `fort.capacity` men
// and has no reserve. The walls' bonus is Phase 4. Imports only types from
// units.ts (units.ts imports this file). No DOM.

import type { GameState } from './state';
import type { Settlement } from './settlements';
import type { Unit } from './units';
import { castleAt, CASTLES } from './castles';
import { totalPopulation } from './demography';
import { unitTypeDefOf } from './unitdefs';

export interface GarrisonRow {
  unit: Unit;
  people: number;
  /** people of this unit inside the walls */
  inside: number;
}

export interface Garrison {
  castle: Settlement;
  /** people it can hold at this staffing */
  capacity: number;
  /** military people standing on its hex */
  people: number;
  /** of those, inside the walls */
  inside: number;
  rows: GarrisonRow[];
}

/** Is this a unit that garrisons (a military unit — one with pay)? */
export function isMilitary(u: Unit): boolean {
  return !!unitTypeDefOf(u.type).upkeepPerManPerMonth;
}

/** The garrison of `castle`: its faction's military units on its hex, in id order, filling the capacity in turn (the last may be split). */
export function garrisonOf(state: GameState, castle: Settlement): Garrison {
  const capacity = castle.castle && !castle.castle.ruin ? castle.castle.garrisonCapacity : 0;
  const rows: GarrisonRow[] = [];
  let room = capacity, people = 0, inside = 0;
  const here = Object.values(state.units)
    .filter((u) => u.faction === castle.faction && u.col === castle.col && u.row === castle.row && isMilitary(u))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const u of here) {
    const n = totalPopulation(u.pop);
    const inn = Math.max(0, Math.min(room, n));
    room -= inn; people += n; inside += inn;
    rows.push({ unit: u, people: n, inside: inn });
  }
  return { castle, capacity, people, inside, rows };
}

/** The share of `u` (0–1) inside a castle of its faction, and which one; null when it is not garrisoned. */
export function garrisonShare(state: GameState, u: Unit): { castle: Settlement; inside: number } | null {
  if (!isMilitary(u)) return null;
  const cell = u.row * state.map.width + u.col;
  const c = castleAt(state, cell);
  if (!c || c.faction !== u.faction) return null;
  const g = garrisonOf(state, c);
  const row = g.rows.find((r) => r.unit.id === u.id);
  if (!row || row.people <= 0 || row.inside <= 0) return null;
  return { castle: c, inside: row.inside / row.people };
}

/** Men a fort holds (units beyond are camped outside; informational until Phase 4). */
export function fortCapacity(): number {
  return CASTLES.fort.capacity;
}
