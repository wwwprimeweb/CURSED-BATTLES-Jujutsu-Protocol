import { loadImage } from "./imageLoader.js";

const FRAME_W = 64;
const FRAME_H = 64;
const FRAMES_PER_SHEET = 6;

const SHEET_PATHS = [
  "/assets/smoke/smoke_2A_1.png",
  "/assets/smoke/smoke_2A_2.png",
  "/assets/smoke/smoke_2A_3.png",
];

export class SmokeEffect {
  constructor() {
    this.sheets = [];
    this.bursts = [];
    this._loaded = false;
  }

  async load() {
    for (const path of SHEET_PATHS) {
      try {
        const img = await loadImage(path);
        this.sheets.push(img);
      } catch (e) {
        console.warn("SmokeEffect: Failed to load", path);
        this.sheets.push(null);
      }
    }
    this._loaded = true;
  }

  spawnBurst(x, y, sheetIndex = 0, scale = 1, angle = 0, life = 0.35) {
    if (!this.sheets[sheetIndex]) return;
    this.bursts.push({
      x, y,
      sheetIndex,
      frame: 0,
      speed: 20,
      frames: FRAMES_PER_SHEET,
      startScale: scale,
      endScale: scale + scale * 0.8,
      life,
      maxLife: life,
      angle,
    });
  }

  update(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.bursts.splice(i, 1);
        continue;
      }
      b.frame += b.speed * dt;
      const t = 1 - b.life / b.maxLife;
      b.scale = b.startScale + (b.endScale - b.startScale) * t;
    }
  }

  render(ctx, camera) {
    if (this.bursts.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const b of this.bursts) {
      const img = this.sheets[b.sheetIndex];
      if (!img) continue;

      const t = 1 - b.life / b.maxLife;
      const alpha = Math.max(0, 1 - t * t) * 0.7;
      const frameIdx = Math.min(Math.floor(b.frame), b.frames - 1);

      const sx = (b.x - camera.x) * camera.zoom + ctx.canvas.width * 0.5;
      const sy = (b.y - camera.y) * camera.zoom + ctx.canvas.height * 0.5;
      const renderSize = FRAME_W * b.scale * camera.zoom;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sx, sy);
      ctx.rotate(b.angle);
      ctx.drawImage(
        img,
        frameIdx * FRAME_W, 0, FRAME_W, FRAME_H,
        -renderSize / 2, -renderSize / 2,
        renderSize, renderSize,
      );
      ctx.restore();
    }

    ctx.restore();
  }
}
