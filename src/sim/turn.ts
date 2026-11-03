// endTurn: deterministic transition from one month to the next.
// Phase 0: nothing happens yet except the clock advancing. Each later phase
// adds its step here in a fixed order (demography → economy → … ).

import type { GameState } from './state';

export function endTurn(state: GameState): GameState {
  state.turn += 1;
  return state;
}
