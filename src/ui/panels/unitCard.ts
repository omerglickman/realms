// The unit card (Phase 2 session 1b; UI-DESIGN.md §5): a pinned card in the
// hover card's shape next to a selected unit — type and name, people and
// hands, provisions with a gauge, home, order and months to arrival, state,
// warnings from last month's report — and the orders: Move, Settle here /
// Settle at…, Disband, Cancel order. Display and forwarding only.

import type { GameState } from '../../sim/state';
import { type Unit, unitTypeDef, isForming, unitCell, canSettle, disbandTarget, routeFor, UNITS } from '../../sim/units';
import { totalPopulation, workingHands } from '../../sim/demography';
import { fmt, fmt1, esc, gauge, ICON } from './format';

export interface UnitCardHost {
  onMove(id: string): void;
  onSettleAt(id: string): void;
  onSettleHere(id: string): void;
  onDisband(id: string): void;
  onCancelOrder(id: string): void;
  onFocusSettlement(id: string): void;
}

/** One-word state of a unit for the card and the status strip. */
export function unitState(state: GameState, u: Unit): string {
  if (isForming(state, u)) return 'mustering';
  if (u.order) {
    if (u.report.blocked) return 'blocked';
    if (u.order.dest === unitCell(state.map, u)) return 'arrived';
    return u.order.then === 'settle' ? 'marching to settle' : u.order.then === 'disband' ? 'going home' : 'marching';
  }
  if (!u.report.inBorders) return 'foraging';
  return 'waiting';
}

export function renderUnitCard(root: HTMLElement, state: GameState, u: Unit, host: UnitCardHost): void {
  const def = unitTypeDef(u.type);
  const pop = totalPopulation(u.pop);
  const hands = workingHands(u.pop);
  const months = pop > 0 ? u.provisions / pop : 0;
  const home = state.settlements[u.home];
  const forming = isForming(state, u);
  const here = unitCell(state.map, u);
  const w = state.map.width;
  const row = (k: string, v: string) => `<div class="pop-row"><span>${k}</span><span class="num">${v}</span></div>`;
  const rows: string[] = [];
  rows.push(row('People', `${fmt(pop)} <span class="dim">· ${fmt(hands)} hands</span>`));
  rows.push(row('Food', `${fmt1(months)} months <span class="dim">of ${u.provisionMonths}</span>`));
  rows.push(gauge(UNITS.provisions.maxMonths > 0 ? months / UNITS.provisions.maxMonths : 0, { marks: [u.provisionMonths / UNITS.provisions.maxMonths], title: `${fmt(u.provisions)} food carried; the mark is the months the party keeps topped up to inside the borders` }));
  rows.push(row('Home', home ? `<a href="#" data-home="${home.id}">${esc(home.name)}</a>` : '<span class="dim">gone</span>'));
  if (u.order) {
    const dest = u.order.dest;
    const dcol = dest % w, drow = Math.floor(dest / w);
    const route = dest === here ? null : routeFor(state, u, dest);
    const left = dest === here ? 0 : route && Number.isFinite(route.months) ? route.months : null;
    const what = u.order.then === 'settle' ? 'to found a village' : u.order.then === 'disband' ? `to disband into ${esc(state.settlements[u.order.to ?? '']?.name ?? 'a settlement')}` : '';
    rows.push(row('Bound for', `(${dcol}, ${drow}) ${what ? `<span class="dim">${what}</span>` : ''}`));
    rows.push(row('Arrives', left === null ? '<span class="warn">no way there</span>' : left === 0 ? 'there now' : `in ${left} month${left === 1 ? '' : 's'}${forming ? ' <span class="dim">after forming</span>' : ''}`));
  }
  rows.push(row('State', unitState(state, u) + (u.report.inBorders ? '' : ' <span class="dim">· outside the borders</span>')));
  const r = u.report;
  const warn: string[] = [];
  if (forming) warn.push(`${ICON.hand} forms at the end of this month; cancel it from ${esc(home?.name ?? 'the home settlement')}'s Recruitment page`);
  if (r.blocked) warn.push(`${ICON.warn} ${esc(r.blocked)}`);
  if (r.shortfall > 0) warn.push(`${ICON.skull} <b>starving in the field</b>: ${fmt(r.hungerDeaths)} died last month`);
  else if (!r.inBorders && !forming) warn.push(`${ICON.deer} foraged ${fmt(r.foraged)} last month against ${fmt(r.consumed)} eaten`);
  if (!forming && months < 1 && !r.inBorders) warn.push(`${ICON.warn} the bags are nearly empty`);
  // orders
  const settleCheck = def.canSettle ? canSettle(state, u) : null;
  const disband = disbandTarget(state, u);
  const btns: string[] = [];
  if (!forming) {
    btns.push(`<button class="btn small" data-act="move" title="Walk to a hex you click on the map">${ICON.walk} Move</button>`);
    if (def.canSettle) {
      btns.push(`<button class="btn small" data-act="settleAt" title="Walk to a hex and found a village there">${ICON.village} Settle at…</button>`);
      btns.push(`<button class="btn small primary" data-act="settleHere" ${settleCheck?.ok ? '' : `disabled title="${esc(settleCheck?.reason ?? '')}"`}>Settle here</button>`);
    }
    btns.push(`<button class="btn small ${disband.ok ? '' : ''}" data-act="disband" ${disband.ok ? `title="Rejoin ${esc(disband.target!.name)}${disband.distance ? ` (${disband.distance} hex${disband.distance === 1 ? '' : 'es'} away — walks there)` : ''}"` : `disabled title="${esc(disband.reason ?? '')}"`}>Disband</button>`);
    if (u.order) btns.push(`<button class="btn small danger" data-act="cancel" title="Stay where it stands">Cancel order</button>`);
  }
  root.innerHTML = `
    <div class="pop-head"><span class="pop-ico">${ICON[def.icon] ?? ICON.walk}</span><span class="pop-name">${esc(u.name)}</span><span class="pop-tier">${esc(def.name)}</span></div>
    ${rows.join('')}
    ${warn.length ? `<div class="warnline">${warn.join('<br>')}</div>` : ''}
    ${btns.length ? `<div class="pop-actions">${btns.join('')}</div>` : ''}
    ${settleCheck && !settleCheck.ok && !forming ? `<div class="pop-hint">${esc(settleCheck.reason ?? '')}</div>` : ''}
  `;
  root.querySelector('[data-act=move]')?.addEventListener('click', () => host.onMove(u.id));
  root.querySelector('[data-act=settleAt]')?.addEventListener('click', () => host.onSettleAt(u.id));
  root.querySelector('[data-act=settleHere]')?.addEventListener('click', () => host.onSettleHere(u.id));
  root.querySelector('[data-act=disband]')?.addEventListener('click', () => host.onDisband(u.id));
  root.querySelector('[data-act=cancel]')?.addEventListener('click', () => host.onCancelOrder(u.id));
  root.querySelector<HTMLElement>('[data-home]')?.addEventListener('click', (e) => { e.preventDefault(); host.onFocusSettlement(u.home); });
}
