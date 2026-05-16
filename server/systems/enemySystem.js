"use strict";

const { createEnemy } = require("../entities/enemy");
const { distance, normalize } = require("../utils/math");

class EnemySystem {
  constructor(server) {
    this.server = server;
    this.spawnTimer = 0;
    this.bossSpawned = false;
  }

  phaseName(elapsedSec) {
    const timings = this.server.config.match.phaseTimings;
    if (elapsedSec < timings.early) {
      return "early";
    }
    if (elapsedSec < timings.mid) {
      return "mid";
    }
    if (elapsedSec < timings.late) {
      return "late";
    }
    return "final";
  }

  phaseScale(elapsedSec) {
    if (elapsedSec < this.server.config.match.phaseTimings.early) {
      return 1;
    }
    if (elapsedSec < this.server.config.match.phaseTimings.mid) {
      return 1.2;
    }
    if (elapsedSec < this.server.config.match.phaseTimings.late) {
      return 1.4;
    }
    return 1.7;
  }

  update(dt, elapsedSec) {
    const phase = this.phaseName(elapsedSec);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnWave(phase, elapsedSec);
    }

    this.server.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      enemy.windupTimer = Math.max(0, enemy.windupTimer - dt);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.freezeTimer = Math.max(0, enemy.freezeTimer - dt);
      enemy.freezeFxTimer = Math.max(0, enemy.freezeFxTimer - dt);

      if (enemy.freezeTimer > 0) {
        enemy.vx = 0;
        enemy.vy = 0;
        enemy.windupTimer = 0;
        enemy.state = "frozen";
        if (enemy.freezeFxTimer <= 0) {
          enemy.freezeFxTimer = 0.28 + this.server.rng.range(0, 0.12);
          this.server.emitEventNear(enemy.x, enemy.y, {
            type: "freezeTick",
            x: enemy.x,
            y: enemy.y,
            enemyId: enemy.id,
          });
        }
        return;
      }

      enemy.aiTimer += dt;
      enemy.bossPatternTimer += dt;

      const target = this.findNearestPlayer(enemy.x, enemy.y);
      if (!target) {
        enemy.vx = 0;
        enemy.vy = 0;
        return;
      }

      enemy.targetId = target.id;

      if (enemy.windupTimer > 0) {
        if (enemy.windupTimer <= 0.02) {
          this.executeAttack(enemy, target);
        }
        return;
      }

      const dist = distance(enemy.x, enemy.y, target.x, target.y);
      const canAttack = dist <= enemy.attackRange + target.radius;

      if (enemy.type === "caster") {
        this.updateCaster(enemy, target, dist, dt);
      } else if (enemy.type === "boss") {
        this.updateBoss(enemy, target, dist, dt);
      } else {
        this.updateMelee(enemy, target, dist, dt);
      }

      if (canAttack && enemy.attackCooldown <= 0) {
        enemy.windupTimer = enemy.attackWindup;
        enemy.state = "windup";
        this.server.emitEventNear(enemy.x, enemy.y, {
          type: "telegraph",
          x: enemy.x,
          y: enemy.y,
          radius: enemy.attackRange,
          style: enemy.type,
        });
      }

      this.server.moveEntityWithCollisions(enemy, enemy.vx * dt, enemy.vy * dt);
    });
  }

  updateMelee(enemy, target, dist) {
    const dir = normalize(target.x - enemy.x, target.y - enemy.y);
    const slowFactor = this.server.getEnemySlowFactor(enemy);
    const speed = enemy.speed * slowFactor;
    enemy.vx = dir.x * speed;
    enemy.vy = dir.y * speed;

    if (enemy.type === "stalker" && dist > 70 && enemy.attackCooldown <= 0.2) {
      enemy.vx *= 1.35;
      enemy.vy *= 1.35;
    }
    enemy.state = "chase";
  }

  updateCaster(enemy, target, dist) {
    const dir = normalize(target.x - enemy.x, target.y - enemy.y);
    const slowFactor = this.server.getEnemySlowFactor(enemy);
    const desired = 280;
    if (dist > desired + 40) {
      enemy.vx = dir.x * enemy.speed * slowFactor;
      enemy.vy = dir.y * enemy.speed * slowFactor;
    } else if (dist < desired - 30) {
      enemy.vx = -dir.x * enemy.speed * 0.85 * slowFactor;
      enemy.vy = -dir.y * enemy.speed * 0.85 * slowFactor;
    } else {
      enemy.vx = 0;
      enemy.vy = 0;
    }
    enemy.state = "kite";
  }

  updateBoss(enemy, target, dist) {
    const dir = normalize(target.x - enemy.x, target.y - enemy.y);
    const slowFactor = this.server.getEnemySlowFactor(enemy);
    const speed = enemy.speed * slowFactor;

    if (dist > 180) {
      enemy.vx = dir.x * speed;
      enemy.vy = dir.y * speed;
    } else {
      enemy.vx = 0;
      enemy.vy = 0;
    }

    if (enemy.bossPatternTimer >= 4.5 && enemy.attackCooldown <= 0) {
      enemy.bossPatternTimer = 0;
      const roll = this.server.rng.next();
      if (roll < 0.5) {
        this.castBossSlam(enemy, target);
      } else {
        this.castBossVolley(enemy);
      }
      enemy.attackCooldown = 2.5;
    }
    enemy.state = "boss";
  }

  executeAttack(enemy, target) {
    enemy.windupTimer = 0;
    enemy.attackCooldown = enemy.attackCooldownBase;

    if (enemy.type === "caster") {
      const dir = normalize(target.x - enemy.x, target.y - enemy.y);
      this.server.spawnEnemyProjectile({
        type: "enemy_orb",
        x: enemy.x + dir.x * (enemy.radius + 6),
        y: enemy.y + dir.y * (enemy.radius + 6),
        dirX: dir.x,
        dirY: dir.y,
        speed: 300,
        radius: 14,
        lifetime: 2.1,
        damage: enemy.damage,
      });
      this.server.emitEventNear(enemy.x, enemy.y, {
        type: "enemyCast",
        x: enemy.x,
        y: enemy.y,
      });
      return;
    }

    if (enemy.type === "boss") {
      this.server.combat.applyDamage({
        target,
        source: enemy,
        amount: enemy.damage,
        kind: "bossMelee",
        knockback: 280,
        fromX: enemy.x,
        fromY: enemy.y,
      });
      return;
    }

    if (!target.alive) {
      return;
    }
    const dist = distance(enemy.x, enemy.y, target.x, target.y);
    if (dist <= enemy.attackRange + target.radius + 14) {
      this.server.combat.applyDamage({
        target,
        source: enemy,
        amount: enemy.damage,
        kind: "enemyMelee",
        knockback: enemy.type === "elite" ? 220 : 150,
        fromX: enemy.x,
        fromY: enemy.y,
      });
    }
  }

  castBossSlam(enemy, target) {
    const slamX = target.x;
    const slamY = target.y;
    const radius = 120;
    this.server.queueDelayedAction(0.85, () => {
      this.server.players.forEach((player) => {
        if (!player.alive) {
          return;
        }
        const d = distance(player.x, player.y, slamX, slamY);
        if (d <= radius + player.radius) {
          this.server.combat.applyDamage({
            target: player,
            source: enemy,
            amount: 82,
            kind: "bossSlam",
            knockback: 420,
            fromX: slamX,
            fromY: slamY,
          });
        }
      });
      this.server.emitEventAll({
        type: "bossSlamImpact",
        x: slamX,
        y: slamY,
        radius,
      });
    });

    this.server.emitEventAll({
      type: "bossSlamTelegraph",
      x: slamX,
      y: slamY,
      radius,
      delay: 0.85,
    });
  }

  castBossVolley(enemy) {
    const shots = 10;
    for (let i = 0; i < shots; i += 1) {
      const angle = (Math.PI * 2 * i) / shots;
      this.server.spawnEnemyProjectile({
        type: "enemy_orb",
        x: enemy.x + Math.cos(angle) * (enemy.radius + 6),
        y: enemy.y + Math.sin(angle) * (enemy.radius + 6),
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
        speed: 260,
        radius: 12,
        lifetime: 2.7,
        damage: 28,
      });
    }
    this.server.emitEventAll({
      type: "bossVolley",
      x: enemy.x,
      y: enemy.y,
    });
  }

  findNearestPlayer(x, y) {
    let nearest = null;
    let bestDist = Number.POSITIVE_INFINITY;
    this.server.players.forEach((player) => {
      if (!player.alive) {
        return;
      }
      const d = distance(player.x, player.y, x, y);
      if (d < bestDist) {
        bestDist = d;
        nearest = player;
      }
    });
    return nearest;
  }

  isWeakType(type) {
    return type === "shade" || type === "stalker" || type === "rotten_husk" || type === "cursed_runner";
  }

  isStrongType(type) {
    return (
      type === "caster" ||
      type === "elite" ||
      type === "bone_spearer" ||
      type === "void_priest" ||
      type === "abyss_howler" ||
      type === "chaos_executioner"
    );
  }

  countAliveWeakEnemies() {
    let total = 0;
    this.server.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      if (this.isWeakType(enemy.type)) {
        total += 1;
      }
    });
    return total;
  }

  countAliveStrongEnemies() {
    let total = 0;
    this.server.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      if (this.isStrongType(enemy.type)) {
        total += 1;
      }
    });
    return total;
  }

  spawnWave(phase, elapsedSec) {
    const alivePlayers = this.server.countAlivePlayers();
    if (alivePlayers === 0) {
      this.spawnTimer = 1;
      return;
    }

    let spawnCount = 1;
    let interval = 1.5;
    let weakCap = 10;
    let strongCap = 3;
    let totalCap = 16;
    const scale = this.phaseScale(elapsedSec);

    if (phase === "early") {
      spawnCount = 1;
      interval = 1.7;
      weakCap = 7;
      strongCap = 1;
      totalCap = 9;
    } else if (phase === "mid") {
      spawnCount = 2;
      interval = 1.35;
      weakCap = 9;
      strongCap = 3;
      totalCap = 15;
    } else if (phase === "late") {
      spawnCount = 2;
      interval = 1.05;
      weakCap = 10;
      strongCap = 4;
      totalCap = 18;
    } else {
      spawnCount = 3;
      interval = 0.9;
      weakCap = 10;
      strongCap = 5;
      totalCap = 22;
      if (!this.bossSpawned) {
        this.bossSpawned = true;
        this.spawnEnemy("boss", scale * 1.05);
        this.server.emitEventAll({
          type: "bossSpawn",
          x: this.server.map.width * 0.5,
          y: this.server.map.height * 0.5,
        });
      }
    }

    let weakAlive = this.countAliveWeakEnemies();
    let strongAlive = this.countAliveStrongEnemies();
    let totalAlive = this.server.enemies.size;

    for (let i = 0; i < spawnCount; i += 1) {
      if (totalAlive >= totalCap) {
        break;
      }

      let type = "stalker";
      const roll = this.server.rng.next();
      if (phase === "early") {
        type = roll < 0.58 ? "shade" : "stalker";
      } else if (phase === "mid") {
        if (roll < 0.35) type = "shade";
        else if (roll < 0.7) type = "stalker";
        else type = "caster";
      } else if (phase === "late") {
        if (roll < 0.2) type = "shade";
        else if (roll < 0.45) type = "stalker";
        else if (roll < 0.8) type = "caster";
        else type = "elite";
      } else {
        if (roll < 0.1) type = "shade";
        else if (roll < 0.25) type = "stalker";
        else if (roll < 0.7) type = "caster";
        else type = "elite";
      }

      if (this.isWeakType(type) && weakAlive >= weakCap) {
        if (phase === "early") {
          continue;
        }
        if (strongAlive < strongCap) {
          type = this.server.rng.next() < 0.58 ? "caster" : "elite";
        } else {
          continue;
        }
      }

      if (this.isStrongType(type) && strongAlive >= strongCap) {
        if (weakAlive < weakCap) {
          type = this.server.rng.next() < 0.5 ? "shade" : "stalker";
        } else {
          continue;
        }
      }

      this.spawnEnemy(type, scale);
      if (this.isWeakType(type)) {
        weakAlive += 1;
      }
      if (this.isStrongType(type)) {
        strongAlive += 1;
      }
      totalAlive += 1;
    }

    this.spawnTimer = interval;
  }

  spawnEnemy(type, scale) {
    const pos = this.server.getSpawnEdgePoint();
    const id = `e${this.server.nextEnemyId++}`;
    const enemy = createEnemy(id, type, pos.x, pos.y, scale);
    this.server.enemies.set(id, enemy);
  }
}

module.exports = {
  EnemySystem,
};
