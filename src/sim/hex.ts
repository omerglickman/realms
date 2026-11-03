// Hex grid mathematics.
// CONVENTION (ROADMAP B.3 rule 5): pointy-top hexes, axial coordinates (q, r)
// for all math, "odd-r" offset coordinates (col, row) for the rectangular map
// store. Reference: Red Blob Games, "Hexagonal Grids".
//
// odd-r: odd rows are shoved right by half a hex.

export interface Axial {
  q: number;
  r: number;
}

export interface Offset {
  col: number;
  row: number;
}

export interface Cube {
  x: number;
  y: number;
  z: number;
}

export function axial(q: number, r: number): Axial {
  return { q, r };
}

export function offsetToAxial(col: number, row: number): Axial {
  const q = col - (row - (row & 1)) / 2;
  return { q, r: row };
}

export function axialToOffset(q: number, r: number): Offset {
  const col = q + (r - (r & 1)) / 2;
  return { col, row: r };
}

export function axialToCube(h: Axial): Cube {
  return { x: h.q, z: h.r, y: -h.q - h.r };
}

export function cubeToAxial(c: Cube): Axial {
  return { q: c.x, r: c.z };
}

/** Axial direction vectors for pointy-top hexes, starting east and going counter-clockwise. */
export const AXIAL_DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function axialNeighbor(h: Axial, dir: number): Axial {
  const d = AXIAL_DIRECTIONS[dir % 6];
  return { q: h.q + d.q, r: h.r + d.r };
}

export function axialNeighbors(h: Axial): Axial[] {
  return AXIAL_DIRECTIONS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

export function axialDistance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** All hexes within `radius` of the centre, centre included (ring 0..radius). */
export function axialRange(center: Axial, radius: number): Axial[] {
  const out: Axial[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    const rMin = Math.max(-radius, -dq - radius);
    const rMax = Math.min(radius, -dq + radius);
    for (let dr = rMin; dr <= rMax; dr++) {
      out.push({ q: center.q + dq, r: center.r + dr });
    }
  }
  return out;
}

/** The ring of hexes at exactly `radius` from the centre (radius 0 → the centre itself). */
export function axialRing(center: Axial, radius: number): Axial[] {
  if (radius === 0) return [{ ...center }];
  const out: Axial[] = [];
  // start at the hex `radius` steps in direction 4 (south-west), then walk around.
  let h: Axial = {
    q: center.q + AXIAL_DIRECTIONS[4].q * radius,
    r: center.r + AXIAL_DIRECTIONS[4].r * radius,
  };
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      out.push(h);
      h = axialNeighbor(h, side);
    }
  }
  return out;
}

export function axialRound(q: number, r: number): Axial {
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

// ---- Pixel geometry (pointy-top). `size` is the centre-to-corner radius. ----

export const SQRT3 = Math.sqrt(3);

export function hexWidth(size: number): number {
  return SQRT3 * size;
}

export function hexHeight(size: number): number {
  return 2 * size;
}

/** Vertical distance between rows. */
export function hexRowStep(size: number): number {
  return 1.5 * size;
}

export function axialToPixel(h: Axial, size: number): { x: number; y: number } {
  const x = size * (SQRT3 * h.q + (SQRT3 / 2) * h.r);
  const y = size * 1.5 * h.r;
  return { x, y };
}

export function offsetToPixel(col: number, row: number, size: number): { x: number; y: number } {
  const x = size * SQRT3 * (col + 0.5 * (row & 1));
  const y = size * 1.5 * row;
  return { x, y };
}

export function pixelToAxial(x: number, y: number, size: number): Axial {
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return axialRound(q, r);
}

/** The six corner points of a pointy-top hex centred at (cx, cy). */
export function hexCorners(cx: number, cy: number, size: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(cx + size * Math.cos(angle), cy + size * Math.sin(angle));
  }
  return pts;
}
