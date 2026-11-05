// Factions (DESIGN §4.8). Phase 1: only the player's faction exists; it owns
// settlements and, later, units, characters and a treasury. The definitions
// come from data/factions.json; the live record lives in GameState.factions.

import factionData from '../../data/factions.json';
import { type Materials, emptyMaterials } from './materials';

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
  /** money (DESIGN §4.2); filled by markets (Session 11), nothing to spend it on yet */
  treasury: number;
  /** the faction's central materials stockpile (DESIGN §4.2, Session 11): the clusters' yearly surplus, shipped by the player */
  stock: Materials;
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
  for (const d of FACTION_DEFS) out[d.id] = { ...d, treasury: 0, stock: emptyMaterials() };
  return out;
}

/** Colour for a faction id, with a neutral fallback for ids the state does not know (e.g. headless 'A'). */
export const NEUTRAL_COLOR = '#9a9484';
export function factionColor(factions: Record<string, Faction>, id: string | null): string {
  return (id && factions[id]?.color) || NEUTRAL_COLOR;
}
