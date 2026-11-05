// Factions (DESIGN §4.8). Phase 1: only the player's faction exists; it owns
// settlements and, later, units, characters and a treasury. The definitions
// come from data/factions.json; the live record lives in GameState.factions.

import factionData from '../../data/factions.json';

export interface FactionDef {
  id: string;
  name: string;
  /** CSS hex colour */
  color: string;
  culture: string | null;
  player: boolean;
}

/** Live faction state (plain JSON in GameState). */
export interface Faction {
  id: string;
  name: string;
  color: string;
  culture: string | null;
  player: boolean;
  /** money (DESIGN §4.2); unused until trade and tax exist */
  treasury: number;
}

export const FACTION_DEFS: readonly FactionDef[] = factionData.factions as FactionDef[];
export const PLAYER_FACTION: string = factionData.playerFaction;

export function factionDef(id: string): FactionDef {
  const f = FACTION_DEFS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown faction "${id}"`);
  return f;
}

/** The starting faction record for a new game: every faction in the data file. */
export function initialFactions(): Record<string, Faction> {
  const out: Record<string, Faction> = {};
  for (const d of FACTION_DEFS) out[d.id] = { ...d, treasury: 0 };
  return out;
}

/** Colour for a faction id, with a neutral fallback for ids the state does not know (e.g. headless 'A'). */
export const NEUTRAL_COLOR = '#9a9484';
export function factionColor(factions: Record<string, Faction>, id: string | null): string {
  return (id && factions[id]?.color) || NEUTRAL_COLOR;
}
