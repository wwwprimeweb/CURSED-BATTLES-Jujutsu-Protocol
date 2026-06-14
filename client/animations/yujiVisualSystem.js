import { SpriteAnimator } from "./spriteAnimator.js";
import { YUJI_ANIMATIONS, YUJI_SPRITE_CONFIG, YUJI_SHEET_PATH } from "./yujiSprites.js";
import { drawHitReaction, drawDodgeEffect, drawDeathPose } from "./gojoEffects.js";

const IMPACT_SHEET_PATH = "/assets/sprites/punho-indomavel_shinjuku/impact_sheet.png";
const IMPACT_FRAME_W = 132;
const IMPACT_FRAME_H = 96;
const IMPACT_FRAMES = 21;

const DOMAIN_SHEET_PATH = "/assets/sprites/punho-indomavel_shinjuku/domain_sheet.png";
const DOMAIN_FRAME_W = 110;
const DOMAIN_FRAME_H = 125;
const DOMAIN_FRAMES = 12;

const M1_30007_FRAME_COUNT = 7;
const M1_30007_PATH = "/assets/sprites/punho-indomavel_shinjuku/m1_30007/";



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

    this.domainSheet = new Image();
    this.domainSheet.src = DOMAIN_SHEET_PATH;

    this.m1FxFrames = [];
    for (let i = 0; i < M1_30007_FRAME_COUNT; i++) {
      const img = new Image();
      img.src = `${M1_30007_PATH}30007_${i}.png`;
      this.m1FxFrames.push(img);
    }

    this.hitFlashes = new Map();
    this.dodgeEffects = new Map();
    this.time = 0;
    this.qStartTimes = new Map();

    this.m1Fx = [];
    this.flyingKneeEffects = [];
    this.soulImpactMissEffects = [];
    this.taidoBeatdownEffects = [];
    this.cutLines = [];
    this.trainSpritesReady = false;
    this.trainImpactSprites = [];
    let loaded = 0;
    for (let i = 0; i < 14; i++) {
      const img = new Image();
      img.onload = () => { loaded++; if (loaded === 14) this.trainSpritesReady = true; };
      img.onerror = () => { loaded++; if (loaded === 14) this.trainSpritesReady = true; };
      img.src = `/assets/sprites/invocador-de-sombras/7123_${i}.png`;
      this.trainImpactSprites.push(img);
    }
    this.trainImpacts = [];
  }

  _soulSheetReady() {
    return this.impactSheet.complete && this.impactSheet.naturalWidth > 0;
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

    for (let i = this.flyingKneeEffects.length - 1; i >= 0; i -= 1) {
      this.flyingKneeEffects[i].life -= dt;
      if (this.flyingKneeEffects[i].life <= 0) this.flyingKneeEffects.splice(i, 1);
    }

    for (let i = this.m1Fx.length - 1; i >= 0; i -= 1) {
      this.m1Fx[i].life -= dt;
      if (this.m1Fx[i].life <= 0) this.m1Fx.splice(i, 1);
    }

    for (let i = this.soulImpactMissEffects.length - 1; i >= 0; i -= 1) {
      this.soulImpactMissEffects[i].life -= dt;
      if (this.soulImpactMissEffects[i].life <= 0) this.soulImpactMissEffects.splice(i, 1);
    }

    for (let i = this.taidoBeatdownEffects.length - 1; i >= 0; i -= 1) {
      this.taidoBeatdownEffects[i].life -= dt;
      if (this.taidoBeatdownEffects[i].life <= 0) this.taidoBeatdownEffects.splice(i, 1);
    }

    for (let i = this.cutLines.length - 1; i >= 0; i -= 1) {
      this.cutLines[i].life -= dt;
      if (this.cutLines[i].life <= 0) this.cutLines.splice(i, 1);
    }

    for (let i = this.trainImpacts.length - 1; i >= 0; i -= 1) {
      this.trainImpacts[i].life -= dt;
      if (this.trainImpacts[i].life <= 0) this.trainImpacts.splice(i, 1);
    }
  }

  triggerFlyingKnee(x, y, dirX, dirY, hit) {
    this.flyingKneeEffects.push({
      x, y,
      dirX, dirY,
      hit,
      life: 0.48,
    });
  }

  triggerM1Fx(x, y, dirX, dirY, comboStep) {
    this.m1Fx.push({
      x,
      y,
      dirX,
      dirY,
      comboStep,
      life: comboStep >= 3 ? 0.20 : 0.15,
      maxLife: comboStep >= 3 ? 0.20 : 0.15,
    });
  }

  triggerSoulImpactMiss(x, y, dirX, dirY) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 0.35;
      const angle = Math.atan2(dirY || 0, dirX || 1) + spread;
      const speed = 200 + Math.random() * 180;
      this.soulImpactMissEffects.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: 8 + Math.random() * 18,
        life: 0.15 + Math.random() * 0.15,
        maxLife: 0.15 + Math.random() * 0.15,
      });
    }
  }

  triggerTaidoBeatdownHit(x, y, hitNum) {
    this.taidoBeatdownEffects.push({ x, y, hitNum, life: 0.16, final: false });
  }

  triggerTaidoBeatdownFinal(x, y, hitNum, blackFlash) {
    this.taidoBeatdownEffects.push({ x, y, hitNum, life: 0.62, final: true, blackFlash });
  }

  addCutLine(x, y) {
    const angle = Math.random() * Math.PI * 2;
    this.cutLines.push({
      x, y,
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
      life: 0.35,
      maxLife: 0.35,
    });
  }

  addTrainImpact(x, y) {
    this.trainImpacts.push({ x, y, life: 0.5, maxLife: 0.5 });
  }

  triggerHit(x, y, intensity = 1) {
    this.hitFlashes.set(Date.now(), { x, y, life: 0.15, intensity });
  }

  triggerDodge(x, y, facing) {
    this.dodgeEffects.set(Date.now(), { x, y, facing, life: 0.25 });
  }

  renderPlayer(ctx, camera, entry, _isYou, facing, state, renderX, renderY, _dt = 1 / 60) {
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
    if (animState !== "idle" && animState !== "death" && animState !== "walk" && animState !== "run") {
      const isMoving = Math.abs(p.vx) > 5 || Math.abs(p.vy) > 5;
      if (isMoving) {
        drawY += Math.sin(this.time * 40) * 4;
      }
    }

    this.yujiSprite.render(ctx, pos.x, drawY, animState, facing, zoom, entry.id);

    if (animState === "q") {
      if (!this.qStartTimes.has(entry.id)) {
        this.qStartTimes.set(entry.id, this.time);
      }
      const elapsed = this.time - this.qStartTimes.get(entry.id);
      const progress = Math.min(1, elapsed / 0.35);
      const domainIdx = Math.floor(elapsed * DOMAIN_FRAMES / 0.35) % DOMAIN_FRAMES;

      const qPhase = Math.min(3, Math.floor(progress * 4));
      const frameOffsets = [
        { x: 10, y: -70 },
        { x: 35, y: -75 },
        { x: 60, y: -80 },
        { x: 35, y: -75 },
      ];
      const offset = frameOffsets[qPhase] || frameOffsets[0];
      const fistX = pos.x + facing * offset.x * zoom;
      const fistY = drawY + offset.y * zoom;

      if (this.domainSheet.complete && this.domainSheet.naturalWidth > 0) {
        const sx = domainIdx * DOMAIN_FRAME_W;
        const targetW = DOMAIN_FRAME_W * zoom * 1.1;
        const targetH = DOMAIN_FRAME_H * zoom * 1.1;

        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.translate(fistX, fistY);
        ctx.rotate(facing > 0 ? -Math.PI / 2 : Math.PI / 2);
        ctx.drawImage(
          this.domainSheet,
          sx, 0, DOMAIN_FRAME_W, DOMAIN_FRAME_H,
          -targetW * 0.5, -targetH * 0.5,
          targetW, targetH,
        );
        ctx.restore();
      }
    } else {
      this.qStartTimes.delete(entry.id);
    }

    if (!p.alive) return;

    ctx.fillStyle = "#f2f6ff";
    ctx.font = "600 14px Rajdhani";
    ctx.textAlign = "center";
    ctx.fillText(p.name || "punho-indomavel", pos.x, pos.y - (65 * 2.05 + 10) * zoom);
  }

  drawImpactFrame(ctx, x, y, zoom, frameIndex, alpha = 1, sizeMul = 1, flipX = false) {
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

    if (flipX) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(this.impactSheet, sx, sy, sw, sh, -targetW * 0.5, -targetH * 0.5, targetW, targetH);
    } else {
      ctx.drawImage(this.impactSheet, sx, sy, sw, sh, x - targetW * 0.5, y - targetH * 0.5, targetW, targetH);
    }

    ctx.restore();
  }

  renderEffects(ctx, camera) {
    const zoom = camera.zoom || 1;

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

    });

    this.m1Fx.forEach((e) => {
      const screenX = (e.x - camera.x) * zoom + ctx.canvas.width * 0.5;
      const screenY = (e.y - camera.y) * zoom + ctx.canvas.height * 0.5;
      const progress = 1 - e.life / e.maxLife;
      const rawFadeIn = Math.min(1, progress * 4);
      const fadeIn = rawFadeIn * rawFadeIn * (3 - 2 * rawFadeIn);
      const rawFadeOut = Math.max(0, 1 - progress * 1.4);
      const fadeOut = rawFadeOut * rawFadeOut * (3 - 2 * rawFadeOut);
      const alpha = fadeIn * fadeOut;
      if (alpha <= 0.01) return;

      const dirLen = Math.hypot(e.dirX, e.dirY) || 1;
      const nx = e.dirX / dirLen;
      const ny = e.dirY / dirLen;
      const sideX = -ny;
      const sideY = nx;

      const combo = e.comboStep || 1;
      const isHeavy = combo === 3 || combo === 4;

      const travel = Math.min(1, progress * 2.8);
      const startDist = 24;
      const endDist = isHeavy ? 82 : 72;
      const spriteDist = (startDist + (endDist - startDist) * travel) * zoom;
      const sideShift = ((combo % 2 === 0) ? -1 : 1) * (isHeavy ? 3 : 2) * zoom;
      const slashX = screenX + nx * spriteDist + sideX * sideShift;
      const slashY = screenY - 45 * zoom + ny * spriteDist + sideY * sideShift;

      const frameIdx = Math.min(M1_30007_FRAME_COUNT - 1, Math.floor(progress * M1_30007_FRAME_COUNT));
      const sprite = this.m1FxFrames[frameIdx];
      if (!sprite || !sprite.complete || sprite.naturalWidth <= 0) return;

      ctx.save();
      let visualAngle = Math.atan2(ny, nx);
      ctx.translate(slashX, slashY);
      ctx.rotate(visualAngle + Math.PI / 2);

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      const scale = isHeavy ? 0.30 : 0.24;
      const stretch = isHeavy ? 1.08 : 1;
      const targetW = sprite.naturalWidth * zoom * scale * stretch;
      const targetH = sprite.naturalHeight * zoom * scale;
      ctx.drawImage(sprite, -targetW * 0.5, -targetH * 0.5, targetW, targetH);

      ctx.restore();
    });

    this.soulImpactMissEffects.forEach((e) => {
      const progress = 1 - e.life / e.maxLife;
      const alpha = (1 - progress) * 0.5;
      const screenX = (e.x + e.vx * progress - camera.x) * zoom + ctx.canvas.width * 0.5;
      const screenY = (e.y + e.vy * progress - camera.y) * zoom + ctx.canvas.height * 0.5;
      const len = e.length * zoom;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5 * zoom;
      ctx.lineCap = "round";
      ctx.beginPath();
      const nx = e.vx / Math.hypot(e.vx, e.vy);
      const ny = e.vy / Math.hypot(e.vx, e.vy);
      ctx.moveTo(screenX - nx * len * 0.5, screenY - ny * len * 0.5);
      ctx.lineTo(screenX + nx * len * 0.5, screenY + ny * len * 0.5);
      ctx.stroke();
      ctx.restore();
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

    this.cutLines.forEach((e) => {
      const screenX = (e.x - camera.x) * zoom + ctx.canvas.width * 0.5;
      const screenY = (e.y - camera.y) * zoom + ctx.canvas.height * 0.5;
      const progress = 1 - e.life / e.maxLife;
      const alpha = Math.min(1, progress * 4) * Math.max(0, 1 - progress * 1.2);
      if (alpha <= 0.01) return;

      const slashLen = 120 * zoom;
      const startX = screenX - e.dirX * slashLen * 0.5;
      const startY = screenY - e.dirY * slashLen * 0.5;
      const endX = screenX + e.dirX * slashLen * 0.5;
      const endY = screenY + e.dirY * slashLen * 0.5;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 25 * zoom;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 8 * zoom * alpha;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.shadowBlur = 10 * zoom;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3 * zoom * alpha;
      ctx.globalAlpha = alpha * 0.9;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.restore();
    });

    this.trainImpacts.forEach((e) => {
      const screenX = (e.x - camera.x) * zoom + ctx.canvas.width * 0.5;
      const screenY = (e.y - camera.y) * zoom + ctx.canvas.height * 0.5;
      const progress = 1 - e.life / e.maxLife;
      const frameIdx = Math.min(13, Math.floor(progress * 14));
      const alpha = Math.min(1, progress * 4) * Math.max(0, 1 - (e.life / e.maxLife - 0.6) / 0.4);
      const img = this.trainImpactSprites[frameIdx];
      if (!this.trainSpritesReady) return;
      const w = img.naturalWidth * zoom * 0.7;
      const h = img.naturalHeight * zoom * 0.7;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, screenX - w * 0.5, screenY - h * 0.5, w, h);
      ctx.restore();
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
