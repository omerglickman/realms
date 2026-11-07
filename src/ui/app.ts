// The browser application: PixiJS stage, camera, input, the ledger strip,
// hover card, the ledgers (modals), editor wiring, turn controls. All game
// rules live in src/sim; this file only displays and forwards input.

import { Application, Graphics } from 'pixi.js';
import { MapRenderer, HEX_SIZE } from './render/mapRenderer';
import { SettlementLayer, setLabelFont } from './render/settlementLayer';
import { UnitLayer, unitAtWorld, shieldSize, type UnitPath } from './render/unitLayer';
import { renderUnitCard } from './panels/unitCard';
import { renderRaiseDialog, newRaiseDraft, type RaiseDraft } from './panels/raiseDialog';
import { routeFor, unitCell, unitTypeDef, canFoundAt, unitsAt, UNIT_TYPES, type Unit } from '../sim/units';
import { findRoute, OPEN } from '../sim/pathfinding';
import { Camera } from './camera';
import { Editor } from './editor/editor';
import { renderHud } from './panels/hud';
import { renderHoverCard } from './panels/hoverCard';
import { ModalShell, wireLinks, type ModalSpec } from './panels/modal';
import { settlementSpec, wireSettlement } from './panels/settlementModal';
import { clusterSpec, wireSend, wireSendFood, wireLeadership } from './panels/clusterModal';
import { realmSpec } from './panels/realmModal';
import { clusterOf, clusterRootOf } from '../sim/clusters';
import { factionStockKey, type Command, type CancelRaiseCommand } from '../sim/commands';
import type { Materials } from '../sim/materials';
import { generateDraftMap, MAPGEN_DEFAULTS, type MapGenParams } from '../sim/mapgen';
import { createGameState, calendar, type GameState } from '../sim/state';
import { endTurn } from '../sim/turn';
import { pixelToAxial, axialToOffset, offsetToPixel, hexCorners } from '../sim/hex';
import { inBounds, getTerrain, getResource, idx } from '../sim/map';
import { TERRAIN } from '../sim/terrain';
import { resourceByIndex } from '../sim/resources';
import { loadMapFile } from '../sim/mapfile';
import { settlementIdAt, computeWorkAssignment } from '../sim/settlements';
import { SettlementLayer as SL } from './render/settlementLayer';
import testmapJson from '../../maps/testmap.json';
import startJson from '../../scenarios/start.json';
import { loadScenarioFile } from '../sim/scenario';
import { esc } from './panels/format';
import { preloadIconTextures, MAP_BADGE, MAP_BADGE_IDLE, MAP_MARK } from './icons';
import { installTooltips, hideTooltip } from './panels/tooltip';
import { RESOURCES } from '../sim/resources';

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e as T;
}

/** The header-font choices (Settings). Lugrasimo is the default — the closest open font to a Carolingian book hand. */
const FONTS: { id: string; cls: string; family: string; label: string }[] = [
  { id: 'lugrasimo', cls: '', family: 'Lugrasimo', label: 'Lugrasimo — a round Carolingian-style book hand (default)' },
  { id: 'almendra', cls: 'font-almendra', family: 'Almendra', label: 'Almendra — a lighter calligraphic hand' },
  { id: 'uncial', cls: 'font-uncial', family: 'Uncial Antiqua', label: 'Uncial Antiqua — the older uncial' },
];

export async function startApp(): Promise<void> {
  const host = el<HTMLDivElement>('map');
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: 0x221a12,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: 'webgl',
  });
  host.appendChild(app.canvas);

  // ---- settings: the header font (stored in the browser) ----
  function applyFont(id: string): void {
    const f = FONTS.find((x) => x.id === id) ?? FONTS[0];
    for (const x of FONTS) if (x.cls) document.body.classList.toggle(x.cls, x.id === f.id);
    setLabelFont(`${f.family}, Georgia, serif`);
    try { localStorage.setItem('realms.font', f.id); } catch { /* ignore */ }
  }
  let fontId = 'lugrasimo';
  try { fontId = localStorage.getItem('realms.font') || 'lugrasimo'; } catch { /* ignore */ }
  try { await Promise.all(FONTS.map((f) => document.fonts.load(`14px "${f.family}"`))); } catch { /* fonts are bundled; a failure only means fallbacks */ }
  applyFont(fontId);

  // ---- generator settings (also readable from the URL hash, e.g.
  //      realms.html#seed=orkney&w=160&h=100&continents=2&islands=6&land=45) ----
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const seedInput = el<HTMLInputElement>('seed');
  const sizeSel = el<HTMLSelectElement>('size');
  const contSel = el<HTMLSelectElement>('continents');
  const islandsInput = el<HTMLInputElement>('islands');
  const landInput = el<HTMLInputElement>('land');
  if (hash.get('seed')) seedInput.value = hash.get('seed')!;
  if (hash.get('w') && hash.get('h')) {
    const v = `${hash.get('w')}x${hash.get('h')}`;
    if ([...sizeSel.options].some((o) => o.value === v)) sizeSel.value = v;
  }
  if (hash.get('continents')) contSel.value = hash.get('continents')!;
  if (hash.get('islands')) islandsInput.value = hash.get('islands')!;
  if (hash.get('land')) landInput.value = hash.get('land')!;
  const syncLandLabel = () => { el('land-val').textContent = `${landInput.value}%`; };
  landInput.addEventListener('input', syncLandLabel);
  syncLandLabel();

  function readParams(): MapGenParams {
    const [w, h] = sizeSel.value.split('x').map(Number);
    return {
      seed: seedInput.value.trim() || 'realms',
      width: w,
      height: h,
      continents: Number(contSel.value) || MAPGEN_DEFAULTS.continents,
      islands: Number(islandsInput.value) || 0,
      landFraction: (Number(landInput.value) || 45) / 100,
    };
  }

  // ---- state: the shipped starting position by default; a generated draft if the URL asks for one ----
  let state: GameState;
  let mapName = '';
  /** The shipped starting position (scenarios/start.json — Omer's placed and pre-run realm, DESIGN §4.8). */
  function loadStart(): GameState {
    const { state: st, name } = loadScenarioFile(startJson);
    mapName = name;
    return st;
  }
  if (hash.has('seed')) {
    state = newGameFrom(readParams());
  } else {
    state = loadStart();
  }

  // ---- selection / hover of settlements, and the open ledger ----
  let selectedId: string | null = null;
  let hoverId: string | null = null;
  type ViewKind = 'settlement' | 'cluster' | 'realm' | 'settings' | 'help' | 'draft';
  let view: { kind: ViewKind; id: string; tab: string } | null = null;
  let workAssign = computeWorkAssignment(state);
  const modal = new ModalShell(el('modal'), el('modal-backdrop'));
  installTooltips(el('tooltip'));
  const tiles = el<HTMLDivElement>('tiles');
  let mouseX = -1, mouseY = -1;

  // the map's icon textures (resources, things on hexes, tier marks) — rasterised once from the shared icon set
  await preloadIconTextures([...RESOURCES.map((r) => r.icon).filter((x): x is string => !!x), 'mill', 'wharf', 'castle1', 'castle2', 'castle3', 'station'], MAP_BADGE);
  await preloadIconTextures(RESOURCES.map((r) => r.icon).filter((x): x is string => !!x), MAP_BADGE_IDLE);
  await preloadIconTextures([...SL.TIER_ICON, ...UNIT_TYPES.map((t) => t.icon)], MAP_MARK);

  const renderer = new MapRenderer(state.map);
  const settlementLayer = new SettlementLayer();
  const unitLayer = new UnitLayer();
  const camera = new Camera(renderer.root, app.screen.width, app.screen.height);
  const hover = new Graphics();
  renderer.root.addChild(settlementLayer.root, hover, unitLayer.root);

  // ---- units (Phase 2 session 1b): selection, the pinned card, targeting modes, the raise dialog ----
  let selectedUnitId: string | null = null;
  let hoverUnitId: string | null = null;
  /** choosing a hex on the map: a move / settle order for a unit, or the destination of a party being raised */
  type Mode = { kind: 'order'; unitId: string; then: 'none' | 'settle' } | { kind: 'pickDest' } | null;
  let mode: Mode = null;
  let preview: { cells: number[]; months: number; label: string } | null = null;
  let previewCell = -1;
  let raiseDraft: RaiseDraft | null = null;
  /** the inverse of every raise made in this session, so a mustering party can be cancelled from its Recruitment page */
  const raiseInverses = new Map<string, CancelRaiseCommand>();
  const unitCard = el<HTMLDivElement>('unitcard');
  const dialog = el<HTMLDivElement>('dialog');
  app.stage.addChild(renderer.root);

  // ---- hover card: a small card to the right of the hovered settlement ----
  const popover = el<HTMLDivElement>('popover');
  const topbar = el<HTMLDivElement>('topbar');
  let popoverId: string | null = null;
  function showPopover(id: string | null): void {
    const s = id ? state.settlements[id] : null;
    if (!s) { popover.classList.add('hidden'); popoverId = null; return; }
    popoverId = id;
    renderHoverCard(popover, state, s);
    popover.style.borderLeftColor = state.factions[s.faction ?? '']?.color ?? '#4a2f1a';
    popover.classList.remove('hidden');
    positionPopover();
  }
  function positionPopover(): void {
    const s = popoverId ? state.settlements[popoverId] : null;
    if (!s) return;
    const p = offsetToPixel(s.col, s.row, HEX_SIZE);
    const r = SL.markerRadius(s, camera.zoom) * camera.zoom;
    const sx = renderer.root.position.x + p.x * camera.zoom;
    const sy = renderer.root.position.y + p.y * camera.zoom;
    const w = popover.offsetWidth, h = popover.offsetHeight;
    let left = sx + r + 12;
    if (left + w > window.innerWidth - 8) left = sx - r - 12 - w; // flip to the left when there is no room
    let top = sy - h / 2;
    top = Math.max(topbar.offsetHeight + 4, Math.min(window.innerHeight - h - 8, top));
    popover.style.left = `${Math.max(4, left)}px`;
    popover.style.top = `${top}px`;
  }
  popover.addEventListener('pointerleave', (e) => {
    // leaving the card: keep it only if the cursor went back onto the settlement itself
    const h = hexAt(e.clientX, e.clientY);
    const over = inBounds(state.map, h.col, h.row) ? settlementIdAt(state, h.col, h.row) : null;
    if (over !== popoverId) { hoverId = null; showPopover(null); refreshLayer(); }
  });
  popover.addEventListener('click', () => { if (popoverId) select(popoverId); });
  // the cursor can leave the map for a panel without the canvas ever seeing a move: close the card then
  window.addEventListener('pointermove', (e) => {
    const t = e.target as Node | null;
    if (hoverId && t !== app.canvas && !popover.contains(t)) { hoverId = null; showPopover(null); refreshLayer(); }
  });

  const editor = new Editor({
    getState: () => state,
    onChanged: (cells) => {
      if (cells === 'all') {
        applyMap(false);
      } else {
        const w = state.map.width;
        for (const i of cells) renderer.invalidateHex(i % w, Math.floor(i / w));
      }
      stateChanged();
    },
    getMapName: () => mapName,
    setMapName: (n) => { mapName = n; updateMapInfo(); },
    setState: (s) => { replaceState(s, true); },
    onSelect: (id) => select(id),
    onToolChanged: () => { refreshLayer(); renderView(); if (mouseX >= 0) updateHover(mouseX, mouseY); },
  });

  applyMap(true);

  function newGameFrom(p: MapGenParams): GameState {
    const map = generateDraftMap(p);
    const st = createGameState(String(p.seed), map);
    location.hash = `seed=${encodeURIComponent(String(p.seed))}&w=${p.width}&h=${p.height}&continents=${p.continents}&islands=${p.islands}&land=${Math.round((p.landFraction ?? 0.45) * 100)}`;
    return st;
  }

  function applyMap(fit: boolean): void {
    renderer.setMap(state.map);
    renderer.root.addChild(settlementLayer.root, hover, unitLayer.root);
    const ws = renderer.worldSize();
    camera.setWorldSize(ws.width, ws.height);
    if (fit) camera.fit();
    stateChanged();
  }

  /** Swap in a whole new state (new map, loaded scenario). */
  function replaceState(s: GameState, fit: boolean): void {
    state = s;
    selectedId = null;
    hoverId = null;
    selectedUnitId = null; hoverUnitId = null; mode = null; preview = null; raiseDraft = null;
    raiseInverses.clear();
    if (view && (view.kind === 'settlement' || view.kind === 'cluster')) closeView();
    applyMap(fit);
  }

  /** Anything in the state may have changed: refresh every readout and layer. */
  function stateChanged(): void {
    if (selectedId && !state.settlements[selectedId]) selectedId = null;
    if (hoverId && !state.settlements[hoverId]) hoverId = null;
    if (selectedUnitId && !state.units[selectedUnitId]) { selectedUnitId = null; mode = mode?.kind === 'order' ? null : mode; preview = null; }
    if (hoverUnitId && !state.units[hoverUnitId]) hoverUnitId = null;
    if (raiseDraft && !state.settlements[raiseDraft.at]) closeDialog();
    workAssign = computeWorkAssignment(state);
    renderer.setWorkedCells(new Set(workAssign.keys()));
    updateMapInfo();
    refreshLayer();
    renderHud(tiles, state, { onRealm: (tab) => openView('realm', '', tab) });
    renderView();
    renderUnitCardNow();
    if (raiseDraft) renderDialog();
    editor.refreshPanel();
    if (mouseX >= 0) updateHover(mouseX, mouseY);
  }

  function refreshLayer(): void {
    settlementLayer.update(state, { hover: hoverId, selected: selectedId, zoom: camera.zoom, settling: editor.settling });
    unitLayer.update(state, { hover: hoverUnitId, selected: selectedUnitId, zoom: camera.zoom, preview });
    positionPopover();
    positionUnitCard();
  }

  // ---- the unit card: pinned next to the selected unit's shield ----
  function selectUnit(id: string | null): void {
    if (id && !state.units[id]) id = null;
    selectedUnitId = id;
    if (!id && mode?.kind === 'order') { mode = null; preview = null; }
    if (id) {
      // a unit's card and a settlement's ledger do not share the screen well: close the ledger
      if (view?.kind === 'settlement' || view?.kind === 'cluster') { closeView(); }
      selectedId = null;
    }
    renderUnitCardNow();
    refreshLayer();
  }
  function renderUnitCardNow(): void {
    const u = selectedUnitId ? state.units[selectedUnitId] : null;
    if (!u) { unitCard.classList.add('hidden'); return; }
    renderUnitCard(unitCard, state, u, {
      onMove: (id) => startOrder(id, 'none'),
      onSettleAt: (id) => startOrder(id, 'settle'),
      onSettleHere: (id) => act({ type: 'settleUnit', id }),
      onDisband: (id) => act({ type: 'disbandUnit', id }),
      onCancelOrder: (id) => act({ type: 'orderUnit', id, order: null }),
      onFocusSettlement: (id) => focusSettlement(id),
    });
    unitCard.style.borderLeftColor = state.factions[u.faction]?.color ?? '#4a2f1a';
    unitCard.classList.toggle('targeting', mode?.kind === 'order');
    unitCard.classList.remove('hidden');
    positionUnitCard();
  }
  function positionUnitCard(): void {
    const u = selectedUnitId ? state.units[selectedUnitId] : null;
    if (!u || unitCard.classList.contains('hidden')) return;
    const cell = unitCell(state.map, u);
    const sh = unitLayer.shieldAt(state, cell, camera.zoom);
    let p = sh ? { x: sh.x, y: sh.y } : offsetToPixel(u.col, u.row, HEX_SIZE);
    let r = shieldSize(camera.zoom).w * 0.6 * camera.zoom;
    // on a settlement's hex the shield sits at the marker's upper-left: keep the card clear of the marker
    const sid = settlementIdAt(state, u.col, u.row);
    if (sid && !unitLayer.animating) {
      const sp = offsetToPixel(u.col, u.row, HEX_SIZE);
      r = Math.max(r, (SL.markerRadius(state.settlements[sid], camera.zoom) + (sp.x - p.x)) * camera.zoom);
      p = { x: sp.x, y: p.y };
    }
    const sx = renderer.root.position.x + p.x * camera.zoom;
    const sy = renderer.root.position.y + p.y * camera.zoom;
    const w = unitCard.offsetWidth, h = unitCard.offsetHeight;
    let left = sx + r + 12;
    if (left + w > window.innerWidth - 8) left = sx - r - 12 - w;
    let top = sy - h / 2;
    top = Math.max(topbar.offsetHeight + 4, Math.min(window.innerHeight - h - 8, top));
    unitCard.style.left = `${Math.max(4, left)}px`;
    unitCard.style.top = `${top}px`;
  }
  /** Move / Settle at…: the next click on the map is the destination; hovering previews the route. */
  function startOrder(unitId: string, then: 'none' | 'settle'): void {
    if (mode?.kind === 'order' && mode.unitId === unitId && mode.then === then) { mode = null; preview = null; }
    else mode = { kind: 'order', unitId, then };
    previewCell = -1;
    el('info-event').textContent = mode ? (then === 'settle' ? 'Click the hex where the settlers should found their village (Esc to cancel).' : 'Click the hex the party should march to (Esc to cancel).') : '';
    renderUnitCardNow();
    if (mouseX >= 0) updateHover(mouseX, mouseY);
    refreshLayer();
  }
  /** The route a hovered hex would mean in the current targeting mode, for the preview. */
  function previewTo(cell: number): void {
    if (cell === previewCell) return;
    previewCell = cell;
    preview = null;
    if (!mode) return;
    let start: { cell: number; bank: number } | null = null, points = 4, settle = false, label = '';
    if (mode.kind === 'order') {
      const u = state.units[mode.unitId];
      if (!u) { mode = null; return; }
      start = { cell: unitCell(state.map, u), bank: u.bank };
      points = unitTypeDef(u.type).movePoints;
      settle = mode.then === 'settle';
    } else if (raiseDraft) {
      const s = state.settlements[raiseDraft.at];
      if (!s) return;
      start = { cell: idx(state.map, s.col, s.row), bank: OPEN };
      points = unitTypeDef(raiseDraft.type).movePoints;
      settle = unitTypeDef(raiseDraft.type).canSettle;
    }
    if (!start || start.cell === cell) return;
    const route = findRoute(state, start, cell, points);
    if (!route || !Number.isFinite(route.months)) { preview = { cells: [start.cell, cell], months: Infinity, label: 'no way there' }; return; }
    label = `${route.months} mo`;
    if (settle) { const f = canFoundAt(state, cell); label += f.ok ? ' · settle' : ` · ${f.reason}`; }
    preview = { cells: [start.cell, ...route.nodes.map((n) => n.cell)], months: route.months, label };
  }
  /** A click on `cell` while targeting. */
  function targetClicked(cell: number): void {
    if (!mode) return;
    if (mode.kind === 'order') {
      const u = state.units[mode.unitId];
      const then = mode.then;
      mode = null; preview = null; previewCell = -1;
      el('info-event').textContent = '';
      if (!u) return;
      if (cell === unitCell(state.map, u)) { if (then === 'settle') act({ type: 'settleUnit', id: u.id }); else act({ type: 'orderUnit', id: u.id, order: null }); }
      else act({ type: 'orderUnit', id: u.id, order: { kind: 'move', dest: cell, then } });
      renderUnitCardNow();
    } else {
      mode = null; preview = null; previewCell = -1;
      if (raiseDraft) {
        const s = state.settlements[raiseDraft.at];
        // the raising settlement's own hex means "no destination"
        raiseDraft.dest = s && idx(state.map, s.col, s.row) === cell ? null : cell;
      }
      el('info-event').textContent = '';
      reopenAfterPick();
    }
    refreshLayer();
  }

  // ---- the raise dialog ----
  function openRaise(settlementId: string, type: string): void {
    const s = state.settlements[settlementId];
    if (!s) return;
    raiseDraft = newRaiseDraft(state, s, type);
    renderDialog();
  }
  function renderDialog(): void {
    if (!raiseDraft) { dialog.classList.add('hidden'); dialog.innerHTML = ''; return; }
    renderRaiseDialog(dialog, state, raiseDraft, {
      onChange: () => { /* the dialog refreshed its own derived parts */ },
      onPickDest: () => {
        mode = { kind: 'pickDest' };
        previewCell = -1;
        dialog.classList.add('hidden');
        modal.hide();
        el('info-event').textContent = 'Click the hex the party is bound for (Esc to go back).';
        refreshLayer();
      },
      onClearDest: () => { if (raiseDraft) { raiseDraft.dest = null; raiseDraft.name = ''; renderDialog(); } },
      onRaise: (spec) => {
        const before = new Set(Object.keys(state.units));
        try { editor.execute({ type: 'raiseUnit', spec }); } catch (e) { el('info-event').textContent = (e as Error).message; return; }
        const newId = Object.keys(state.units).find((k) => !before.has(k));
        const inv = editor.lastInverse();
        if (newId && inv && inv.type === 'cancelRaise') raiseInverses.set(newId, inv);
        raiseDraft = null;
        dialog.classList.add('hidden');
        stateChanged();
        if (newId) selectUnit(newId);
      },
      onClose: closeDialog,
    });
    dialog.classList.remove('hidden');
  }
  function closeDialog(): void {
    raiseDraft = null;
    if (mode?.kind === 'pickDest') { mode = null; preview = null; }
    dialog.classList.add('hidden');
    dialog.innerHTML = '';
    el('info-event').textContent = '';
  }
  /** After the destination was picked (or the pick cancelled): the ledger and the dialog come back. */
  function reopenAfterPick(): void {
    if (view) renderView();
    renderDialog();
  }
  function cancelRaise(unitId: string): void {
    const inv = raiseInverses.get(unitId);
    if (!inv) { el('info-event').textContent = 'This party was raised in an earlier session and can no longer be cancelled; it forms at the end of the month.'; return; }
    act(inv);
    raiseInverses.delete(unitId);
  }

  function updateMapInfo(): void {
    const ev = state.events[state.events.length - 1];
    el('info-event').textContent = ev ? `${calendar(ev.turn).monthName} ${calendar(ev.turn).year}: ${ev.text}` : '';
  }

  // ---- the ledgers ----
  const tabMemory: Record<string, string> = {};
  function openView(kind: ViewKind, id = '', tab?: string): void {
    const t = tab ?? tabMemory[kind] ?? 'overview';
    view = { kind, id, tab: t };
    tabMemory[kind] = t;
    if (kind === 'settlement') selectedId = id;
    else if (kind === 'cluster') selectedId = id;
    refreshLayer();
    renderView();
  }
  function closeView(): void {
    view = null;
    hideTooltip();
    modal.hide();
    refreshLayer();
  }
  const links = {
    onFocus: focusSettlement,
    onCluster: (root: string) => openView('cluster', root),
    onOpen: (kind: string, id: string, tab?: string) => openView(kind as ViewKind, id, tab),
  };
  const modalHost = { onTab: (t: string) => { if (view) openView(view.kind, view.id, t); }, onClose: closeView };
  function renderView(): void {
    if (!view) return;
    const genForm = el('gen-form');
    if (view.kind !== 'draft' && genForm.parentElement !== el('holder')) el('holder').appendChild(genForm);
    let spec: ModalSpec;
    if (view.kind === 'settlement') {
      const s = state.settlements[view.id];
      if (!s) { closeView(); return; }
      spec = settlementSpec(state, s, view.tab, editor.active);
      const root = modal.show(`settlement:${s.id}:${view.tab}`, spec, modalHost);
      wireSettlement(root, state, s, {
        onRename: (id, name) => { editor.editSettlement(id, { name }); },
        onSetPopulation: (id, population) => { editor.editSettlement(id, { population }); },
        onRemove: (id) => { editor.removeSettlement(id); closeView(); },
        onBuild: (id, building) => act({ type: 'queueBuilding', id, building }),
        onCancelBuild: (id) => act({ type: 'cancelBuilding', id }),
        onRaise: (id, type) => openRaise(id, type),
        onCancelRaise: (unitId) => cancelRaise(unitId),
        onUpgrade: (id) => act({ type: 'upgradeSettlement', id }),
        onCancelUpgrade: (id) => act({ type: 'cancelUpgrade', id }),
        onSelectUnit: (unitId) => { selectUnit(unitId); const u = state.units[unitId]; if (u) { const p = offsetToPixel(u.col, u.row, HEX_SIZE); camera.centerOn(p.x, p.y); refreshLayer(); } },
      }, editor.active);
      wireLinks(root, links);
    } else if (view.kind === 'cluster') {
      const c = state.settlements[view.id] ? clusterOf(state, view.id) : null;
      if (!c) { closeView(); return; }
      spec = clusterSpec(state, c, view.tab, c.faction === state.playerFaction);
      const root = modal.show(`cluster:${c.root}:${view.tab}`, spec, modalHost);
      wireLinks(root, links);
      wireSend(root, { onSend: (to, amount) => sendMaterials(to, amount) });
      wireSendFood(root, { onSendFood: (from, to, amount) => act({ type: 'sendFood', from, to, amount }) });
      wireLeadership(root, state, c, { onSetParents: (changes) => { const lead = changes.find((x) => x.parent === null); act({ type: 'setParents', changes }); if (lead) openView('cluster', lead.id, 'overview'); } });
    } else if (view.kind === 'realm') {
      spec = realmSpec(state, view.tab);
      const root = modal.show(`realm:${view.tab}`, spec, modalHost);
      wireLinks(root, links);
      wireSend(root, { onSend: (to, amount) => sendMaterials(to, amount) });
    } else if (view.kind === 'settings') {
      spec = settingsSpec();
      const root = modal.show('settings', spec, modalHost);
      root.querySelectorAll<HTMLInputElement>('input[name=font]').forEach((i) => i.addEventListener('change', () => { applyFont(i.value); renderView(); refreshLayer(); }));
    } else if (view.kind === 'help') {
      modal.show('help', helpSpec(), modalHost);
    } else {
      const root = modal.show('draft', { title: 'New draft map', badge: 'generator', body: '<div id="gen-slot"></div><p class="note">Generates a fresh canvas from noise and replaces the current map and settlements. The shipped test map and starting position are files and are not touched; reload them from the menu.</p>' }, modalHost);
      root.querySelector('#gen-slot')!.appendChild(genForm);
    }
  }
  function sendMaterials(to: string, amount: Partial<Materials>): void {
    act({ type: 'transferMaterials', from: factionStockKey(state.playerFaction), to, amount });
  }

  function settingsSpec(): ModalSpec {
    const cur = (() => { try { return localStorage.getItem('realms.font') || 'lugrasimo'; } catch { return 'lugrasimo'; } })();
    return {
      title: 'Settings', badge: 'this browser',
      body: `<h3>Header hand</h3><p class="note">The script used for titles, headings and the names on the map. All three are bundled in the file.</p>
        ${FONTS.map((f) => `<div class="form-row"><label><input type="radio" name="font" value="${f.id}" ${f.id === cur ? 'checked' : ''}> <span style="font-family:'${f.family}';font-size:20px">Hugeopolis · The Realm · Granary</span></label> <span class="dim">${esc(f.label)}</span></div>`).join('')}
        <h3>Map</h3><p class="note">Keys on the map: <kbd>G</kbd> grid · <kbd>R</kbd> resource glyphs · <kbd>Z</kbd> zones and cluster outlines. The hex under the cursor is described in the strip at the bottom of the screen.</p>`,
    };
  }
  function helpSpec(): ModalSpec {
    const row = (k: string, v: string) => `<tr><th><kbd>${k}</kbd></th><td>${v}</td></tr>`;
    return {
      title: 'Keys & help', badge: 'phase 2',
      body: `<div class="cols"><div><h3>Turns</h3><table class="kv">${row('Space', 'end the month')}${row('Go', 'run the years in the box')}</table>
        <h3>Ledgers</h3><table class="kv">${row('click', 'a settlement opens its ledger; the tiles at the top open the realm\'s')}${row('K', 'the realm ledger')}${row('Esc', 'close')}</table>
        <h3>Parties</h3><table class="kv">${row('click', 'a shield opens the party\'s card: Move, Settle, Disband')}${row('Recruitment', 'the settlement ledger\'s last page raises settlers')}</table></div>
        <div><h3>Map</h3><table class="kv">${row('drag', 'pan')}${row('wheel', 'zoom')}${row('Home', 'fit the map')}${row('arrows', 'pan')}${row('G', 'hex grid')}${row('R', 'resource glyphs')}${row('Z', 'zones and cluster outlines')}${row('E', 'the map editor')}</table></div></div>
        <h3>Reading the screen</h3>
        <p>The strip at the top is the realm's bottom line: the crown's <b>treasury</b>, the <b>people</b>, <b>months of food</b> in all granaries, and the realm's <b>stockpile</b> of timber, stone and goods against its cap. Hover a tile for the figures behind it; click it for the full page.</p>
        <p>Every settlement's ledger has five pages: <b>Overview</b>, <b>People</b> (who lives there and what limits growth), <b>Land & Food</b> (every worked hex, the harvest calendar, the granary), <b>Economy</b> (where the hands go, tax, the cluster's stockpile) and <b>Buildings</b>. A <b>cluster</b> is an independent settlement with everything subordinate to it — food flows only inside it. The <b>realm</b> is the sum over clusters.</p>
        <p class="note">Hex colours: grassland and river are the richest farmland; plains feed herds; hills and woodland are middling; forest gives timber; mountains, lake and sea cannot be settled. Shore, lake and river hexes are fished.</p>`,
    };
  }

  // ---- settlement selection ----
  function select(id: string | null): void {
    if (!id || !state.settlements[id]) { if (view?.kind === 'settlement' || view?.kind === 'cluster') closeView(); selectedId = null; refreshLayer(); return; }
    const keepTab = view?.kind === 'settlement' ? view.tab : undefined;
    if (selectedUnitId) { selectedUnitId = null; unitCard.classList.add('hidden'); if (mode?.kind === 'order') { mode = null; preview = null; } }
    openView('settlement', id, keepTab);
  }
  function focusSettlement(id: string): void {
    const t = state.settlements[id];
    if (!t) return;
    select(id);
    const p = offsetToPixel(t.col, t.row, HEX_SIZE);
    camera.centerOn(p.x, p.y);
  }
  /** A player action: goes through the command layer via the editor so it is undoable and autosaved. */
  function act(cmd: Command): void {
    try {
      editor.execute(cmd);
    } catch (e) {
      el('info-event').textContent = (e as Error).message;
      return;
    }
    stateChanged();
  }

  // ---- menu ----
  const menu = el<HTMLDivElement>('menu');
  const menuBtn = el<HTMLButtonElement>('menu-btn');
  function toggleMenu(open?: boolean): void { menu.classList.toggle('hidden', open === undefined ? !menu.classList.contains('hidden') : !open); }
  menuBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
  window.addEventListener('pointerdown', (e) => { if (!menu.contains(e.target as Node) && e.target !== menuBtn) toggleMenu(false); });
  menu.addEventListener('click', () => toggleMenu(false));
  el('menu-realm').addEventListener('click', () => openView('realm'));
  el('menu-draft').addEventListener('click', () => openView('draft'));
  el('menu-settings').addEventListener('click', () => openView('settings'));
  el('menu-help').addEventListener('click', () => openView('help'));

  // ---- turns ----
  function advance(months: number): void {
    const t0 = performance.now();
    // for the gliding animation (one month only): the route every ordered unit is about to walk
    const planned: { id: string; cells: number[] }[] = [];
    if (months === 1) {
      for (const u of Object.values(state.units)) {
        if (!u.order || u.order.dest === unitCell(state.map, u)) continue;
        const r = routeFor(state, u, u.order.dest);
        if (r && Number.isFinite(r.months)) planned.push({ id: u.id, cells: [unitCell(state.map, u), ...r.nodes.map((n) => n.cell)] });
      }
    }
    for (let i = 0; i < months; i++) endTurn(state);
    const paths: UnitPath[] = [];
    for (const p of planned) {
      const u = state.units[p.id];
      if (!u || u.report.moved <= 0) continue;
      paths.push({ id: p.id, cells: p.cells.slice(0, u.report.moved + 1) });
    }
    const ms = performance.now() - t0;
    el('info-run').textContent = months > 1 ? `${months / 12} years in ${ms.toFixed(0)} ms` : '';
    editor.stateChangedExternally();
    stateChanged();
    if (paths.length) unitLayer.animate(state, paths, camera.zoom);
    renderPopoverIfStale();
  }
  el<HTMLButtonElement>('end-turn').addEventListener('click', () => advance(1));
  el<HTMLButtonElement>('run-years-btn').addEventListener('click', () => {
    const years = Math.max(1, Math.min(200, Math.round(Number(el<HTMLInputElement>('run-years').value) || 1)));
    advance(12 * years);
  });

  // ---- map controls ----
  function regenerate(): void {
    mapName = `draft ${seedInput.value.trim() || 'realms'}`;
    editor.resetHistory();
    closeView();
    replaceState(newGameFrom(readParams()), true);
  }
  el<HTMLButtonElement>('generate').addEventListener('click', regenerate);
  el<HTMLButtonElement>('random').addEventListener('click', () => {
    const syll = ['ar', 'bel', 'cor', 'dun', 'el', 'fen', 'gal', 'hol', 'is', 'kar', 'lin', 'mor', 'nor', 'os', 'ral', 'sil', 'tor', 'ul', 'vin', 'wen'];
    const n = 2 + Math.floor(Math.random() * 2);
    let w = '';
    for (let i = 0; i < n; i++) w += syll[Math.floor(Math.random() * syll.length)];
    seedInput.value = w;
    regenerate();
  });
  el('start-position').addEventListener('click', () => {
    if (editor.dirty && !confirm('Reload the shipped starting position? Unsaved changes will be lost (save a scenario first if you want to keep them).')) return;
    history.replaceState(null, '', location.pathname);
    editor.resetHistory();
    replaceState(loadStart(), true);
  });
  el('testmap').addEventListener('click', () => {
    if (Object.keys(state.settlements).length && !confirm('Load the bare test map (terrain and resources, no settlements)? Unsaved changes will be lost.')) return;
    const loaded = loadMapFile(testmapJson);
    mapName = loaded.name;
    history.replaceState(null, '', location.pathname);
    editor.resetHistory();
    replaceState(createGameState('testmap', loaded.map), true);
  });

  // ---- input: pan / zoom / hover / paint / select ----
  const canvas = app.canvas;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  let panning = false;
  let painting = false;
  let lastX = 0, lastY = 0;
  let downX = 0, downY = 0, moved = false;

  function hexAt(sx: number, sy: number): { col: number; row: number } {
    const w = camera.screenToWorld(sx, sy);
    const a = pixelToAxial(w.x, w.y, HEX_SIZE);
    return axialToOffset(a.q, a.r);
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    lastX = downX = e.clientX;
    lastY = downY = e.clientY;
    moved = false;
    const paintButton = editor.active && e.button === 0;
    if (paintButton) {
      painting = true;
      const h = hexAt(e.clientX, e.clientY);
      editor.pointerDown(h.col, h.row);
      updateHover(e.clientX, e.clientY);
    } else {
      panning = true;
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasPanning = panning;
    panning = false;
    if (painting) {
      painting = false;
      editor.pointerUp();
    } else if (wasPanning && e.button === 0 && !moved) {
      const h = hexAt(e.clientX, e.clientY);
      const on = inBounds(state.map, h.col, h.row);
      if (mode) {
        // targeting: the click is the destination
        if (on) targetClicked(idx(state.map, h.col, h.row));
        else if (mode.kind === 'pickDest') { mode = null; preview = null; reopenAfterPick(); }
        else { mode = null; preview = null; renderUnitCardNow(); refreshLayer(); }
      } else {
        // a plain click outside edit mode: a unit's shield first, then the settlement under the cursor (or close what is open)
        const wpt = camera.screenToWorld(e.clientX, e.clientY);
        const u = unitAtWorld(state, unitLayer, wpt.x, wpt.y, camera.zoom);
        const id = on ? settlementIdAt(state, h.col, h.row) : null;
        if (u) selectUnit(u.id);
        else if (id) select(id);
        else if (view) closeView();
        else if (selectedUnitId) selectUnit(null);
        else select(null);
      }
    }
    canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) moved = true;
    if (panning) {
      camera.panBy(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      positionPopover();
      positionUnitCard();
    } else if (painting) {
      const h = hexAt(e.clientX, e.clientY);
      editor.pointerMove(h.col, h.row);
    }
    mouseX = e.clientX;
    mouseY = e.clientY;
    updateHover(mouseX, mouseY);
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    camera.zoomAt(factor, e.clientX, e.clientY);
    updateHover(e.clientX, e.clientY);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (e.key === 'Enter' && (e.target as HTMLElement).id === 'seed') regenerate();
      if (e.key === 'Escape') (e.target as HTMLElement).blur();
      return;
    }
    if (editor.key(e)) { e.preventDefault(); if (mouseX >= 0) updateHover(mouseX, mouseY); return; }
    const step = 60;
    if (e.key === 'ArrowLeft') camera.panBy(step, 0);
    else if (e.key === 'ArrowRight') camera.panBy(-step, 0);
    else if (e.key === 'ArrowUp') camera.panBy(0, step);
    else if (e.key === 'ArrowDown') camera.panBy(0, -step);
    else if (e.key === 'g' || e.key === 'G') renderer.setGridVisible(!renderer.gridVisible);
    else if (e.key === 'r' || e.key === 'R') renderer.setResourcesVisible(!renderer.resourcesVisible);
    else if (e.key === 'z' || e.key === 'Z') settlementLayer.setZonesVisible(!settlementLayer.zonesVisible);
    else if (e.key === 'Home') camera.fit();
    else if (e.key === 'e' || e.key === 'E') { editor.setActive(!editor.active); }
    else if (e.key === ' ') { e.preventDefault(); advance(1); }
    else if (e.key === 'k' || e.key === 'K') { if (view?.kind === 'realm') closeView(); else openView('realm'); }
    else if (e.key === '?') openView('help');
    else if (e.key === 'c' || e.key === 'C') { if (selectedId) openView('cluster', clusterRootOf(state, selectedId)); }
    else if (e.key === 'Escape') {
      if (!menu.classList.contains('hidden')) toggleMenu(false);
      else if (mode?.kind === 'pickDest') { mode = null; preview = null; reopenAfterPick(); refreshLayer(); }
      else if (raiseDraft) closeDialog();
      else if (mode) { mode = null; preview = null; el('info-event').textContent = ''; renderUnitCardNow(); refreshLayer(); }
      else if (view) closeView();
      else if (selectedUnitId) selectUnit(null);
      else select(null);
    }
    if (mouseX >= 0) updateHover(mouseX, mouseY);
  });

  window.addEventListener('resize', () => camera.resize(app.screen.width, app.screen.height));
  window.addEventListener('beforeunload', (e) => {
    if (editor.dirty) { e.preventDefault(); }
  });

  function updateHover(sx: number, sy: number): void {
    const h = hexAt(sx, sy);
    hover.clear();
    const prevHover = hoverId;
    if (!inBounds(state.map, h.col, h.row)) {
      el('info-hex').textContent = 'Outside the map';
      hoverId = null;
      const hadUnit = hoverUnitId !== null;
      hoverUnitId = null;
      if (preview) { preview = null; previewCell = -1; refreshLayer(); }
      if (prevHover !== hoverId || hadUnit) { showPopover(null); refreshLayer(); }
      return;
    }
    const t = TERRAIN[getTerrain(state.map, h.col, h.row)];
    const r = resourceByIndex(getResource(state.map, h.col, h.row));
    const y = [t.fertility ? `fertility ${t.fertility}` : '', t.pasture ? `pasture ${t.pasture}` : '', t.timber ? `timber ${t.timber}` : ''].filter(Boolean).join(' · ');
    const cell = idx(state.map, h.col, h.row);
    const workedBy = workAssign.get(cell);
    const workedText = workedBy && state.settlements[workedBy] ? ` · worked by ${state.settlements[workedBy].name}` : '';
    const here = unitsAt(state, cell);
    const unitsText = here.length ? ` · ${here.length === 1 ? here[0].name : `${here.length} parties`}` : '';
    el('info-hex').textContent =
      `${t.name}${r ? ` · ${r.name}` : ''} (${h.col}, ${h.row}) · move ${t.passable ? t.moveCost : '—'}${y ? ' · ' + y : ''}${workedText}${unitsText}`;
    // a unit's shield under the cursor takes the hover; otherwise the settlement
    const wpt = camera.screenToWorld(sx, sy);
    const hu: Unit | null = mode ? null : unitAtWorld(state, unitLayer, wpt.x, wpt.y, camera.zoom);
    const prevHoverUnit = hoverUnitId;
    hoverUnitId = hu ? hu.id : null;
    hoverId = hu ? null : settlementIdAt(state, h.col, h.row);
    if (mode) { const pc = previewCell; previewTo(cell); if (pc !== previewCell) refreshLayer(); }
    if (prevHover !== hoverId || prevHoverUnit !== hoverUnitId) { showPopover(hoverId); refreshLayer(); }
    else if (hoverId) renderPopoverIfStale();
    const lw = 2 / camera.zoom;
    if (editor.active && editor.tool !== 'inspect') {
      const w = state.map.width;
      for (const i of editor.previewCells(h.col, h.row)) {
        const p = offsetToPixel(i % w, Math.floor(i / w), HEX_SIZE);
        hover.poly(hexCorners(p.x, p.y, HEX_SIZE));
      }
      hover.stroke({ width: lw, color: 0xffffff, alpha: editor.tool === 'settle' ? 0.6 : 0.85 });
    } else {
      const p = offsetToPixel(h.col, h.row, HEX_SIZE);
      hover.poly(hexCorners(p.x, p.y, HEX_SIZE)).stroke({ width: lw, color: 0xffffff, alpha: 0.9 });
    }
  }

  /** After turns ran the hovered settlement's numbers changed: redraw the card in place. */
  function renderPopoverIfStale(): void {
    if (popoverId && popoverId === hoverId && state.settlements[popoverId]) renderHoverCard(popover, state, state.settlements[popoverId]);
  }

  // ---- frame loop: culling + perf readout; redraw the settlement layer when the zoom changes ----
  let frames = 0, lastFps = performance.now(), fps = 0, maxBuild = 0, lastZoom = -1;
  app.ticker.add(() => {
    renderer.setZoom(camera.zoom);
    if (Math.abs(camera.zoom - lastZoom) > 1e-6) { lastZoom = camera.zoom; refreshLayer(); }
    if (unitLayer.animating) { unitLayer.tick(); positionUnitCard(); }
    const visible = renderer.cull(camera.viewRect());
    maxBuild = Math.max(maxBuild, renderer.lastBuildMs);
    frames++;
    const now = performance.now();
    if (now - lastFps >= 1000) {
      fps = frames;
      frames = 0;
      lastFps = now;
      el('info-perf').textContent =
        `${state.map.width}×${state.map.height} · ${mapName || state.seed} · ${fps} fps · zoom ${camera.zoom.toFixed(2)} · ${visible}/${renderer.chunkCount} chunks · build ${maxBuild.toFixed(0)} ms`;
    }
  });
}
