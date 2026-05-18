"use strict";

const { GOJO } = require("../gameplay/gojoKit");
const { CHARACTER_REGISTRY } = require("../gameplay/characterRegistry");
const { distance } = require("../utils/math");

class DomainSystem {
  constructor(server) {
    this.server = server;
    this.domains = new Map();
  }

  getDomainKit(player) {
    return CHARACTER_REGISTRY[player.character]?.domain || GOJO.domain;
  }

  activateDomain(player) {
    if (!player.alive) {
      return false;
    }
    if (this.domains.has(player.id)) {
      return false;
    }

    const kit = this.getDomainKit(player);
    const radius = kit.radius * player.modifiers.domainRadiusMul;
    const drain = kit.drainPerSecond * player.modifiers.domainDrainMul;
    const slowEnemy = (kit.slowEnemy || 0) * player.modifiers.domainSlowMul;
    const slowProjectile = (kit.slowProjectile || 0) * player.modifiers.domainSlowMul;

    const domain = {
      id: `d_${player.id}`,
      ownerId: player.id,
      character: player.character || "gojo",
      x: player.x,
      y: player.y,
      radius,
      energy: kit.energyInitial,
      drain,
      slowEnemy,
      slowProjectile,
      active: true,
      conflict: false,
      barrierHp: 100,
      barrierMaxHp: 100,
    };

    if (domain.character === "yuta") {
      domain.copiedCharacter = null;
      this.server.players.forEach((p) => {
        if (p.id === player.id || !p.alive) return;
        const d = distance(p.x, p.y, player.x, player.y);
        if (d <= domain.radius) {
          domain.copiedCharacter = p.character;
        }
      });
    }

    this.domains.set(player.id, domain);
    this.server.emitEventAll({
      type: "domainStart",
      x: player.x,
      y: player.y,
      ownerId: player.id,
      radius,
      copiedCharacter: domain.copiedCharacter,
    });
    return true;
  }

  getKitByDomain(domain) {
    const kit = CHARACTER_REGISTRY[domain.character];
    return kit ? kit.domain : GOJO.domain;
  }

  isSkillLocked() {
    return this.domains.size > 0;
  }

  isSkillLockedForPlayer(player) {
    if (!player || !player.alive) {
      return false;
    }

    let locked = false;
    this.domains.forEach((domain) => {
      if (locked) {
        return;
      }
      if (domain.character !== "gojo") {
        return;
      }
      if (domain.ownerId === player.id) {
        return;
      }
      const owner = this.server.players.get(domain.ownerId);
      if (!owner || !owner.alive) {
        return;
      }
      const d = distance(player.x, player.y, domain.x, domain.y);
      if (d <= domain.radius) {
        locked = true;
      }
    });
    return locked;
  }

  hasActiveDomain(playerId) {
    return this.domains.has(playerId);
  }

  update(dt) {
    this.domains.forEach((domain) => {
      const owner = this.server.players.get(domain.ownerId);
      if (!owner || !owner.alive || owner.energy <= 0) {
        this.collapseDomain(domain.ownerId, null, true);
        return;
      }
      domain.conflict = false;
      domain.energy -= domain.drain * dt;
      owner.energy -= domain.drain * 4 * dt;

      const durationMul = owner.modifiers.domainDurationMul;
      if (durationMul > 1) {
        domain.energy += (durationMul - 1) * 0.75 * dt;
      }
    });

    const list = Array.from(this.domains.values());
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const d = distance(a.x, a.y, b.x, b.y);
        if (d <= a.radius + b.radius) {
          a.conflict = true;
          b.conflict = true;
          const kitA = this.getKitByDomain(a);
          const kitB = this.getKitByDomain(b);
          a.energy -= kitA.conflictExtraDrain * dt;
          b.energy -= kitB.conflictExtraDrain * dt;
          const ownerA = this.server.players.get(a.ownerId);
          const ownerB = this.server.players.get(b.ownerId);
          if (ownerA) ownerA.energy -= kitA.conflictExtraDrain * 2 * dt;
          if (ownerB) ownerB.energy -= kitB.conflictExtraDrain * 2 * dt;
          const powerA = a.energy * (ownerA ? ownerA.modifiers.domainPowerMul : 1);
          const powerB = b.energy * (ownerB ? ownerB.modifiers.domainPowerMul : 1);
          if (powerA > powerB) {
            b.energy -= 3.5 * dt;
          } else if (powerB > powerA) {
            a.energy -= 3.5 * dt;
          }
        }
      }
    }

    this.domains.forEach((domain) => {
      if (domain.energy <= 0) {
        const winner = this.findConflictWinner(domain);
        this.collapseDomain(domain.ownerId, winner, Boolean(winner));
      }
    });

    this.applyDomainFreezeEffects(dt);
    this.applyDomainPlayerEffects(dt);
  }

  applyDomainPlayerEffects(dt) {
    if (this.domains.size === 0) return;
    this.server.players.forEach((targetPlayer) => {
      if (!targetPlayer.alive) return;
      this.domains.forEach((domain) => {
        if (domain.ownerId === targetPlayer.id) return;
        const owner = this.server.players.get(domain.ownerId);
        if (!owner || !owner.alive) return;
        const d = distance(targetPlayer.x, targetPlayer.y, domain.x, domain.y);
        if (d <= domain.radius) {
          targetPlayer.vx *= 0.5;
          targetPlayer.vy *= 0.5;
          this.server.combat.applyDamage({
            target: targetPlayer,
            source: owner,
            amount: (this.getKitByDomain(domain).freezeDps || 0) * 0.6 * dt,
            kind: "domainFreeze",
            fromX: domain.x,
            fromY: domain.y,
          });
          this.server.emitEventNear(targetPlayer.x, targetPlayer.y, {
            type: "freezeTick",
            x: targetPlayer.x,
            y: targetPlayer.y,
          });
        }
      });
    });
  }

  applyDomainFreezeEffects(dt) {
    if (this.domains.size === 0) {
      return;
    }

    this.server.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }

      let sourceDomain = null;
      let bestDist = Number.POSITIVE_INFINITY;
      this.domains.forEach((domain) => {
        const owner = this.server.players.get(domain.ownerId);
        if (!owner || !owner.alive) {
          return;
        }
        const d = distance(enemy.x, enemy.y, domain.x, domain.y);
        if (d <= domain.radius + enemy.radius && d < bestDist) {
          bestDist = d;
          sourceDomain = domain;
        }
      });

      if (!sourceDomain) {
        return;
      }

      const kit = this.getKitByDomain(sourceDomain);
      enemy.freezeTimer = Math.max(enemy.freezeTimer, kit.freezePersistSec || 0);
      const owner = this.server.players.get(sourceDomain.ownerId) || null;
      this.server.combat.applyDamage({
        target: enemy,
        source: owner,
        amount: (kit.freezeDps || 0) * dt,
        kind: "domainFreeze",
        fromX: sourceDomain.x,
        fromY: sourceDomain.y,
      });

      const barrierDamage = (enemy.type === "boss" ? 6 : enemy.type === "elite" ? 3 : 1) * dt;
      this.damageBarrier(sourceDomain.ownerId, barrierDamage);
    });
  }

  findConflictWinner(domain) {
    let winner = null;
    let winnerPower = 0;
    const owner = this.server.players.get(domain.ownerId);
    if (!owner) {
      return null;
    }
    this.domains.forEach((other) => {
      if (other.ownerId === domain.ownerId) {
        return;
      }
      const d = distance(domain.x, domain.y, other.x, other.y);
      if (d > domain.radius + other.radius) {
        return;
      }
      const otherOwner = this.server.players.get(other.ownerId);
      const power = other.energy * (otherOwner ? otherOwner.modifiers.domainPowerMul : 1);
      if (power > winnerPower) {
        winnerPower = power;
        winner = other.ownerId;
      }
    });
    return winner;
  }

  collapseDomain(ownerId, winnerId, byConflict) {
    const domain = this.domains.get(ownerId);
    if (!domain) {
      return;
    }
    this.domains.delete(ownerId);

    const owner = this.server.players.get(ownerId);
    if (owner) {
      owner.domainExhaustionTimer = 10;
      if (byConflict) {
        const kit = this.getKitByDomain(domain);
        owner.stunTimer = Math.max(owner.stunTimer, kit.collapseStun);
        owner.cooldowns.f = Math.max(owner.cooldowns.f, kit.cooldown * 0.5);
      }
    }

    this.server.emitEventAll({
      type: "domainCollapse",
      x: domain.x,
      y: domain.y,
      ownerId,
      winnerId,
      byConflict,
      broken: domain.barrierHp <= 0,
    });
  }

  damageBarrier(ownerId, amount) {
    const domain = this.domains.get(ownerId);
    if (!domain) return;
    domain.barrierHp = Math.max(0, domain.barrierHp - amount);
    if (domain.barrierHp <= 0) {
      this.collapseDomain(ownerId, null, false);
    }
  }

  getEnemySlowAt(enemyX, enemyY, enemyId) {
    let factor = 1;
    this.domains.forEach((domain) => {
      const owner = this.server.players.get(domain.ownerId);
      if (!owner || !owner.alive) {
        return;
      }
      const d = distance(enemyX, enemyY, domain.x, domain.y);
      if (d <= domain.radius) {
        factor *= Math.max(0.25, 1 - domain.slowEnemy);
      }
    });
    return factor;
  }

  getPlayerSlowFactor(player) {
    let result = 1;
    this.domains.forEach((domain) => {
      if (domain.ownerId === player.id) return;
      const d = distance(player.x, player.y, domain.x, domain.y);
      if (d <= domain.radius) {
        result = 0;
      }
    });
    return result;
  }

  getProjectileSlow(projectile) {
    let factor = 1;
    this.domains.forEach((domain) => {
      const d = distance(projectile.x, projectile.y, domain.x, domain.y);
      if (d <= domain.radius) {
        const ownerId = domain.ownerId;
        if (projectile.ownerKind === "enemy" || projectile.ownerId !== ownerId) {
          factor *= Math.max(0.1, 1 - domain.slowProjectile);
        }
      }
    });
    return factor;
  }

  toSnapshot() {
    return Array.from(this.domains.values()).map((domain) => ({
      id: domain.id,
      ownerId: domain.ownerId,
      x: Math.round(domain.x),
      y: Math.round(domain.y),
      radius: Math.round(domain.radius),
      energy: Number(domain.energy.toFixed(1)),
      conflict: domain.conflict,
      barrierHp: Math.round(domain.barrierHp),
      barrierMaxHp: domain.barrierMaxHp,
    }));
  }
}

module.exports = {
  DomainSystem,
};
