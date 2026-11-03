import { describe, it, expect } from 'vitest';
import {
  offsetToAxial, axialToOffset, axialDistance, axialNeighbors, axialRange, axialRing,
  axialToPixel, pixelToAxial, offsetToPixel, hexCorners, axialRound,
} from '../src/sim/hex';

describe('offset <-> axial (odd-r)', () => {
  it('round-trips every cell of a small grid', () => {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 9; col++) {
        const a = offsetToAxial(col, row);
        const o = axialToOffset(a.q, a.r);
        expect(o).toEqual({ col, row });
      }
    }
  });
  it('odd rows are shoved right: (0,1) is east-ish of (0,0)', () => {
    const p0 = offsetToPixel(0, 0, 10);
    const p1 = offsetToPixel(0, 1, 10);
    expect(p1.x).toBeGreaterThan(p0.x);
    expect(p1.y).toBeGreaterThan(p0.y);
  });
});

describe('distance and neighbours', () => {
  it('neighbours are at distance 1 and there are six of them', () => {
    const c = offsetToAxial(5, 5);
    const ns = axialNeighbors(c);
    expect(ns).toHaveLength(6);
    for (const n of ns) expect(axialDistance(c, n)).toBe(1);
  });
  it('distance along a row is the column difference', () => {
    expect(axialDistance(offsetToAxial(0, 4), offsetToAxial(7, 4))).toBe(7);
  });
  it('range(r) has 1+3r(r+1) hexes and ring(r) has 6r', () => {
    const c = { q: 0, r: 0 };
    for (let r = 0; r <= 3; r++) {
      expect(axialRange(c, r)).toHaveLength(1 + 3 * r * (r + 1));
      expect(axialRing(c, r)).toHaveLength(r === 0 ? 1 : 6 * r);
      for (const h of axialRing(c, r)) expect(axialDistance(c, h)).toBe(r);
    }
  });
  it('village/town/city influence zones are 6/18/36 hexes beyond the centre', () => {
    const c = { q: 10, r: 10 };
    expect(axialRange(c, 1).length - 1).toBe(6);
    expect(axialRange(c, 2).length - 1).toBe(18);
    expect(axialRange(c, 3).length - 1).toBe(36);
  });
});

describe('pixel conversion', () => {
  it('axial -> pixel -> axial round-trips', () => {
    for (let q = -5; q <= 5; q++) {
      for (let r = -5; r <= 5; r++) {
        const p = axialToPixel({ q, r }, 17);
        expect(pixelToAxial(p.x, p.y, 17)).toEqual({ q, r });
      }
    }
  });
  it('a point just inside a corner still rounds to the right hex', () => {
    const size = 20;
    const p = axialToPixel({ q: 3, r: 2 }, size);
    const corners = hexCorners(p.x, p.y, size);
    for (let i = 0; i < 6; i++) {
      const cx = p.x + (corners[i * 2] - p.x) * 0.95;
      const cy = p.y + (corners[i * 2 + 1] - p.y) * 0.95;
      expect(pixelToAxial(cx, cy, size)).toEqual({ q: 3, r: 2 });
    }
  });
  it('axialRound keeps q+r+s == 0', () => {
    const h = axialRound(1.4, -0.6);
    expect(Number.isInteger(h.q) && Number.isInteger(h.r)).toBe(true);
  });
});
