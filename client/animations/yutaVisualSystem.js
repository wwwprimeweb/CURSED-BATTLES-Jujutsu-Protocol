import { YutaSpriteRenderer } from "./yutaSprite.js";
import { YutaSkillEffects } from "./proceduralYuta.js";
import { drawHitReaction } from "./gojoEffects.js";
import { drawRowOfKatanas, drawRikaAreaExplosion, drawRikaClawScratch, drawRikaShockwave, drawPinkSlashCuts, drawEnergyWaveTrail } from "./yutaEffects.js";
import { SkillVFX } from "../particles/proceduralEffects.js";

export class YutaVisualSystem {
  constructor() {
    this.yutaSprite = new YutaSpriteRenderer();
    this.effects = new YutaSkillEffects();
    this.hitFlashes = new Map();
    this.dodgeEffects = new Map();
    this.domainKatanas = new Map();
    this.rikaAttacks = [];
    this.rikaHeavyImpacts = [];
    this.rikaRenderPos = new Map();
    this.pureLoveCharges = new Map();
    this.pureLoveBeam = null;
    this.beamParticles = [];
    this.dashSlashes = [];
    this.slashCuts = [];
    this.rikaImpulses = [];
    this.rikaDashes = [];
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    this.yutaSprite.update(dt);
    this.effects.update(dt);

    this.hitFlashes.forEach((flash, id) => {
      flash.life -= dt;
      if (flash.life <= 0) this.hitFlashes.delete(id);
    });

    this.dodgeEffects.forEach((effect, id) => {
      effect.life -= dt;
      if (effect.life <= 0) this.dodgeEffects.delete(id);
    });

    this.domainKatanas.forEach((dk, id) => {
      dk.life -= dt;
      if (dk.life <= 0) this.domainKatanas.delete(id);
    });

    for (let i = this.rikaAttacks.length - 1; i >= 0; i--) {
      this.rikaAttacks[i].life -= dt;
      if (this.rikaAttacks[i].life <= 0) {
        this.rikaAttacks.splice(i, 1);
      }
    }

    for (let i = this.rikaHeavyImpacts.length - 1; i >= 0; i--) {
      this.rikaHeavyImpacts[i].life -= dt;
      if (this.rikaHeavyImpacts[i].life <= 0) {
        this.rikaHeavyImpacts.splice(i, 1);
      }
    }

    // Remove charge sphere only when the beam snapshot has arrived
    if (this.pureLoveBeam) {
      this.pureLoveCharges.clear();
    }

    // Update beam particles
    for (let i = this.beamParticles.length - 1; i >= 0; i--) {
      const p = this.beamParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.beamParticles.splice(i, 1);
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx += p.wobblePhase * Math.sin(t * Math.PI * 8) * dt * 0.3;
      p.size *= 0.995;
    }

    // Emit beam particles
    if (this.pureLoveBeam) {
      const beamLength = this.pureLoveBeam.beamLength;
      const endX = this.pureLoveBeam.originX + this.pureLoveBeam.dirX * beamLength;
      const endY = this.pureLoveBeam.originY + this.pureLoveBeam.dirY * beamLength;
      const perpX = -this.pureLoveBeam.dirY;
      const perpY = this.pureLoveBeam.dirX;
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const t = Math.random();
        const spread = (Math.random() - 0.5) * this.pureLoveBeam.width * 0.6;
        const px = this.pureLoveBeam.originX + (endX - this.pureLoveBeam.originX) * t + perpX * spread;
        const py = this.pureLoveBeam.originY + (endY - this.pureLoveBeam.originY) * t + perpY * spread;
        const speed = 80 + Math.random() * 120;
        this.beamParticles.push({
          x: px,
          y: py,
          vx: this.pureLoveBeam.dirX * speed + (Math.random() - 0.5) * 30,
          vy: this.pureLoveBeam.dirY * speed + (Math.random() - 0.5) * 30,
          life: 0.4 + Math.random() * 0.4,
          maxLife: 0.4 + Math.random() * 0.4,
          size: 2 + Math.random() * 4,
          hue: 320 + Math.random() * 40,
          wobblePhase: (Math.random() - 0.5) * 10,
        });
      }
    }

    // Update dash slashes
    for (let i = this.dashSlashes.length - 1; i >= 0; i--) {
      const t = this.dashSlashes[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.dashSlashes.splice(i, 1);
      }
    }

    // Update slash cuts
    for (let i = this.slashCuts.length - 1; i >= 0; i--) {
      const c = this.slashCuts[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.slashCuts.splice(i, 1);
      }
    }

    // Update rika impulse shockwaves
    for (let i = this.rikaImpulses.length - 1; i >= 0; i--) {
      this.rikaImpulses[i].life -= dt;
      if (this.rikaImpulses[i].life <= 0) {
        this.rikaImpulses.splice(i, 1);
      }
    }

    // Update rika dash trails
    for (let i = this.rikaDashes.length - 1; i >= 0; i--) {
      this.rikaDashes[i].life -= dt;
      if (this.rikaDashes[i].life <= 0) {
        this.rikaDashes.splice(i, 1);
      }
    }
  }

  triggerKatanaSlash(x, y, dirX, dirY, combo, range, coneAngle) {
    this.effects.addKatanaSlash(x, y, dirX, dirY, combo, { range, coneAngle });
  }

  triggerHit(x, y, intensity = 1) {
    this.hitFlashes.set(Date.now(), { x, y, life: 0.15, intensity });
  }

  triggerDodge(x, y, facing) {
    this.dodgeEffects.set(Date.now(), { x, y, facing, life: 0.25 });
  }

  triggerRika(x, y, dirX, dirY) {
    const range = 140;
    const nx = Number.isFinite(dirX) ? dirX : 1;
    const ny = Number.isFinite(dirY) ? dirY : 0;
    this.rikaAttacks.push({
      x,
      y,
      dirX: nx,
      dirY: ny,
      life: 0.8,
      maxLife: 0.8,
      impactX: x + nx * range,
      impactY: y + ny * range,
    });
    this.effects.addRikaAttack(x + nx * range, y + ny * range, nx, ny);
  }

  triggerRikaCompanionAttack(x, y, dirX, dirY, attackType = "normal", radius = 0) {
    const nx = Number.isFinite(dirX) ? dirX : 1;
    const ny = Number.isFinite(dirY) ? dirY : 0;
    const isHeavy = attackType === "heavy";
    this.effects.addRikaAttack(x, y, nx, ny, {
      life: isHeavy ? 0.56 : 0.4,
      size: isHeavy ? 2.2 : 1,
      intensity: isHeavy ? 1.45 : 1,
    });

    if (isHeavy) {
      const impactRadius = Number.isFinite(radius) ? Math.max(70, radius) : 170;
      this.rikaHeavyImpacts.push({
        x,
        y,
        dirX: nx,
        dirY: ny,
        radius: impactRadius,
        life: 0.72,
        maxLife: 0.72,
      });
    }
  }

  triggerFullRika(x, y, duration) {
    this.effects.addRikaStart(x, y, duration);
  }

  triggerDashSlash(startX, startY, endX, endY, radius) {
    this.dashSlashes.push({
      startX, startY,
      endX, endY,
      radius: radius || 160,
      startTime: this.time,
      life: 0.10,
    });
  }

  triggerRikaDash(startX, startY, endX, endY) {
    this.rikaDashes.push({
      startX, startY,
      endX, endY,
      startTime: this.time,
      life: 0.25,
    });
  }

  triggerRikaImpulse(x, y, radius) {
    this.rikaImpulses.push({
      x, y,
      radius: radius || 180,
      startTime: this.time,
      life: 0.6,
      maxLife: 0.6,
    });
  }

  triggerSlashCuts(x, y) {
    this.slashCuts.push({
      x, y,
      startTime: this.time,
      life: 0.15,
    });
  }

  triggerCursedWave(x, y, dirX, dirY, range, width) {
    this.effects.addCursedWave(x, y, dirX, dirY, range, width);
  }

  triggerPureLove(x, y, radius) {
    this.effects.addPureLove(x, y, radius);
  }

  triggerPureLoveCharge(playerId, x, y, dirX, dirY, duration) {
    this.pureLoveCharges.set(playerId, {
      x, y, dirX, dirY,
      startTime: this.time,
      duration,
    });
  }

  triggerPureLoveBeam(x, y, dirX, dirY, width, lifetime) {
    this.pureLoveBeam = {
      originX: x,
      originY: y,
      dirX,
      dirY,
      width,
      lifetime,
      totalLifetime: 4.0,
    };
  }

  updatePureLoveBeamFromSnapshot(snapshot) {
    if (!snapshot.pureLoveActive) return;
    this.pureLoveBeam = {
      originX: snapshot.pureLoveX,
      originY: snapshot.pureLoveY,
      dirX: snapshot.pureLoveDirX,
      dirY: snapshot.pureLoveDirY,
      width: snapshot.pureLoveWidth,
      beamLength: snapshot.pureLoveBeamLength || 960,
      lifetime: snapshot.pureLoveLifetime,
      totalLifetime: snapshot.pureLoveTotalLifetime || 4.0,
    };
  }

  updateBeamsFromPlayerSnapshots(players) {
    this.pureLoveBeam = null;
    players.forEach((entry) => {
      this.updatePureLoveBeamFromSnapshot(entry.raw);
    });
  }

  triggerDomainKatana(x, y) {
    this.domainKatanas.set(Date.now(), { x, y, life: 0.8 });
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
    const animState = p.animState === "dodge" ? "dodge" : (state || p.animState || "idle");
    const spriteScale = zoom;

    if (animState === "domain_prepare") {
      this.yutaSprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale, entry.id);
      return;
    }

    if (animState === "dodge") {
      this.yutaSprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale, entry.id);
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
       this.yutaSprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale, entry.id);
       return;
     }

      const isYuta = p.character === "yuta";
      if (!p.rikaActive) {
        this.rikaRenderPos.delete(p.id);
      }

      // Render Rika first so Yuta appears on top
      if (isYuta && p.rikaActive) {
        let rikaX;
        let rikaY;
        let rikaFacing;
        const isAttacking = p.rikaState === "attack";
        if (Number.isFinite(p.rikaX) && Number.isFinite(p.rikaY)) {
          const targetX = p.rikaX;
          const targetY = p.rikaY;
          let smooth = this.rikaRenderPos.get(p.id);
          if (!smooth) {
            smooth = { x: targetX, y: targetY };
            this.rikaRenderPos.set(p.id, smooth);
          } else {
            const dx = targetX - smooth.x;
            const dy = targetY - smooth.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 180) {
              smooth.x = targetX;
              smooth.y = targetY;
            } else {
              const follow = dist > 65 ? 0.32 : dist > 22 ? 0.24 : 0.18;
              smooth.x += dx * follow;
              smooth.y += dy * follow;
            }
          }
          const cam = camera;
          rikaX = (smooth.x - cam.x) * zoom + ctx.canvas.width * 0.5;
          rikaY = (smooth.y - cam.y) * zoom + ctx.canvas.height * 0.5;
          const side = smooth.x < worldX ? -1 : 1;
          rikaFacing = Number.isFinite(p.rikaFacing) ? p.rikaFacing : (side < 0 ? 1 : -1);
        } else {
          const fallbackSource = this.rikaRenderPos.get(p.id);
          const fallbackSide = fallbackSource && Number.isFinite(fallbackSource.x)
            ? (fallbackSource.x < worldX ? -1 : 1)
            : -1;
          rikaX = pos.x + fallbackSide * 105 * zoom;
          rikaY = pos.y;
          rikaFacing = fallbackSide < 0 ? 1 : -1;
        }
        const floatPhase = ((worldX + worldY) * 0.01) % (Math.PI * 2);
        const floatAmp = isAttacking ? 2.4 : 0;
        this.yutaSprite.renderRika(ctx, rikaX, rikaY, rikaFacing, floatPhase, floatAmp, spriteScale);
      }

      // Render Yuta on top of Rika
      this.yutaSprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale, entry.id);

    if (!p.alive) return;

     ctx.fillStyle = "#ffe0f0";
     ctx.font = "600 14px Rajdhani";
     ctx.textAlign = "center";
     ctx.fillText(p.name || "Yuta", pos.x, pos.y - (65 * 1.7 + 10) * zoom);

  }

  renderEffects(ctx, camera) {
    this.effects.render(ctx, camera);

    this.hitFlashes.forEach((flash) => {
      ctx.save();
      ctx.globalAlpha = flash.intensity * (flash.life / 0.15);
      ctx.fillStyle = "rgba(255,80,80,0.3)";
      ctx.beginPath();
      ctx.arc(flash.x - camera.x + ctx.canvas.width * 0.5, flash.y - camera.y + ctx.canvas.height * 0.5, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    this.domainKatanas.forEach((dk) => {
      const pos = {
        x: dk.x - camera.x + ctx.canvas.width * 0.5,
        y: dk.y - camera.y + ctx.canvas.height * 0.5,
      };
      const progress = 1 - dk.life / 0.8;
      drawRowOfKatanas(ctx, pos.x, pos.y, progress, this.time);
    });

    const z = camera.zoom || 1;
    const cx = camera.x;
    const cy = camera.y;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    for (const impact of this.rikaHeavyImpacts) {
      const progress = 1 - impact.life / impact.maxLife;
      if (progress <= 0 || progress >= 1) continue;

      const sx = (impact.x - cx) * z + w * 0.5;
      const sy = (impact.y - cy) * z + h * 0.5;
      const ringRadius = impact.radius * z;

      drawRikaShockwave(ctx, sx, sy, ringRadius, progress, 1.3);
      drawRikaAreaExplosion(ctx, sx, sy, Math.max(95 * z, ringRadius * 0.62), progress, this.time);
      drawRikaClawScratch(ctx, sx, sy, impact.dirX, impact.dirY, Math.min(0.98, progress * 1.12), 1.15);
    }

    for (const ra of this.rikaAttacks) {
      const progress = 1 - ra.life / ra.maxLife;
      if (progress <= 0 || progress >= 1) continue;

      const sx = (ra.x - cx) * z + w * 0.5;
      const sy = (ra.y - cy) * z + h * 0.5;
      const impactSx = (ra.impactX - cx) * z + w * 0.5;
      const impactSy = (ra.impactY - cy) * z + h * 0.5;
      const coneAngle = 1.2;
      const angle = Math.atan2(ra.dirY, ra.dirX);

      ctx.save();
      ctx.globalAlpha = Math.min(1, progress * 4) * (1 - Math.max(0, progress - 0.3) / 0.5);
      ctx.fillStyle = "rgba(204,51,136,0.12)";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, 160 * z, angle - coneAngle * 0.5, angle + coneAngle * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      drawRikaAreaExplosion(ctx, impactSx, impactSy, 60 * z, progress, this.time);
      drawRikaClawScratch(ctx, impactSx, impactSy, ra.dirX, ra.dirY, progress, 0.9);

      if (this.yutaSprite.rikaSprite) {
        const spriteAlpha = Math.min(1, progress * 5) * (1 - Math.max(0, progress - 0.4) / 0.4);
        if (spriteAlpha > 0.01) {
          const swayX = impactSx + Math.sin(this.time * 8) * 6;
          const swayY = impactSy + Math.abs(Math.sin(this.time * 7)) * -12;
          ctx.save();
          ctx.globalAlpha = spriteAlpha;
          ctx.shadowColor = "#ff66b2";
          ctx.shadowBlur = 30;
          ctx.translate(swayX, swayY);
          ctx.rotate((this.time % (Math.PI * 2)) * 0.3 + Math.sin(this.time * 5) * 0.08);
          ctx.translate(-swayX, -swayY);
          this.yutaSprite.renderRika(ctx, swayX, swayY, -1, 0, 0);
          ctx.restore();
        }
      }
    }

    // Pure Love charge sphere (visible until beam snapshot arrives)
    this.pureLoveCharges.forEach((charge) => {
      const chargeAge = this.time - charge.startTime;
      const progress = Math.min(1, chargeAge / charge.duration);
      const sphereAlpha = progress >= 1 ? 1 : Math.min(1, progress * 4);
      const sx = (charge.x - camera.x) * z + w * 0.5;
      const sy = (charge.y - camera.y) * z + h * 0.5;
      SkillVFX.drawPinkSphere(ctx, sx, sy, 60 * z, progress, sphereAlpha);
    });

    // Pure Love beam + inner particles
    if (this.pureLoveBeam) {
      const beamLength = this.pureLoveBeam.beamLength;
      const bx = (this.pureLoveBeam.originX - cx) * z + w * 0.5;
      const by = (this.pureLoveBeam.originY - cy) * z + h * 0.5;
      const endX = bx + this.pureLoveBeam.dirX * beamLength * z;
      const endY = by + this.pureLoveBeam.dirY * beamLength * z;
      const lifeFrac = Math.max(0, this.pureLoveBeam.lifetime / this.pureLoveBeam.totalLifetime);
      const fadeStart = 0.2;
      const alpha = lifeFrac > fadeStart ? 1 : Math.max(0, lifeFrac / fadeStart);
      const widthScale = lifeFrac > fadeStart ? 1 : Math.max(0.1, lifeFrac / fadeStart);
      SkillVFX.drawPinkBeam(ctx, bx, by, endX, endY, this.pureLoveBeam.width * z * widthScale, alpha);

      // Beam inner energy particles
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const p of this.beamParticles) {
        const t = p.life / p.maxLife;
        const px = (p.x - cx) * z + w * 0.5;
        const py = (p.y - cy) * z + h * 0.5;
        ctx.globalAlpha = t * t * alpha;
        ctx.fillStyle = `hsl(${p.hue}, 100%, ${60 + t * 30}%)`;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 70%)`;
        ctx.shadowBlur = p.size * 6;
        ctx.beginPath();
        ctx.arc(px, py, p.size * z * t, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Beam inner streaks
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const streakT = (this.time * 0.3 + i * 0.33) % 1;
        const offset = (Math.sin(streakT * Math.PI * 4 + i) * 0.08 + 0.1) * 0.8 + 0.1;
        const sx = bx + (endX - bx) * offset;
        const sy = by + (endY - by) * offset;
        const streakLen = 0.08;
        const ex = bx + (endX - bx) * Math.min(1, offset + streakLen);
        const ey = by + (endY - by) * Math.min(1, offset + streakLen);
        ctx.globalAlpha = (1 - streakT) * 0.4 * alpha;
        ctx.strokeStyle = "#ffccff";
        ctx.shadowColor = "#ff66cc";
        ctx.shadowBlur = 18;
        ctx.lineWidth = (4 + Math.sin(this.time * 2 + i) * 2) * z;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Dash slash trail (single energy wave effect)
    for (const trail of this.dashSlashes) {
      const progress = 1 - trail.life / 0.10;
      const sx = (trail.startX - cx) * z + w * 0.5;
      const sy = (trail.startY - cy) * z + h * 0.5;
      const ex = (trail.endX - cx) * z + w * 0.5;
      const ey = (trail.endY - cy) * z + h * 0.5;

      drawEnergyWaveTrail(ctx, sx, sy, ex, ey, progress, this.time, {
        width: (40 + progress * 80) * z,
      });
    }

    // Rika dash trail (energy wave)
    for (const trail of this.rikaDashes) {
      const progress = 1 - trail.life / 0.25;
      if (progress >= 1) continue;
      const sx = (trail.startX - cx) * z + w * 0.5;
      const sy = (trail.startY - cy) * z + h * 0.5;
      const ex = (trail.endX - cx) * z + w * 0.5;
      const ey = (trail.endY - cy) * z + h * 0.5;

      ctx.save();
      ctx.globalAlpha = 1 - progress;
      drawEnergyWaveTrail(ctx, sx, sy, ex, ey, progress, this.time, {
        width: (30 + progress * 60) * z,
        colorMul: 0.8,
      });
      ctx.restore();
    }

    // Rika impulse shockwave
    for (const imp of this.rikaImpulses) {
      const progress = 1 - imp.life / imp.maxLife;
      if (progress <= 0 || progress >= 1) continue;
      const sx = (imp.x - cx) * z + w * 0.5;
      const sy = (imp.y - cy) * z + h * 0.5;
      const ringRadius = imp.radius * z;

      drawRikaShockwave(ctx, sx, sy, ringRadius, progress, 1.5);
      drawRikaAreaExplosion(ctx, sx, sy, Math.max(50 * z, ringRadius * 0.5), progress, this.time);
      drawRikaClawScratch(ctx, sx, sy, 0, -1, Math.min(1, progress * 1.5), 1.3);
      drawRikaClawScratch(ctx, sx, sy, 1, 0.5, Math.min(1, progress * 1.5), 1.3);
      drawRikaClawScratch(ctx, sx, sy, -1, 0.5, Math.min(1, progress * 1.5), 1.3);
    }

    // Pink slash cuts (2nd hit VFX)
    for (const cut of this.slashCuts) {
      const progress = 1 - cut.life / 0.15;
      if (progress >= 1) continue;
      const scx = (cut.x - cx) * z + w * 0.5;
      const scy = (cut.y - cy) * z + h * 0.5;
      drawPinkSlashCuts(ctx, scx, scy, progress, this.time, z);
    }
  }
}
