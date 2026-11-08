// Shared formatting, icons and small widgets for the UI (Session 13).
// Display helpers only — nothing here touches the state.

import type { GameState } from '../../sim/state';
import { TIERS, growthTrend, buildingDef, type Settlement, type BuildingDef } from '../../sim/settlements';
import { totalPopulation } from '../../sim/demography';
import { monthsLeft, moneyCost } from '../../sim/buildings';
import { MATERIAL_IDS, type Materials } from '../../sim/materials';
import { clustersOf } from '../../sim/clusters';
import { ICON_PATHS, icon } from '../icons';

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
/** Tier indexes that hold people (castles are manned, not populated), low to high. */
export const PEOPLE_TIERS: number[] = TIERS.map((t, i) => (t.castle ? -1 : i)).filter((i) => i >= 0);
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

// ---- icons: see src/ui/icons.ts (one source for the DOM and the map) ----
export const ICON: Record<string, string> = Object.fromEntries(Object.keys(ICON_PATHS).map((k) => [k, icon(k)]));

/** Icon for a food job kind. */
export function jobIcon(kind: string): string {
  return kind === 'farm' ? ICON.wheat : kind === 'herd' ? ICON.cow : kind === 'fish' ? ICON.fish : kind === 'hunt' ? ICON.deer : kind === 'timber' ? ICON.timber : kind === 'stone' ? ICON.stone : ICON.hammer;
}
export function jobName(kind: string): string {
  return { farm: 'farming', herd: 'herding', fish: 'fishing', hunt: 'hunting', timber: 'timber', stone: 'stone' }[kind] ?? kind;
}
