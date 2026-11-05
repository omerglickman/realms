// Scenario files (DESIGN §4.8, Omer 2026-11-05): a starting position is a game
// state the engine may already have run forward for a few years — map,
// settlements, populations, granaries and the calendar. Since the GameState is
// already plain JSON, a scenario file is just a thin envelope around it.
// Map files (maps/*.json, format 'realms-map') hold terrain and resources only;
// `detectFile` tells the two apart so one Import button can take either.

import { type GameState, serializeState, deserializeState, calendar } from './state';
import { totalPopulation } from './demography';
import type { MapFile } from './mapfile';

export const SCENARIO_VERSION = 1;

export interface ScenarioFile {
  format: 'realms-scenario';
  version: number;
  name: string;
  /** the serialized GameState (kept as an object so the file stays readable) */
  state: GameState;
  meta?: Record<string, unknown>;
}

export function saveScenarioFile(state: GameState, name: string, meta?: Record<string, unknown>): ScenarioFile {
  const cal = calendar(state.turn);
  const people = Object.values(state.settlements).reduce((t, s) => t + totalPopulation(s.pop), 0);
  return {
    format: 'realms-scenario',
    version: SCENARIO_VERSION,
    name,
    state: JSON.parse(serializeState(state)) as GameState,
    meta: {
      ...meta,
      settlements: Object.keys(state.settlements).length,
      people: Math.round(people),
      date: `${cal.monthName}, year ${cal.year}`,
    },
  };
}

export function loadScenarioFile(raw: unknown): { state: GameState; name: string } {
  const f = raw as Partial<ScenarioFile>;
  if (!f || f.format !== 'realms-scenario') throw new Error('Not a realms scenario file');
  if (typeof f.version !== 'number' || f.version > SCENARIO_VERSION) throw new Error(`Scenario version ${f.version} not supported`);
  if (!f.state) throw new Error('Scenario file has no state');
  return { state: deserializeState(JSON.stringify(f.state)), name: f.name ?? 'scenario' };
}

/**
 * Turn a pre-run state into a starting position (DESIGN §4.8): keep every
 * settlement, population and granary exactly as they are, but rebase the
 * calendar so the game opens in year 1 (same month, so stocks stay in season)
 * and every settlement counts as founded "at the start".
 */
export function rebaseAsStart(state: GameState): GameState {
  const month = state.turn % 12;
  state.turn = month;
  for (const s of Object.values(state.settlements)) s.foundedTurn = 0;
  return state;
}

export type RealmsFileKind = 'map' | 'scenario' | 'unknown';

export function detectFile(raw: unknown): RealmsFileKind {
  const f = raw as Partial<MapFile | ScenarioFile> | null;
  if (!f || typeof f !== 'object') return 'unknown';
  if (f.format === 'realms-map') return 'map';
  if (f.format === 'realms-scenario') return 'scenario';
  return 'unknown';
}
