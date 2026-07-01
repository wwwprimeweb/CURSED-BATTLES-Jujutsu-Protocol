import { SpriteAnimator } from "./spriteAnimator.js";
import { GOJO_ANIMATIONS, SPRITE_CONFIG, GOJO_MANGA_SPRITE_PATH, GOJO_TELEPORT_ANIMATIONS, GOJO_TELEPORT_SPRITE_CONFIG, GOJO_TELEPORT_SHEET_PATH, mapServerStateToAnim } from "./gojoSprites.js";
import { GojoSkillEffects } from "./proceduralGojo.js";
import { drawHitReaction, drawGojoM1Slash } from "./gojoEffects.js";

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
    this.teleportAnimator = new SpriteAnimator({
      sheetPath: GOJO_TELEPORT_SHEET_PATH,
      cellWidth: GOJO_TELEPORT_SPRITE_CONFIG.cellWidth,
      cellHeight: GOJO_TELEPORT_SPRITE_CONFIG.cellHeight,
      pivotX: GOJO_TELEPORT_SPRITE_CONFIG.pivotX,
      pivotY: GOJO_TELEPORT_SPRITE_CONFIG.pivotY,
      renderScale: GOJO_TELEPORT_SPRITE_CONFIG.renderScale,
      animations: GOJO_TELEPORT_ANIMATIONS,
    });
    this.hitFlashes = new Map();
    this.dodgeEffects = new Map();
    this.m1Slashes = [];
    this.time = 0;
    this.gojoM1Vertical = new Image();
    this.gojoM1Vertical.src = "/assets/habilit/gojo_m1_vertical.png";
    this.gojoM1Horizontal = new Image();
    this.gojoM1Horizontal.src = "/assets/habilit/gojo_m1_horizontal.png";
    this.dashImage = new Image();
    this.dashImage.src = "/assets/sprites/o-honrado-dash.png";
    this.domainPrepFrames = [];
    for (let i = 0; i < 5; i++) {
      const img = new Image();
      img.src = `/assets/sprites/o-honrado_shinjuku/domain_prep_${i}.png`;
      this.domainPrepFrames.push(img);
    }
    this.domainPrepTime = 0;
    this._wasDomainPrep = false;
    this.domainPrepTimings = [0.2, 0.2, 0.3, 0.25, 0.6];
    this.gojoCastSprite = new Image();
    this.gojoCastSprite.src = "/assets/sprites/o-honrado_manga/1000_15.png";
    this.gojoRedChargeSprite = new Image();
    this.gojoRedChargeSprite.src = "/assets/sprites/o-honrado_manga/1000_9.png";
  }

  update(dt) {
    this.time += dt;
    this.gojoSprite.update(dt);
    this.teleportAnimator.update(dt);
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
    }
  }

  triggerM1(worldX, worldY, dirX, dirY, comboStep, playerId) {
    const lifeMap = { 1: 0.15, 2: 0.18, 3: 0.22 };
    const life = lifeMap[comboStep] || 0.18;
    this.m1Slashes.push({
      worldX: worldX + dirX * 75,
      worldY: worldY + dirY * 75,
      dirX, dirY, comboStep, life, maxLife: life,
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

  renderPlayer(ctx, camera, entry, isYou, facing, state, renderX, renderY, _dt = 1 / 60) {
    const p = entry.raw;
    const worldX = Number.isFinite(renderX) ? renderX : p.x;
    const worldY = Number.isFinite(renderY) ? renderY : p.y;
    const zoom = camera.zoom;
    const pos = {
      x: (worldX - camera.x) * zoom + ctx.canvas.width * 0.5,
      y: (worldY - camera.y) * zoom + ctx.canvas.height * 0.5,
    };
    let animState = state || mapServerStateToAnim(p.animState || "idle");
    const spriteScale = zoom;

    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (speed > 20 && p.animState !== "idle" && p.animState !== "death" && p.animState !== "hit" && p.animState !== "walk") {
      if (p.animState === "run") {
        pos.y += Math.sin(this.time * 10) * 2.5 * zoom;
      } else {
        pos.y += Math.sin(this.time * 40) * 2 * zoom;
      }
    }

    if (animState !== "domain_prepare") {
      this._wasDomainPrep = false;
    }

    if (animState === "dash") {
      if (this.dashImage.complete && this.dashImage.naturalWidth > 0) {
        const targetSize = 105 * spriteScale;
        this.drawSprite(ctx, this.dashImage, pos.x, pos.y - 50 * zoom, facing, targetSize);
      }
      if (p.alive) {
        ctx.fillStyle = "#dce9ff";
        ctx.font = `600 ${Math.round(14 * zoom)}px Rajdhani`;
        ctx.textAlign = "center";
        ctx.fillText(p.name || "o-honrado", pos.x, pos.y - (65 * 1.7 + 10) * zoom);
      }
      return;
    }

    if (animState === "skill_blue") {
      const targetSize = 90 * spriteScale;
      if (this.gojoCastSprite.complete && this.gojoCastSprite.naturalWidth > 0) {
        this.drawSprite(ctx, this.gojoCastSprite, pos.x, pos.y - 48 * zoom, facing, targetSize);
      }
      
      if (p.alive) {
        ctx.fillStyle = "#dce9ff";
        ctx.font = `600 ${Math.round(14 * zoom)}px Rajdhani`;
        ctx.textAlign = "center";
        ctx.fillText(p.name || "o-honrado", pos.x, pos.y - (65 * 1.7 + 10) * zoom);
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
        this.drawSprite(ctx, img, pos.x, pos.y - 54 * zoom, facing, targetSize);
      }
      if (p.alive) {
        ctx.fillStyle = "#dce9ff";
        ctx.font = `600 ${Math.round(14 * zoom)}px Rajdhani`;
        ctx.textAlign = "center";
        ctx.fillText(p.name || "o-honrado", pos.x, pos.y - (65 * 1.7 + 10) * zoom);
      }
      return;
    }

    if (animState === "hit" && p.hitTime) {
      const hitAge = (Date.now() - p.hitTime) / 1000;
      const flashIntensity = Math.max(0, 1 - hitAge / 0.15);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.scale(zoom, zoom);
      drawHitReaction(ctx, 0, 0, facing, flashIntensity, zoom);
      ctx.restore();
    }

    if (animState === "death" && p.deathTime) {
      this.gojoSprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale, entry.id);
      return;
    }

    if (animState === "skill_red") {
      const targetSize = 90 * spriteScale;
      if (this.gojoRedChargeSprite.complete && this.gojoRedChargeSprite.naturalWidth > 0) {
        this.drawSprite(ctx, this.gojoRedChargeSprite, pos.x, pos.y - 48 * zoom, facing, targetSize);
      }
      if (p.alive) {
        ctx.fillStyle = "#dce9ff";
        ctx.font = `600 ${Math.round(14 * zoom)}px Rajdhani`;
        ctx.textAlign = "center";
        ctx.fillText(p.name || "o-honrado", pos.x, pos.y - (65 * 1.7 + 10) * zoom);
      }
      return;
    }

    if (animState === "teleport") {
      const tp = this.teleportAnimator.players.get(entry.id);
      if (tp && tp.done) {
        this.teleportAnimator.resetPlayer(entry.id);
      }
      this.teleportAnimator.renderTinted(ctx, pos.x, pos.y, animState, facing, spriteScale, entry.id, "#ffffff");
    } else {
      this.gojoSprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale, entry.id);
    }

    if (!p.alive) return;

     ctx.fillStyle = "#dce9ff";
     ctx.font = `600 ${Math.round(14 * zoom)}px Rajdhani`;
     ctx.textAlign = "center";
     ctx.fillText(p.name || "o-honrado", pos.x, pos.y - (65 * 1.7 + 10) * zoom);

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

  drawBlueForming(ctx, x, y, progress, spriteScale, zoom) {
    const p = 1 - Math.pow(1 - progress, 3);
    const time = Date.now() * 0.005;
    const maxSize = 50 * spriteScale * zoom;
    const size = maxSize * p;

    ctx.save();
    
    // Suction lines pulling into the center
    ctx.globalCompositeOperation = "screen";
    for(let i=0; i<12; i++) {
        const angle = (i / 12) * Math.PI * 2 + time * 0.5;
        const pullDist = maxSize * 2.5 * (1 - p) + (Math.sin(time + i) * 10 * zoom);
        const px = x + Math.cos(angle) * pullDist;
        const py = y + Math.sin(angle) * pullDist;
        
        ctx.fillStyle = `rgba(0, 229, 255, ${(1 - p) * 0.8})`;
        ctx.beginPath();
        ctx.arc(px, py, 2 * zoom, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(0, 229, 255, ${(1 - p) * 0.4})`;
        ctx.lineWidth = 1 * zoom;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x + Math.cos(angle) * pullDist * 0.5, y + Math.sin(angle) * pullDist * 0.5);
        ctx.stroke();
    }

    // Core sphere
    const glowR = size * 1.5;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    grad.addColorStop(0, `rgba(200, 255, 255, ${p})`);
    grad.addColorStop(0.3, `rgba(0, 229, 255, ${p * 0.9})`);
    grad.addColorStop(0.6, `rgba(0, 100, 255, ${p * 0.5})`);
    grad.addColorStop(1, "rgba(0, 0, 50, 0)");
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Dark swirling center forming
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 15 * p * zoom;
    ctx.fillStyle = `rgba(0, 40, 150, ${p * 0.9})`;
    ctx.beginPath();
    const pts = 12;
    const r = size * 0.6;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2 + time * 0.8;
      const wob = 1 + Math.sin(a * 4 - time) * 0.15;
      const px = x + Math.cos(a) * r * wob;
      const py = y + Math.sin(a) * r * wob;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    
    // Core intense dot
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255, 255, 255, ${p})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }


  renderEffects(ctx, camera) {
    this.effects.render(ctx, camera);
  }
}
