import { YutaSpriteRenderer } from "./yutaSprite.js";
import { YutaSkillEffects } from "./proceduralYuta.js";
import { drawHitReaction, drawDodgeEffect } from "./gojoEffects.js";
import { drawRowOfKatanas } from "./yutaEffects.js";

export class YutaVisualSystem {
  constructor() {
    this.yutaSprite = new YutaSpriteRenderer();
    this.effects = new YutaSkillEffects();
    this.hitFlashes = new Map();
    this.dodgeEffects = new Map();
    this.domainKatanas = new Map();
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
  }

  triggerKatanaSlash(x, y, dirX, dirY, combo) {
    this.effects.addKatanaSlash(x, y, dirX, dirY, combo);
  }

  triggerHit(x, y, intensity = 1) {
    this.hitFlashes.set(Date.now(), { x, y, life: 0.15, intensity });
  }

  triggerDodge(x, y, facing) {
    this.dodgeEffects.set(Date.now(), { x, y, facing, life: 0.25 });
  }

  triggerRika(x, y, dirX, dirY) {
    this.effects.addRikaStart(x, y, 0.5);
  }

  triggerFullRika(x, y, duration) {
    this.effects.addRikaStart(x, y, duration);
  }

  triggerDashSlash(x, y, dirX, dirY) {
    this.effects.addDashSlash(x, y, dirX, dirY);
  }

  triggerPureLove(x, y, radius) {
    this.effects.addPureLove(x, y, radius);
  }

  triggerDomainKatana(x, y) {
    this.domainKatanas.set(Date.now(), { x, y, life: 0.8 });
  }

  renderPlayer(ctx, camera, entry, isYou, facing, state) {
    const p = entry.raw;
    const pos = {
      x: p.x - camera.x + ctx.canvas.width * 0.5,
      y: p.y - camera.y + ctx.canvas.height * 0.5,
    };
    const animState = state || p.animState || "idle";

    if (animState === "dodge" && p.dodgeStartTime) {
      const dodgeAge = (Date.now() - p.dodgeStartTime) / 1000;
      const dodgeProgress = Math.min(1, dodgeAge / 0.2);
      drawDodgeEffect(ctx, pos.x, pos.y, facing, dodgeProgress);
    }

    if (animState === "hit" && p.hitTime) {
      const hitAge = (Date.now() - p.hitTime) / 1000;
      const flashIntensity = Math.max(0, 1 - hitAge / 0.15);
      drawHitReaction(ctx, pos.x, pos.y, facing, flashIntensity);
    }

    if (animState === "death" && p.deathTime) {
      this.yutaSprite.render(ctx, pos.x, pos.y, animState, facing, 1.0);
      return;
    }

    this.yutaSprite.render(ctx, pos.x, pos.y, animState, facing, 1.0);

    if (p.rikaActive && this.yutaSprite.rikaSprite) {
      const rikaX = pos.x - 35 + Math.sin(this.time * 3) * 8;
      const rikaY = pos.y - 5;
      this.yutaSprite.renderRika(ctx, rikaX, rikaY, facing * -1);
    }

    if (!p.alive) return;

    ctx.fillStyle = "#ffe0f0";
    ctx.font = "600 14px Rajdhani";
    ctx.textAlign = "center";
    ctx.fillText(p.name || "Yuta", pos.x, pos.y - 50);

    const hpPct = p.maxHp > 0 ? p.hp / p.maxHp : 0;
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(pos.x - 22, pos.y + 30, 44, 4);
    ctx.fillStyle = "#ff5d7f";
    ctx.fillRect(pos.x - 22, pos.y + 30, 44 * hpPct, 4);
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
  }
}
