// Seeded pseudo-random number generator (sfc32). One stream per game so that
// a game is fully reproducible from its seed + commands (ROADMAP B.3 rule 4).
// The state is four 32-bit integers and lives inside GameState as plain data.

export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Hash a string or number seed into an RngState. */
export function seedRng(seed: string | number): RngState {
  const str = String(seed);
  // xmur3 string hash → four seeds
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const next = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  const s: RngState = { a: next(), b: next(), c: next(), d: next() };
  // warm up
  for (let i = 0; i < 12; i++) nextU32(s);
  return s;
}

/** Advance the state and return a uint32. Mutates `s`. */
export function nextU32(s: RngState): number {
  s.a >>>= 0;
  s.b >>>= 0;
  s.c >>>= 0;
  s.d >>>= 0;
  let t = (s.a + s.b) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.d = (s.d + 1) | 0;
  t = (t + s.d) | 0;
  s.c = (s.c + t) | 0;
  return t >>> 0;
}

/** Float in [0, 1). */
export function nextFloat(s: RngState): number {
  return nextU32(s) / 4294967296;
}

/** Integer in [min, max] inclusive. */
export function nextInt(s: RngState, min: number, max: number): number {
  return min + Math.floor(nextFloat(s) * (max - min + 1));
}

export function chance(s: RngState, p: number): boolean {
  return nextFloat(s) < p;
}

export function pick<T>(s: RngState, arr: readonly T[]): T {
  return arr[nextInt(s, 0, arr.length - 1)];
}
