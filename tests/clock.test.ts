// Season turns (Session 22, DESIGN §2.4): a turn is three months; the sim still steps monthly.
import { describe, it, expect } from 'vitest';
import { createGameState, calendar, turnNumber } from '../src/sim/state';
import { createMap } from '../src/sim/map';
import { endTurn, advanceTurn, monthsInTurn } from '../src/sim/turn';

describe('season turns', () => {
  it('names the seasons: Mar–May spring, Jun–Aug summer, Sep–Nov autumn (harvest), Dec–Feb winter', () => {
    const season = (month: number) => calendar(month).season;
    expect([2, 3, 4].map(season)).toEqual(['Spring', 'Spring', 'Spring']);
    expect([5, 6, 7].map(season)).toEqual(['Summer', 'Summer', 'Summer']);
    expect([8, 9, 10].map(season)).toEqual(['Autumn', 'Autumn', 'Autumn']);
    expect([11, 12, 13].map(season)).toEqual(['Winter', 'Winter', 'Winter']); // Dec, Jan, Feb
  });

  it('a turn runs to the next season boundary: 3 months from a boundary, a short one from anywhere else', () => {
    expect(monthsInTurn(2)).toBe(3); // March
    expect(monthsInTurn(11)).toBe(3); // December
    expect(monthsInTurn(1)).toBe(1); // February → March
    expect(monthsInTurn(10)).toBe(1); // November → December
    expect(monthsInTurn(0)).toBe(2); // January → March
    const s = createGameState('clock', createMap(8, 8, 0));
    s.turn = 1;
    expect(advanceTurn(s)).toBe(1);
    expect(s.turn).toBe(2);
    for (let i = 0; i < 8; i++) expect(advanceTurn(s)).toBe(3);
    expect(s.turn).toBe(26);
    expect(calendar(s.turn).season).toBe('Spring');
  });

  it('is exactly the same game as stepping the months one by one', () => {
    const a = createGameState('same', createMap(8, 8, 0)), b = createGameState('same', createMap(8, 8, 0));
    a.turn = b.turn = 2;
    for (let i = 0; i < 8; i++) advanceTurn(a);
    for (let i = 0; i < 24; i++) endTurn(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('counts turns from the first spring', () => {
    expect(turnNumber(2)).toBe(1);
    expect(turnNumber(5)).toBe(2);
    expect(turnNumber(2 + 12)).toBe(5);
    expect(turnNumber(0)).toBe(1);
  });
});
