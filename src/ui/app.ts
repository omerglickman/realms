// The browser application: PixiJS stage, camera, input, HUD.
// All game rules live in src/sim; this file only displays and forwards input.

import { Application, Graphics } from 'pixi.js';
import { MapRenderer, HEX_SIZE } from './render/mapRenderer';
import { Camera } from './camera';
import { generateDraftMap, MAPGEN_DEFAULTS, type MapGenParams } from '../sim/mapgen';
import { createGameState, calendar, type GameState } from '../sim/state';
import { pixelToAxial, axialToOffset, offsetToPixel, hexCorners } from '../sim/hex';
import { inBounds, getTerrain, countTerrain } from '../sim/map';
import { TERRAIN } from '../sim/terrain';
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
  applyMap();

  function newGameFrom(p: MapGenParams): GameState {
    const map = generateDraftMap(p);
    const st = createGameState(String(p.seed), map);
    location.hash = `seed=${encodeURIComponent(String(p.seed))}&w=${p.width}&h=${p.height}&continents=${p.continents}&islands=${p.islands}&land=${Math.round((p.landFraction ?? 0.45) * 100)}`;
    return st;
  }

  function applyMap(): void {
    renderer.setMap(state.map);
    renderer.root.addChild(hover);
    const ws = renderer.worldSize();
    camera.setWorldSize(ws.width, ws.height);
    camera.fit();
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
    mapName = '';
    state = newGameFrom(readParams());
    applyMap();
    el('info-perf').textContent = `generated in ${(performance.now() - t0).toFixed(0)} ms`;
  }
  el<HTMLButtonElement>('generate').addEventListener('click', regenerate);
  el<HTMLButtonElement>('testmap').addEventListener('click', () => {
    const loaded = loadMapFile(testmapJson);
    state = createGameState('testmap', loaded.map);
    mapName = loaded.name;
    history.replaceState(null, '', location.pathname);
    applyMap();
  });
  el<HTMLButtonElement>('random').addEventListener('click', () => {
    const syll = ['ar', 'bel', 'cor', 'dun', 'el', 'fen', 'gal', 'hol', 'is', 'kar', 'lin', 'mor', 'nor', 'os', 'ral', 'sil', 'tor', 'ul', 'vin', 'wen'];
    const n = 2 + Math.floor(Math.random() * 2);
    let w = '';
    for (let i = 0; i < n; i++) w += syll[Math.floor(Math.random() * syll.length)];
    seedInput.value = w;
    regenerate();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement)?.id === 'seed') regenerate();
  });

  // ---- input: pan / zoom / hover ----
  const canvas = app.canvas;
  let dragging = false;
  let lastX = 0, lastY = 0, moved = 0;
  let mouseX = -1, mouseY = -1;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      camera.panBy(dx, dy);
      lastX = e.clientX;
      lastY = e.clientY;
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
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const step = 60;
    if (e.key === 'ArrowLeft') camera.panBy(step, 0);
    else if (e.key === 'ArrowRight') camera.panBy(-step, 0);
    else if (e.key === 'ArrowUp') camera.panBy(0, step);
    else if (e.key === 'ArrowDown') camera.panBy(0, -step);
    else if (e.key === 'g' || e.key === 'G') renderer.setGridVisible(!renderer.gridVisible);
    else if (e.key === 'f' || e.key === 'F') camera.fit();
    if (mouseX >= 0) updateHover(mouseX, mouseY);
  });

  window.addEventListener('resize', () => camera.resize(app.screen.width, app.screen.height));

  function updateHover(sx: number, sy: number): void {
    const w = camera.screenToWorld(sx, sy);
    const a = pixelToAxial(w.x, w.y, HEX_SIZE);
    const o = axialToOffset(a.q, a.r);
    hover.clear();
    if (!inBounds(state.map, o.col, o.row)) {
      el('info-hex').textContent = 'Outside the map';
      return;
    }
    const t = TERRAIN[getTerrain(state.map, o.col, o.row)];
    el('info-hex').textContent =
      `hex (${o.col}, ${o.row})  axial (${a.q}, ${a.r})  ${t.name}  move ${t.passable ? t.moveCost : '—'}  food ${t.food}`;
    const p = offsetToPixel(o.col, o.row, HEX_SIZE);
    hover.poly(hexCorners(p.x, p.y, HEX_SIZE)).stroke({ width: 2 / camera.zoom, color: 0xffffff, alpha: 0.9 });
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
