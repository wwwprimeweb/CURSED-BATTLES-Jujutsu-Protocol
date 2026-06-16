import { drawM1Combined, drawCursedWave, drawRikaClawScratch, drawPureLoveExplosion } from "./yutaEffects.js";
import { SkillVFX } from "../particles/proceduralEffects.js";

export class YutaSkillEffects {
  constructor() {
    this.rikas = new Map();
    this.pureLoves = [];
    this.katanaSlashes = [];
    this.time = 0;
    this.m1Spritesheet = new Image();
    this.m1Spritesheet.src = "/assets/habilit/portador-do-vinculo_m1_7033.png";
  }

  update(dt) {
    this.time += dt;

    this.rikas.forEach((rika, id) => {
      rika.life -= dt;
      if (rika.life <= 0) this.rikas.delete(id);
    });

    for (let i = this.pureLoves.length - 1; i >= 0; i--) {
      this.pureLoves[i].life -= dt;
      if (this.pureLoves[i].life <= 0) this.pureLoves.splice(i, 1);
    }

    for (let i = this.katanaSlashes.length - 1; i >= 0; i--) {
      this.katanaSlashes[i].life -= dt;
      if (this.katanaSlashes[i].life <= 0) this.katanaSlashes.splice(i, 1);
    }
  }

  addRikaStart(x, y, duration) {
    this.rikas.set(Date.now(), { x, y, life: duration });
  }

  addRikaAttack(x, y, dirX = 1, dirY = 0, options = {}) {
    let fx = dirX;
    let fy = dirY;
    const valid = Number.isFinite(fx) && Number.isFinite(fy) && fx * fx + fy * fy > 0.000001;
    if (!valid) {
      const a = Math.random() * Math.PI * 2;
      fx = Math.cos(a);
      fy = Math.sin(a);
    }
    const life = Number.isFinite(options.life) ? Math.max(0.2, options.life) : 0.4;
    const size = Number.isFinite(options.size) ? Math.max(0.6, options.size) : 1;
    const intensity = Number.isFinite(options.intensity) ? Math.max(0.5, options.intensity) : 1;
    this.katanaSlashes.push({
      type: "rika",
      x,
      y,
      dirX: fx,
      dirY: fy,
      life,
      maxLife: life,
      size,
      intensity,
    });
  }

  addPureLove(x, y, radius) {
    this.pureLoves.push({ x, y, radius, life: 0.8 });
  }

  addKatanaSlash(x, y, dirX, dirY, combo, options = {}) {
    const range = Number.isFinite(options.range) ? Math.max(85, options.range) : 160;
    const coneAngle = Number.isFinite(options.coneAngle) ? Math.max(0.5, options.coneAngle) : 0.6;

    this.katanaSlashes.push({
      type: "m1Combined",
      x,
      y,
      dirX,
      dirY,
      combo,
      range,
      coneAngle,
      life: 0.4,
      maxLife: 0.4,
    });
  }

  addCursedWave(x, y, dirX, dirY, range = 300, width = 120) {
    this.katanaSlashes.push({
      type: "cursedWave",
      x,
      y,
      dirX,
      dirY,
      range,
      width,
      life: 0.6,
      maxLife: 0.6,
    });
  }

  render(ctx, camera) {
    const z = camera.zoom;
    const cx = camera.x;
    const cy = camera.y;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    this.rikas.forEach((rika) => {
      const sx = (rika.x - cx) * z + w * 0.5;
      const sy = (rika.y - cy) * z + h * 0.5;
      const alpha = Math.min(1, rika.life / 2);
      SkillVFX.drawTeleportDistortion(ctx, sx, sy, alpha * 0.5);
    });

    this.pureLoves.forEach((pl) => {
      const sx = (pl.x - cx) * z + w * 0.5;
      const sy = (pl.y - cy) * z + h * 0.5;
      const progress = 1 - pl.life / 0.8;
      SkillVFX.drawPurpleExplosion(ctx, sx, sy, pl.radius * progress * 1.2);
    });

    for (const slash of this.katanaSlashes) {
      if (slash.life <= 0) continue;
      const sx = (slash.x - cx) * z + w * 0.5;
      const sy = (slash.y - cy) * z + h * 0.5;
      const maxLife = Number.isFinite(slash.maxLife) ? slash.maxLife : 0.3;
      const progress = 1 - slash.life / maxLife;
      if (slash.type === "m1Combined") {
        drawM1Combined(ctx, sx, sy, slash.dirX, slash.dirY, progress, slash.combo || 1, slash.range, slash.coneAngle, this.m1Spritesheet);
      } else if (slash.type === "rika") {
        const size = Number.isFinite(slash.size) ? slash.size : 1;
        const intensity = Number.isFinite(slash.intensity) ? slash.intensity : 1;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(size, size);
        drawRikaClawScratch(ctx, 0, 0, slash.dirX, slash.dirY, progress, intensity);
        ctx.restore();
      }
    }
  }
}
