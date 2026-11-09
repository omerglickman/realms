// The raise dialog (Phase 2 session 1b; UI-DESIGN.md §5): a small modal over
// the settlement ledger for raising a party — the size (a slider with the
// settlers' destination reckoning), the muster rows (the raising settlement,
// its cluster's members and own settlements within reach, a field each), the
// months of provisions, an optional destination picked on the map with the
// route preview, the cost chips, and Raise. The draft lives in app.ts and is
// re-rendered here; typing changes the draft and refreshes the derived parts
// in place so the inputs keep focus. Display and forwarding only.

import type { GameState } from '../../sim/state';
import { calendar } from '../../sim/state';
import type { Settlement } from '../../sim/settlements';
import { totalPopulation } from '../../sim/demography';
import { planLabour } from '../../sim/economy';
import { workedCellsBySettlement } from '../../sim/settlements';
import { MATERIAL_IDS } from '../../sim/materials';
import { idx } from '../../sim/map';
import { unitTypeDef, musterSources, raiseCheck, destinationHands, defaultSize, defaultProvisionMonths, handsShare, canFoundAt, recruitableMenOf, UNITS, type RaiseSpec } from '../../sim/units';
import { findRoute, OPEN } from '../../sim/pathfinding';
import { fmt, fmt1, esc, foodMonths, tierGlyph, ICON } from './format';

/** What the player has chosen so far. */
export interface RaiseDraft {
  type: string;
  at: string;
  /** people per source settlement id */
  muster: Record<string, number>;
  provisionMonths: number;
  dest: number | null;
  /** village name for settlers bound to found one */
  name: string;
}

export interface RaiseHost {
  onChange(): void;
  onPickDest(): void;
  onClearDest(): void;
  onRaise(spec: RaiseSpec): void;
  onClose(): void;
}

/** A fresh draft for `type` at `s`: the default size mustered from the raising settlement first, then the other sources by distance. */
export function newRaiseDraft(state: GameState, s: Settlement, type: string): RaiseDraft {
  const d: RaiseDraft = { type, at: s.id, muster: {}, provisionMonths: defaultProvisionMonths(type, calendar(state.turn).month), dest: null, name: '' };
  distribute(state, d, defaultSize(state, type, s, null));
  return d;
}

/** People a source can give without touching its working hands: its spare hands as people. */
function spareAsPeople(src: { settlement: Settlement; spareHands: number }): number {
  return Math.floor(src.spareHands / Math.max(0.3, handsShare(src.settlement.pop)) / 10) * 10;
}

/** Spread `total` people over the sources: the raising settlement's spare first, then the others' by distance, then the raising settlement up to half its people. */
export function distribute(state: GameState, d: RaiseDraft, total: number): void {
  const def = unitTypeDef(d.type);
  const sources = musterSources(state, d.at);
  d.muster = {};
  let left = Math.max(0, Math.round(total / 10) * 10);
  const cap = (src: { settlement: Settlement }) => sourceCap(def, src.settlement);
  for (const src of sources) {
    if (left <= 0) break;
    const give = Math.min(left, spareAsPeople(src), cap(src));
    if (give > 0) { d.muster[src.settlement.id] = give; left -= give; }
  }
  if (left > 0) {
    const at = sources[0];
    if (at) {
      const more = Math.min(left, Math.max(0, cap(at) - (d.muster[at.settlement.id] ?? 0)));
      if (more > 0) { d.muster[at.settlement.id] = (d.muster[at.settlement.id] ?? 0) + more; left -= more; }
    }
  }
  // still short (a small village on its own): the neighbours in reach give up to their caps, nearest first
  for (const src of sources) {
    if (left <= 0) break;
    const more = Math.min(left, Math.max(0, cap(src) - (d.muster[src.settlement.id] ?? 0)));
    if (more > 0) { d.muster[src.settlement.id] = (d.muster[src.settlement.id] ?? 0) + more; left -= more; }
  }
}

/** The most one source may be asked for: levies — a quarter of its people, never more than its men 15–44; others — half. */
export function sourceCap(def: ReturnType<typeof unitTypeDef>, s: Settlement): number {
  const raw = def.slice === 'men' ? Math.min(totalPopulation(s.pop) * 0.25, recruitableMenOf(s.pop)) : totalPopulation(s.pop) * 0.5;
  return Math.floor(raw / 10) * 10;
}

export function draftTotal(d: RaiseDraft): number {
  return Object.values(d.muster).reduce((t, n) => t + Math.max(0, n || 0), 0);
}

export function draftSpec(d: RaiseDraft): RaiseSpec {
  const def = unitTypeDef(d.type);
  return {
    type: d.type, at: d.at,
    muster: Object.entries(d.muster).filter(([, n]) => n > 0).map(([id, people]) => ({ id, people })),
    provisionMonths: d.provisionMonths,
    dest: d.dest,
    then: d.dest !== null && def.canSettle ? 'settle' : 'none',
    name: d.name.trim() || undefined,
  };
}

/** Render the dialog into `root`. */
export function renderRaiseDialog(root: HTMLElement, state: GameState, d: RaiseDraft, host: RaiseHost): void {
  const s = state.settlements[d.at];
  if (!s) { host.onClose(); return; }
  const def = unitTypeDef(d.type);
  const sources = musterSources(state, d.at);
  const poolTotal = Math.max(10, sources.reduce((t, src) => t + sourceCap(def, src.settlement), 0));
  // the slider runs to three times the usual party (the fields take any number)
  const usual = defaultSize(state, d.type, s, d.dest);
  const maxTotal = Math.min(poolTotal, Math.max(usual * 3, 3000, draftTotal(d)));
  const rows = sources.map((src) => {
    const m = src.settlement;
    const spare = spareAsPeople(src);
    return `<tr><td>${tierGlyph(m.tier)}${esc(m.name)}${m.id === d.at ? ' <span class="dim">(here)</span>' : ` <span class="dim">· ${src.distance} hex${src.distance === 1 ? '' : 'es'}</span>`}</td><td class="r dimrow">${fmt(totalPopulation(m.pop))}</td><td class="r dimrow">${fmt(src.spareHands)} <span class="dim">≈ ${fmt(spare)} people</span></td><td class="r dimrow">${fmt1(foodMonths(m))}</td><td class="r"><input type="number" class="rd-m" data-src="${m.id}" min="0" step="10" value="${Math.round(d.muster[m.id] ?? 0)}" style="width:5.5em"></td></tr>`;
  }).join('');
  root.innerHTML = `
    <div class="rd-head"><span class="rd-ico">${ICON[def.icon] ?? ICON.walk}</span><div><div class="rd-title">Raise ${esc(def.name.toLowerCase())}</div><div class="dim">at ${esc(s.name)} · ${esc(def.blurb ?? '')}</div></div><button class="m-close" data-act="close" title="Close (Esc)">×</button></div>
    <div class="rd-body">
      <h3>How many</h3>
      <div class="form-row"><input type="range" id="rd-size" min="10" max="${maxTotal}" step="10" value="${Math.min(maxTotal, draftTotal(d))}" style="flex:1;min-width:200px"> <b class="num" data-d="total" style="min-width:5em;text-align:right">${fmt(draftTotal(d))}</b> people</div>
      <p class="note" data-d="reckoning"></p>
      <h3>Provisions</h3>
      <div class="form-row"><label>months of food <input type="number" id="rd-prov" min="0" max="${UNITS.provisions.maxMonths}" step="1" value="${d.provisionMonths}" style="width:4.5em"></label> <span class="dim" data-d="prov"></span></div>
      <h3>Destination <small>optional</small></h3>
      <div class="form-row"><span data-d="dest"></span> <button class="btn small" data-act="pick">${d.dest === null ? 'Pick on the map' : 'Pick another'}</button>${d.dest !== null ? ' <button class="btn small" data-act="clear">Clear</button>' : ''}</div>
      ${def.canSettle ? `<div class="form-row" data-d="namerow" ${d.dest === null ? 'style="display:none"' : ''}><label>village name <input type="text" id="rd-name" value="${esc(d.name)}" placeholder="${esc(UNITS.naming.pattern.replace('{home}', s.name))}" style="width:14em"></label></div>` : ''}
      <h3>Muster <small>who gives whom</small></h3>
      <table class="data"><tr><th>Settlement</th><th class="r">people</th><th class="r">spare hands</th><th class="r">food (mo)</th><th class="r">leave</th></tr>${rows}</table>
      <p class="note">${def.slice === 'men' ? 'Men 15–44 are called; everyone else stays.' : 'A proportional slice of every cohort leaves each source, with its share of the granary.'} Spare hands go first; taking more than the spare takes working hands off the fields and buildings. Everyone gathers here and the party forms at the end of the month.</p>
    </div>
    <div class="rd-foot"><div class="cost" data-d="cost"></div><span class="warn" data-d="why"></span><span class="spacer"></span><button class="btn primary" data-act="raise">Raise</button></div>
  `;
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const set = (k: string, html: string) => { const e = q<HTMLElement>(`[data-d=${k}]`); if (e) e.innerHTML = html; };
  const taxDent = (() => {
    const worked = workedCellsBySettlement(state).get(s.id) ?? [];
    const plan = planLabour(state.map, s, worked);
    return plan.taxableHands > 0 ? plan.taxPerYear / plan.taxableHands : 0;
  })();

  const refresh = () => {
    const total = draftTotal(d);
    set('total', fmt(total));
    const slider = q<HTMLInputElement>('#rd-size');
    if (slider) { if (total > Number(slider.max)) slider.max = String(Math.min(poolTotal, total)); if (Math.abs(Number(slider.value) - total) >= 5) slider.value = String(total); }
    // the reckoning
    if (def.defaultSize === 'destination') {
      const hands = destinationHands(state, d.dest);
      const share = Math.max(0.3, handsShare(s.pop));
      const want = defaultSize(state, d.type, s, d.dest);
      set('reckoning', `To work ${d.dest === null ? 'seven farm hexes' : 'the land around the destination'} plus a hall and a granary takes <b>${fmt(hands)} hands</b>; at ${Math.round(100 * share)} % hands per head that is <b>${fmt(want)} people</b>${Math.abs(total - want) >= 10 ? ` — you are sending ${total < want ? 'fewer' : 'more'}` : ''}. A village starts to crowd above about ${fmt(900)} people on seven hexes.`);
    } else set('reckoning', `The usual party is ${fmt(def.defaultSize as number)}.`);
    // provisions
    const need = total * d.provisionMonths;
    const have = Object.entries(d.muster).reduce((t, [id, n]) => t + Math.min(state.settlements[id]?.food ?? 0, Math.max(0, n) * d.provisionMonths), 0);
    set('prov', `${fmt(need)} food leaves the granaries${have + 0.5 < need ? ` — <span class="warn">only ${fmt(have)} is there</span>` : ''} · ${esc(s.name)} holds ${fmt1(foodMonths(s))} months${def.defaultProvisions === 'calendar' ? ` · the harvest is in ${(UNITS.provisions.harvestMonth - calendar(state.turn).month + 12) % 12 || 12} months` : ''}`);
    // destination
    if (d.dest === null) set('dest', `<span class="dim">none — the party waits here for orders</span>`);
    else {
      const w = state.map.width;
      const col = d.dest % w, row = Math.floor(d.dest / w);
      const route = findRoute(state, { cell: idx(state.map, s.col, s.row), bank: OPEN }, d.dest, def.movePoints);
      const found = def.canSettle ? canFoundAt(state, d.dest) : null;
      set('dest', `(${col}, ${row}) · ${route && Number.isFinite(route.months) ? `${route.months} month${route.months === 1 ? '' : 's'}' walk` : '<span class="warn">no way there</span>'}${found ? found.ok ? ' · <span class="good">founds a village on arrival</span>' : ` · <span class="warn">cannot settle there: ${esc(found.reason ?? '')}</span>` : ''}`);
    }
    const nr = q<HTMLElement>('[data-d=namerow]');
    if (nr) nr.style.display = d.dest === null ? 'none' : '';
    // cost and the verdict
    const check = raiseCheck(state, draftSpec(d));
    const chips: string[] = [];
    const money = def.cost.money ?? 0;
    if (money > 0) chips.push(`<span class="${check.lackingMoney ? 'short' : ''}">${ICON.coin} ${fmt(money)}</span>`);
    for (const k of MATERIAL_IDS) { const v = def.cost[k] ?? 0; if (v > 0) chips.push(`<span class="${check.lacking && check.lacking[k] > 0 ? 'short' : ''}">${k === 'timber' ? ICON.timber : k === 'stone' ? ICON.stone : ICON.goods} ${fmt(v)}${check.fromRealm && check.fromRealm[k] > 0 ? ` <span class="dim">(${fmt(check.fromRealm[k])} from the realm)</span>` : ''}</span>`); }
    chips.push(`<span>${ICON.people} ${fmt(total)}</span>`);
    chips.push(`<span>${ICON.wheat} ${fmt(need)}</span>`);
    if (taxDent > 0 && (d.muster[s.id] ?? 0) > 0) chips.push(`<span class="dim" title="tax forgone a year while these people are away">−${fmt((d.muster[s.id] ?? 0) * handsShare(s.pop) * taxDent)} coins / yr</span>`);
    set('cost', chips.join(''));
    set('why', check.ok ? '' : esc(check.reason ?? ''));
    const btn = q<HTMLButtonElement>('[data-act=raise]');
    if (btn) btn.disabled = !check.ok;
  };

  q<HTMLInputElement>('#rd-size')?.addEventListener('input', (e) => {
    distribute(state, d, Number((e.target as HTMLInputElement).value));
    root.querySelectorAll<HTMLInputElement>('.rd-m').forEach((i) => { i.value = String(Math.round(d.muster[i.dataset.src!] ?? 0)); });
    refresh(); host.onChange();
  });
  root.querySelectorAll<HTMLInputElement>('.rd-m').forEach((i) => i.addEventListener('input', () => {
    d.muster[i.dataset.src!] = Math.max(0, Number(i.value) || 0);
    refresh(); host.onChange();
  }));
  q<HTMLInputElement>('#rd-prov')?.addEventListener('input', (e) => {
    d.provisionMonths = Math.max(0, Math.min(UNITS.provisions.maxMonths, Math.round(Number((e.target as HTMLInputElement).value) || 0)));
    refresh(); host.onChange();
  });
  q<HTMLInputElement>('#rd-name')?.addEventListener('input', (e) => { d.name = (e.target as HTMLInputElement).value; host.onChange(); });
  q('[data-act=pick]')?.addEventListener('click', () => host.onPickDest());
  q('[data-act=clear]')?.addEventListener('click', () => host.onClearDest());
  q('[data-act=close]')?.addEventListener('click', () => host.onClose());
  q('[data-act=raise]')?.addEventListener('click', () => { const spec = draftSpec(d); if (raiseCheck(state, spec).ok) host.onRaise(spec); });
  refresh();
}
