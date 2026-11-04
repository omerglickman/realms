// endTurn: deterministic transition from one month to the next.
// Each phase adds its step here in a fixed order. Phase 1: the food economy
// runs every month; the demographic update runs in December (DESIGN §2.4, §4.1).

import type { GameState } from './state';
import { calendar } from './state';
import { economyMonth, demographyYear } from './economy';

export function endTurn(state: GameState): GameState {
  const { month } = calendar(state.turn);
  economyMonth(state, month);
  if (month === 11) demographyYear(state);
  state.turn += 1;
  return state;
}
