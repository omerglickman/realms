import { describe, it, expect } from 'vitest';
import {
  createPopulation, totalPopulation, workingHands, fertileWomen, yearlyUpdate, applyHunger, takeSlice, addPopulation,
  emptyPopulation, BANDS, DEMOGRAPHY, labourBirthFactor,
} from '../src/sim/demography';

describe('demography', () => {
  it('creates a population of the requested size with ~58% working hands', () => {
    const p = createPopulation(1000);
    expect(totalPopulation(p)).toBeCloseTo(1000, 6);
    const hands = workingHands(p);
    expect(hands / 1000).toBeGreaterThan(0.55);
    expect(hands / 1000).toBeLessThan(0.62);
    expect(fertileWomen(p) / 1000).toBeCloseTo(0.22, 1);
  });

  it('grows about 2-3% a year when well fed (births x1.5, Session 22) and shrinks when starved', () => {
    const p = createPopulation(1000);
    for (let y = 0; y < 10; y++) yearlyUpdate(p, 1, false);
    const rate = Math.pow(totalPopulation(p) / 1000, 1 / 10) - 1;
    expect(rate).toBeGreaterThan(0.015);
    expect(rate).toBeLessThan(0.04);

    const q = createPopulation(1000);
    yearlyUpdate(q, 0.5, false); // half-fed year → half the births
    expect(totalPopulation(q)).toBeLessThan(1000);
  });

  it('famine cuts births steeply: the year\'s food sufficiency to the power famineBirthExponent (Omer 2026-11-09)', () => {
    const a = createPopulation(1000), b = createPopulation(1000);
    const full = yearlyUpdate(a, 1, false).births, short = yearlyUpdate(b, 0.7, false).births;
    expect(short / full).toBeCloseTo(Math.pow(0.7, DEMOGRAPHY.famineBirthExponent), 6);
    expect(short / full).toBeLessThan(0.4);
  });

  it('missing hands raise births, up to maxBoost, and none missing changes nothing (Omer 2026-11-09)', () => {
    const base = yearlyUpdate(createPopulation(1000), 1, false).births;
    const half = yearlyUpdate(createPopulation(1000), 1, false, 0, { vacancyShare: DEMOGRAPHY.labourBoost.vacancyFull / 2 }).births;
    const full = yearlyUpdate(createPopulation(1000), 1, false, 0, { vacancyShare: 1 }).births;
    expect(half / base).toBeCloseTo(1 + DEMOGRAPHY.labourBoost.maxBoost / 2, 6);
    expect(full / base).toBeCloseTo(1 + DEMOGRAPHY.labourBoost.maxBoost, 6);
    expect(labourBirthFactor(0)).toBe(1);
  });

  it('idle hands lower births (crowding) and missing hands raise them, in a village', () => {
    const idle = yearlyUpdate(createPopulation(1000), 1, false, 0.3).births;
    const none = yearlyUpdate(createPopulation(1000), 1, false, 0).births;
    expect(idle).toBeLessThan(none);
    expect(none).toBeLessThan(yearlyUpdate(createPopulation(1000), 1, false, 0, { vacancyShare: 0.5 }).births);
  });

  it('plenty raises births', () => {
    const a = createPopulation(1000), b = createPopulation(1000);
    const ra = yearlyUpdate(a, 1, false), rb = yearlyUpdate(b, 1, true);
    expect(rb.births).toBeCloseTo(ra.births * 1.15, 6);
  });

  it('hunger kills in proportion to the shortfall and hits children and the old twice as hard', () => {
    const p = createPopulation(1000);
    const before = { child: p.m[0] + p.f[0], young: p.m[1] + p.f[1] };
    const dead = applyHunger(p, 1);
    expect(dead).toBeCloseTo(50, 6); // 5% at full shortfall
    expect(totalPopulation(p)).toBeCloseTo(950, 6);
    const lostChild = before.child - (p.m[0] + p.f[0]);
    const lostYoung = before.young - (p.m[1] + p.f[1]);
    expect(lostChild / before.child).toBeCloseTo((lostYoung / before.young) * 2, 6);
    expect(applyHunger(createPopulation(100), 0)).toBe(0);
  });

  it('takeSlice removes a proportional slice and addPopulation puts it back', () => {
    const p = createPopulation(600);
    const slice = takeSlice(p, 0.1);
    expect(totalPopulation(slice)).toBeCloseTo(60, 6);
    expect(totalPopulation(p)).toBeCloseTo(540, 6);
    for (let b = 0; b < BANDS; b++) expect(slice.m[b]).toBeCloseTo(p.m[b] / 9, 6);
    const q = emptyPopulation();
    addPopulation(q, slice);
    addPopulation(q, p);
    expect(totalPopulation(q)).toBeCloseTo(600, 6);
  });
});
