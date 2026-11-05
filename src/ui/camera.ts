// Camera: pan/zoom of the world container, with clamping to the map.
import { Container, Rectangle } from 'pixi.js';

export class Camera {
  zoom = 1;
  minZoom = 0.08;
  maxZoom = 5;
  private worldW = 0;
  private worldH = 0;

  constructor(readonly world: Container, private screenW: number, private screenH: number) {}

  setWorldSize(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
    this.clamp();
  }

  resize(w: number, h: number): void {
    this.screenW = w;
    this.screenH = h;
    this.clamp();
  }

  /** Fit the whole map on screen. */
  fit(): void {
    const z = Math.min(this.screenW / this.worldW, this.screenH / this.worldH) * 0.95;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, z));
    this.world.scale.set(this.zoom);
    this.world.position.set(
      (this.screenW - this.worldW * this.zoom) / 2,
      (this.screenH - this.worldH * this.zoom) / 2,
    );
  }

  panBy(dx: number, dy: number): void {
    this.world.position.x += dx;
    this.world.position.y += dy;
    this.clamp();
  }

  /** Zoom keeping the screen point (sx, sy) fixed. */
  zoomAt(factor: number, sx: number, sy: number): void {
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const wx = (sx - this.world.position.x) / this.zoom;
    const wy = (sy - this.world.position.y) / this.zoom;
    this.zoom = newZoom;
    this.world.scale.set(newZoom);
    this.world.position.set(sx - wx * newZoom, sy - wy * newZoom);
    this.clamp();
  }

  /** Put the world point (wx, wy) at the centre of the screen, keeping the zoom. */
  centerOn(wx: number, wy: number): void {
    this.world.position.set(this.screenW / 2 - wx * this.zoom, this.screenH / 2 - wy * this.zoom);
    this.clamp();
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.world.position.x) / this.zoom,
      y: (sy - this.world.position.y) / this.zoom,
    };
  }

  /** Visible area in world coordinates. */
  viewRect(): Rectangle {
    const tl = this.screenToWorld(0, 0);
    return new Rectangle(tl.x, tl.y, this.screenW / this.zoom, this.screenH / this.zoom);
  }

  private clamp(): void {
    const w = this.worldW * this.zoom, h = this.worldH * this.zoom;
    const margin = 0.5; // allow the map to be dragged half-way off screen
    const minX = Math.min(0, this.screenW * margin - w), maxX = Math.max(this.screenW * (1 - margin), 0);
    const minY = Math.min(0, this.screenH * margin - h), maxY = Math.max(this.screenH * (1 - margin), 0);
    if (w < this.screenW) {
      // centre small maps horizontally
      this.world.position.x = Math.max(minX, Math.min(maxX, this.world.position.x));
    } else {
      this.world.position.x = Math.max(this.screenW * margin - w, Math.min(this.screenW * (1 - margin), this.world.position.x));
    }
    if (h < this.screenH) {
      this.world.position.y = Math.max(minY, Math.min(maxY, this.world.position.y));
    } else {
      this.world.position.y = Math.max(this.screenH * margin - h, Math.min(this.screenH * (1 - margin), this.world.position.y));
    }
  }
}
