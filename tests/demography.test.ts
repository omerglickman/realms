import { describe, it, expect } from 'vitest';
import {
  createPopulation, totalPopulation, workingHands, fertileWomen, yearlyUpdate, applyHunger, takeSlice, addPopulation,
  emptyPopulation, BANDS,
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

  it('grows about 1% a year when well fed and shrinks when starved', () => {
    const p = createPopulation(1000);
    for (let y = 0; y < 10; y++) yearlyUpdate(p, 1, false);
    const rate = Math.pow(totalPopulation(p) / 1000, 1 / 10) - 1;
    expect(rate).toBeGreaterThan(0.005);
    expect(rate).toBeLessThan(0.02);

    const q = createPopulation(1000);
    yearlyUpdate(q, 0.5, false); // half-fed year → half the births
    expect(totalPopulation(q)).toBeLessThan(1000);
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
