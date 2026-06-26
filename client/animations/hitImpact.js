const SHEET_PATH = "/Hit-Yellow.png";
const FRAME_SIZE = 1024;
const COLS = 4;
const TOTAL_FRAMES = 16;
const LIFE = 0.35;
const BASE_SIZE = 120;

export class HitImpactEffect {
  constructor() {
    this.impacts = [];
    this._loaded = false;
    this.image = new Image();
  }

  async load() {
    try {
      await new Promise((resolve, reject) => {
        this.image.onload = resolve;
        this.image.onerror = () => reject(new Error("Failed to load Hit-Yellow"));
        this.image.src = SHEET_PATH;
      });
      this._loaded = true;
    } catch (e) {
      console.warn("HitImpact: Failed to load", e);
    }
  }

  spawn(x, y, fromX, fromY) {
    if (!this._loaded) return;
    const dx = x - fromX;
    const dy = y - fromY;
    const norm = Math.hypot(dx, dy);
    if (norm < 0.01) return;

    this.impacts.push({
      x, y,
      angle: Math.atan2(fromY - y, fromX - x),
      life: LIFE,
      maxLife: LIFE,
    });
  }

  update(dt) {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      this.impacts[i].life -= dt;
      if (this.impacts[i].life <= 0) {
        this.impacts.splice(i, 1);
      }
    }
  }

  render(ctx, camera) {
    if (!this._loaded || this.impacts.length === 0) return;

    for (const imp of this.impacts) {
      const t = 1 - imp.life / imp.maxLife;
      const alpha = Math.max(0, 1 - t * t);
      const frameIdx = Math.min(TOTAL_FRAMES - 1, Math.floor(t * TOTAL_FRAMES));

      const sx = (imp.x - camera.x) * camera.zoom + ctx.canvas.width * 0.5;
      const sy = (imp.y - camera.y) * camera.zoom + ctx.canvas.height * 0.5;
      const size = BASE_SIZE * (0.5 + t * 0.5) * camera.zoom;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(imp.angle);

      ctx.globalAlpha = alpha;
      ctx.filter = "grayscale(1) brightness(1.8)";
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(
        this.image,
        (frameIdx % COLS) * FRAME_SIZE,
        Math.floor(frameIdx / COLS) * FRAME_SIZE,
        FRAME_SIZE,
        FRAME_SIZE,
        -size / 2,
        -size / 2,
        size,
        size,
      );


      ctx.restore();
    }
  }

  clear() {
    this.impacts.length = 0;
  }
}
