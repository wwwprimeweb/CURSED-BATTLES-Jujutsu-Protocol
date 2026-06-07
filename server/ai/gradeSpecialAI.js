"use strict";

const { distance, normalize } = require("../utils/math");

function predictPosition(enemy, target, lookAhead = 0.5) {
  const px = target.x + (target.vx || 0) * lookAhead;
  const py = target.y + (target.vy || 0) * lookAhead;
  return { x: px, y: py };
}

function updateGradeSpecial(enemy, target, dist, dt, gameState, pressuringBarrier) {
  const predicted = predictPosition(enemy, target, 0.5);
  const dir = normalize(predicted.x - enemy.x, predicted.y - enemy.y);
  const slowFactor = gameState.getEnemySlowFactor(enemy);
  const speed = enemy.speed * slowFactor;
  const desired = pressuringBarrier ? Math.max(24, enemy.attackRange * 0.45) : 180;

  const hpRatio = enemy.hp / enemy.maxHp;
  if (hpRatio < 0.3 && !enemy.isRaged) {
    enemy.isRaged = true;
  }

  const currentSpeed = enemy.isRaged ? speed * 1.35 : speed;

  if (dist > desired) {
    enemy.vx = dir.x * currentSpeed;
    enemy.vy = dir.y * currentSpeed;
  } else {
    enemy.vx = 0;
    enemy.vy = 0;
  }

  const phase = hpRatio < 0.3 ? 3 : hpRatio < 0.6 ? 2 : 1;
  enemy.phase = phase;

  if (enemy.bossPatternTimer >= 3.5 && enemy.attackCooldown <= 0) {
    enemy.bossPatternTimer = 0;
    const roll = gameState.rng.next();
    if (phase <= 1) {
      if (roll < 0.5) {
        gameState.castBossSlamProxy(enemy, target);
      } else {
        gameState.castBossVolleyProxy(enemy);
      }
    } else {
      gameState.castBossSlamProxy(enemy, target);
      gameState.castBossVolleyProxy(enemy);
    }
    enemy.attackCooldown = 2.0;
  }

  enemy.state = pressuringBarrier ? "pressureBarrier" : "boss";
}

module.exports = { updateGradeSpecial };
