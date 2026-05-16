import { drawM1Slash, drawDashSlashTrail, drawRikaSwing, drawPureLoveExplosion } from "./yutaEffects.js";
import { SkillVFX } from "../particles/proceduralEffects.js";

export class YutaSkillEffects {
  constructor() {
    this.rikas = new Map();
    this.pureLoves = [];
    this.katanaSlashes = [];
    this.time = 0;
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

  addRikaAttack(x, y) {
    this.katanaSlashes.push({ type: "rika", x, y, life: 0.4 });
  }

  addPureLove(x, y, radius) {
    this.pureLoves.push({ x, y, radius, life: 0.8 });
  }

  addKatanaSlash(x, y, dirX, dirY, combo) {
    this.katanaSlashes.push({ type: "m1", x, y, dirX, dirY, combo, life: 0.3 });
  }

  addDashSlash(x, y, dirX, dirY) {
    this.katanaSlashes.push({ type: "dash", x, y, dirX, dirY, life: 0.25 });
  }

  render(ctx, camera) {
    const z = camera.zoom || 1;
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
      const progress = 1 - slash.life / 0.3;
      if (slash.type === "m1") {
        drawM1Slash(ctx, sx, sy, slash.dirX, slash.dirY, progress, slash.combo || 1);
      } else if (slash.type === "dash") {
        drawDashSlashTrail(ctx, sx, sy, slash.dirX, slash.dirY, progress);
      } else if (slash.type === "rika") {
        drawRikaSwing(ctx, sx, sy, progress);
      }
    }
  }
}
