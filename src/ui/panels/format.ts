// Shared formatting, icons and small widgets for the UI (Session 13).
// Display helpers only — nothing here touches the state.

import type { GameState } from '../../sim/state';
import { TIERS, growthTrend, buildingDef, type Settlement, type BuildingDef } from '../../sim/settlements';
import { totalPopulation } from '../../sim/demography';
import { monthsLeft, moneyCost } from '../../sim/buildings';
import { MATERIAL_IDS, type Materials } from '../../sim/materials';
import { clustersOf } from '../../sim/clusters';

export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
export const fmt1 = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const pct = (x: number, digits = 1): string => `${x >= 0 ? '+' : '−'}${(100 * Math.abs(x)).toFixed(digits)} %`;
export const signed = (n: number): string => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
export const esc = (x: string): string => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const plural = (n: number, one: string, many = `${one}s`): string => `${fmt(n)} ${Math.round(n) === 1 ? one : many}`;

/** "metropolis" → "metropolises", "city" → "cities" */
export function tierPlural(name: string, n: number): string {
  const l = name.toLowerCase();
  if (n === 1) return l;
  if (l === 'city') return 'cities';
  if (l === 'metropolis') return 'metropolises';
  return `${l}s`;
}
export function tierName(s: Settlement): string { return TIERS[s.tier].name; }
/** A small tier glyph (dot / disc / diamond / pentagon). */
export const tierGlyph = (tier: number): string => `<span class="tier-ico t${tier}" title="${esc(TIERS[tier].name)}"></span>`;

/** Months of food in the granary at the current consumption. */
export function foodMonths(s: Settlement): number {
  const pop = totalPopulation(s.pop);
  return pop > 0 ? s.food / pop : 0;
}

export function trendText(s: Settlement): string {
  const t = growthTrend(s);
  return t === null ? '—' : `${pct(t)} / yr`;
}

/** "120 timber · 30 stone" (goods only when present); "nothing" when empty. */
export function materialsText(m: Partial<Materials>, showZero = false): string {
  const parts = MATERIAL_IDS.filter((k) => showZero || (m[k] ?? 0) >= 0.5).map((k) => `${fmt(m[k] ?? 0)} ${k}`);
  return parts.length ? parts.join(' · ') : 'nothing';
}

/** "2,000 coins · 90 timber · 30 stone" — the full price of a building. */
export function costText(def: BuildingDef): string {
  const money = moneyCost(def);
  const mats = materialsText(def.cost ?? {});
  return (money > 0 ? `${fmt(money)} coins` : '') + (money > 0 && mats !== 'nothing' ? ' · ' : '') + (mats !== 'nothing' ? mats : money > 0 ? '' : 'free');
}

/** "Mill — 50 % done, ~3 months left" for a settlement's project. */
export function projectText(s: Settlement): string | null {
  if (!s.build) return null;
  const def = buildingDef(s.build.building);
  const left = monthsLeft(s) ?? 0;
  return `${def.name} — ${Math.round(100 * s.build.progress)} % done, ~${left} month${left === 1 ? '' : 's'} left`;
}

/**
 * The cluster `s` belongs to, as text — "lone village — a cluster of its own" /
 * "heads a cluster of 22 settlements · 103,727 people" / "Hugeopolis cluster · 22 settlements · 103,727 people".
 */
export function clusterLine(state: GameState, s: Settlement): { root: string; text: string } | null {
  const c = clustersOf(state).find((k) => k.members.includes(s.id));
  if (!c) return null;
  const rs = state.settlements[c.root];
  if (c.members.length === 1) return { root: c.root, text: 'lone village — a cluster of its own' };
  const tail = `${c.members.length} settlements · ${fmt(c.totals.population)} people`;
  return { root: c.root, text: c.root === s.id ? `heads a cluster of ${tail}` : `${rs.name} cluster · ${tail}` };
}

/** "30,692 in the metropolis · 43,456 in cities · 82,096 in towns" — people by tier, worded by how many settlements of each tier there are. */
export function popByTierText(popByTier: number[], members: Settlement[]): string {
  const counts = TIERS.map(() => 0);
  for (const m of members) counts[m.tier] += 1;
  const parts: string[] = [];
  for (let i = TIERS.length - 1; i >= 0; i--) if (popByTier[i] > 0.5) parts.push(`${fmt(popByTier[i])} in ${counts[i] === 1 ? 'the ' : ''}${tierPlural(TIERS[i].name, counts[i] || 2)}`);
  return parts.join(' · ');
}
/** Tier label for a legend: "metropolis" when there is one, "metropolises" when more. */
export function tierLabel(tier: number, members: Settlement[]): string {
  const n = members.filter((m) => m.tier === tier).length;
  return tierPlural(TIERS[tier].name, n || 2);
}

/** A small line chart of yearly values (the last point is "now"). */
export function sparkSvg(history: number[], current: number, label: string): string {
  const pts = [...history, current];
  if (pts.length < 2) return `<p class="note">The growth line needs a year-end or two.</p>`;
  const W = 420, H = 110, l = 48, r = 8, t = 10, b = 22;
  const max = Math.max(...pts) * 1.05, min = Math.min(...pts) * 0.95;
  const x = (i: number) => l + (i * (W - l - r)) / (pts.length - 1);
  const y = (v: number) => t + (H - t - b) * (1 - (v - min) / Math.max(1e-9, max - min));
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const fill = `${path} L${x(pts.length - 1).toFixed(1)},${H - b} L${x(0).toFixed(1)},${H - b} Z`;
  const years = pts.length - 1;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <path class="fill" d="${fill}"/><path d="${path}"/>
    <line class="axis" x1="${l}" y1="${H - b}" x2="${W - r}" y2="${H - b}"/>
    <text x="${l - 4}" y="${y(max / 1.05) + 4}" text-anchor="end">${fmt(max / 1.05)}</text>
    <text x="${l - 4}" y="${y(min / 0.95) + 4}" text-anchor="end">${fmt(min / 0.95)}</text>
    <text x="${l}" y="${H - 6}">${years} year${years === 1 ? '' : 's'} ago</text>
    <text x="${W - r}" y="${H - 6}" text-anchor="end">${esc(label)}</text>
  </svg>`;
}

/** "1 metropolis · 3 towns · 18 villages" */
export function tierBreakdown(members: Settlement[]): string {
  const counts = TIERS.map(() => 0);
  for (const m of members) counts[m.tier] += 1;
  const parts: string[] = [];
  for (let i = TIERS.length - 1; i >= 0; i--) if (counts[i]) parts.push(`${counts[i]} ${tierPlural(TIERS[i].name, counts[i])}`);
  return parts.join(' · ');
}

// ---- widgets ----

/** A horizontal gauge 0–1; `marks` are positions 0–1 drawn as thin lines; colour by level (lo < 0.34, mid < 0.67). */
export function gauge(value: number, opts: { marks?: number[]; tall?: boolean; cls?: string; title?: string } = {}): string {
  const v = Math.max(0, Math.min(1, value));
  const cls = opts.cls ?? (v < 0.34 ? 'lo' : v < 0.67 ? 'mid' : '');
  return `<div class="gauge${opts.tall ? ' tall' : ''}"${opts.title ? ` title="${esc(opts.title)}"` : ''}><i class="${cls}" style="width:${(100 * v).toFixed(1)}%"></i>${(opts.marks ?? []).map((m) => `<em style="left:${(100 * Math.max(0, Math.min(1, m))).toFixed(1)}%"></em>`).join('')}</div>`;
}

/** A single bar as a fraction of `max`, colour class c1..c5. */
export function hbar(value: number, max: number, cls = 'c1', title = ''): string {
  const v = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return `<div class="hbar"${title ? ` title="${esc(title)}"` : ''}><i class="${cls}" style="width:${(100 * v).toFixed(1)}%"></i></div>`;
}

/** A stacked bar of parts (sum = 100 %) with a legend. */
export function stack(parts: { label: string; value: number; cls: string }[], unit = ''): string {
  const total = parts.reduce((t, p) => t + Math.max(0, p.value), 0);
  if (total <= 0) return '<div class="dim">—</div>';
  const segs = parts.filter((p) => p.value > 0).map((p) => `<i class="${p.cls}" style="width:${(100 * p.value / total).toFixed(2)}%" title="${esc(p.label)}: ${fmt(p.value)}${unit}"></i>`).join('');
  const legend = parts.filter((p) => p.value > 0).map((p) => `<span><span class="sw ${p.cls}"></span>${esc(p.label)} <b class="num">${fmt(p.value)}</b> <span class="dim">(${Math.round(100 * p.value / total)} %)</span></span>`).join('');
  return `<div class="stack">${segs}</div><div class="legend">${legend}</div>`;
}

/** A stat tile for the top of a modal page. */
export function stat(icon: string, label: string, value: string, sub = '', extra = ''): string {
  return `<div class="stat">${icon}<div class="sv"><div class="sl">${label}</div><div class="sn">${value}</div>${sub ? `<div class="ss">${sub}</div>` : ''}${extra}</div></div>`;
}

export function kv(rows: [string, string][]): string {
  return `<table class="kv">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>`;
}

// ---- icons: original line glyphs, 24×24, stroke = currentColor ----

const I = (body: string, solid = false): string => `<svg class="ico${solid ? ' solid' : ''}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const ICON = {
  coin: I('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><path d="M12 9.5v5M10.5 11h3"/>'),
  people: I('<circle cx="8.5" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3 19c0-3.3 2.5-5.5 5.5-5.5S14 15.7 14 19M14 18.5c.3-2.4 1.7-4 4-4 1.9 0 3.5 1.4 3.5 4"/>'),
  wheat: I('<path d="M12 21V8"/><path d="M12 8c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5zM12 8c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/><path d="M12 12.5c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5zM12 12.5c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/><path d="M12 17c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5zM12 17c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/>'),
  timber: I('<path d="M6 7h11"/><path d="M6 17h11"/><ellipse cx="17" cy="12" rx="3" ry="5"/><path d="M6 7c-1.7 0-3 2.2-3 5s1.3 5 3 5"/><ellipse cx="17" cy="12" rx="1.2" ry="2"/>'),
  stone: I('<path d="M4 15l3-8 8-2 5 5-2 7-9 2z"/><path d="M7 7l5 4 7-1M12 11l-3 8"/>'),
  goods: I('<rect x="4" y="8" width="16" height="12" rx="1"/><path d="M4 12h16M12 8v12M7 8l2-4h6l2 4"/>'),
  hammer: I('<path d="M14 4l6 6-2 2-6-6z"/><path d="M12 6l2 2-9 9-2-2z"/><path d="M13 11l-2-2"/>'),
  granary: I('<path d="M4 20V10l8-6 8 6v10z"/><path d="M4 20h16M10 20v-6h4v6M4 13h16"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  house: I('<path d="M5 11l7-6 7 6v9H5z"/><path d="M10 20v-5h4v5"/>'),
  tree: I('<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="12" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M12 7.5v4M12 11.5l-7 4M12 11.5v4M12 11.5l7 4"/>'),
  scroll: I('<path d="M6 4h11a3 3 0 0 1 3 3v1h-4"/><path d="M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7"/><path d="M8 10h7M8 14h7"/>'),
  crown: I('<path d="M4 17h16l1-9-5 4-4-6-4 6-5-4z"/><path d="M4 20h16"/>'),
  warn: I('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'),
  skull: I('<path d="M12 3a7 7 0 0 0-7 7c0 2.6 1.3 4.3 3 5.4V19h8v-3.6c1.7-1.1 3-2.8 3-5.4a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="10.5" r="1.3"/><circle cx="14.5" cy="10.5" r="1.3"/><path d="M11 15l1-1.5 1 1.5M10 19v2M14 19v2"/>'),
  walk: I('<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-7-2.5-2 1-5 3 1.5 2 3 2.5 1M10 9l-3 4M13 14l3 3 1 4"/>'),
  calendar: I('<rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 10h18M8 3v4M16 3v4M7 14h3M12 14h3M7 18h3"/>'),
  map: I('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  book: I('<path d="M4 5a2 2 0 0 1 2-2h5v16H6a2 2 0 0 0-2 2z"/><path d="M20 5a2 2 0 0 0-2-2h-5v16h5a2 2 0 0 1 2 2z"/>'),
  hand: I('<path d="M7 11V6a1.5 1.5 0 0 1 3 0v5M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V6a1.5 1.5 0 0 1 3 0v6"/><path d="M16 12l2-2.5a1.4 1.4 0 0 1 2.2 1.7L17 17c-1 2-2.5 4-6 4-3.5 0-5-2.5-5-5v-5"/>'),
  arrowUp: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  fish: I('<path d="M3 12c3-4 7-6 11-6 2.5 0 4.5 1 6 3-1.5 2-3.5 3-6 3-4 0-8-2-11-6z"/><path d="M3 12c3 4 7 6 11 6M17 9l4-3v12l-4-3"/><circle cx="7" cy="11" r=".8"/>'),
  cow: I('<path d="M5 9h14l-1 9H6z"/><path d="M8 18v3M16 18v3M5 9L3 5M19 9l2-4M9 9V6M15 9V6"/>'),
  deer: I('<path d="M12 21v-8l-4-3V5M12 13l4-3V5M8 7h2M14 7h2"/><circle cx="12" cy="8" r="2"/>'),
  grid: I('<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
};

/** Icon for a food job kind. */
export function jobIcon(kind: string): string {
  return kind === 'farm' ? ICON.wheat : kind === 'herd' ? ICON.cow : kind === 'fish' ? ICON.fish : kind === 'hunt' ? ICON.deer : kind === 'timber' ? ICON.timber : kind === 'stone' ? ICON.stone : ICON.hammer;
}
export function jobName(kind: string): string {
  return { farm: 'farming', herd: 'herding', fish: 'fishing', hunt: 'hunting', timber: 'timber', stone: 'stone' }[kind] ?? kind;
}
