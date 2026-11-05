// Cluster and realm readouts (DESIGN §3.3, Session 10). Display only.
// The cluster panel shows the unit inside which food actually flows: people by
// tier, the granaries, this year's and last year's food balance, and the member
// tree (towns nested under the city, villages under their town). The realm
// panel is the sum over the player's clusters.

import type { GameState } from '../../sim/state';
import { calendar } from '../../sim/state';
import { TIERS, type Settlement, type YearTotals } from '../../sim/settlements';
import { totalPopulation } from '../../sim/demography';
import { type Cluster, type ClusterNode, clustersOf, realmReport } from '../../sim/clusters';
import { foodMonths, materialsText, projectText } from './settlementPanel';
import { clusterStock, clusterCap, realmCap, MATERIAL_IDS, type Materials } from '../../sim/materials';

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export interface ClusterHost {
  onFocus(id: string): void;
  onCluster(root: string): void;
  onRealm(): void;
  onClose(): void;
  /** ship materials from the realm stockpile to the cluster headed by `root` (Session 11) */
  onSend?(root: string, amount: Partial<Materials>): void;
}

/** "1 metropolis · 3 towns · 18 villages" */
export function tierBreakdown(members: Settlement[]): string {
  const counts = TIERS.map(() => 0);
  for (const m of members) counts[m.tier] += 1;
  const parts: string[] = [];
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (!counts[i]) continue;
    const name = TIERS[i].name.toLowerCase();
    parts.push(`${counts[i]} ${counts[i] === 1 ? name : name === 'city' ? 'cities' : name === 'metropolis' ? 'metropolises' : `${name}s`}`);
  }
  return parts.join(' · ');
}

function popByTierText(popByTier: number[]): string {
  const parts: string[] = [];
  for (let i = TIERS.length - 1; i >= 0; i--) if (popByTier[i] > 0.5) parts.push(`${fmt(popByTier[i])} in ${TIERS[i].name.toLowerCase() === 'city' ? 'cities' : TIERS[i].name.toLowerCase() + (TIERS[i].name === 'Metropolis' ? '' : 's')}`);
  return parts.join(' · ');
}

/** One line summarising a year's food balance. */
function yearText(y: YearTotals, population: number, partial: boolean): string {
  const net = y.produced - y.consumed;
  const months = population > 0 ? net / population : 0;
  const bits = [
    `${fmt(y.produced)} grown`,
    `${fmt(y.consumed)} eaten`,
    `<b class="${net >= 0 ? 'good' : 'warn'}">${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</b> <span class="dim">(${months >= 0 ? '+' : '−'}${Math.abs(months).toFixed(1)} mo of stock)</span>`,
  ];
  if (y.titheIn > 0.5 || y.titheOut > 0.5) bits.push(`${fmt(y.titheIn)} tithed up`);
  if (y.received > 0.5) bits.push(`${fmt(y.received)} moved up inside`);
  if (y.hungerDeaths > 0.5) bits.push(`<b class="warn">${fmt(y.hungerDeaths)} starved</b>`);
  if (y.migrantsIn > 0.5) bits.push(`${fmt(y.migrantsIn)} migrated inside`);
  return bits.join(', ') + (partial ? ` <span class="dim">· ${y.months} month${y.months === 1 ? '' : 's'} so far</span>` : '');
}

/** "1,200 / 5,220 timber · 0 / 2,610 stone · 480 / 2,610 goods" */
function stockVsCap(stock: Materials, cap: Materials): string {
  return MATERIAL_IDS.map((k) => `${fmt(stock[k])}<span class="dim"> / ${Number.isFinite(cap[k]) ? fmt(cap[k]) : '∞'}</span> ${k}`).join(' · ');
}

function memberRow(state: GameState, node: ClusterNode, depth: number): string {
  const s = state.settlements[node.id];
  const pop = totalPopulation(s.pop);
  const months = foodMonths(s);
  const warn = s.report.hungerDeaths > 0.5 ? ' <span class="warn" title="starved last month">⚠</span>' : '';
  const extra = s.buildings.length > 2 ? ` · ${s.buildings.length - 2} built` : '';
  const proj = s.build ? ` <span class="dim" title="${esc(projectText(s) ?? '')}">⚒</span>` : '';
  const row = `<div class="member d${depth}"><a href="#" data-focus="${s.id}">${esc(s.name)}</a> <span class="dim">${TIERS[s.tier].name.toLowerCase()} · ${fmt(pop)} · ${months.toFixed(1)} mo${extra}</span>${proj}${warn}</div>`;
  return row + node.children.map((c) => memberRow(state, c, depth + 1)).join('');
}

function privateHandsOf(state: GameState, members: Settlement[]): number {
  return members.reduce((t, m) => t + m.report.privateHands, 0);
}

/** Fill the panel with a cluster. */
export function renderClusterPanel(root: HTMLElement, state: GameState, c: Cluster, host: ClusterHost): void {
  const rs = state.settlements[c.root];
  const members = c.members.map((id) => state.settlements[id]);
  const t = c.totals;
  const months = t.monthlyNeed > 0 ? t.food / t.monthlyNeed : 0;
  const rows: [string, string][] = [
    ['Settlements', tierBreakdown(members)],
    ['People', `${fmt(t.population)} <span class="dim">— ${popByTierText(t.popByTier)}</span>`],
    ['Granaries', `${months.toFixed(1)} months of food in all <span class="dim">(${fmt(t.food)})</span>`],
    ['Last year', t.lastYear ? yearText(t.lastYear, t.population, false) : '<span class="dim">no year-end yet</span>'],
    ['This year', t.year.months > 0 ? yearText(t.year, t.population, true) : '<span class="dim">nothing yet</span>'],
    ['Stockpile', `${stockVsCap(clusterStock(state, c.root), clusterCap(state, c.root))}` + (t.year.timber + t.year.stone + t.year.goods > 0.5 ? ` <span class="dim">· this year +${materialsText({ timber: t.year.timber, stone: t.year.stone, goods: t.year.goods })}${t.year.sold > 0.5 ? `, sold goods for ${fmt(t.year.sold)}` : ''}</span>` : '') + (t.year.surplusOut > 0.5 ? ` <span class="dim">· ${fmt(t.year.surplusOut)} overflowed to the realm this year</span>` : '')],
    ...(t.year.tax > 0.5 || (t.lastYear && t.lastYear.tax > 0.5) ? [['Tax', `${fmt(privateHandsOf(state, members))} private hands · ${fmt(t.year.tax)} coins this year` + (t.lastYear ? ` <span class="dim">· ${fmt(t.lastYear.tax)} last year</span>` : '') + (t.year.taxLost > 0.5 ? ` <span class="dim">· ${fmt(t.year.taxLost)} forgone to building and gathering</span>` : '')] as [string, string]] : []),
  ];
  if (t.hungerDeathsLastMonth > 0.5) rows.push(['Last month', `<b class="warn">${fmt(t.hungerDeathsLastMonth)} starved</b>`]);
  root.innerHTML = `
    <div class="panel-head">
      <span class="pname">${esc(rs.name)} cluster</span>
      <span class="tier">${c.members.length === 1 ? 'lone village' : `${c.members.length} settlements`}</span>
      <button id="sp-close" title="Close">×</button>
    </div>
    <table class="kv">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
    <div class="section">Members</div>
    <div class="members">${memberRow(state, c.tree, 0)}</div>
    <div class="row"><a href="#" id="sp-realm">Whole realm →</a></div>
  `;
  wire(root, host);
}

/** Fill the panel with the realm: the sum over the player's clusters. */
export function renderRealmPanel(root: HTMLElement, state: GameState, host: ClusterHost): void {
  const r = realmReport(state);
  const faction = state.factions[state.playerFaction];
  const cal = calendar(state.turn);
  const members = r.clusters.flatMap((c) => c.members.map((id) => state.settlements[id]));
  const months = r.population > 0 ? r.food / r.population : 0;
  const rows: [string, string][] = [
    ['Settlements', `${members.length} <span class="dim">— ${tierBreakdown(members)}</span>`],
    ['Clusters', `${r.clusters.length} <span class="dim">(${r.singletons} lone village${r.singletons === 1 ? '' : 's'})</span>`],
    ['People', `${fmt(r.population)} <span class="dim">— ${popByTierText(r.popByTier)}</span>`],
    ['Granaries', `${months.toFixed(1)} months of food in all <span class="dim">(${fmt(r.food)})</span>`],
    ['Last year', r.lastYear ? yearText(r.lastYear, r.population, false) : '<span class="dim">no year-end yet</span>'],
    ['This year', r.year.months > 0 ? yearText(r.year, r.population, true) : '<span class="dim">nothing yet</span>'],
    ['Realm stockpile', faction ? `${stockVsCap(faction.stock, realmCap())} <span class="dim">· what the clusters hold above their caps flows here; above the realm's cap it is lost</span>` + (() => { const y = faction.year, ly = faction.lastYear; const inY = y.overflowIn.timber + y.overflowIn.stone + y.overflowIn.goods; const lostY = y.lost.timber + y.lost.stone + y.lost.goods; const lostL = ly ? ly.lost.timber + ly.lost.stone + ly.lost.goods : 0; return (inY > 0.5 ? ` <span class="dim">· +${fmt(inY)} arrived this year</span>` : '') + (lostY > 0.5 ? ` <span class="warn">· ${fmt(lostY)} lost this year</span>` : '') + (lostL > 0.5 ? ` <span class="dim">· ${fmt(lostL)} lost last year</span>` : ''); })() : '—'],
    ['Treasury', faction ? `<b>${fmt(faction.treasury)} coins</b> <span class="dim">· this year +${fmt(faction.year.tax)} tax, +${fmt(faction.year.sales)} sales, −${fmt(faction.year.spent)} on buildings</span>` + (faction.lastYear ? ` <span class="dim">· last year +${fmt(faction.lastYear.tax)} tax, +${fmt(faction.lastYear.sales)} sales, −${fmt(faction.lastYear.spent)} spent</span>` : '') : '—'],
    ['Tax base', `${fmt(privateHandsOf(state, members))} private hands in towns and cities <span class="dim">· the private economy (DESIGN §4.2b): artisans, labourers and traders the crown taxes; building, levies and settlers draw on them</span>`],
  ];
  const clusterRows = r.clusters.map((c) => {
    const rs = state.settlements[c.root];
    const ly = c.totals.lastYear;
    const starved = ly && ly.hungerDeaths > 0.5 ? ` <span class="warn">⚠ ${fmt(ly.hungerDeaths)} starved</span>` : '';
    const st = clusterStock(state, c.root);
    return `<div class="member d0"><a href="#" data-cluster="${c.root}">${esc(rs.name)}</a> <span class="dim">${c.members.length === 1 ? 'lone village' : `${c.members.length} settlements`} · ${fmt(c.totals.population)} · ${materialsText(st)}</span>${starved}</div>`;
  }).join('');
  const sendForm = faction && host.onSend ? `<div class="section">Send materials from the realm stockpile</div>
    <div class="build-row send-row">
      <select id="sp-send-to">${r.clusters.map((c) => `<option value="${c.root}">${esc(state.settlements[c.root].name)}${c.members.length > 1 ? ' cluster' : ''}</option>`).join('')}</select>
      <label>timber <input id="sp-send-timber" type="number" min="0" step="30" value="0" /></label>
      <label>stone <input id="sp-send-stone" type="number" min="0" step="30" value="0" /></label>
      <button id="sp-send-go">Send</button>
      <div class="dim blurb">Arrives at once — a placeholder until roads and caravans carry it.</div>
    </div>` : '';
  root.innerHTML = `
    <div class="panel-head">
      <span class="pname">${esc(faction?.name ?? 'The realm')}</span>
      <span class="tier">${cal.monthName}, year ${cal.year}</span>
      <button id="sp-close" title="Close">×</button>
    </div>
    <table class="kv">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
    <div class="section">Clusters</div>
    <div class="members">${clusterRows}</div>
    ${sendForm}
  `;
  wire(root, host);
  const go = root.querySelector<HTMLButtonElement>('#sp-send-go');
  if (go && host.onSend) {
    go.addEventListener('click', () => {
      const to = root.querySelector<HTMLSelectElement>('#sp-send-to')!.value;
      const timber = Math.max(0, Number(root.querySelector<HTMLInputElement>('#sp-send-timber')!.value) || 0);
      const stone = Math.max(0, Number(root.querySelector<HTMLInputElement>('#sp-send-stone')!.value) || 0);
      if (timber + stone > 0) host.onSend!(to, { timber, stone });
    });
  }
}

function wire(root: HTMLElement, host: ClusterHost): void {
  root.querySelector<HTMLButtonElement>('#sp-close')!.addEventListener('click', () => host.onClose());
  root.querySelector<HTMLAnchorElement>('#sp-realm')?.addEventListener('click', (e) => { e.preventDefault(); host.onRealm(); });
  root.querySelectorAll<HTMLAnchorElement>('a[data-focus]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); host.onFocus(a.dataset.focus!); });
  });
  root.querySelectorAll<HTMLAnchorElement>('a[data-cluster]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); host.onCluster(a.dataset.cluster!); });
  });
}

/**
 * For the settlement panel and hover card: the cluster `s` belongs to, as text —
 * "lone village — a cluster of its own" / "heads a cluster of 22 settlements · 103,727 people"
 * / "Hugeopolis cluster · 22 settlements · 103,727 people".
 */
export function clusterLine(state: GameState, s: Settlement): { root: string; text: string } | null {
  const c = clustersOf(state).find((k) => k.members.includes(s.id));
  if (!c) return null;
  const rs = state.settlements[c.root];
  if (c.members.length === 1) return { root: c.root, text: 'lone village — a cluster of its own' };
  const tail = `${c.members.length} settlements · ${fmt(c.totals.population)} people`;
  return { root: c.root, text: c.root === s.id ? `heads a cluster of ${tail}` : `${rs.name} cluster · ${tail}` };
}
