// Zoom levels for the map's labels and icons (Omer, Session 13b; UI-DESIGN.md §6).
// Four levels, from close to far:
//   0  everything                                      zoom ≥ villageNames
//   1  village names hidden                            zoom ≥ townLevel
//   2  town names and village markers hidden too       zoom ≥ cityLevel
//   3  town markers and resource icons hidden too — only cities and the metropolis, with their names
// Camera zoom 1 = one hex ≈ 42 screen px wide; the start position fits the window at ≈ 0.43.

export const ZOOM_LEVELS = {
  /** below this, village names go */
  villageNames: 2.0,
  /** below this, town names and village markers go */
  townLevel: 1.0,
  /** below this, town markers and resource icons go */
  cityLevel: 0.6,
};

export function zoomLevel(zoom: number): 0 | 1 | 2 | 3 {
  if (zoom >= ZOOM_LEVELS.villageNames) return 0;
  if (zoom >= ZOOM_LEVELS.townLevel) return 1;
  if (zoom >= ZOOM_LEVELS.cityLevel) return 2;
  return 3;
}

/**
 * Which ladder ranks show a marker / a name at this zoom. The ladder (Session 18, DESIGN §3.5) is
 * village 0 · small castle 1 · town 2 · medium castle 3 · city 4 · large castle 5 · metropolis 6;
 * a castle follows the settlement just below it (a small castle like a village, a medium one like a
 * town) except that a large castle, like a city, is always shown.
 */
export function showMarker(rank: number, zoom: number): boolean {
  const l = zoomLevel(zoom);
  return rank >= 4 || ((rank === 2 || rank === 3) && l <= 2) || (rank <= 1 && l <= 1);
}
export function showName(rank: number, zoom: number): boolean {
  const l = zoomLevel(zoom);
  return rank >= 4 || ((rank === 2 || rank === 3) && l <= 1) || (rank <= 1 && l === 0);
}
export function showResources(zoom: number): boolean {
  return zoomLevel(zoom) <= 2;
}
