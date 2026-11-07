// The whole game state as ONE plain, JSON-serializable object (ROADMAP B.3 rule 2).
// Everything the game knows lives here. Saving = JSON.stringify(state).
// Phase 0: the map and the clock. Phase 1 adds settlements (people and food)
// and factions. Later phases add units, characters, diplomacy — always as
// plain data keyed by ids.

import type { MapData } from './map';
import { type RngState, seedRng } from './rng';
import { type Settlement, emptyReport, emptyYearTotals } from './settlements';
import { type Faction, initialFactions, emptyFactionYear, PLAYER_FACTION } from './factions';
import { emptyMaterials } from './materials';
import type { Unit } from './units';

/** v1: map + clock. v2: + settlements. v3: + factions, settlement population history. v4: + materials stocks and build projects (Session 11). v5: + faction yearly flows, money on projects (Session 11b). v6: + units (Phase 2, Session 14). */
export const STATE_VERSION = 7;

export interface GameState {
  version: number;
  seed: string;
  rng: RngState;
  /** Absolute turn counter. Turn 0 = the first month of year 1. */
  turn: number;
  map: MapData;
  /** Settlements by id (Phase 1). */
  settlements: Record<string, Settlement>;
  /** Factions by id (Phase 1: the player only). */
  factions: Record<string, Faction>;
  /** Units on the map by id (Phase 2, DESIGN §3.2b) — settlers, work-bands, levies; people in the field. */
  units: Record<string, Unit>;
  /** Id of the faction the player controls (fixed for now — DESIGN §4.8). */
  playerFaction: string;
  /** Counter for generated entity ids. */
  nextId: number;
  /** Recent notable events (newest last, capped) — abandonments, later famines, successions… */
  events: GameEvent[];
}

export interface GameEvent {
  turn: number;
  kind: string;
  text: string;
}

export const MAX_EVENTS = 200;

export function logEvent(state: GameState, kind: string, text: string): void {
  state.events.push({ turn: state.turn, kind, text });
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export function createGameState(seed: string, map: MapData): GameState {
  return {
    version: STATE_VERSION,
    seed,
    rng: seedRng(seed),
    turn: 0,
    map,
    settlements: {},
    units: {},
    factions: initialFactions(),
    playerFaction: PLAYER_FACTION,
    nextId: 1,
    events: [],
  };
}

/** Year (1-based) and month index (0-11) for a turn. One turn = one month (DESIGN §2.4). */
export function calendar(turn: number): { year: number; month: number; monthName: string } {
  const year = Math.floor(turn / 12) + 1;
  const month = turn % 12;
  return { year, month, monthName: MONTHS[month] };
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(json: string): GameState {
  const s = JSON.parse(json) as GameState;
  if (typeof s.version !== 'number' || !s.map || !Array.isArray(s.map.terrain)) {
    throw new Error('Not a valid game state');
  }
  if (s.version === 1) {
    // Phase 0 save: no settlements yet.
    s.settlements = {};
    s.nextId = 1;
    s.version = 2;
  }
  if (s.version === 2) {
    // Session 5 save: no factions, no population history.
    s.factions = initialFactions();
    s.playerFaction = PLAYER_FACTION;
    for (const st of Object.values(s.settlements)) {
      if (!Array.isArray(st.popHistory)) st.popHistory = [];
      if (typeof st.foundedTurn !== 'number') st.foundedTurn = 0;
    }
    s.version = 3;
  }
  if (s.version === 3) {
    // Session 11: materials stocks on settlements and factions, build projects
    for (const st of Object.values(s.settlements)) {
      if (!st.stock) st.stock = emptyMaterials();
      if (st.build === undefined) st.build = null;
    }
    for (const f of Object.values(s.factions ?? {})) if (!f.stock) f.stock = emptyMaterials();
    s.version = 4;
  }
  if (s.version === 4) {
    // Session 12: faction yearly flows (tax, sales, spent, overflow, lost); projects may carry paidMoney
    for (const f of Object.values(s.factions ?? {})) { f.year = emptyFactionYear(); f.lastYear = null; }
    s.version = 5;
  }
  if (s.version === 5) {
    // Session 14 (Phase 2): units on the map
    s.units = {};
    s.version = 6;
  }
  if (s.version === 6) {
    // Session 15b: tier upgrades as a running project on the settlement
    for (const t of Object.values(s.settlements ?? {})) (t as { upgrade?: unknown }).upgrade = null;
    s.version = 7;
  }
  if (s.version !== STATE_VERSION) {
    throw new Error(`Save version ${s.version} not supported (expected ${STATE_VERSION})`);
  }
  if (!s.settlements) s.settlements = {};
  if (!s.units) s.units = {};
  if (!s.factions) s.factions = initialFactions();
  if (!s.playerFaction) s.playerFaction = PLAYER_FACTION;
  if (typeof s.nextId !== 'number') s.nextId = 1;
  if (!Array.isArray(s.events)) s.events = [];
  if (!Array.isArray(s.map.resource)) s.map.resource = new Array<number>(s.map.terrain.length).fill(-1);
  for (const f of Object.values(s.factions)) {
    if (!f.stock) f.stock = emptyMaterials();
    if (typeof f.treasury !== 'number') f.treasury = 0;
    const fy = (y: Partial<typeof f.year> | null | undefined) => y ? { ...emptyFactionYear(), ...y, overflowIn: { ...emptyMaterials(), ...(y.overflowIn ?? {}) }, lost: { ...emptyMaterials(), ...(y.lost ?? {}) } } : null;
    f.year = fy(f.year) ?? emptyFactionYear();
    f.lastYear = fy(f.lastYear);
  }
  for (const st of Object.values(s.settlements)) {
    // fields added within v3 (Session 9): harvest factor, trickle/epidemic/sufficiency in the report
    if (typeof st.harvestFactor !== 'number') st.harvestFactor = 1;
    if (!st.stock) st.stock = emptyMaterials();
    else st.stock = { ...emptyMaterials(), ...st.stock };
    if (!st.build) st.build = null;
    st.report = { ...emptyReport(), ...(st.report ?? {}) };
    // Session 10: yearly running totals
    st.year = { ...emptyYearTotals(), ...(st.year ?? {}) };
    if (st.lastYear && typeof st.lastYear === 'object') st.lastYear = { ...emptyYearTotals(), ...st.lastYear };
    else st.lastYear = null;
  }
  return s;
}
