"use strict";

const { normalize } = require("../utils/math");
const { getEnemyDef } = require("../entities/enemyRegistry");

class CombatSystem {
  constructor(server) {
    this.server = server;
  }

  applyDamage({
    target,
    amount,
    source,
    kind = "generic",
    knockback = 0,
    knockbackDistanceCap = 170,
    fromX,
    fromY,
  }) {
    if (!target || !target.alive || amount <= 0) {
      return false;
    }

    if (target.kind === "player" && target.invulnTimer > 0) {
      return false;
    }

    if (target.kind === "player" && target.hp === target.maxHp && source !== target) {
      console.log(`[DIAG] FIRST DAMAGE on ${target.id}: kind=${kind}, amount=${amount}, hp=${target.hp}->${target.hp - amount}, fromX=${fromX}, fromY=${fromY}, source=${source ? source.id : 'none'}, sourceKind=${source ? source.kind : 'N/A'}`);
    }

    let finalDamage = amount;
    if (source && source.kind === "player") {
      finalDamage *= source.modifiers.damageMul;
    }
    if (target.kind === "player") {
      target.lastDamageTaken = this.server.now;
      finalDamage = Math.max(1, finalDamage - target.armor);
      finalDamage *= target.modifiers.damageReductionMul;
      if (target.cast && finalDamage >= 30 && target.cast.type !== "divergentFist" && target.cast.type !== "soulImpact") {
        target.cast = null;
      } else if (target.cast && target.cast.type === "soulImpact") {
        console.log(`[DIAG] soulImpact cast protected, damage=${finalDamage}`);
      }
    }
    if (target.kind === "enemy") {
      target.lastDamageTaken = this.server.now;
      if ((target.protectionReduction || 0) > 0) {
        finalDamage *= 1 - target.protectionReduction;
      }
    }

    target.hp -= finalDamage;
    target.hitFlash = 0.1;

    if (target.kind === "player" && this.server.domainSystem) {
      this.server.domainSystem.damageBarrier(target.id, finalDamage * 0.5);
    }

    if (knockback > 0 && Number.isFinite(fromX) && Number.isFinite(fromY)) {
      const def = target.kind === "enemy" ? getEnemyDef(target.type) : null;
      if (!def || !def.behaviors || !def.behaviors.immuneKnockback) {
        const n = normalize(target.x - fromX, target.y - fromY);
        target.vx += n.x * knockback;
        target.vy += n.y * knockback;
        const cap = Number.isFinite(knockbackDistanceCap) ? Math.max(0, knockbackDistanceCap) : 170;
        const knockbackDistance = Math.min(cap, knockback * 0.16);
        if (knockbackDistance > 0) {
          this.server.moveEntityWithCollisions(target, n.x * knockbackDistance, n.y * knockbackDistance, true);
        }
      }
    }

    this.server.emitEventNear(target.x, target.y, {
      type: "hit",
      x: target.x,
      y: target.y,
      kind,
      amount: Math.round(finalDamage),
      targetKind: target.kind,
      targetId: target.id,
      sourceKind: source?.kind,
      sourceId: source?.id,
    });

    if (target.hp <= 0) {
      this.handleDeath(target, source);
    }
    return true;
  }

  handleDeath(target, source) {
    if (target.kind === "enemy") {
      const def = getEnemyDef(target.type);
      if (def && def.onDeath && def.onDeath(target, this.server, source)) {
        target.hp = 0;
        target.vx = 0;
        target.vy = 0;
        return;
      }
    }

    target.hp = 0;
    target.alive = false;
    target.vx = 0;
    target.vy = 0;

    if (target.kind === "player") {
      target.deaths += 1;
      target.respawnTimer = 4.5;
      target.cast = null;
      this.server.emitEventAll({
        type: "kill",
        x: target.x,
        y: target.y,
        victimId: target.id,
        killerId: source && source.id ? source.id : null,
      });
    } else if (target.kind === "enemy") {
      this.server.enemies.delete(target.id);
      this.server.emitEventNear(target.x, target.y, {
        type: "enemyDeath",
        x: target.x,
        y: target.y,
        enemyType: target.type,
      });
    }

    if (source && source.kind === "player") {
      source.kills += 1;
      if (source.modifiers.sustainOnKill > 0) {
        source.hp = Math.min(source.maxHp, source.hp + source.modifiers.sustainOnKill);
      }
      this.server.progression.grantXp(source, target.kind === "enemy" ? target.xpReward : 120);
    }
  }
}

module.exports = {
  CombatSystem,
};
