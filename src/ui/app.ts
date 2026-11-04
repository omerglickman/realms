// The browser application: PixiJS stage, camera, input, HUD, editor wiring.
// All game rules live in src/sim; this file only displays and forwards input.

import { Application, Graphics } from 'pixi.js';
import { MapRenderer, HEX_SIZE } from './render/mapRenderer';
import { Camera } from './camera';
import { Editor } from './editor/editor';
import { generateDraftMap, MAPGEN_DEFAULTS, type MapGenParams } from '../sim/mapgen';
import { createGameState, calendar, type GameState } from '../sim/state';
import { pixelToAxial, axialToOffset, offsetToPixel, hexCorners } from '../sim/hex';
import { inBounds, getTerrain, getResource, countTerrain } from '../sim/map';
import { TERRAIN } from '../sim/terrain';
import { resourceByIndex } from '../sim/resources';
import { loadMapFile } from '../sim/mapfile';
import testmapJson from '../../maps/testmap.json';

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
  if (hash.has('seed')) {
    state = newGameFrom(readParams());
  } else {
    const loaded = loadMapFile(testmapJson);
    state = createGameState('testmap', loaded.map);
    mapName = loaded.name;
  }

  const renderer = new MapRenderer(state.map);
  const camera = new Camera(renderer.root, app.screen.width, app.screen.height);
  const hover = new Graphics();
  renderer.root.addChild(hover);
  app.stage.addChild(renderer.root);

  const editor = new Editor({
    getState: () => state,
    onChanged: (cells) => {
      if (cells === 'all') {
        applyMap(false);
      } else {
        const w = state.map.width;
        for (const i of cells) renderer.invalidateHex(i % w, Math.floor(i / w));
      }
      updateMapInfo();
    },
    getMapName: () => mapName,
    setMapName: (n) => { mapName = n; updateMapInfo(); },
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
    renderer.root.addChild(hover);
    const ws = renderer.worldSize();
    camera.setWorldSize(ws.width, ws.height);
    if (fit) camera.fit();
    updateMapInfo();
  }

  function updateMapInfo(): void {
    const counts = countTerrain(state.map);
    const land = state.map.terrain.length - (counts[TERRAIN.findIndex((t) => t.id === 'sea')] ?? 0);
    const cal = calendar(state.turn);
    const label = mapName ? `map "${mapName}"` : `seed "${state.seed}"`;
    el('info-map').textContent =
      `${state.map.width}×${state.map.height} hexes · ${label} · land ${((100 * land) / state.map.terrain.length).toFixed(0)}% · ${cal.monthName}, year ${cal.year}`;
  }

  // ---- HUD controls ----
  function regenerate(): void {
    const t0 = performance.now();
    mapName = `draft ${seedInput.value.trim() || 'realms'}`;
    state = newGameFrom(readParams());
    editor.resetHistory();
    applyMap(true);
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
  el<HTMLButtonElement>('testmap').addEventListener('click', () => {
    const loaded = loadMapFile(testmapJson);
    state = createGameState('testmap', loaded.map);
    mapName = loaded.name;
    history.replaceState(null, '', location.pathname);
    editor.resetHistory();
    applyMap(true);
  });

  // ---- input: pan / zoom / hover / paint ----
  const canvas = app.canvas;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  let panning = false;
  let painting = false;
  let lastX = 0, lastY = 0;
  let mouseX = -1, mouseY = -1;

  function hexAt(sx: number, sy: number): { col: number; row: number } {
    const w = camera.screenToWorld(sx, sy);
    const a = pixelToAxial(w.x, w.y, HEX_SIZE);
    return axialToOffset(a.q, a.r);
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    lastX = e.clientX;
    lastY = e.clientY;
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
    panning = false;
    if (painting) {
      painting = false;
      editor.pointerUp();
    }
    canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (panning) {
      camera.panBy(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
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
    else if (e.key === 'Home') camera.fit();
    else if (e.key === 'e' || e.key === 'E') editor.setActive(!editor.active);
    if (mouseX >= 0) updateHover(mouseX, mouseY);
  });

  window.addEventListener('resize', () => camera.resize(app.screen.width, app.screen.height));
  window.addEventListener('beforeunload', (e) => {
    if (editor.dirty) { e.preventDefault(); }
  });

  function updateHover(sx: number, sy: number): void {
    const h = hexAt(sx, sy);
    hover.clear();
    if (!inBounds(state.map, h.col, h.row)) {
      el('info-hex').textContent = 'Outside the map';
      return;
    }
    const t = TERRAIN[getTerrain(state.map, h.col, h.row)];
    const r = resourceByIndex(getResource(state.map, h.col, h.row));
    el('info-hex').textContent =
      `hex (${h.col}, ${h.row})  ${t.name}${r ? ` · ${r.name}` : ''}  move ${t.passable ? t.moveCost : '—'}  food ${t.food}`;
    const lw = 2 / camera.zoom;
    if (editor.active) {
      const w = state.map.width;
      for (const i of editor.previewCells(h.col, h.row)) {
        const p = offsetToPixel(i % w, Math.floor(i / w), HEX_SIZE);
        hover.poly(hexCorners(p.x, p.y, HEX_SIZE));
      }
      hover.stroke({ width: lw, color: 0xffffff, alpha: 0.85 });
    } else {
      const p = offsetToPixel(h.col, h.row, HEX_SIZE);
      hover.poly(hexCorners(p.x, p.y, HEX_SIZE)).stroke({ width: lw, color: 0xffffff, alpha: 0.9 });
    }
  }

  // ---- frame loop: culling + perf readout ----
  let frames = 0, lastFps = performance.now(), fps = 0, maxBuild = 0;
  app.ticker.add(() => {
    renderer.setZoom(camera.zoom);
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
