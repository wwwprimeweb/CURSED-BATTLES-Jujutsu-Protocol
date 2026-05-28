import { SpriteAnimator } from "./spriteAnimator.js";
import { YUJI_ANIMATIONS, YUJI_SPRITE_CONFIG, YUJI_SHEET_PATH } from "./yujiSprites.js";
import { drawHitReaction, drawDodgeEffect, drawDeathPose } from "./gojoEffects.js";

const IMPACT_SHEET_PATH = "/assets/sprites/yuji_shinjuku/impact_sheet.png";
const IMPACT_FRAME_W = 132;
const IMPACT_FRAME_H = 96;
const IMPACT_FRAMES = 21;

export class YujiVisualSystem {
  constructor() {
    this.yujiSprite = new SpriteAnimator({
      sheetPath: YUJI_SHEET_PATH,
      cellWidth: YUJI_SPRITE_CONFIG.cellWidth,
      cellHeight: YUJI_SPRITE_CONFIG.cellHeight,
      pivotX: YUJI_SPRITE_CONFIG.pivotX,
      pivotY: YUJI_SPRITE_CONFIG.pivotY,
      renderScale: YUJI_SPRITE_CONFIG.renderScale,
      animations: YUJI_ANIMATIONS,
    });

    this.impactSheet = new Image();
    this.impactSheet.src = IMPACT_SHEET_PATH;

    this.hitFlashes = new Map();
    this.dodgeEffects = new Map();
    this.time = 0;

    this.divergentFistEffects = [];
    this.flyingKneeEffects = [];
    this.soulImpactEffects = [];
    this.taidoBeatdownEffects = [];
  }

  update(dt) {
    this.time += dt;
    this.yujiSprite.update(dt);

    this.hitFlashes.forEach((flash, id) => {
      flash.life -= dt;
      if (flash.life <= 0) this.hitFlashes.delete(id);
    });

    this.dodgeEffects.forEach((effect, id) => {
      effect.life -= dt;
      if (effect.life <= 0) this.dodgeEffects.delete(id);
    });

    for (let i = this.divergentFistEffects.length - 1; i >= 0; i -= 1) {
      this.divergentFistEffects[i].life -= dt;
      if (this.divergentFistEffects[i].life <= 0) this.divergentFistEffects.splice(i, 1);
    }

    for (let i = this.flyingKneeEffects.length - 1; i >= 0; i -= 1) {
      this.flyingKneeEffects[i].life -= dt;
      if (this.flyingKneeEffects[i].life <= 0) this.flyingKneeEffects.splice(i, 1);
    }

    for (let i = this.soulImpactEffects.length - 1; i >= 0; i -= 1) {
      this.soulImpactEffects[i].life -= dt;
      if (this.soulImpactEffects[i].life <= 0) this.soulImpactEffects.splice(i, 1);
    }

    for (let i = this.taidoBeatdownEffects.length - 1; i >= 0; i -= 1) {
      this.taidoBeatdownEffects[i].life -= dt;
      if (this.taidoBeatdownEffects[i].life <= 0) this.taidoBeatdownEffects.splice(i, 1);
    }
  }

  triggerDivergentFist(x, y, dirX, dirY, range, width) {
    if (this.divergentFistEffects.length > 24) this.divergentFistEffects.splice(0, 8);
    const impactX = x + dirX * range;
    const impactY = y + dirY * range;
    this.divergentFistEffects.push({
      x: impactX,
      y: impactY,
      radius: width * 0.5,
      life: 0.28,
      delayed: false,
    });
  }

  triggerDivergentFistDelayed(x, y, radius) {
    if (this.divergentFistEffects.length > 24) this.divergentFistEffects.splice(0, 8);
    this.divergentFistEffects.push({
      x,
      y,
      radius,
      life: 0.5,
      delayed: true,
      impactStart: Math.floor(Math.random() * 5),
    });
  }

  triggerFlyingKnee(x, y, dirX, dirY, hit) {
    if (this.flyingKneeEffects.length > 12) this.flyingKneeEffects.splice(0, 4);
    this.flyingKneeEffects.push({
      x, y,
      dirX, dirY,
      hit,
      life: 0.48,
    });
  }

  triggerSoulImpact(x, y) {
    if (this.soulImpactEffects.length > 12) this.soulImpactEffects.splice(0, 4);
    this.soulImpactEffects.push({ x, y, life: 0.76 });
  }

  triggerTaidoBeatdownHit(x, y, hitNum) {
    if (this.taidoBeatdownEffects.length > 24) this.taidoBeatdownEffects.splice(0, 8);
    this.taidoBeatdownEffects.push({ x, y, hitNum, life: 0.16, final: false });
  }

  triggerTaidoBeatdownFinal(x, y, hitNum, blackFlash) {
    if (this.taidoBeatdownEffects.length > 24) this.taidoBeatdownEffects.splice(0, 8);
    this.taidoBeatdownEffects.push({ x, y, hitNum, life: 0.62, final: true, blackFlash });
  }

  triggerHit(x, y, intensity = 1) {
    this.hitFlashes.set(Date.now(), { x, y, life: 0.15, intensity });
  }

  triggerDodge(x, y, facing) {
    this.dodgeEffects.set(Date.now(), { x, y, facing, life: 0.25 });
  }

  renderPlayer(ctx, camera, entry, _isYou, facing, state, renderX, renderY) {
    const p = entry.raw;
    const worldX = Number.isFinite(renderX) ? renderX : p.x;
    const worldY = Number.isFinite(renderY) ? renderY : p.y;
    const zoom = camera.zoom || 1;
    const pos = {
      x: (worldX - camera.x) * zoom + ctx.canvas.width * 0.5,
      y: (worldY - camera.y) * zoom + ctx.canvas.height * 0.5,
    };

    const animState = state || p.animState || "idle";

    if (animState === "dodge" && p.dodgeStartTime) {
      const dodgeAge = (Date.now() - p.dodgeStartTime) / 1000;
      const dodgeProgress = Math.min(1, dodgeAge / 0.2);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.scale(zoom, zoom);
      drawDodgeEffect(ctx, 0, 0, facing, dodgeProgress);
      ctx.restore();
    }

    if (animState === "hit" && p.hitTime) {
      const hitAge = (Date.now() - p.hitTime) / 1000;
      const flashIntensity = Math.max(0, 1 - hitAge / 0.15);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.scale(zoom, zoom);
      drawHitReaction(ctx, 0, 0, facing, flashIntensity);
      ctx.restore();
    }

    if (animState === "death" && p.deathTime) {
      const deathAge = (Date.now() - p.deathTime) / 1000;
      const progress = Math.min(1, deathAge / 1.5);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.scale(zoom, zoom);
      drawDeathPose(ctx, 0, 0, progress, this.time);
      ctx.restore();
      return;
    }

    let drawY = pos.y;
    if (animState === "walk" || animState === "run") {
      drawY += Math.sin(this.time * 10) * 2.5;
    }

    this.yujiSprite.render(ctx, pos.x, drawY, animState, facing, zoom, entry.id);

    if (!p.alive) return;

    ctx.fillStyle = "#f2f6ff";
    ctx.font = "600 14px Rajdhani";
    ctx.textAlign = "center";
    ctx.fillText(p.name || "Yuji", pos.x, pos.y - (65 * 2.05 + 10) * zoom);
  }

  drawImpactFrame(ctx, x, y, zoom, frameIndex, alpha = 1, sizeMul = 1) {
    if (!this.impactSheet.complete || this.impactSheet.naturalWidth <= 0) return;
    const idx = ((frameIndex % IMPACT_FRAMES) + IMPACT_FRAMES) % IMPACT_FRAMES;
    const sx = idx * IMPACT_FRAME_W;
    const sy = 0;
    const sw = IMPACT_FRAME_W;
    const sh = IMPACT_FRAME_H;

    const targetW = sw * zoom * sizeMul;
    const targetH = sh * zoom * sizeMul;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(this.impactSheet, sx, sy, sw, sh, x - targetW * 0.5, y - targetH * 0.5, targetW, targetH);
    ctx.restore();
  }

  renderEffects(ctx, camera) {
    const zoom = camera.zoom || 1;

    this.divergentFistEffects.forEach((e) => {
      const screenX = (e.x - camera.x) * zoom + ctx.canvas.width * 0.5;
      const screenY = (e.y - camera.y) * zoom + ctx.canvas.height * 0.5;
      const radius = (e.radius || 90) * zoom;

      if (e.delayed) {
        const t = 1 - e.life / 0.5;
        const alpha = Math.max(0, Math.min(1, e.life / 0.5));
        const frame = e.impactStart + Math.floor(t * 8);
        this.drawImpactFrame(ctx, screenX, screenY, zoom, frame, alpha, 0.75 + t * 0.1);
      } else {
        // Expanding repulsion ring
        const t = 1 - e.life / 0.28;
        const ringRadius = radius * (0.3 + t * 0.7);
        const alpha = Math.max(0, (1 - t) * 0.6);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "rgba(80,170,255,0.7)";
        ctx.lineWidth = 3 * zoom * (1 - t * 0.5);
        ctx.beginPath();
        ctx.arc(screenX, screenY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        // Inner glow fill
        ctx.globalAlpha = alpha * 0.15;
        ctx.fillStyle = "rgba(60,140,255,0.2)";
        ctx.beginPath();
        ctx.arc(screenX, screenY, ringRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    this.flyingKneeEffects.forEach((e) => {
      const screenX = (e.x - camera.x) * zoom + ctx.canvas.width * 0.5;
      const screenY = (e.y - camera.y) * zoom + ctx.canvas.height * 0.5;
      const alpha = Math.min(1, e.life / 0.48);

      ctx.save();
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = "rgba(255,170,68,0.7)";
      ctx.lineWidth = 3 * zoom;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(screenX + e.dirX * 80 * zoom, screenY + e.dirY * 80 * zoom);
      ctx.stroke();
      ctx.restore();

      if (e.hit) {
        this.drawImpactFrame(ctx, screenX, screenY, zoom, 9, alpha, 0.85);
      }
    });

    this.soulImpactEffects.forEach((e) => {
      const screenX = (e.x - camera.x) * zoom + ctx.canvas.width * 0.5;
      const screenY = (e.y - camera.y) * zoom + ctx.canvas.height * 0.5;
      const alpha = Math.min(1, e.life / 0.76);

      ctx.save();
      ctx.globalAlpha = alpha;
      const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 62 * zoom);
      gradient.addColorStop(0, "rgba(255,255,255,0.95)");
      gradient.addColorStop(0.35, "rgba(200,0,0,0.75)");
      gradient.addColorStop(1, "rgba(100,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 62 * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      this.drawImpactFrame(ctx, screenX, screenY, zoom, 14, alpha * 0.9, 0.82);
    });

    this.taidoBeatdownEffects.forEach((e) => {
      const screenX = (e.x - camera.x) * zoom + ctx.canvas.width * 0.5;
      const screenY = (e.y - camera.y) * zoom + ctx.canvas.height * 0.5;

      if (e.final) {
        const alpha = Math.min(1, e.life / 0.62);
        const frame = e.blackFlash ? 17 : 11;
        this.drawImpactFrame(ctx, screenX, screenY, zoom, frame, alpha, 0.96);
      } else {
        const alpha = Math.min(1, e.life / 0.16);
        this.drawImpactFrame(ctx, screenX, screenY, zoom, (e.hitNum || 0) % 8, alpha, 0.55);
      }
    });

    this.hitFlashes.forEach((flash) => {
      ctx.save();
      ctx.globalAlpha = flash.intensity * (flash.life / 0.15);
      ctx.fillStyle = "rgba(255,80,80,0.3)";
      ctx.beginPath();
      ctx.arc(
        flash.x - camera.x + ctx.canvas.width * 0.5,
        flash.y - camera.y + ctx.canvas.height * 0.5,
        30,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    });
  }
}
