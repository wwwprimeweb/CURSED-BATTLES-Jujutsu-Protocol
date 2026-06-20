import { YutaSpriteRenderer } from "./yutaSprite.js";
import { YutaSkillEffects } from "./proceduralYuta.js";
import { drawHitReaction } from "./gojoEffects.js";
import { drawRowOfKatanas, drawRikaAreaExplosion, drawRikaClawScratch, drawRikaShockwave, drawPinkSlashCuts, drawEnergyWaveTrail, drawRikaAppearGlow, drawRikaImpactBurst, drawRikaDashTrail, drawDashSlideTrail } from "./yutaEffects.js";
import { SkillVFX } from "../particles/proceduralEffects.js";
import { RIKA_INCOMPLETA_CONFIG, FULL_RIKA_CONFIG } from "./yutaSprites.js";

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
    this.rikaSummons = [];
    this.dashSlashActive = null;
    this.dashSlashTrail = [];
    this.needsShake = false;
    this.time = 0;
    this.fullRikaStates = new Map();
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
      p.size *= Math.pow(0.995, dt * 60);
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

    // Update dash slash active state (slide trail)
    if (this.dashSlashActive) {
      this.dashSlashActive.timer -= dt;
      if (this.dashSlashActive.timer <= 0) {
        this.dashSlashActive = null;
        this.dashSlashTrail = [];
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

    // Update Full Rika animation states
    this.fullRikaStates.forEach((state, id) => {
      state.timer += dt;
      const cfg = FULL_RIKA_CONFIG;

      if (!state.introDone) {
        if (state.timer >= cfg.introDuration) {
          state.introDone = true;
          state.timer = 0;
        }
      }
      if (state.attackVisualTimer > 0) {
        state.attackVisualTimer = Math.max(0, state.attackVisualTimer - dt);
      }
    });

    // Update rika summon state machine
    for (let i = this.rikaSummons.length - 1; i >= 0; i--) {
      const s = this.rikaSummons[i];
      s.timer += dt;

      if (s.isIncomplete) {
        const cfg = RIKA_INCOMPLETA_CONFIG;
        const appearEnd = cfg.appearDuration;
        const loopEnd = appearEnd + cfg.loopDuration;
        const attackEnd = loopEnd + cfg.attackDuration;
        const fadeOutEnd = attackEnd + cfg.fadeOutDuration;

        if (s.timer > fadeOutEnd) {
          this.rikaSummons.splice(i, 1);
          continue;
        }

        // Appear phase (0 - appearEnd): fade in, show frame 0
        if (s.timer < appearEnd) {
          s.currentRow = 0;
          s.currentFrame = 0;
        }

        // Float loop phase (appearEnd - loopEnd): loop frames 1-5
        if (s.timer >= appearEnd && s.timer < loopEnd) {
          s.currentRow = 0;
          const loopElapsed = s.timer - appearEnd;
          const loopFrames = cfg.loopEndIndex - cfg.loopStartIndex + 1;
          const frameInterval = cfg.loopDuration / loopFrames;
          s.currentFrame = cfg.loopStartIndex + Math.floor(loopElapsed / frameInterval) % loopFrames;
        }

        // Attack phase (loopEnd - attackEnd): play attack frames row 1
        if (s.timer >= loopEnd && s.timer < attackEnd) {
          s.currentRow = 1;
          const atkElapsed = s.timer - loopEnd;
          const atkFrames = cfg.attackFrames.length;
          const frameInterval = cfg.attackDuration / atkFrames;
          const rawFrame = Math.floor(atkElapsed / frameInterval);
          s.currentFrame = Math.min(rawFrame, atkFrames - 1);

          // Lerp position forward for attack lunge
          const dp = Math.min(1, atkElapsed / cfg.attackDuration);
          const ease = dp < 0.5 ? 2 * dp * dp : 1 - Math.pow(-2 * dp + 2, 2) / 2;
          s.x = s.startX + (s.targetX - s.startX) * ease;
          s.y = s.startY + (s.targetY - s.startY) * ease;
        }

        // Fade out phase (attackEnd - fadeOutEnd): shrink + fade + particles
        if (s.timer >= attackEnd && s.timer < fadeOutEnd) {
          s.currentRow = 1;
          s.currentFrame = cfg.attackFrames.length - 1;

          // Spawn dissipate particles once
          if (!s.dissipatedParticles) {
            s.dissipatedParticles = true;
            s.dissipated = true;
          }
        }

        // Trigger screen shake at attack start
        if (s.timer >= loopEnd && s.timer - dt < loopEnd) {
          this.needsShake = true;
        }
      } else {
        // Original Rika summon state machine
        if (s.timer > 2.0) {
          this.rikaSummons.splice(i, 1);
          continue;
        }

        // Dash phase: interpolate position from follow position to target
        if (s.timer >= 1.2 && s.timer < 1.5) {
          const dp = (s.timer - 1.2) / 0.3;
          const ease = 1 - Math.pow(1 - dp, 2);
          s.x = s.dashFromX + (s.targetX - s.dashFromX) * ease;
          s.y = s.dashFromY + (s.targetY - s.dashFromY) * ease;
        }

        // Attack phase: at target
        if (s.timer >= 1.5) {
          s.x = s.targetX;
          s.y = s.targetY;
        }

        // Trigger screen shake at attack start
        if (s.timer >= 1.5 && s.timer - dt < 1.5) {
          this.needsShake = true;
        }
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

  triggerRikaSummon(playerId, x, y, targetX, targetY, isIncomplete = false) {
    const dx = targetX - x;
    const dy = targetY - y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = len > 0.001 ? dx / len : 1;
    const ny = len > 0.001 ? dy / len : 0;
    if (isIncomplete) {
      // Rika incompleta: appears in front of Yuta (respecting cursor distance)
      const cursorDist = Math.hypot(targetX - x, targetY - y);
      const followDist = Math.min(cursorDist, 80);
      const frontX = x + nx * followDist;
      const frontY = y - 50;
      this.rikaSummons.push({
        playerId,
        isIncomplete: true,
        startX: x,
        startY: y,
        x: frontX,
        y: frontY,
        dirX: nx,
        dirY: ny,
        targetX,
        targetY,
        timer: 0,
        appearDuration: RIKA_INCOMPLETA_CONFIG.appearDuration,
        loopDuration: RIKA_INCOMPLETA_CONFIG.loopDuration,
        attackDuration: RIKA_INCOMPLETA_CONFIG.attackDuration,
        fadeOutDuration: RIKA_INCOMPLETA_CONFIG.fadeOutDuration,
        totalDuration: RIKA_INCOMPLETA_CONFIG.totalDuration,
        frameTimer: 0,
        currentFrame: 0,
        currentRow: 0,
        dissipated: false,
        dissipatedParticles: false,
      });
    } else {
      this.rikaSummons.push({
        playerId,
        isIncomplete: false,
        startX: x,
        startY: y,
        x,
        y,
        dirX: nx,
        dirY: ny,
        targetX,
        targetY,
        dashFromX: x,
        dashFromY: y,
        timer: 0,
        duration: 2.2,
      });
    }
  }

  triggerRikaCompanionAttack(x, y, dirX, dirY, attackType = "normal", radius = 0, playerId) {
    const isHeavy = attackType === "heavy";
    if (playerId && this.fullRikaStates.has(playerId)) {
      const state = this.fullRikaStates.get(playerId);
      state.attackVisualTimer = isHeavy ? 0.35 : 0.25;
      state.isHeavyAttack = isHeavy;
    }
    const nx = Number.isFinite(dirX) ? dirX : 1;
    const ny = Number.isFinite(dirY) ? dirY : 0;
    this.effects.addRikaAttack(x, y, nx, ny, {
      life: isHeavy ? 0.7 : 0.45,
      size: isHeavy ? 2.8 : 1.2,
      intensity: isHeavy ? 1.0 : 1,
    });

    if (isHeavy) {
      this.needsShake = true;
      const impactRadius = Number.isFinite(radius) ? Math.max(70, radius) : 170;
      this.rikaHeavyImpacts.push({
        x,
        y,
        dirX: nx,
        dirY: ny,
        radius: impactRadius,
        life: 0.72,
        maxLife: 0.72,
        playerId,
      });
    }
  }

  triggerFullRika(playerId, x, y, duration) {
    this.effects.addRikaStart(x, y, duration);
    this.fullRikaStates.set(playerId, {
      timer: 0,
      introDone: false,
      attackVisualTimer: 0,
      isHeavyAttack: false,
    });
  }

  triggerDashSlashStart(playerId, x, y, dirX, dirY) {
    this.dashSlashActive = {
      playerId, x, y, dirX, dirY,
      timer: 0.35,
    };
    this.dashSlashTrail = [{ x, y }];
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

  triggerRikaDash(startX, startY, endX, endY, playerId) {
    const fullRikaBoosted = playerId && this.fullRikaStates.has(playerId);
    this.rikaDashes.push({
      startX, startY,
      endX, endY,
      startTime: this.time,
      life: 0.25,
      fullRikaBoosted,
    });
  }

  triggerRikaImpulse(x, y, radius, playerId, startX, startY, endX, endY) {
    const fullRikaBoosted = playerId && this.fullRikaStates.has(playerId);
    this.rikaImpulses.push({
      x, y,
      radius: radius || 180,
      startTime: this.time,
      life: 0.6,
      maxLife: 0.6,
      fullRikaBoosted,
      startX: startX !== undefined ? startX : x,
      startY: startY !== undefined ? startY : y,
      endX: endX !== undefined ? endX : x,
      endY: endY !== undefined ? endY : y,
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
      const p = entry.raw;
      this.updatePureLoveBeamFromSnapshot(p);
      if (this.pureLoveCharges.has(p.id)) {
        const charge = this.pureLoveCharges.get(p.id);
        if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
          charge.x = p.x + charge.dirX * 150;
          charge.y = p.y + charge.dirY * 150;
        }
      }
    });
  }

  triggerDomainKatana(x, y) {
    this.domainKatanas.set(Date.now(), { x, y, life: 0.8 });
  }

  renderPlayer(ctx, camera, entry, isYou, facing, state, renderX, renderY, dt = 1 / 60) {
    const p = entry.raw;
    const worldX = Number.isFinite(renderX) ? renderX : p.x;
    const worldY = Number.isFinite(renderY) ? renderY : p.y;
    const zoom = camera.zoom;
    const pos = {
      x: (worldX - camera.x) * zoom + ctx.canvas.width * 0.5,
      y: (worldY - camera.y) * zoom + ctx.canvas.height * 0.5,
    };
    const animState = p.animState === "dodge" ? "dodge" : (state || p.animState || "idle");
    const spriteScale = zoom;

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
       this.yutaSprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale, entry.id);
       return;
     }

      const isYuta = p.character === "portador-do-vinculo";
      if (!p.rikaActive) {
        this.rikaRenderPos.delete(p.id);
        this.fullRikaStates.delete(p.id);
      }

      // Check for active Q summon
      const hasSummon = this.rikaSummons.some(s => s.playerId === p.id && s.timer < (s.isIncomplete ? RIKA_INCOMPLETA_CONFIG.totalDuration : 2.2));
      const summon = hasSummon ? this.rikaSummons.find(s => s.playerId === p.id) : null;

      // Render Q summon (full Rika or incomplete Rika)
      if (isYuta && summon) {
        if (summon.isIncomplete) {
          const cfg = RIKA_INCOMPLETA_CONFIG;
          const appearEnd = cfg.appearDuration;
          const loopEnd = appearEnd + cfg.loopDuration;
          const attackEnd = loopEnd + cfg.attackDuration;
          const fadeOutEnd = attackEnd + cfg.fadeOutDuration;
          const lerp = 1 - Math.pow(1 - 0.04, dt * 60);

          // Follow player during appear and loop phases
          if (summon.timer < loopEnd) {
            // Track cursor with deadzone margin
            if (Number.isFinite(p.aimX) && Number.isFinite(p.aimY)) {
              const aimDx = p.aimX - worldX;
              const aimDy = p.aimY - worldY;
              const aimLen = Math.hypot(aimDx, aimDy);
              if (aimLen > 20) {
                summon.dirX = aimDx / aimLen;
                summon.dirY = aimDy / aimLen;
                const distToTarget = Math.hypot(summon.targetX - worldX, summon.targetY - worldY);
                summon.targetX = worldX + summon.dirX * distToTarget;
                summon.targetY = worldY + summon.dirY * distToTarget;
              }
            }

            const distToTarget = Math.hypot(summon.targetX - worldX, summon.targetY - worldY);
            const followDist = Math.min(distToTarget, 80);
            const desiredX = worldX + summon.dirX * followDist;
            const desiredY = worldY + summon.dirY * followDist;
            summon.x += (desiredX - summon.x) * lerp;
            summon.y += (desiredY - summon.y) * lerp;
            summon.startX = summon.x;
            summon.startY = summon.y;
          }

          // Calculate alpha and scale
          let alpha = 1;
          let scaleMul = 1;

          if (summon.timer < appearEnd) {
            alpha = summon.timer / appearEnd;
          } else if (summon.timer >= attackEnd && summon.timer < fadeOutEnd) {
            const fadeProgress = (summon.timer - attackEnd) / cfg.fadeOutDuration;
            alpha = 1 - fadeProgress;
            scaleMul = 1 - fadeProgress * 0.6;
          } else if (summon.timer >= fadeOutEnd) {
            alpha = 0;
          }

          let bobY = 0;
          if (summon.timer >= appearEnd && summon.timer < loopEnd) {
            const loopElapsed = summon.timer - appearEnd;
            bobY = Math.sin(this.time * 4 + loopElapsed * 2) * 4 * zoom;
          }

          if (alpha > 0.01) {
            const rikaScreenX = (summon.x - camera.x) * zoom + ctx.canvas.width * 0.5;
            const rikaScreenY = (summon.y - camera.y) * zoom + ctx.canvas.height * 0.5 + bobY;
            const rikaFacing = summon.dirX < 0 ? -1 : 1;

            ctx.save();
            ctx.globalAlpha = alpha;
            if (summon.timer < appearEnd) {
              ctx.shadowColor = "#ff66b2";
              ctx.shadowBlur = (20 + alpha * 25) * zoom;
            }
            this.yutaSprite.renderRikaIncompletaFrame(ctx, rikaScreenX, rikaScreenY, rikaFacing, summon.currentRow, summon.currentFrame, alpha, spriteScale * scaleMul);
            ctx.restore();
          }
        } else if (summon.timer < 1.2) {
          // Original full Rika: behind player follow
          const behindX = worldX - facing * 90;
          const behindY = worldY;
          const lerp = 1 - Math.pow(1 - 0.04, dt * 60);
          summon.x += (behindX - summon.x) * lerp;
          summon.y += (behindY - summon.y) * lerp;
          summon.dashFromX = summon.x;
          summon.dashFromY = summon.y;

          const alpha = summon.timer < 0.2 ? summon.timer / 0.2 : 1;
          const rikaScreenX = (summon.x - camera.x) * zoom + ctx.canvas.width * 0.5;
          const rikaScreenY = (summon.y - camera.y) * zoom + ctx.canvas.height * 0.5;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.shadowColor = "#ff66b2";
          ctx.shadowBlur = (25 + (1 - alpha) * 20) * zoom;
          this.yutaSprite.renderRika(ctx, rikaScreenX, rikaScreenY, facing, 0, 0, spriteScale);
          ctx.restore();
        }
      }

      // Render companion Rika (only when no Q summon is active)
      if (isYuta && p.rikaActive && !hasSummon) {
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
            const distSq = dx * dx + dy * dy;
            if (distSq > 32400) {
              smooth.x = targetX;
              smooth.y = targetY;
            } else {
              const follow = distSq > 4225 ? 0.32 : distSq > 484 ? 0.24 : 0.18;
              const frameFollow = 1 - Math.pow(1 - follow, dt * 60);
              smooth.x += dx * frameFollow;
              smooth.y += dy * frameFollow;
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
        let fullRikaState = this.fullRikaStates.get(p.id);
        if (!fullRikaState && p.rikaActive) {
          this.fullRikaStates.set(p.id, {
            timer: 0,
            introDone: true,
            attackVisualTimer: 0,
            isHeavyAttack: false,
          });
          fullRikaState = this.fullRikaStates.get(p.id);
        }
        if (fullRikaState) {
          const cfg = FULL_RIKA_CONFIG;
          let frame, row;
          if (!fullRikaState.introDone) {
            row = 0;
            const progress = Math.min(fullRikaState.timer / cfg.introDuration, 1);
            frame = Math.min(Math.floor(progress * cfg.introFrames), cfg.introFrames - 1);
          } else {
            if (fullRikaState.attackVisualTimer > 0) {
              if (fullRikaState.isHeavyAttack) {
                row = cfg.heavyFrameRow;
                frame = cfg.heavyFrameIndex;
              } else {
                row = 1;
                frame = cfg.attackFrameIndex;
              }
            } else {
              row = 1;
              const moving = Math.abs(p.vx) > 0.5 || Math.abs(p.vy) > 0.5;
              frame = moving ? cfg.moveFrame : cfg.idleFrame;
            }
          }
          this.yutaSprite.renderFullRikaFrame(ctx, rikaX, rikaY, rikaFacing, row, frame, 1, spriteScale);
        } else {
          const floatPhase = ((worldX + worldY) * 0.01) % (Math.PI * 2);
          const floatAmp = isAttacking ? 2.4 : 0;
          this.yutaSprite.renderRika(ctx, rikaX, rikaY, rikaFacing, floatPhase, floatAmp, spriteScale);
        }
      }

      // Dash afterimage trail (during dashSlash slide)
      if (this.dashSlashActive && this.dashSlashActive.playerId === p.id && this.dashSlashActive.timer > 0) {
        this.dashSlashTrail.push({ x: worldX, y: worldY });
        if (this.dashSlashTrail.length > 10) this.dashSlashTrail.shift();

        const dashProgress = 1 - this.dashSlashActive.timer / 0.35;
        const trailOffY = 50 * zoom;

        // Glowing afterimage orbs behind the player
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < this.dashSlashTrail.length - 1; i++) {
          const t = i / Math.max(1, this.dashSlashTrail.length - 2);
          const aa = (1 - t) * 0.25 * (1 - dashProgress * 0.2);
          if (aa < 0.01) continue;
          const tp = this.dashSlashTrail[i];
          const tx = (tp.x - camera.x) * zoom + ctx.canvas.width * 0.5;
          const ty = (tp.y - camera.y) * zoom + ctx.canvas.height * 0.5 - trailOffY;
          ctx.globalAlpha = aa;
          ctx.fillStyle = i % 2 === 0 ? "#ff99cc" : "#ff66b2";
          ctx.shadowColor = "#ff66b2";
          ctx.shadowBlur = 25 * zoom;
          ctx.beginPath();
          ctx.arc(tx, ty, (8 + t * 6) * zoom, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Wind/energy trail streaks
        const dirX = this.dashSlashActive.dirX || 1;
        const dirY = this.dashSlashActive.dirY || 0;
        drawDashSlideTrail(ctx, pos.x, pos.y - trailOffY, dirX, dirY, dashProgress, this.time, zoom);
      }

      // Render Yuta
      this.yutaSprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale, entry.id);

    if (!p.alive) return;

     ctx.fillStyle = "#ffe0f0";
     ctx.font = `600 ${Math.round(14 * zoom)}px Rajdhani`;
     ctx.textAlign = "center";
     ctx.fillText(p.name || "portador-do-vinculo", pos.x, pos.y - (65 * 1.7 + 10) * zoom);

  }

  renderEffects(ctx, camera) {
    this.effects.render(ctx, camera);

    this.hitFlashes.forEach((flash) => {
      ctx.save();
      ctx.globalAlpha = flash.intensity * (flash.life / 0.15);
      ctx.fillStyle = "rgba(255,80,80,0.3)";
      ctx.beginPath();
      ctx.arc((flash.x - camera.x) * camera.zoom + ctx.canvas.width * 0.5, (flash.y - camera.y) * camera.zoom + ctx.canvas.height * 0.5, 30 * camera.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    this.domainKatanas.forEach((dk) => {
      const pos = {
        x: (dk.x - camera.x) * camera.zoom + ctx.canvas.width * 0.5,
        y: (dk.y - camera.y) * camera.zoom + ctx.canvas.height * 0.5,
      };
      const progress = 1 - dk.life / 0.8;
      drawRowOfKatanas(ctx, pos.x, pos.y, progress, this.time, camera.zoom);
    });

    const z = camera.zoom;
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

      const summon = impact.playerId ? this.rikaSummons.find(s => s.playerId === impact.playerId) : null;
      if (summon) {
        const trailStartX = (summon.x - cx) * z + w * 0.5;
        const trailStartY = (summon.y - cy) * z + h * 0.5;
        drawEnergyWaveTrail(ctx, trailStartX, trailStartY, sx, sy, progress, this.time, {
          width: (70 + progress * 100) * z,
        }, z);
      }

      drawRikaShockwave(ctx, sx, sy, ringRadius, progress, 1.3, z);
      drawRikaAreaExplosion(ctx, sx, sy, Math.max(95 * z, ringRadius * 0.62), progress, this.time, z);
      drawRikaClawScratch(ctx, sx, sy, impact.dirX, impact.dirY, Math.min(0.98, progress * 1.12), 1.15, z);
    }

    for (const s of this.rikaSummons) {
      if (s.timer <= 0) continue;

      if (s.isIncomplete) {
        const cfg = RIKA_INCOMPLETA_CONFIG;
        const appearEnd = cfg.appearDuration;
        const loopEnd = appearEnd + cfg.loopDuration;
        const attackEnd = loopEnd + cfg.attackDuration;
        const fadeOutEnd = attackEnd + cfg.fadeOutDuration;

        if (s.timer >= fadeOutEnd) continue;

        // Attack phase VFX: impact at target position
        if (s.timer >= loopEnd && s.timer < attackEnd) {
          const atkProgress = (s.timer - loopEnd) / cfg.attackDuration;
          const impactX = (s.targetX - cx) * z + w * 0.5;
          const impactY = (s.targetY - cy) * z + h * 0.5;

          drawRikaImpactBurst(ctx, impactX, impactY, atkProgress, this.time, z);
          drawRikaAreaExplosion(ctx, impactX, impactY, 60 * z, atkProgress, this.time, z);
          drawRikaClawScratch(ctx, impactX, impactY, s.dirX, s.dirY, atkProgress, 0.9, z);
        }

        // Fade out phase: dissipate particles
        if (s.timer >= attackEnd && s.timer < fadeOutEnd) {
          const fadeProgress = (s.timer - attackEnd) / cfg.fadeOutDuration;
          const impactX = (s.targetX - cx) * z + w * 0.5;
          const impactY = (s.targetY - cy) * z + h * 0.5;

          // Shrinking pink particles fading out
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          for (let j = 0; j < 6; j++) {
            const seed = (j / 6 + this.time * 0.3) % 1;
            const angle = seed * Math.PI * 2;
            const dist = (40 + j * 15) * (1 - fadeProgress) * z;
            const px = impactX + Math.cos(angle + this.time * 2) * dist;
            const py = impactY + Math.sin(angle + this.time * 2) * dist;
            const pSize = (4 + j * 2) * (1 - fadeProgress) * z;
            const pAlpha = (1 - fadeProgress) * 0.6;
            ctx.globalAlpha = pAlpha;
            ctx.fillStyle = ["#ff66b2", "#ff99cc", "#d4a5e5", "#ff80bf"][j % 4];
            ctx.shadowColor = "#ff66b2";
            ctx.shadowBlur = 15 * (1 - fadeProgress) * z;
            ctx.beginPath();
            ctx.arc(px, py, pSize, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        continue;
      }

      if (s.timer >= 2.0) continue;

      // Dash phase: trail + Rika sprite dashing (original)
      if (s.timer >= 1.2 && s.timer < 1.5) {
        const dp = (s.timer - 1.2) / 0.3;
        const sx = (s.dashFromX - cx) * z + w * 0.5;
        const sy = (s.dashFromY - cy) * z + h * 0.5;
        const ex = (s.x - cx) * z + w * 0.5;
        const ey = (s.y - cy) * z + h * 0.5;

        drawRikaDashTrail(ctx, sx, sy, ex, ey, dp, this.time, z);

        const rikaX = (s.x - cx) * z + w * 0.5;
        const rikaY = (s.y - cy) * z + h * 0.5;
        if (this.yutaSprite.rikaSprite) {
          ctx.save();
          ctx.globalAlpha = 1 - dp * 0.4;
          ctx.shadowColor = "#ff66b2";
          ctx.shadowBlur = 30 * z;
          this.yutaSprite.renderRika(ctx, rikaX, rikaY, -1, 0, 0, z);
          ctx.restore();
        }
      }

        // Attack phase: impact burst + claw scratches + Rika fade out (original)
        if (s.timer >= 1.5 && s.timer < 2.0) {
        const atkProgress = (s.timer - 1.5) / 0.5;
        const impactX = (s.targetX - cx) * z + w * 0.5;
        const impactY = (s.targetY - cy) * z + h * 0.5;

        drawRikaImpactBurst(ctx, impactX, impactY, atkProgress, this.time, z);
        drawRikaAreaExplosion(ctx, impactX, impactY, 60 * z, atkProgress, this.time, z);
        drawRikaClawScratch(ctx, impactX, impactY, s.dirX, s.dirY, atkProgress, 0.9, z);

        const fadeOut = Math.max(0, 1 - atkProgress * 1.3);
        if (this.yutaSprite.rikaSprite && fadeOut > 0.01) {
          const swayX = impactX + Math.sin(this.time * 8) * 6 * z;
          const swayY = impactY + Math.abs(Math.sin(this.time * 7)) * -12 * z;
          ctx.save();
          ctx.globalAlpha = fadeOut;
          ctx.shadowColor = "#ff66b2";
          ctx.shadowBlur = 15 * fadeOut * z;
          this.yutaSprite.renderRika(ctx, swayX, swayY, -1, 0, 0, z);
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
      SkillVFX.drawPinkSphere(ctx, sx, sy, 60 * z, progress, sphereAlpha, z);
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
      SkillVFX.drawPinkBeam(ctx, bx, by, endX, endY, this.pureLoveBeam.width * z * widthScale, alpha, z);

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
        ctx.shadowBlur = p.size * 6 * z;
        ctx.beginPath();
        ctx.arc(px, py, p.size * z * t, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Beam inner streaks (fixed looping teleportation)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const streakSpeeds = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 1.1, 1.25, 1.4, 1.6];
      const streakColors = ["#ffccff", "#ff99ff", "#ffffff", "#ffccff", "#ff66ff", "#ffffff", "#ff99ff", "#ffccff", "#ffd1dc", "#fff0f5"];
      for (let i = 0; i < 10; i++) {
        const speed = streakSpeeds[i];
        const streakT = (this.time * speed + i * 0.4) % 1;
        const offset = (Math.sin(streakT * Math.PI * 4 + i) * 0.08 + 0.1) * 0.8 + 0.1;
        
        // Add lateral displacement to streaks so they aren't just in the center
        const perpX = -this.pureLoveBeam.dirY;
        const perpY = this.pureLoveBeam.dirX;
        const spread = Math.sin(streakT * Math.PI * 10 + i) * (this.pureLoveBeam.width * 0.4 * z);

        const sx = bx + (endX - bx) * offset + perpX * spread;
        const sy = by + (endY - by) * offset + perpY * spread;
        const streakLen = 0.12;
        const ex = bx + (endX - bx) * Math.min(1, offset + streakLen) + perpX * spread;
        const ey = by + (endY - by) * Math.min(1, offset + streakLen) + perpY * spread;
        
        // Fade in at the start and fade out at the end so it doesn't snap when looping
        const streakAlpha = Math.sin(streakT * Math.PI);
        ctx.globalAlpha = streakAlpha * 0.8 * alpha;
        
        ctx.strokeStyle = streakColors[i];
        ctx.shadowColor = "#ff66cc";
        ctx.shadowBlur = 25 * z;
        ctx.lineWidth = (3 + Math.sin(this.time * 2.5 + i * 0.8) * 4 + i * 0.8) * z;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.restore();

      // Dark jagged ribbons/spikes wrapped around the beam (living energy)
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const ribbonCount = 3; // Three main strands for more chaotic feel
      const numSegments = 120;
      
      for (let i = 0; i < ribbonCount; i++) {
        const spiralSpeed = 15 + i * 2;
        const freq = 0.02 + i * 0.005;
        // Tighter amplitude to hug the beam closely, smaller spikes
        const baseAmp = this.pureLoveBeam.width * 0.25 * z * widthScale;
        const phaseOffset = i * (Math.PI * 2 / 3);

        ctx.fillStyle = i === 0 ? "rgba(20, 0, 30, 0.9)" : "rgba(40, 0, 60, 0.8)";
        ctx.shadowColor = "rgba(10, 0, 20, 0.8)";
        ctx.shadowBlur = 5 * z;
        
        for (let s = 0; s < numSegments; s++) {
          const t1 = s / numSegments;
          const t2 = (s + 1) / numSegments;
          
          // Use smooth fade out at beam tip instead of abrupt break
          const beamTipDist = t1 / (lifeFrac * 2);
          if (beamTipDist > 1) break; // Don't draw past the growing beam
          
          const d1 = t1 * beamLength * z;
          const d2 = t2 * beamLength * z;
          
          // Add chaotic wobble
          const wobble1 = Math.sin(this.time * 20 + d1 * 0.1) * 0.1;
          const wobble2 = Math.sin(this.time * 20 + d2 * 0.1) * 0.1;
          
          const phase1 = -this.time * spiralSpeed + d1 * freq + phaseOffset;
          const phase2 = -this.time * spiralSpeed + d2 * freq + phaseOffset;
          
          // Only draw when the ribbon is in front of the beam
          if (Math.sin(phase1) > -0.1 || Math.sin(phase2) > -0.1) {
            ctx.beginPath();
            const perpX = -this.pureLoveBeam.dirY;
            const perpY = this.pureLoveBeam.dirX;
            
            const wave1 = Math.sin(phase1) + wobble1;
            const wave2 = Math.sin(phase2) + wobble2;
            
            // Taper near the origin (0) and near the current growing tip
            const tipTaper1 = Math.max(0, 1 - Math.pow(beamTipDist, 4));
            const tipTaper2 = Math.max(0, 1 - Math.pow(t2 / (lifeFrac * 2), 4));
            
            const currentAmp1 = (t1 < 0.1 ? baseAmp * (t1 / 0.1) : baseAmp) * tipTaper1;
            const currentAmp2 = (t2 < 0.1 ? baseAmp * (t2 / 0.1) : baseAmp) * tipTaper2;
            
            // Front edge
            const p1x = bx + this.pureLoveBeam.dirX * d1 + perpX * wave1 * currentAmp1;
            const p1y = by + this.pureLoveBeam.dirY * d1 + perpY * wave1 * currentAmp1;
            const p2x = bx + this.pureLoveBeam.dirX * d2 + perpX * wave2 * currentAmp2;
            const p2y = by + this.pureLoveBeam.dirY * d2 + perpY * wave2 * currentAmp2;
            
            // Back edge (creates the tapering sharp ribbon shape, thinner now)
            const thickness1 = (8 + Math.sin(d1 * 0.1) * 8) * z * Math.max(0.1, Math.sin(phase1)) * tipTaper1;
            const thickness2 = (8 + Math.sin(d2 * 0.1) * 8) * z * Math.max(0.1, Math.sin(phase2)) * tipTaper2;
            
            const p3x = p2x - this.pureLoveBeam.dirX * (thickness2 * 0.3) - perpX * thickness2;
            const p3y = p2y - this.pureLoveBeam.dirY * (thickness2 * 0.3) - perpY * thickness2;
            const p4x = p1x - this.pureLoveBeam.dirX * (thickness1 * 0.3) - perpX * thickness1;
            const p4y = p1y - this.pureLoveBeam.dirY * (thickness1 * 0.3) - perpY * thickness1;
            
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.lineTo(p3x, p3y);
            ctx.lineTo(p4x, p4y);
            ctx.closePath();
            
            ctx.globalAlpha = alpha * Math.min(1, (Math.sin(phase1) + 0.5)) * tipTaper1;
            ctx.fill();
          }
        }
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
      }, z);
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

      if (trail.fullRikaBoosted) {
        const dx = ex - sx;
        const dy = ey - sy;
        const segments = 6;
        for (let i = 0; i < segments; i++) {
          const t = i / segments;
          const ox = sx + dx * t;
          const oy = sy + dy * t;
          const orbAlpha = (1 - t) * 0.3 * (1 - progress);
          if (orbAlpha < 0.01) continue;
          ctx.globalAlpha = orbAlpha;
          ctx.fillStyle = i % 2 === 0 ? "#ff99cc" : "#ff66b2";
          ctx.shadowColor = "#ff66b2";
          ctx.shadowBlur = 30 * z;
          ctx.beginPath();
          ctx.arc(ox, oy, (10 + t * 4) * z, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1 - progress;
        drawEnergyWaveTrail(ctx, sx, sy, ex, ey, progress, this.time, {
          width: (50 + progress * 80) * z,
        }, z);
      } else {
        drawEnergyWaveTrail(ctx, sx, sy, ex, ey, progress, this.time, {
          width: (30 + progress * 60) * z,
          colorMul: 0.8,
        }, z);
      }
      ctx.restore();
    }

    // Rika impulse shockwave
    for (const imp of this.rikaImpulses) {
      const progress = 1 - imp.life / imp.maxLife;
      if (progress <= 0 || progress >= 1) continue;
      const sx = (imp.x - cx) * z + w * 0.5;
      const sy = (imp.y - cy) * z + h * 0.5;
      const ringRadius = imp.radius * z;

      if (imp.fullRikaBoosted) {
        const trailSX = (imp.startX - cx) * z + w * 0.5;
        const trailSY = (imp.startY - cy) * z + h * 0.5;
        const trailEX = (imp.endX - cx) * z + w * 0.5;
        const trailEY = (imp.endY - cy) * z + h * 0.5;

        ctx.save();
        const dx = trailEX - trailSX;
        const dy = trailEY - trailSY;
        const segments = 8;
        for (let i = 0; i < segments; i++) {
          const t = i / segments;
          const ox = trailSX + dx * t;
          const oy = trailSY + dy * t;
          const orbAlpha = (1 - t) * 0.35 * (1 - progress * 0.5);
          if (orbAlpha < 0.01) continue;
          ctx.globalAlpha = orbAlpha;
          ctx.fillStyle = i % 2 === 0 ? "#ff99cc" : "#ff66b2";
          ctx.shadowColor = "#ff66b2";
          ctx.shadowBlur = 35 * z;
          ctx.beginPath();
          ctx.arc(ox, oy, (12 + t * 6) * z, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1 - progress * 0.3;
        drawEnergyWaveTrail(ctx, trailSX, trailSY, trailEX, trailEY, progress, this.time, {
          width: (50 + progress * 90) * z,
        }, z);
        ctx.restore();

        drawRikaShockwave(ctx, sx, sy, ringRadius, progress, 1.8, z);
        drawRikaClawSprite(ctx, sx, sy, 0, -1, Math.min(1, progress * 1.3), this.effects.rikaSpritesheet, z);
      } else {
        drawRikaShockwave(ctx, sx, sy, ringRadius, progress, 1.5, z);
        drawRikaAreaExplosion(ctx, sx, sy, Math.max(50 * z, ringRadius * 0.5), progress, this.time, z);
        drawRikaClawScratch(ctx, sx, sy, 0, -1, Math.min(1, progress * 1.5), 1.3, z);
        drawRikaClawScratch(ctx, sx, sy, 1, 0.5, Math.min(1, progress * 1.5), 1.3, z);
        drawRikaClawScratch(ctx, sx, sy, -1, 0.5, Math.min(1, progress * 1.5), 1.3, z);
      }
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
