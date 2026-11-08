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

/** The faction's money and materials flows over a calendar year (Session 11b; reset each December into lastYear). */
export interface FactionYear {
  /** coins from private hands (DESIGN §4.2b) */
  tax: number;
  /** coins from goods sold */
  sales: number;
  /** coins paid for buildings (net of refunds) */
  spent: number;
  /** coins paid in castle wages and upkeep (Session 18) */
  upkeep: number;
  /** materials that overflowed cluster caps into the realm stockpile */
  overflowIn: Materials;
  /** materials lost above the realm cap */
  lost: Materials;
  months: number;
}

export function emptyFactionYear(): FactionYear {
  return { tax: 0, sales: 0, spent: 0, upkeep: 0, overflowIn: emptyMaterials(), lost: emptyMaterials(), months: 0 };
}

/** Live faction state (plain JSON in GameState). */
export interface Faction {
  id: string;
  name: string;
  color: string;
  culture: string | null;
  player: boolean;
  /** money (DESIGN §4.2): tax on private hands and goods sold (Session 11b); pays for buildings */
  treasury: number;
  /** the faction's central materials stockpile (DESIGN §4.2): what overflows the clusters' caps, shipped by the player */
  stock: Materials;
  /** this calendar year's flows and the last finished year's (Session 11b) */
  year: FactionYear;
  lastYear: FactionYear | null;
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
  for (const d of FACTION_DEFS) out[d.id] = { ...d, treasury: 0, stock: emptyMaterials(), year: emptyFactionYear(), lastYear: null };
  return out;
}

/** Colour for a faction id, with a neutral fallback for ids the state does not know (e.g. headless 'A'). */
export const NEUTRAL_COLOR = '#9a9484';
export function factionColor(factions: Record<string, Faction>, id: string | null): string {
  return (id && factions[id]?.color) || NEUTRAL_COLOR;
}
