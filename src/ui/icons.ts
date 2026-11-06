// The icon set (Session 13/13b): original line glyphs on a 24×24 grid, drawn
// with a 1.6-px round stroke in currentColor. One source for the DOM (inline
// SVG via `icon()`) and the map (rasterised to Pixi textures via
// `iconTexture()`), so a resource looks the same in the ledger strip, the
// ledgers and on the hex. See UI-DESIGN.md §4 for the design rules.

import { Texture } from 'pixi.js';

/** Icon bodies: SVG path/shape elements inside a 24×24 viewBox. */
export const ICON_PATHS: Record<string, string> = {
  // ---- the bottom lines ----
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><path d="M12 9.5v5M10.5 11h3"/>',
  people: '<circle cx="8.5" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3 19c0-3.3 2.5-5.5 5.5-5.5S14 15.7 14 19M14 18.5c.3-2.4 1.7-4 4-4 1.9 0 3.5 1.4 3.5 4"/>',
  wheat: '<path d="M12 21V8"/><path d="M12 8c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5zM12 8c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/><path d="M12 12.5c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5zM12 12.5c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/><path d="M12 17c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5zM12 17c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/>',
  timber: '<path d="M6 7h11"/><path d="M6 17h11"/><ellipse cx="17" cy="12" rx="3" ry="5"/><path d="M6 7c-1.7 0-3 2.2-3 5s1.3 5 3 5"/><ellipse cx="17" cy="12" rx="1.2" ry="2"/>',
  stone: '<path d="M4 15l3-8 8-2 5 5-2 7-9 2z"/><path d="M7 7l5 4 7-1M12 11l-3 8"/>',
  goods: '<rect x="4" y="8" width="16" height="12" rx="1"/><path d="M4 12h16M12 8v12M7 8l2-4h6l2 4"/>',
  // ---- map resources (data/resources.json `icon`) ----
  game: '<path d="M9 11c0-1.5 1.3-2.5 3-2.5s3 1 3 2.5v5c0 2-1.3 3.5-3 3.5S9 18 9 16z"/><path d="M10.5 14h.5M13 14h.5"/><path d="M10 10L7 6M7 6L5 5M7 6L6 3M7 6l2-2"/><path d="M14 10l3-4M17 6l2-1M17 6l1-3M17 6l-2-2"/>',
  iron: '<path d="M3 16l3-7h12l3 7z"/><path d="M3 16h18M8 12.5h3"/>',
  fish: '<path d="M3 12c2.5-4 6-6 10-6s6 3 7 6c-1 3-3 6-7 6S5.5 16 3 12z"/><path d="M17 12l5-4-1.5 4 1.5 4z"/><circle cx="8" cy="10.5" r="1"/>',
  furs: '<path d="M7 4l2 2h6l2-2 2 3-2 3v5l2 3-2 3-2-2H9l-2 2-2-3 2-3V10L5 7z"/><path d="M12 8v8"/>',
  salt: '<path d="M4 18c2-6 5-9 8-9s6 3 8 9z"/><path d="M4 18h16"/><path d="M10 13.5h.01M14 14.5h.01M12 11h.01"/>',
  wine: '<circle cx="9" cy="12" r="2.2"/><circle cx="15" cy="12" r="2.2"/><circle cx="12" cy="16" r="2.2"/><circle cx="12" cy="9" r="2.2"/><path d="M12 7V3M12 3c2 0 3.5 1 4 2.5"/>',
  silver: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.8l1.29 3.42 3.66.18-2.86 2.28 1 3.52L12 14.2l-3.06 2 .97-3.52-2.86-2.28 3.66-.18z"/>',
  // ---- settlements (on a faction-colour disc) ----
  village: '<path d="M5 12l7-6 7 6v8H5z"/><path d="M10 20v-5h4v5"/>',
  town: '<path d="M3 20v-7l4-3 4 3v7M11 20V9l3-5 3 5v11M17 20v-6l4-3v9M3 20h18"/><path d="M6 15v2M14 11v2"/>',
  city: '<path d="M3 20V10h4V7h3v3h4V7h3v3h4v10z"/><path d="M3 20h18M10 20v-5h4v5M6 13h1M17 13h1"/>',
  metropolis: '<path d="M2 20V11h4V8h3v3h2V4l1-2 1 2v7h2V8h3v3h4v9z"/><path d="M2 20h20M10 20v-5h4v5M5 14h1M18 14h1M10 9h4"/>',
  // ---- things built on hexes (now and later) ----
  mill: '<path d="M11 20V11l4-4 4 4v9z"/><path d="M11 20h8M3 20h8"/><circle cx="6.5" cy="14.5" r="3.5"/><path d="M6.5 11v7M3 14.5h7M4 12l5 5M9 12l-5 5"/>',
  wharf: '<path d="M3 15h18"/><path d="M5 15v4M9 15v4M13 15v4M17 15v4"/><path d="M6 11c3-3 9-3 12 0v4H6z"/><path d="M12 11V6M12 6l4 2"/>',
  castle1: '<path d="M8 20V6h2V4h1v2h2V4h1v2h2v14z"/><path d="M8 20h8M11 20v-4h2v4"/>',
  castle2: '<path d="M3 20v-8h2v-2h1v2h2v-2h1v2h8v-2h1v2h2v-2h1v2h2v8z"/><path d="M3 20h18M10 20v-5h4v5M9 12V5h2V3h1v2h1V3h1v2h1v7"/>',
  castle3: '<path d="M2 20v-9h1V9h1v2h1V9h1v2h2V7h1V5h1v2h1V5h1v2h1V5h1v2h1v4h2V9h1v2h1V9h1v2h1v9z"/><path d="M2 20h20M10 20v-5h4v5M7 14h1M16 14h1"/>',
  station: '<path d="M4 20V9l8-6 8 6v11z"/><path d="M4 20h16M10 20v-5h4v5"/><path d="M12 3v-1M9 10h6"/><circle cx="12" cy="13" r="1"/>',
  // ---- interface ----
  hammer: '<path d="M14 4l6 6-2 2-6-6z"/><path d="M12 6l2 2-9 9-2-2z"/><path d="M13 11l-2-2"/>',
  granary: '<path d="M4 20V10l8-6 8 6v10z"/><path d="M4 20h16M10 20v-6h4v6M4 13h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  house: '<path d="M5 11l7-6 7 6v9H5z"/><path d="M10 20v-5h4v5"/>',
  tree: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="12" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M12 7.5v4M12 11.5l-7 4M12 11.5v4M12 11.5l7 4"/>',
  scroll: '<path d="M6 4h11a3 3 0 0 1 3 3v1h-4"/><path d="M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7"/><path d="M8 10h7M8 14h7"/>',
  crown: '<path d="M4 17h16l1-9-5 4-4-6-4 6-5-4z"/><path d="M4 20h16"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  skull: '<path d="M12 3a7 7 0 0 0-7 7c0 2.6 1.3 4.3 3 5.4V19h8v-3.6c1.7-1.1 3-2.8 3-5.4a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="10.5" r="1.3"/><circle cx="14.5" cy="10.5" r="1.3"/><path d="M11 15l1-1.5 1 1.5M10 19v2M14 19v2"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-7-2.5-2 1-5 3 1.5 2 3 2.5 1M10 9l-3 4M13 14l3 3 1 4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 10h18M8 3v4M16 3v4M7 14h3M12 14h3M7 18h3"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h5v16H6a2 2 0 0 0-2 2z"/><path d="M20 5a2 2 0 0 0-2-2h-5v16h5a2 2 0 0 1 2 2z"/>',
  hand: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v5M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V6a1.5 1.5 0 0 1 3 0v6"/><path d="M16 12l2-2.5a1.4 1.4 0 0 1 2.2 1.7L17 17c-1 2-2.5 4-6 4-3.5 0-5-2.5-5-5v-5"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  cow: '<path d="M5 9h14l-1 9H6z"/><path d="M8 18v3M16 18v3M5 9L3 5M19 9l2-4M9 9V6M15 9V6"/>',
  deer: '<path d="M12 21v-8l-4-3V5M12 13l4-3V5M8 7h2M14 7h2"/><circle cx="12" cy="8" r="2"/>',
  grid: '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chapel: '<path d="M6 20V11l6-5 6 5v9z"/><path d="M6 20h12M10 20v-4h4v4M12 6V2M10.5 3.5h3"/>',
  market: '<path d="M3 9l2-5h14l2 5z"/><path d="M4 9v11h16V9"/><path d="M4 20h16M9 20v-6h6v6M3 9c1 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0"/>',
  workshop: '<path d="M4 20V9h16v11z"/><path d="M4 20h16M8 9V5h4v4"/><path d="M11 17l5-5 1.5 1.5-5 5zM10 18l1-1"/>',
  warehouse: '<path d="M3 20V9l9-5 9 5v11z"/><path d="M3 20h18M7 20v-7h10v7M7 16h10M12 13v7"/>',
  range: '<path d="M6 4c6 2 6 14 0 16"/><path d="M6 4v16M6 12h13M15 9l4 3-4 3"/>',
  stables: '<path d="M3 20V10l9-6 9 6v10z"/><path d="M3 20h18M9 20v-6h6v6"/><path d="M7 13c1-2 2-2 3-1M14 13c1-2 2-2 3-1"/>',
  drill: '<path d="M12 21V9"/><path d="M8 9h8l-1-5H9z"/><path d="M5 21h14M12 13l-4 3M12 13l4 3"/>',
  walls: '<path d="M3 20v-8h2v-2h2v2h2v-2h2v2h2v-2h2v2h2v-2h2v2h2v8z"/><path d="M3 20h18M10 20v-4h4v4"/>',
  barracks: '<path d="M3 20V8h18v12z"/><path d="M3 20h18M6 11h3v3H6zM15 11h3v3h-3zM10 20v-5h4v5M12 8V4l4 1.5L12 7"/>',
  ironworks: '<path d="M4 20V11l6 2V9l6 3V7l4 2v11z"/><path d="M4 20h16M8 20v-4h3v4"/><path d="M14 4v3M17 3v3"/>',
  citadel: '<path d="M3 20V9h2V7h2v2h2V7h2v2h2V4l1-2 1 2v5h2V7h2v2h2V7h2v2h2v11z"/><path d="M3 20h20M11 20v-5h3v5M7 13h1M18 13h1"/>',
};

export type IconId = keyof typeof ICON_PATHS;

/** Inline SVG for the DOM; stroke = currentColor. */
export function icon(id: string, cls = ''): string {
  const body = ICON_PATHS[id] ?? ICON_PATHS.warn;
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

/** A standalone SVG document string (for rasterising) with explicit colours. */
export function iconSvg(id: string, stroke: string, strokeWidth = 1.6): string {
  const body = ICON_PATHS[id] ?? ICON_PATHS.warn;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

const textureCache = new Map<string, Texture>();

/** How an icon is rasterised for the map. */
export interface IconStyle {
  /** line colour */
  stroke: string;
  strokeWidth?: number;
  /** a round badge behind the icon (map resources, things on hexes): fill and border colours */
  badge?: { fill: string; border: string };
  /** texture size in px (the sprite is scaled to world units) */
  size?: number;
}

/** The map styles (UI-DESIGN.md §4): a parchment badge with an ink icon for a resource that is worked ("tapped"); a greyed badge for one nobody works yet; a bare parchment-coloured icon for faction discs. */
export const MAP_BADGE: IconStyle = { stroke: '#2b1d12', strokeWidth: 1.9, badge: { fill: '#f5e7c2', border: '#2b1d12' } };
export const MAP_BADGE_IDLE: IconStyle = { stroke: '#6b5f4e', strokeWidth: 1.9, badge: { fill: '#d9d2c3', border: '#6b5f4e' } };
export const MAP_MARK: IconStyle = { stroke: '#f6eed8', strokeWidth: 2.1 };

const styleKey = (id: string, st: IconStyle) => `${id}|${st.stroke}|${st.strokeWidth ?? 1.6}|${st.badge ? st.badge.fill + st.badge.border : ''}|${st.size ?? 64}`;

/**
 * Rasterised icon as a Pixi texture (cached). Call `preloadIconTextures` once
 * at startup for every id/style the map uses; afterwards this is synchronous
 * (an unknown key returns the white texture rather than throwing).
 */
export function iconTexture(id: string, style: IconStyle): Texture {
  return textureCache.get(styleKey(id, style)) ?? Texture.WHITE;
}

export async function preloadIconTextures(ids: string[], style: IconStyle): Promise<void> {
  const size = style.size ?? 64;
  await Promise.all(ids.map(async (id) => {
    const key = styleKey(id, style);
    if (textureCache.has(key)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    let inset = 0;
    if (style.badge) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.fillStyle = style.badge.fill; ctx.fill();
      ctx.lineWidth = Math.max(2, size / 22); ctx.strokeStyle = style.badge.border; ctx.stroke();
      inset = size * 0.14;
    }
    const img = new Image();
    const svg = iconSvg(id, style.stroke, style.strokeWidth ?? 1.6);
    await new Promise<void>((resolve) => {
      img.onload = () => { ctx.drawImage(img, inset, inset, size - 2 * inset, size - 2 * inset); resolve(); };
      img.onerror = () => resolve();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    textureCache.set(key, Texture.from(canvas));
  }));
}
