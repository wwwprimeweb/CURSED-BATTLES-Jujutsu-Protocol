import { CharacterSprite } from "./characterSprite.js";
import { drawDeathPose, drawHitReaction, drawDodgeEffect } from "./gojoEffects.js";

export class GenericVisualSystem {
  constructor(character) {
    this.character = character;
    this.sprite = new CharacterSprite(character);
    this.hitFlashes = new Map();
    this.dodgeEffects = new Map();
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    this.sprite.update(dt);

    this.hitFlashes.forEach((flash, id) => {
      flash.life -= dt;
      if (flash.life <= 0) this.hitFlashes.delete(id);
    });

    this.dodgeEffects.forEach((effect, id) => {
      effect.life -= dt;
      if (effect.life <= 0) this.dodgeEffects.delete(id);
    });
  }

  triggerHit(x, y, intensity = 1) {
    this.hitFlashes.set(Date.now(), { x, y, life: 0.15, intensity });
  }

  triggerDodge(x, y, facing) {
    this.dodgeEffects.set(Date.now(), { x, y, facing, life: 0.25 });
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
    const animState = state || p.animState || "idle";
    const spriteScale = zoom;

    if (animState === "domain_prepare") {
      this.sprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale);
      return;
    }

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
      ctx.scale(spriteScale, spriteScale);
      drawDeathPose(ctx, 0, 0, progress, this.time);
      ctx.restore();
      return;
    }

    this.sprite.render(ctx, pos.x, pos.y, animState, facing, spriteScale);

    if (!p.alive) return;

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 14px Rajdhani";
    ctx.textAlign = "center";
    ctx.fillText(p.name || this.character, pos.x, pos.y - 70);
  }

  renderEffects(ctx, camera) {
    this.hitFlashes.forEach((flash) => {
      ctx.save();
      ctx.globalAlpha = flash.intensity * (flash.life / 0.15);
      ctx.fillStyle = "rgba(255,80,80,0.3)";
      ctx.beginPath();
      ctx.arc(flash.x - camera.x + ctx.canvas.width * 0.5, flash.y - camera.y + ctx.canvas.height * 0.5, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}
