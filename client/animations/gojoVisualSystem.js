import { SpriteAnimator } from "./spriteAnimator.js";
import { GOJO_ANIMATIONS, SPRITE_CONFIG, GOJO_MANGA_SPRITE_PATH } from "./gojoSprites.js";
import { GojoSkillEffects } from "./proceduralGojo.js";
import { drawHitReaction } from "./gojoEffects.js";

export class GojoVisualSystem {
  constructor() {
    this.gojoSprite = new SpriteAnimator({
      sheetPath: GOJO_MANGA_SPRITE_PATH,
      cellWidth: SPRITE_CONFIG.cellWidth,
      cellHeight: SPRITE_CONFIG.cellHeight,
      pivotX: SPRITE_CONFIG.pivotX,
      pivotY: SPRITE_CONFIG.pivotY,
      renderScale: SPRITE_CONFIG.renderScale,
      animations: GOJO_ANIMATIONS,
    });
    this.effects = new GojoSkillEffects();
    this.hitFlashes = new Map();
    this.dodgeEffects = new Map();
    this.m1Slashes = [];
    this.time = 0;
    this.gojoAttackSprite = new Image();
    this.gojoAttackSprite.src = "/assets/habilit/gojoattack.png";
    this.dashImage = new Image();
    this.dashImage.src = "/assets/sprites/gojo_shinjuku/dash.png";
    this.domainPrepFrames = [];
    for (let i = 0; i < 5; i++) {
      const img = new Image();
      img.src = `/assets/sprites/gojo_shinjuku/domain_prep_${i}.png`;
      this.domainPrepFrames.push(img);
    }
    this.domainPrepTime = 0;
    this._wasDomainPrep = false;
    this.domainPrepTimings = [0.2, 0.2, 0.3, 0.25, 0.6];
  }

  update(dt) {
    this.time += dt;
    this.gojoSprite.update(dt);
    this.effects.update(dt);

    this.domainPrepTime += dt;

    this.hitFlashes.forEach((flash, id) => {
      flash.life -= dt;
      if (flash.life <= 0) this.hitFlashes.delete(id);
    });

    this.dodgeEffects.forEach((effect, id) => {
      effect.life -= dt;
      if (effect.life <= 0) this.dodgeEffects.delete(id);
    });

    for (let i = this.m1Slashes.length - 1; i >= 0; i--) {
      const slash = this.m1Slashes[i];
      slash.life -= dt;
      if (slash.life <= 0) {
        this.m1Slashes.splice(i, 1);
      }

      // Trail sprites — 1 por frame na posição exata do sprite principal
      const range = 85;
      const spriteDist = range * 1.15 * 0.7;
      const offsetMap = { 1: 0, 2: 35, 3: 18 };
      const offsetVal = offsetMap[slash.comboStep] || 0;
      const perpX = -slash.dirY;
      const perpY = slash.dirX;
      const tx = slash.worldX + slash.dirX * spriteDist + perpX * offsetVal;
      const ty = slash.worldY + slash.dirY * spriteDist + perpY * offsetVal;
      if (!slash.trail) slash.trail = [];
      slash.trail.push({ x: tx, y: ty, life: 0.4 });

      if (slash.trail) {
        for (let t = slash.trail.length - 1; t >= 0; t--) {
          slash.trail[t].life -= dt;
          if (slash.trail[t].life <= 0) slash.trail.splice(t, 1);
        }
      }
    }
  }

  triggerM1(worldX, worldY, dirX, dirY, comboStep, playerId) {
    this.m1Slashes.push({
      worldX: worldX - dirX * 35,
      worldY: worldY - 35,
      dirX, dirY, comboStep, life: 0.5,
    });
  }

  triggerHit(x, y, intensity = 1) {
    this.hitFlashes.set(Date.now(), { x, y, life: 0.15, intensity });
  }

  triggerDodge(x, y, facing) {
    this.dodgeEffects.set(Date.now(), { x, y, facing, life: 0.25 });
  }

  addProjectile(type, x, y, vx, vy) {
    if (type === "blue") this.effects.addBlue(x, y, vx, vy);
    else if (type === "red") this.effects.addRed(x, y, vx, vy);
  }

  addBeam(x1, y1, x2, y2) {
    this.effects.addPurpleBeam(x1, y1, x2, y2);
  }

  addExplosion(x, y, type, radius) {
    this.effects.addExplosion(x, y, type, radius);
  }

  addTeleport(x, y) {
    this.effects.addTeleport(x, y);
  }

  addAfterimage(x, y, facing) {
    this.effects.addAfterimage(x, y, facing);
  }

  addDomain(x, y, radius, ownerId, myId) {
    this.effects.addDomain(x, y, radius, ownerId, myId);
  }

  renderPlayer(ctx, camera, entry, isYou, facing, state, renderX, renderY) {
    const p = entry.raw;
    const worldX = Number.isFinite(renderX) ? renderX : p.x;
    const worldY = Number.isFinite(renderY) ? renderY : p.y;
    const zoom = camera.zoom || 1;
    const pos = {
      x: (worldX - camera.x) * zoom + ctx.canvas.width * 0.5,
      y: (worldY - camera.y) * zoom + ctx.canvas.height * 0.5,
    };
    let animState = state || p.animState || "idle";
    const spriteScale = zoom;

    if (animState !== "domain_prepare") {
      this._wasDomainPrep = false;
    }

    if (animState === "dash") {
      if (this.dashImage.complete && this.dashImage.naturalWidth > 0) {
        const targetSize = 110 * spriteScale;
        this.drawSprite(ctx, this.dashImage, pos.x, pos.y - 34 * spriteScale, facing, targetSize);
      }
      if (p.alive) {
        ctx.fillStyle = "#dce9ff";
        ctx.font = "600 14px Rajdhani";
        ctx.textAlign = "center";
        ctx.fillText(p.name || "Gojo", pos.x, pos.y - (65 * 1.7 + 10) * zoom);
      }
      return;
    }

    if (animState === "domain_prepare") {
      if (!this._wasDomainPrep) {
        this.domainPrepTime = 0;
        this._wasDomainPrep = true;
      }
      const img = this.domainPrepFrames[4];
      if (img && img.complete && img.naturalWidth > 0) {
        const targetSize = 96 * spriteScale;
        this.drawSprite(ctx, img, pos.x, pos.y - 54 * spriteScale, facing, targetSize);
      }
      if (p.alive) {
        ctx.fillStyle = "#dce9ff";
        ctx.font = "600 14px Rajdhani";
        ctx.textAlign = "center";
        ctx.fillText(p.name || "Gojo", pos.x, pos.y - (65 * 1.7 + 10) * zoom);
      }
      return;
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
      this.gojoSprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale, entry.id);
      return;
    }

    if (animState === "run") {
      pos.y += Math.sin(this.time * 10) * 2.5;
    }

    this.gojoSprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale, entry.id);

    if (!p.alive) return;

     ctx.fillStyle = "#dce9ff";
     ctx.font = "600 14px Rajdhani";
     ctx.textAlign = "center";
     ctx.fillText(p.name || "Gojo", pos.x, pos.y - (65 * 1.7 + 10) * zoom);

  }

  getDomainPrepFrame() {
    const total = this.domainPrepTimings.reduce((a, b) => a + b, 0);
    if (this.domainPrepTime >= total) return 4;
    let t = this.domainPrepTime;
    for (let i = 0; i < this.domainPrepTimings.length; i++) {
      if (t < this.domainPrepTimings[i]) return i;
      t -= this.domainPrepTimings[i];
    }
    return 4;
  }

  drawSprite(ctx, img, x, y, facing, targetSize) {
    const aspect = img.naturalWidth / img.naturalHeight;
    let drawW, drawH;
    if (img.naturalWidth >= img.naturalHeight) {
      drawW = targetSize;
      drawH = drawW / aspect;
    } else {
      drawH = targetSize;
      drawW = drawH * aspect;
    }
    ctx.save();
    if (facing < 0) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }
    ctx.drawImage(img, x - drawW / 2, y - drawH / 2, drawW, drawH);
    ctx.restore();
  }

  renderEffects(ctx, camera) {
    this.effects.render(ctx, camera);
  }
}
