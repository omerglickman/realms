// The browser application: PixiJS stage, camera, input, HUD, editor wiring,
// settlement layer and panel, turn controls. All game rules live in src/sim;
// this file only displays and forwards input.

import { Application, Graphics } from 'pixi.js';
import { MapRenderer, HEX_SIZE } from './render/mapRenderer';
import { SettlementLayer } from './render/settlementLayer';
import { Camera } from './camera';
import { Editor } from './editor/editor';
import { renderPanel, renderPopover } from './panels/settlementPanel';
import { generateDraftMap, MAPGEN_DEFAULTS, type MapGenParams } from '../sim/mapgen';
import { createGameState, calendar, type GameState } from '../sim/state';
import { endTurn } from '../sim/turn';
import { pixelToAxial, axialToOffset, offsetToPixel, hexCorners } from '../sim/hex';
import { inBounds, getTerrain, getResource, countTerrain, idx } from '../sim/map';
import { TERRAIN } from '../sim/terrain';
import { resourceByIndex } from '../sim/resources';
import { loadMapFile } from '../sim/mapfile';
import { settlementIdAt, computeWorkAssignment } from '../sim/settlements';
import { SettlementLayer as SL } from './render/settlementLayer';
import testmapJson from '../../maps/testmap.json';
import startJson from '../../scenarios/start.json';
import { loadScenarioFile } from '../sim/scenario';

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e as T;
}

export async function startApp(): Promise<void> {
  const host = el<HTMLDivElement>('map');
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: 0x1b2430,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: 'webgl',
  });
  host.appendChild(app.canvas);

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

  // ---- state: the shipped test map by default; a generated draft if the URL asks for one ----
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

  // ---- selection / hover of settlements ----
  let selectedId: string | null = null;
  let hoverId: string | null = null;
  let workAssign = computeWorkAssignment(state);
  const panel = el<HTMLDivElement>('settlement');
  let mouseX = -1, mouseY = -1;

  const renderer = new MapRenderer(state.map);
  const settlementLayer = new SettlementLayer();
  const camera = new Camera(renderer.root, app.screen.width, app.screen.height);
  const hover = new Graphics();
  renderer.root.addChild(settlementLayer.root, hover);
  app.stage.addChild(renderer.root);

  // ---- top bar collapse ----
  const topbar = el<HTMLDivElement>('topbar');
  const barToggle = el<HTMLButtonElement>('bar-toggle');
  function syncBarHeight(): void {
    document.documentElement.style.setProperty('--bar-h', `${topbar.offsetHeight}px`);
  }
  function setBarCollapsed(c: boolean): void {
    topbar.classList.toggle('collapsed', c);
    barToggle.textContent = c ? '▸' : '▾';
    try { localStorage.setItem('realms.topbar.collapsed', c ? '1' : '0'); } catch { /* ignore */ }
    syncBarHeight();
  }
  new ResizeObserver(syncBarHeight).observe(topbar);
  barToggle.addEventListener('click', () => setBarCollapsed(!topbar.classList.contains('collapsed')));
  try { setBarCollapsed(localStorage.getItem('realms.topbar.collapsed') === '1'); } catch { /* ignore */ }

  // ---- hover popover: a small card to the right of the hovered settlement ----
  const popover = el<HTMLDivElement>('popover');
  let popoverId: string | null = null;
  function showPopover(id: string | null): void {
    const s = id ? state.settlements[id] : null;
    if (!s) { popover.classList.add('hidden'); popoverId = null; return; }
    popoverId = id;
    renderPopover(popover, state, s);
    popover.style.borderLeftColor = state.factions[s.faction ?? '']?.color ?? '#9a9484';
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
    onToolChanged: () => { refreshLayer(); refreshPanel(); if (mouseX >= 0) updateHover(mouseX, mouseY); },
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
    renderer.root.addChild(settlementLayer.root, hover);
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
    applyMap(fit);
  }

  /** Anything in the state may have changed: refresh every readout and layer. */
  function stateChanged(): void {
    if (selectedId && !state.settlements[selectedId]) selectedId = null;
    if (hoverId && !state.settlements[hoverId]) hoverId = null;
    workAssign = computeWorkAssignment(state);
    updateMapInfo();
    refreshLayer();
    refreshPanel();
    editor.refreshPanel();
    if (mouseX >= 0) updateHover(mouseX, mouseY);
  }

  function refreshLayer(): void {
    settlementLayer.update(state, { hover: hoverId, selected: selectedId, zoom: camera.zoom, settling: editor.settling });
    positionPopover();
  }

  function updateMapInfo(): void {
    const counts = countTerrain(state.map);
    const land = state.map.terrain.length - (counts[TERRAIN.findIndex((t) => t.id === 'sea')] ?? 0);
    const cal = calendar(state.turn);
    const label = mapName ? `map "${mapName}"` : `seed "${state.seed}"`;
    const n = Object.keys(state.settlements).length;
    el('info-map').textContent =
      `${state.map.width}×${state.map.height} hexes · ${label} · land ${((100 * land) / state.map.terrain.length).toFixed(0)}%${n ? ` · ${n} settlement${n === 1 ? '' : 's'}` : ''}`;
    el('info-date').textContent = `${cal.monthName}, year ${cal.year}`;
    const ev = state.events[state.events.length - 1];
    el('info-event').textContent = ev ? `${calendar(ev.turn).monthName} ${calendar(ev.turn).year}: ${ev.text}` : '';
  }

  // ---- settlement selection and panel ----
  function select(id: string | null): void {
    selectedId = id && state.settlements[id] ? id : null;
    refreshLayer();
    refreshPanel();
  }
  function refreshPanel(): void {
    const s = selectedId ? state.settlements[selectedId] : null;
    if (!s) { panel.classList.add('hidden'); panel.innerHTML = ''; return; }
    panel.classList.remove('hidden');
    renderPanel(panel, state, s, {
      onRename: (id, name) => { editor.editSettlement(id, { name }); },
      onSetPopulation: (id, population) => { editor.editSettlement(id, { population }); },
      onRemove: (id) => { editor.removeSettlement(id); },
      onFocus: (id) => {
        const t = state.settlements[id];
        if (!t) return;
        select(id);
        const p = offsetToPixel(t.col, t.row, HEX_SIZE);
        camera.centerOn(p.x, p.y);
      },
      onClose: () => select(null),
    }, editor.active);
  }

  // ---- turns ----
  function advance(months: number): void {
    const t0 = performance.now();
    for (let i = 0; i < months; i++) endTurn(state);
    const ms = performance.now() - t0;
    el('info-run').textContent = months > 1 ? `${months / 12} years in ${ms.toFixed(0)} ms` : '';
    editor.stateChangedExternally();
    stateChanged();
    renderPopoverIfStale();
  }
  el<HTMLButtonElement>('end-turn').addEventListener('click', () => advance(1));
  el<HTMLButtonElement>('run-years-btn').addEventListener('click', () => {
    const years = Math.max(1, Math.min(200, Math.round(Number(el<HTMLInputElement>('run-years').value) || 1)));
    advance(12 * years);
  });

  // ---- HUD controls ----
  function regenerate(): void {
    const t0 = performance.now();
    mapName = `draft ${seedInput.value.trim() || 'realms'}`;
    editor.resetHistory();
    replaceState(newGameFrom(readParams()), true);
    el('info-perf').textContent = `generated in ${(performance.now() - t0).toFixed(0)} ms`;
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
  el<HTMLButtonElement>('start-position').addEventListener('click', () => {
    if (editor.dirty && !confirm('Reload the shipped starting position? Unsaved changes will be lost (save a scenario first if you want to keep them).')) return;
    history.replaceState(null, '', location.pathname);
    editor.resetHistory();
    replaceState(loadStart(), true);
  });
  el<HTMLButtonElement>('testmap').addEventListener('click', () => {
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
      // a plain click outside edit mode: select the settlement under the cursor (or deselect)
      const h = hexAt(e.clientX, e.clientY);
      select(inBounds(state.map, h.col, h.row) ? settlementIdAt(state, h.col, h.row) : null);
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
    else if (e.key === 'Escape') select(null);
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
      if (prevHover !== hoverId) { showPopover(null); refreshLayer(); }
      return;
    }
    const t = TERRAIN[getTerrain(state.map, h.col, h.row)];
    const r = resourceByIndex(getResource(state.map, h.col, h.row));
    const y = [t.fertility ? `fertility ${t.fertility}` : '', t.pasture ? `pasture ${t.pasture}` : '', t.timber ? `timber ${t.timber}` : ''].filter(Boolean).join(' ');
    const workedBy = workAssign.get(idx(state.map, h.col, h.row));
    const workedText = workedBy && state.settlements[workedBy] ? `  · worked by ${state.settlements[workedBy].name}` : '';
    el('info-hex').textContent =
      `hex (${h.col}, ${h.row})  ${t.name}${r ? ` · ${r.name}` : ''}  move ${t.passable ? t.moveCost : '—'}${y ? '  ' + y : ''}${workedText}`;
    hoverId = settlementIdAt(state, h.col, h.row);
    if (prevHover !== hoverId) { showPopover(hoverId); refreshLayer(); }
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
    if (popoverId && popoverId === hoverId && state.settlements[popoverId]) renderPopover(popover, state, state.settlements[popoverId]);
  }

  // ---- frame loop: culling + perf readout; redraw the settlement layer when the zoom changes ----
  let frames = 0, lastFps = performance.now(), fps = 0, maxBuild = 0, lastZoom = -1;
  app.ticker.add(() => {
    renderer.setZoom(camera.zoom);
    if (Math.abs(camera.zoom - lastZoom) > 1e-6) { lastZoom = camera.zoom; refreshLayer(); }
    const visible = renderer.cull(camera.viewRect());
    maxBuild = Math.max(maxBuild, renderer.lastBuildMs);
    frames++;
    const now = performance.now();
    if (now - lastFps >= 1000) {
      fps = frames;
      frames = 0;
      lastFps = now;
      el('info-perf').textContent =
        `${fps} fps · zoom ${camera.zoom.toFixed(2)} · ${visible}/${renderer.chunkCount} chunks visible · worst chunk build ${maxBuild.toFixed(0)} ms`;
    }
  });
}
