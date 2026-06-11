"use strict";

const { createEnemy } = require("../entities/enemy");
const { getEnemyDef, getAllByGrade } = require("../entities/enemyRegistry");
const { updateAI } = require("../ai/index");
const { distance, normalize, circleIntersectsRect } = require("../utils/math");

class EnemySystem {
  constructor(server) {
    this.server = server;
    this.spawnTimer = 0;
    this.bossSpawned = false;
    this.acidZones = [];
  }

  get rng() {
    return this.server.rng;
  }

  phaseName(elapsedSec) {
    const override = this.server.config.debug.overridePhase;
    if (override) return override;
    const timings = this.server.config.match.phaseTimings;
    if (elapsedSec < timings.early) return "early";
    if (elapsedSec < timings.mid) return "mid";
    if (elapsedSec < timings.late) return "late";
    return "final";
  }

  phaseScale(elapsedSec) {
    const timings = this.server.config.match.phaseTimings;
    if (elapsedSec < timings.early) return 1;
    if (elapsedSec < timings.mid) return 1.2;
    if (elapsedSec < timings.late) return 1.4;
    return 1.7;
  }

  update(dt, elapsedSec) {
    const phase = this.phaseName(elapsedSec);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnWave(phase, elapsedSec);
    }

    for (let i = this.acidZones.length - 1; i >= 0; i--) {
      const zone = this.acidZones[i];
      zone.timer -= dt;
      if (zone.timer <= 0) {
        this.acidZones.splice(i, 1);
        continue;
      }
      this.server.players.forEach((player) => {
        if (!player.alive) return;
        if (distance(zone.x, zone.y, player.x, player.y) <= zone.radius + player.radius) {
          this.server.combat.applyDamage({
            target: player,
            amount: zone.dps * dt,
            kind: "acid",
          });
        }
      });
    }

    this.server.enemies.forEach((enemy) => {
      if (!enemy.alive) return;

      if (enemy.dying) {
        enemy.deathTimer -= dt;
        const intensity = enemy.deathTimer > 1.0 ? 0.3 : enemy.deathTimer > 0.5 ? 0.6 : 1.0;
        this.server.emitEventNear(enemy.x, enemy.y, {
          type: "crawlerTremor",
          x: enemy.x,
          y: enemy.y,
          intensity,
          enemyId: enemy.id,
        });
        if (enemy.deathTimer <= 0) {
          this.server.emitEventNear(enemy.x, enemy.y, {
            type: "crawlerExplosion",
            x: enemy.x,
            y: enemy.y,
            radius: 160,
          });
          this.server.players.forEach((player) => {
            if (!player.alive) return;
            const d = distance(enemy.x, enemy.y, player.x, player.y);
            if (d <= 160 + player.radius) {
              this.server.combat.applyDamage({
                target: player,
                source: enemy,
                amount: 40,
                kind: "enemyMelee",
                knockback: 200,
                fromX: enemy.x,
                fromY: enemy.y,
              });
            }
          });
          for (let j = 0; j < 3; j++) {
            this.spawnEnemyNear("crawler_baby", enemy, 30);
          }
          if (enemy.killedBy && enemy.killedBy.kind === "player") {
            enemy.killedBy.kills += 1;
            if (enemy.killedBy.modifiers.sustainOnKill > 0) {
              enemy.killedBy.hp = Math.min(enemy.killedBy.maxHp, enemy.killedBy.hp + enemy.killedBy.modifiers.sustainOnKill);
            }
            this.server.progression.grantXp(enemy.killedBy, enemy.xpReward);
          }
          enemy.alive = false;
          enemy.vx = 0;
          enemy.vy = 0;
          this.server.enemies.delete(enemy.id);
          this.server.emitEventNear(enemy.x, enemy.y, {
            type: "enemyDeath",
            x: enemy.x,
            y: enemy.y,
            enemyType: enemy.type,
          });
        }
        return;
      }

      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      enemy.windupTimer = Math.max(0, enemy.windupTimer - dt);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.freezeTimer = Math.max(0, enemy.freezeTimer - dt);
      enemy.freezeFxTimer = Math.max(0, enemy.freezeFxTimer - dt);

      const enemyRegenConfig = {
        1:       { delay: 12000, rate: 0.03 },
        special: { delay: 8000,  rate: 0.025 },
      };
      const regenCfg = enemyRegenConfig[enemy.grade];
      if (regenCfg) {
        const timeSinceDamageMs = (this.server.now - (enemy.lastDamageTaken || -Infinity)) * 1000;
        if (timeSinceDamageMs > regenCfg.delay) {
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * regenCfg.rate * dt);
        }
      }

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

      if (enemy.isCharging) {
        enemy.chargeTimer -= dt;
        this.server.players.forEach((player) => {
          if (!player.alive) return;
          const d = distance(enemy.x, enemy.y, player.x, player.y);
          if (d < enemy.radius + player.radius) {
            this.server.combat.applyDamage({
              target: player,
              source: enemy,
              amount: enemy.damage,
              kind: "enemyMelee",
              knockback: 250,
              fromX: enemy.x,
              fromY: enemy.y,
            });
            enemy.isCharging = false;
            enemy.chargeTimer = 0;
            enemy.vx = 0;
            enemy.vy = 0;
          }
        });
        if (enemy.chargeTimer <= 0) {
          enemy.isCharging = false;
          enemy.vx = 0;
          enemy.vy = 0;
        }
        this.server.moveEntityWithCollisions(enemy, enemy.vx * dt, enemy.vy * dt);
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

      const barrierContext = this.getDomainBarrierContext(enemy, target);
      const isTargetProtected = Boolean(barrierContext);

      const targetPoint = isTargetProtected
        ? { x: barrierContext.chaseX, y: barrierContext.chaseY, radius: 0 }
        : target;

      if (enemy.windupTimer > 0) {
        if (enemy.type === "crawler_nest") {
          if (enemy.windupTimer <= 0.02) {
            enemy.windupTimer = 0;
            enemy.attackCooldown = enemy.attackCooldownBase;
            enemy.isCharging = true;
            enemy.chargeTimer = 0.35;
            const chargeDir = normalize(targetPoint.x - enemy.x, targetPoint.y - enemy.y);
            enemy.vx = chargeDir.x * 400;
            enemy.vy = chargeDir.y * 400;
          }
          return;
        }

        if (enemy.windupTimer <= 0.02) {
          this.executeAttack(enemy, target, barrierContext);
        }
        return;
      }

      const dist = distance(enemy.x, enemy.y, targetPoint.x, targetPoint.y);
      const canAttackTarget = !isTargetProtected && dist <= enemy.attackRange + target.radius;
      const canAttackBarrier = isTargetProtected && barrierContext.distToBarrier <= enemy.attackRange + 8;
      const canAttack = canAttackTarget || canAttackBarrier;

      updateAI(enemy, targetPoint, dist, dt, this, isTargetProtected);

      if (canAttack && enemy.attackCooldown <= 0) {
        enemy.windupTimer = enemy.attackWindup;
        enemy.state = "windup";
        const telegraphX = canAttackBarrier ? barrierContext.hitX : enemy.x;
        const telegraphY = canAttackBarrier ? barrierContext.hitY : enemy.y;
        this.server.emitEventNear(enemy.x, enemy.y, {
          type: "telegraph",
          x: telegraphX,
          y: telegraphY,
          radius: enemy.attackRange,
          style: canAttackBarrier ? "barrier" : "enemy",
          enemyType: enemy.type,
        });
      }

      const avoid = this.avoidObstacles(enemy);
      if (avoid) {
        const currentSpeed = Math.sqrt(enemy.vx ** 2 + enemy.vy ** 2);
        const blend = currentSpeed > 5 ? 0.55 : 0;
        if (blend > 0) {
          enemy.vx = enemy.vx * (1 - blend) + avoid.steerX * currentSpeed * blend;
          enemy.vy = enemy.vy * (1 - blend) + avoid.steerY * currentSpeed * blend;
        }
      }

      if (enemy.type === "crawler_nest") {
        enemy.nestSpawnTimer = (enemy.nestSpawnTimer || 0) + dt;
        if (enemy.nestSpawnTimer >= 3.0 && this.countAliveByGrade(3) < 12) {
          enemy.nestSpawnTimer = 0;
          this.spawnEnemyNear("crawler_baby", enemy, 40);
        }
        let babiesNear = 0;
        this.server.enemies.forEach((other) => {
          if (!other.alive || other.id === enemy.id) return;
          if (other.type === "crawler_baby" && distance(enemy.x, enemy.y, other.x, other.y) <= 350) {
            babiesNear += 1;
          }
        });
        enemy.protectionReduction = babiesNear >= 3 ? 0.3 : 0;
      }

      this.server.moveEntityWithCollisions(enemy, enemy.vx * dt, enemy.vy * dt);
    });
  }

  getDomainBarrierContext(enemy, target) {
    if (!target || typeof this.server.findFirstDomainBarrierIntersection !== "function") {
      return null;
    }

    const hit = this.server.findFirstDomainBarrierIntersection(enemy.x, enemy.y, target.x, target.y);
    if (!hit || !hit.domain) return null;

    let dir = normalize(hit.x - enemy.x, hit.y - enemy.y);
    if (dir.len <= 0.0001) {
      dir = normalize(hit.x - hit.domain.x, hit.y - hit.domain.y);
    }

    const standOff = Math.max(6, Math.min(22, enemy.attackRange * 0.4));
    const chaseX = hit.x - dir.x * standOff;
    const chaseY = hit.y - dir.y * standOff;

    return {
      domain: hit.domain,
      hitX: hit.x,
      hitY: hit.y,
      chaseX,
      chaseY,
      distToBarrier: distance(enemy.x, enemy.y, hit.x, hit.y),
    };
  }

  getEnemySlowFactor(enemy) {
    return this.server.getEnemySlowFactor(enemy);
  }

  getBarrierAttackDamage(enemy) {
    const base = Math.max(4, enemy.damage * 0.48);
    const def = getEnemyDef(enemy.type);
    if (def && def.behaviors && def.behaviors.barrierDamage != null) {
      return base * def.behaviors.barrierDamage;
    }
    if (enemy.grade === "special") return base * 1.65;
    if (enemy.grade === 1) return base * 1.4;
    if (enemy.grade === 2) return base * 1.15;
    return base;
  }

  executeAttack(enemy, target, barrierContext = null) {
    enemy.windupTimer = 0;
    enemy.attackCooldown = enemy.attackCooldownBase;

    if ((!target || !target.alive) && !barrierContext) return;

    const def = getEnemyDef(enemy.type);
    const isRanged = def && def.tags && def.tags.includes("ranged");

    if (isRanged) {
      const aimX = barrierContext ? barrierContext.hitX : target.x;
      const aimY = barrierContext ? barrierContext.hitY : target.y;
      const dir = normalize(aimX - enemy.x, aimY - enemy.y);
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

    if (barrierContext && barrierContext.domain) {
      this.server.domainSystem.damageBarrier(
        barrierContext.domain.ownerId,
        this.getBarrierAttackDamage(enemy)
      );
      this.server.emitEventNear(barrierContext.hitX, barrierContext.hitY, {
        type: "domainBarrierHit",
        x: barrierContext.hitX,
        y: barrierContext.hitY,
        ownerId: barrierContext.domain.ownerId,
        projectileType: enemy.grade === "special" ? "bossMelee" : "enemyMelee",
        attackerKind: "enemy",
      });
      return;
    }

    if (enemy.grade === "special") {
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

    if (!target.alive) return;

    const dist = distance(enemy.x, enemy.y, target.x, target.y);
    if (dist <= enemy.attackRange + target.radius + 14) {
      const knockbackMap = { 3: 150, 2: 180, 1: 220, special: 280 };
      this.server.combat.applyDamage({
        target,
        source: enemy,
        amount: enemy.damage,
        kind: "enemyMelee",
        knockback: knockbackMap[enemy.grade] || 150,
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
        if (!player.alive) return;
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

  castBossSlamProxy(enemy, target) {
    this.castBossSlam(enemy, target);
  }

  castBossVolleyProxy(enemy) {
    this.castBossVolley(enemy);
  }

  findNearestPlayer(x, y) {
    let nearest = null;
    let bestDist = Number.POSITIVE_INFINITY;
    this.server.players.forEach((player) => {
      if (!player.alive) return;
      const d = distance(player.x, player.y, x, y);
      if (d < bestDist) {
        bestDist = d;
        nearest = player;
      }
    });
    return nearest;
  }

  countAliveByGrade(grade) {
    let total = 0;
    this.server.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      if (enemy.grade === grade) total += 1;
    });
    return total;
  }

  getAllTypesByGrade(grade) {
    return getAllByGrade(grade).filter((d) => d.spawnable !== false).map((d) => d.type);
  }

  pickTypeByGrade(grade) {
    const pool = this.getAllTypesByGrade(grade);
    if (pool.length === 0) return null;
    return pool[Math.floor(this.server.rng.next() * pool.length)];
  }

  spawnWave(phase, elapsedSec) {
    const alivePlayers = this.server.countAlivePlayers();
    if (alivePlayers === 0) {
      this.spawnTimer = 1;
      return;
    }

    let spawnCount = 1;
    let interval = 1.5;
    let grade3Cap = 10;
    let grade2Cap = 3;
    let totalCap = 16;
    const scale = this.phaseScale(elapsedSec);

    if (phase === "early") {
      spawnCount = 1;
      interval = 1.7;
      grade3Cap = 7;
      grade2Cap = 1;
      totalCap = 9;
    } else if (phase === "mid") {
      spawnCount = 2;
      interval = 1.35;
      grade3Cap = 9;
      grade2Cap = 3;
      totalCap = 15;
    } else if (phase === "late") {
      spawnCount = 2;
      interval = 1.05;
      grade3Cap = 10;
      grade2Cap = 4;
      totalCap = 18;
    } else {
      spawnCount = 3;
      interval = 0.9;
      grade3Cap = 10;
      grade2Cap = 5;
      totalCap = 22;
      if (!this.bossSpawned) {
        this.bossSpawned = true;
        const bossType = this.pickTypeByGrade("special");
        if (bossType) this.spawnEnemy(bossType, scale * 1.05);
        this.server.emitEventAll({
          type: "bossSpawn",
          x: this.server.map.width * 0.5,
          y: this.server.map.height * 0.5,
        });
      }
    }

    let grade3Alive = this.countAliveByGrade(3);
    let grade2Alive = this.countAliveByGrade(2);
    let totalAlive = this.server.enemies.size;

    const gradeWeights = {
      early: { 3: 1 },
      mid: { 3: 0.7, 2: 0.3 },
      late: { 3: 0.5, 2: 0.4, 1: 0.1 },
      final: { 3: 0.3, 2: 0.4, 1: 0.25, special: 0.05 },
    };

    const weights = gradeWeights[phase] || gradeWeights.final;

    for (let i = 0; i < spawnCount; i += 1) {
      if (totalAlive >= totalCap) break;

      const roll = this.server.rng.next();
      let cumulative = 0;
      let chosenGrade = 3;
      for (const [grade, weight] of Object.entries(weights)) {
        cumulative += weight;
        if (roll < cumulative) {
          chosenGrade = grade === "special" ? "special" : Number(grade);
          break;
        }
      }

      if (chosenGrade === 3 && grade3Alive >= grade3Cap) {
        if (grade2Alive < grade2Cap) {
          chosenGrade = 2;
        } else {
          continue;
        }
      }

      if (chosenGrade === 2 && grade2Alive >= grade2Cap) {
        if (grade3Alive < grade3Cap) {
          chosenGrade = 3;
        } else {
          continue;
        }
      }

      const type = this.pickTypeByGrade(chosenGrade);
      if (!type) continue;

      this.spawnEnemy(type, scale);
      if (chosenGrade === 3) grade3Alive += 1;
      if (chosenGrade === 2) grade2Alive += 1;
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

  spawnEnemyNear(type, source, offset) {
    const angle = this.server.rng.next() * Math.PI * 2;
    const dist = source.radius + offset + this.server.rng.range(5, 15);
    const x = Math.max(20, Math.min(this.server.map.width - 20, source.x + Math.cos(angle) * dist));
    const y = Math.max(20, Math.min(this.server.map.height - 20, source.y + Math.sin(angle) * dist));
    const id = `e${this.server.nextEnemyId++}`;
    const enemy = createEnemy(id, type, x, y, 1);
    this.server.enemies.set(id, enemy);
    this.server.emitEventNear(x, y, {
      type: "crawlerBabySpawn",
      x,
      y,
    });
  }

  spawnAcidPuddle(x, y) {
    this.acidZones.push({
      x,
      y,
      radius: 60,
      dps: 8,
      timer: 4,
    });
    this.server.emitEventNear(x, y, {
      type: "acidPuddle",
      x,
      y,
      radius: 60,
      duration: 4,
      dps: 8,
    });
  }

  avoidObstacles(enemy) {
    const obstacles = this.server.map.obstacles;
    const lookDist = 45 + Math.min(enemy.speed * 0.12, 25);
    const spread = 0.35;

    const dir = normalize(enemy.vx, enemy.vy);
    if (dir.len < 0.01) return null;

    const angles = [0, spread, -spread];
    for (const angle of angles) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const fx = enemy.x + (dir.x * cos - dir.y * sin) * lookDist;
      const fy = enemy.y + (dir.x * sin + dir.y * cos) * lookDist;

      for (const obs of obstacles) {
        if (circleIntersectsRect(fx, fy, enemy.radius, obs)) {
          const cx = obs.x + obs.w * 0.5;
          const cy = obs.y + obs.h * 0.5;
          const dx = enemy.x - cx;
          const dy = enemy.y - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 0.01) return { steerX: dx / d, steerY: dy / d };
        }
      }
    }
    return null;
  }
}

module.exports = {
  EnemySystem,
};
