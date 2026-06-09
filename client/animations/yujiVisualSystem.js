import { SpriteAnimator } from "./spriteAnimator.js";
import { YUJI_ANIMATIONS, YUJI_SPRITE_CONFIG, YUJI_SHEET_PATH } from "./yujiSprites.js";
import { drawHitReaction, drawDodgeEffect, drawDeathPose } from "./gojoEffects.js";

const IMPACT_SHEET_PATH = "/assets/sprites/yuji_shinjuku/impact_sheet.png";
const IMPACT_FRAME_W = 132;
const IMPACT_FRAME_H = 96;
const IMPACT_FRAMES = 21;

const DOMAIN_SHEET_PATH = "/assets/sprites/yuji_shinjuku/domain_sheet.png";
const DOMAIN_FRAME_W = 110;
const DOMAIN_FRAME_H = 125;
const DOMAIN_FRAMES = 12;



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
    this._soulFrameCache = {};

    this.domainSheet = new Image();
    this.domainSheet.src = DOMAIN_SHEET_PATH;

    this.hitFlashes = new Map();
    this.dodgeEffects = new Map();
    this.time = 0;
    this.qStartTimes = new Map();

    this.flyingKneeEffects = [];
    this.soulImpactEffects = [];
    this.taidoBeatdownEffects = [];
    this.cutLines = [];
    this.trainSpritesReady = false;
    this.trainImpactSprites = [];
    let loaded = 0;
    for (let i = 0; i < 14; i++) {
      const img = new Image();
      img.onload = () => { loaded++; if (loaded === 14) this.trainSpritesReady = true; };
      img.onerror = () => { loaded++; if (loaded === 14) this.trainSpritesReady = true; };
      img.src = `/assets/sprites/megumi/7123_${i}.png`;
      this.trainImpactSprites.push(img);
    }
    this.trainImpacts = [];
  }

  _getSoulFrame(frameIndex) {
    if (!this.impactSheet.complete || this.impactSheet.naturalWidth <= 0) return null;
    if (this._soulFrameCache[frameIndex]) return this._soulFrameCache[frameIndex];

    const frameIdx = 8 + frameIndex;
    const sx = frameIdx * IMPACT_FRAME_W;

    const red = document.createElement('canvas');
    red.width = IMPACT_FRAME_W;
    red.height = IMPACT_FRAME_H;
    const rctx = red.getContext('2d');
    rctx.drawImage(this.impactSheet, sx, 0, IMPACT_FRAME_W, IMPACT_FRAME_H, 0, 0, IMPACT_FRAME_W, IMPACT_FRAME_H);
    rctx.globalCompositeOperation = "source-atop";
    rctx.fillStyle = "#ff0000";
    rctx.fillRect(0, 0, IMPACT_FRAME_W, IMPACT_FRAME_H);

    const black = document.createElement('canvas');
    black.width = IMPACT_FRAME_W;
    black.height = IMPACT_FRAME_H;
    const bctx = black.getContext('2d');
    bctx.drawImage(this.impactSheet, sx, 0, IMPACT_FRAME_W, IMPACT_FRAME_H, 0, 0, IMPACT_FRAME_W, IMPACT_FRAME_H);
    bctx.globalCompositeOperation = "source-atop";
    bctx.fillStyle = "#000000";
    bctx.fillRect(0, 0, IMPACT_FRAME_W, IMPACT_FRAME_H);

    const redImg = new Image(); redImg.src = red.toDataURL();
    const blackImg = new Image(); blackImg.src = black.toDataURL();
    this._soulFrameCache[frameIndex] = { red: redImg, black: blackImg };
    return this._soulFrameCache[frameIndex];
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

    for (let i = this.soulImpactEffects.length - 1; i >= 0; i -= 1) {
      this.soulImpactEffects[i].life -= dt;
      if (this.soulImpactEffects[i].life <= 0) this.soulImpactEffects.splice(i, 1);
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

  triggerSoulImpact(x, y, dirX, dirY) {
    this.soulImpactEffects.push({ x, y, dirX: dirX || 0, dirY: dirY || 1, startTime: this.time, life: 0.76 });
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
    if (animState === "walk" || animState === "run") {
      drawY += Math.sin(this.time * 10) * 2.5;
    }

    this.yujiSprite.render(ctx, pos.x, drawY, animState, facing, zoom, entry.id);

    if (animState === "q") {
      if (!this.qStartTimes.has(entry.id)) {
        this.qStartTimes.set(entry.id, this.time);
      }
      const elapsed = this.time - this.qStartTimes.get(entry.id);
      const progress = Math.min(1, elapsed / 0.6);
      const domainIdx = Math.min(DOMAIN_FRAMES - 1, Math.floor(progress * DOMAIN_FRAMES));

      const qPhase = Math.min(3, Math.floor(progress * 4));
      const frameOffsets = [
        { x: 10, y: -70 },
        { x: 35, y: -75 },
        { x: 60, y: -80 },
        { x: 35, y: -75 },
      ];
      const offset = frameOffsets[qPhase] || frameOffsets[0];
      const fistX = pos.x + facing * offset.x * zoom;
      const fistY = pos.y + offset.y * zoom;

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
    ctx.fillText(p.name || "Yuji", pos.x, pos.y - (65 * 2.05 + 10) * zoom);
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

    this.soulImpactEffects.forEach((e) => {
      const offsetDist = 65;
      const fistHeight = 45;
      const effectX = e.x + e.dirX * offsetDist;
      const effectY = e.y - fistHeight;
      const screenX = (effectX - camera.x) * zoom + ctx.canvas.width * 0.5;
      const screenY = (effectY - camera.y) * zoom + ctx.canvas.height * 0.5;
      const alpha = Math.min(1, e.life / 0.76);
      const elapsed = 0.76 - e.life;
      const frameIndex = Math.floor(elapsed * 18) % 13;

      const sizeMul = 1.64;
      const targetW = IMPACT_FRAME_W * zoom * sizeMul;
      const targetH = IMPACT_FRAME_H * zoom * sizeMul;

      const frame = this._getSoulFrame(frameIndex);
      if (!frame) return;
      const redFrame = frame.red;
      const blackFrame = frame.black;

      ctx.save();
      ctx.globalAlpha = alpha;

      const flipX = e.dirX < 0;
      let drawX, drawY;
      if (flipX) {
        ctx.translate(screenX, screenY);
        ctx.scale(-1, 1);
        drawX = -targetW * 0.5;
        drawY = -targetH * 0.5;
      } else {
        drawX = screenX - targetW * 0.5;
        drawY = screenY - targetH * 0.5;
      }

      const outlineOff = 5;
      ctx.globalCompositeOperation = "source-over";
      for (let ox = -outlineOff; ox <= outlineOff; ox += outlineOff) {
        for (let oy = -outlineOff; oy <= outlineOff; oy += outlineOff) {
          if (ox === 0 && oy === 0) continue;
          ctx.drawImage(blackFrame, drawX + ox, drawY + oy, targetW, targetH);
        }
      }
      ctx.drawImage(redFrame, drawX, drawY, targetW, targetH);

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
