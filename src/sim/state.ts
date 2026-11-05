// The whole game state as ONE plain, JSON-serializable object (ROADMAP B.3 rule 2).
// Everything the game knows lives here. Saving = JSON.stringify(state).
// Phase 0: the map and the clock. Phase 1 adds settlements (people and food)
// and factions. Later phases add units, characters, diplomacy — always as
// plain data keyed by ids.

import type { MapData } from './map';
import { type RngState, seedRng } from './rng';
import { type Settlement, emptyReport } from './settlements';
import { type Faction, initialFactions, PLAYER_FACTION } from './factions';

/** v1: map + clock. v2: + settlements. v3: + factions, settlement population history. */
export const STATE_VERSION = 3;

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
  if (s.version !== STATE_VERSION) {
    throw new Error(`Save version ${s.version} not supported (expected ${STATE_VERSION})`);
  }
  if (!s.settlements) s.settlements = {};
  if (!s.factions) s.factions = initialFactions();
  if (!s.playerFaction) s.playerFaction = PLAYER_FACTION;
  if (typeof s.nextId !== 'number') s.nextId = 1;
  if (!Array.isArray(s.events)) s.events = [];
  if (!Array.isArray(s.map.resource)) s.map.resource = new Array<number>(s.map.terrain.length).fill(-1);
  for (const st of Object.values(s.settlements)) {
    // fields added within v3 (Session 9): harvest factor, trickle/epidemic/sufficiency in the report
    if (typeof st.harvestFactor !== 'number') st.harvestFactor = 1;
    st.report = { ...emptyReport(), ...(st.report ?? {}) };
  }
  return s;
}
