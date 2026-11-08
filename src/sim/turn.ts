// endTurn: deterministic transition from one month to the next.
// Each phase adds its step here in a fixed order. Phase 1: the food economy
// runs every month; the demographic update runs in December (DESIGN §2.4, §4.1).
// Phase 2 (Session 14): units act first — they walk, found villages, disband,
// eat and forage — so a village founded this month has its first month of
// economy at once and a unit inside the borders eats before its granary does.

import type { GameState } from './state';
import { calendar } from './state';
import { economyMonth, demographyYear } from './economy';
import { unitsMonth } from './units';
import { fortsMonth } from './forts';

export function endTurn(state: GameState): GameState {
  const { month } = calendar(state.turn);
  unitsMonth(state, month);
  fortsMonth(state);
  economyMonth(state, month);
  if (month === 11) demographyYear(state);
  state.turn += 1;
  return state;
}
