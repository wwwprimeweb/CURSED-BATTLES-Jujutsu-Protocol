import { GojoSpriteRenderer } from "./gojoSprite.js";
import { GojoSkillEffects } from "./proceduralGojo.js";
import { drawDeathPose, drawHitReaction, drawDodgeEffect } from "./gojoEffects.js";

export class GojoVisualSystem {
  constructor() {
    this.gojoSprite = new GojoSpriteRenderer();
    this.effects = new GojoSkillEffects();
    this.hitFlashes = new Map();
    this.dodgeEffects = new Map();
    this.m1Slashes = [];
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    this.gojoSprite.update(dt);
    this.effects.update(dt);

    this.hitFlashes.forEach((flash, id) => {
      flash.life -= dt;
      if (flash.life <= 0) this.hitFlashes.delete(id);
    });

    this.dodgeEffects.forEach((effect, id) => {
      effect.life -= dt;
      if (effect.life <= 0) this.dodgeEffects.delete(id);
    });

    for (let i = this.m1Slashes.length - 1; i >= 0; i--) {
      this.m1Slashes[i].life -= dt;
      if (this.m1Slashes[i].life <= 0) this.m1Slashes.splice(i, 1);
    }
  }

  triggerM1(worldX, worldY, dirX, dirY, comboStep) {
    this.m1Slashes.push({ worldX, worldY, dirX, dirY, comboStep, life: 0.3 });
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
      const deathAge = (Date.now() - p.deathTime) / 1000;
      const progress = Math.min(1, deathAge / 1.5);
      drawDeathPose(ctx, pos.x, pos.y, progress, this.time);
      return;
    }

    this.gojoSprite.render(ctx, pos.x, pos.y, animState, facing, 1.0);

    if (!p.alive) return;

    ctx.fillStyle = "#dce9ff";
    ctx.font = "600 14px Rajdhani";
    ctx.textAlign = "center";
    ctx.fillText(p.name || "Gojo", pos.x, pos.y - 50);

    const hpPct = p.maxHp > 0 ? p.hp / p.maxHp : 0;
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(pos.x - 22, pos.y + 30, 44, 4);
    ctx.fillStyle = "#ff5d7f";
    ctx.fillRect(pos.x - 22, pos.y + 30, 44 * hpPct, 4);
  }

  renderEffects(ctx, camera) {
    this.effects.render(ctx, camera);
  }
}
