// The cluster ledger (Session 13): the unit inside which food flows —
// Overview, Members, Food (+ Send food between members, Phase 2 session 1b),
// Stockpile. Display only, except the Send forms it forwards.

import type { GameState } from '../../sim/state';
import { calendar } from '../../sim/state';
import { TIERS, canOverrideParent, isCastle, type Settlement, type YearTotals } from '../../sim/settlements';
import { clusterPeers } from '../../sim/upgrades';
import { totalPopulation } from '../../sim/demography';
import { type Cluster, type ClusterNode } from '../../sim/clusters';
import { clusterStock, clusterCap, MATERIAL_IDS, type Materials } from '../../sim/materials';
import { titheShare } from '../../sim/economy';
import { fmt, fmt1, signed, esc, tierGlyph, tierName, tierBreakdown, tierLabel, PEOPLE_TIERS, popByTierText, foodMonths, projectText, gauge, hbar, stack, stat, kv, ICON } from './format';
import type { ModalSpec } from './modal';

export const CLUSTER_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'food', label: 'Food' },
  { id: 'stockpile', label: 'Stockpile' },
];

export interface SendHost {
  onSend(root: string, amount: Partial<Materials>): void;
}

export interface SendFoodHost {
  onSendFood(from: string, to: string, amount: number): void;
}

export interface LeadershipHost {
  onSetParents(changes: { id: string; parent: string | null }[]): void;
}

/** The Leadership block (DESIGN §3.3, Omer 2026-11-07): when several members share the cluster's top tier, choose which leads or split one off. */
function leadershipBlock(state: GameState, c: Cluster): string {
  const root = state.settlements[c.root];
  const peers = clusterPeers(state, root, c.members);
  if (peers.length < 2) return '';
  const rows = peers.map((p) => {
    const isRoot = p.id === c.root;
    const others = peers.filter((o) => o.id !== p.id);
    const unreachable = others.filter((o) => !canOverrideParent(state, o, p.id));
    const lead = isRoot ? '<span class="dim">leads now</span>'
      : unreachable.length ? `<button class="btn small" disabled title="${esc(unreachable.map((o) => o.name).join(', '))} ${unreachable.length === 1 ? 'lies' : 'lie'} beyond its influence">Make leader</button>`
      : `<button class="btn small" data-lead="${p.id}" title="Every other ${tierName(p).toLowerCase()} of the cluster goes under ${esc(p.name)}">Make leader</button>`;
    const split = isRoot ? '' : `<button class="btn small danger" data-split="${p.id}" title="${esc(p.name)} heads a cluster of its own, with the villages nearer to it">Split off</button>`;
    return `<tr><td>${tierGlyph(p.tier)}<a href="#" data-focus="${p.id}">${esc(p.name)}</a>${isRoot ? ' <span class="dim">(leader)</span>' : p.parent ? ` <span class="dim">under ${esc(state.settlements[p.parent]?.name ?? '')}</span>` : ''}</td><td class="r">${fmt(totalPopulation(p.pop))}</td><td class="r">${fmt1(foodMonths(p))}</td><td class="r">${lead} ${split}</td></tr>`;
  }).join('');
  const tn = tierName(root).toLowerCase();
  return `<h3>Leadership <small>${peers.length} ${tn.endsWith('y') ? tn.slice(0, -1) + 'ies' : tn + 's'} in one cluster</small></h3>
    <table class="data"><tr><th>Settlement</th><th class="r">people</th><th class="r">food (mo)</th><th class="r"></th></tr>${rows}</table>
    <p class="note">A settlement that grows to its parent's tier stays in the cluster under it. The crown may name another of them the leader — the rest go under it and the tithe and surplus flow its way — or split one off into a cluster of its own; equal tiers never rejoin by themselves.</p>`;
}

export function wireLeadership(root: HTMLElement, state: GameState, c: Cluster, host: LeadershipHost): void {
  const rs = state.settlements[c.root];
  if (!rs) return;
  const peers = clusterPeers(state, rs, c.members);
  root.querySelectorAll<HTMLButtonElement>('[data-lead]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.lead!;
    host.onSetParents([{ id, parent: null }, ...peers.filter((p) => p.id !== id).map((p) => ({ id: p.id, parent: id }))]);
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-split]').forEach((b) => b.addEventListener('click', () => host.onSetParents([{ id: b.dataset.split!, parent: null }])));
}

/** The Send food form (DESIGN §3.2b rule 6, DECIDED 2026-11-07 — by hand, never automatic): grain from one member of the cluster to another. */
export function sendFoodForm(state: GameState, c: Cluster): string {
  const members = c.members.map((id) => state.settlements[id]).sort((a, b) => TIERS[b.tier].rank - TIERS[a.tier].rank || (a.name < b.name ? -1 : 1));
  if (members.length < 2) return '<p class="note">A lone settlement has nobody to send food to.</p>';
  const opt = (sel: (m: Settlement, i: number) => boolean) => members.map((m, i) => `<option value="${m.id}" ${sel(m, i) ? 'selected' : ''}>${esc(m.name)} — ${fmt1(foodMonths(m))} mo (${fmt(m.food)})</option>`).join('');
  const hungriest = members.slice().sort((a, b) => foodMonths(a) - foodMonths(b))[0];
  const fullest = members.slice().sort((a, b) => foodMonths(b) - foodMonths(a))[0];
  return `<div class="form-row">
    <label>from <select id="sf-from">${opt((m) => m.id === fullest.id)}</select></label>
    <label>to <select id="sf-to">${opt((m) => m.id === hungriest.id)}</select></label>
    <label>${ICON.wheat} food <input id="sf-amount" type="number" min="0" step="100" value="${Math.max(0, Math.round(Math.min(fullest.food * 0.25, Math.max(0, 3 * totalPopulation(hungriest.pop) - hungriest.food)) / 100) * 100)}" style="width:7em"></label>
    <button id="sf-go" class="btn primary small">Send food</button>
    <span class="dim">one month of food feeds one person · arrives at once (a placeholder until roads carry it)</span>
  </div>`;
}

export function wireSendFood(root: HTMLElement, host: SendFoodHost): void {
  const go = root.querySelector<HTMLButtonElement>('#sf-go');
  if (!go) return;
  go.addEventListener('click', () => {
    const from = root.querySelector<HTMLSelectElement>('#sf-from')!.value;
    const to = root.querySelector<HTMLSelectElement>('#sf-to')!.value;
    const amount = Math.max(0, Number(root.querySelector<HTMLInputElement>('#sf-amount')?.value) || 0);
    if (amount > 0 && from !== to) host.onSendFood(from, to, amount);
  });
}

/** "1,200 / 5,220 timber" rows as bars. */
export function stockBars(stock: Materials, cap: Materials): string {
  return `<div class="bars">${MATERIAL_IDS.map((k) => `<div class="bl">${k === 'timber' ? ICON.timber : k === 'stone' ? ICON.stone : ICON.goods} ${k}</div>${hbar(stock[k], Number.isFinite(cap[k]) ? cap[k] : stock[k], k === 'timber' ? 'c4' : k === 'stone' ? 'c1' : 'c3')}<div class="bv">${fmt(stock[k])} <span class="dim">/ ${Number.isFinite(cap[k]) ? fmt(cap[k]) : '∞'}</span></div>`).join('')}</div>`;
}

/** The Send form: ship from the realm stockpile to a cluster. */
export function sendForm(state: GameState, roots: { root: string; label: string }[], fixedRoot?: string): string {
  const f = state.factions[state.playerFaction];
  if (!f) return '';
  return `<div class="form-row">
    ${fixedRoot ? `<input type="hidden" id="sp-send-to" value="${fixedRoot}">` : `<label>to <select id="sp-send-to">${roots.map((r) => `<option value="${r.root}">${esc(r.label)}</option>`).join('')}</select></label>`}
    <label>${ICON.timber} timber <input id="sp-send-timber" type="number" min="0" step="30" value="0" max="${Math.floor(f.stock.timber)}"></label>
    <label>${ICON.stone} stone <input id="sp-send-stone" type="number" min="0" step="30" value="0" max="${Math.floor(f.stock.stone)}"></label>
    <label>${ICON.goods} goods <input id="sp-send-goods" type="number" min="0" step="30" value="0" max="${Math.floor(f.stock.goods)}"></label>
    <button id="sp-send-go" class="btn primary small">Send</button>
    <span class="dim">the realm holds ${fmt(f.stock.timber)} timber · ${fmt(f.stock.stone)} stone · ${fmt(f.stock.goods)} goods · arrives at once (a placeholder until roads and caravans carry it)</span>
  </div>`;
}

export function wireSend(root: HTMLElement, host: SendHost): void {
  const go = root.querySelector<HTMLButtonElement>('#sp-send-go');
  if (!go) return;
  go.addEventListener('click', () => {
    const to = root.querySelector<HTMLInputElement | HTMLSelectElement>('#sp-send-to')!.value;
    const n = (id: string) => Math.max(0, Number(root.querySelector<HTMLInputElement>(id)?.value) || 0);
    const amount = { timber: n('#sp-send-timber'), stone: n('#sp-send-stone'), goods: n('#sp-send-goods') };
    if (amount.timber + amount.stone + amount.goods > 0) host.onSend(to, amount);
  });
}

/** One line summarising a year's food balance. */
export function yearFoodText(y: YearTotals, population: number, partial: boolean): string {
  const net = y.produced - y.consumed;
  const months = population > 0 ? net / population : 0;
  const bits = [`${fmt(y.produced)} grown`, `${fmt(y.consumed)} eaten`, `<b class="${net >= 0 ? 'good' : 'warn'}">${signed(net)}</b> <span class="dim">(${months >= 0 ? '+' : '−'}${Math.abs(months).toFixed(1)} mo of stock)</span>`];
  if (y.titheIn > 0.5) bits.push(`${fmt(y.titheIn)} tithed up`);
  if (y.received > 0.5) bits.push(`${fmt(y.received)} surplus moved up`);
  if (y.hungerDeaths > 0.5) bits.push(`<b class="warn">${fmt(y.hungerDeaths)} starved</b>`);
  if (y.migrantsIn > 0.5) bits.push(`${fmt(y.migrantsIn)} fled hunger inside`);
  return bits.join(', ') + (partial ? ` <span class="dim">· ${y.months} month${y.months === 1 ? '' : 's'} so far</span>` : '');
}

function memberRows(state: GameState, node: ClusterNode, depth: number): string {
  const s = state.settlements[node.id];
  const pop = totalPopulation(s.pop);
  const months = foodMonths(s);
  const r = s.report;
  const warn = r.hungerDeaths > 0.5 ? `<span class="warn" title="${fmt(r.hungerDeaths)} starved last month">${ICON.skull}</span>` : '';
  const proj = s.build ? `<span class="dim" title="${esc(projectText(s) ?? '')}">${ICON.hammer}</span>` : '';
  const row = `<tr class="d${depth}"><td>${tierGlyph(s.tier)}<a href="#" data-focus="${s.id}">${esc(s.name)}</a></td><td class="dimrow">${TIERS[s.tier].name.toLowerCase()}</td>${isCastle(s) ? `<td class="r"><span class="dim">—</span></td><td><span class="dim">reserve ${fmt(s.food)}</span></td>` : `<td class="r">${fmt(pop)}</td><td>${hbar(months, 24, months < 3 ? 'c5' : months < 6 ? 'c3' : 'c2', `${fmt1(months)} months of food`)} <span class="num">${fmt1(months)}</span></td>`}<td class="r">${s.buildings.length - 2 > 0 ? s.buildings.length - 2 : '<span class="dim">—</span>'}</td><td class="r">${r.privateHands > 0.5 ? fmt(r.tax * 12) : '<span class="dim">—</span>'}</td><td>${proj} ${warn}</td></tr>`;
  return row + node.children.map((k) => memberRows(state, k, depth + 1)).join('');
}

export function clusterSpec(state: GameState, c: Cluster, tab: string, canSend: boolean): ModalSpec {
  const rs = state.settlements[c.root];
  const members = c.members.map((id) => state.settlements[id]);
  const t = c.totals;
  const months = t.monthlyNeed > 0 ? t.food / t.monthlyNeed : 0;
  const cal = calendar(state.turn);
  const privateHands = members.reduce((a, m) => a + m.report.privateHands, 0);
  const body =
    tab === 'members' ? membersPage(state, c) :
    tab === 'food' ? foodPage(state, c, canSend) :
    tab === 'stockpile' ? stockpilePage(state, c, canSend) :
    overviewPage(state, c, privateHands);
  return {
    title: `${esc(rs.name)} <span class="dim" style="font-size:18px">cluster</span>`,
    badge: c.members.length === 1 ? 'lone village' : `${c.members.length} settlements`,
    stripe: state.factions[c.faction ?? '']?.color ?? '#4a2f1a',
    sub: `${tierBreakdown(members)} · <b>${fmt(t.population)}</b> people · ${fmt1(months)} months of food · headed by <a href="#" data-focus="${rs.id}">${esc(rs.name)}</a> · <a href="#" data-open="realm" data-id="" data-tab="clusters">whole realm →</a>`,
    right: `${cal.monthName}, year ${cal.year}`,
    tabs: CLUSTER_TABS,
    tab,
    body,
  };
}

function overviewPage(state: GameState, c: Cluster, privateHands: number): string {
  const t = c.totals;
  const members = c.members.map((id) => state.settlements[id]);
  const months = t.monthlyNeed > 0 ? t.food / t.monthlyNeed : 0;
  const stock = clusterStock(state, c.root), cap = clusterCap(state, c.root);
  const stats = [
    stat(ICON.people, 'People', fmt(t.population), popByTierText(t.popByTier, members)),
    stat(ICON.granary, 'Food', `${fmt1(months)} <small>months</small>`, `${fmt(t.food)} in all granaries`, gauge(months / 24, { marks: [3 / 24] })),
    stat(ICON.coin, 'Tax', `${fmt(t.year.tax)} <small>coins this year</small>`, `${fmt(privateHands)} private hands` + (t.lastYear ? ` · ${fmt(t.lastYear.tax)} last year` : '')),
    stat(ICON.goods, 'Stockpile', `${fmt(stock.timber)} <small>timber</small>`, `${fmt(stock.stone)} stone · ${fmt(stock.goods)} goods · cap ${fmt(cap.timber)} / ${fmt(cap.stone)} / ${fmt(cap.goods)}`),
  ].join('');
  const rows: [string, string][] = [
    ['Last year', t.lastYear ? yearFoodText(t.lastYear, t.population, false) : '<span class="dim">no year-end yet</span>'],
    ['This year', t.year.months > 0 ? yearFoodText(t.year, t.population, true) : '<span class="dim">nothing yet</span>'],
  ];
  if (t.hungerDeathsLastMonth > 0.5) rows.push(['Last month', `<b class="warn">${fmt(t.hungerDeathsLastMonth)} starved</b> somewhere in the cluster`]);
  return `<div class="stats">${stats}</div>
    <h3>People by tier</h3>${stack(PEOPLE_TIERS.map((i) => ({ label: tierLabel(i, members), value: t.popByTier[i], cls: `c${4 - i}` })).reverse())}
    <h3>The year</h3>${kv(rows)}
    ${c.faction === state.playerFaction ? leadershipBlock(state, c) : ''}
    <p class="note">A cluster is an independent settlement with everything subordinate to it. Food flows only inside a cluster: villages tithe ${Math.round(100 * titheShare())} % of what they grow to their parent as they grow it, and send their surplus up after the harvest; migrants and the yearly pull go the same way.</p>`;
}

function membersPage(state: GameState, c: Cluster): string {
  return `<table class="data"><tr><th>Settlement</th><th>tier</th><th class="r">people</th><th>food (months)</th><th class="r">built</th><th class="r">tax / yr</th><th></th></tr>${memberRows(state, c.tree, 0)}</table>
    <p class="note">Towns are nested under their city and villages under their town. "Built" counts buildings beyond the hall and granary; tax is last month's ×12.</p>`;
}

function foodPage(state: GameState, c: Cluster, canSend: boolean): string {
  const t = c.totals;
  const members = c.members.map((id) => state.settlements[id]);
  const y = t.lastYear ?? t.year;
  const partial = !t.lastYear;
  const flows = stack([
    { label: 'eaten', value: y.consumed, cls: 'c2' },
    { label: 'tithed to parents', value: y.titheIn, cls: 'c3' },
    { label: 'surplus moved up', value: y.received, cls: 'c1' },
  ]);
  const rows = members.slice().sort((a, b) => TIERS[b.tier].rank - TIERS[a.tier].rank || totalPopulation(b.pop) - totalPopulation(a.pop)).map((s) => {
    const ly = s.lastYear ?? s.year;
    const pop = totalPopulation(s.pop);
    const net = ly.produced - ly.consumed;
    return `<tr><td>${tierGlyph(s.tier)}<a href="#" data-focus="${s.id}">${esc(s.name)}</a></td><td class="r">${fmt(ly.produced)}</td><td class="r">${fmt(ly.consumed)}</td><td class="r ${net >= 0 ? 'good' : 'warn'}">${signed(net)}</td><td class="r">${ly.titheOut > 0.5 ? fmt(ly.titheOut) : ''}${ly.titheIn > 0.5 ? `<span class="good">+${fmt(ly.titheIn)}</span>` : ''}</td><td class="r">${ly.sent > 0.5 ? fmt(ly.sent) : ''}${ly.received > 0.5 ? `<span class="good">+${fmt(ly.received)}</span>` : ''}</td><td class="r">${ly.hungerDeaths > 0.5 ? `<span class="warn">${fmt(ly.hungerDeaths)}</span>` : ''}</td><td class="r">${fmt1(foodMonths(s))}</td><td class="r dimrow">${fmt(pop)}</td></tr>`;
  }).join('');
  return `<h3>${partial ? 'This year so far' : 'Last year'} <small>${fmt(y.produced)} grown in the cluster</small></h3>${flows}
    <p class="note">Grown ${fmt(y.produced)}, eaten ${fmt(y.consumed)}: <b class="${y.produced >= y.consumed ? 'good' : 'warn'}">${signed(y.produced - y.consumed)}</b>${y.hungerDeaths > 0.5 ? ` · <b class="warn">${fmt(y.hungerDeaths)} starved</b>` : ''}${y.migrantsIn > 0.5 ? ` · ${fmt(y.migrantsIn)} fled hunger to their parents` : ''}.</p>
    ${canSend ? `<h3>Send food <small>between members, by the crown's order</small></h3>${sendFoodForm(state, c)}` : ''}
    <h3>By settlement <small>${partial ? 'this year so far' : 'last year'}</small></h3>
    <table class="data"><tr><th>Settlement</th><th class="r">grown</th><th class="r">eaten</th><th class="r">net</th><th class="r">tithe</th><th class="r">surplus</th><th class="r">starved</th><th class="r">months now</th><th class="r">people</th></tr>${rows}</table>`;
}

function stockpilePage(state: GameState, c: Cluster, canSend: boolean): string {
  const t = c.totals;
  const stock = clusterStock(state, c.root), cap = clusterCap(state, c.root);
  const members = c.members.map((id) => state.settlements[id]);
  const holders = members.filter((m) => m.stock.timber + m.stock.stone + m.stock.goods > 0.5).sort((a, b) => (b.stock.timber + b.stock.stone + b.stock.goods) - (a.stock.timber + a.stock.stone + a.stock.goods));
  const rows = holders.map((m) => `<tr><td>${tierGlyph(m.tier)}<a href="#" data-focus="${m.id}">${esc(m.name)}</a></td><td class="r">${fmt(m.stock.timber)}</td><td class="r">${fmt(m.stock.stone)}</td><td class="r">${fmt(m.stock.goods)}</td><td class="r dimrow">+${fmt(m.report.timber)} / +${fmt(m.report.stone)} / +${fmt(m.report.goods)}</td></tr>`).join('');
  const warehouses = members.filter((m) => m.buildings.includes('warehouse')).length;
  const markets = members.filter((m) => m.buildings.includes('market')).length;
  return `<h3>Held against the cap</h3>${stockBars(stock, cap)}
    <p class="note">Base cap plus a share per member settlement${warehouses ? ` plus ${warehouses} Warehouse${warehouses === 1 ? '' : 's'}` : ''}. Above it, what the cluster gathers flows to the realm stockpile each month. This year: +${fmt(t.year.timber)} timber, +${fmt(t.year.stone)} stone, +${fmt(t.year.goods)} goods gathered or made${t.year.surplusOut > 0.5 ? `; ${fmt(t.year.surplusOut)} overflowed to the realm` : ''}${t.year.sold > 0.5 ? `; goods sold for ${fmt(t.year.sold)} coins` : ''}. ${markets ? `${markets} Market${markets === 1 ? '' : 's'} sell the cluster's goods.` : '<b>No Market in this cluster</b> — its goods only pile up and overflow.'}</p>
    ${canSend ? `<h3>Ship from the realm stockpile</h3>${sendForm(state, [], c.root)}` : ''}
    <h3>Who holds what <small>stock · gathered last month</small></h3>
    ${holders.length ? `<table class="data"><tr><th>Settlement</th><th class="r">timber</th><th class="r">stone</th><th class="r">goods</th><th class="r">last month</th></tr>${rows}</table>` : '<p class="note">Nobody holds anything yet.</p>'}`;
}

export function membersOf(state: GameState, c: Cluster): Settlement[] {
  return c.members.map((id) => state.settlements[id]);
}
