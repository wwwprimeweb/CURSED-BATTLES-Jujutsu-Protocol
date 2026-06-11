"use strict";

const { distance, normalize } = require("../utils/math");
const { getEnemyDef } = require("../entities/enemyRegistry");

function updateGrade2(enemy, target, dist, dt, gameState, pressuringBarrier) {
  const def = getEnemyDef(enemy.type);
  if (def && def.behaviors && def.behaviors.pureChase) {
    const dir = normalize(target.x - enemy.x, target.y - enemy.y);
    const slowFactor = gameState.getEnemySlowFactor(enemy);
    const speed = enemy.speed * slowFactor;
    if (pressuringBarrier && dist <= Math.max(10, enemy.attackRange * 0.55)) {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.state = "pressureBarrier";
      return;
    }
    enemy.vx = dir.x * speed;
    enemy.vy = dir.y * speed;
    enemy.state = pressuringBarrier ? "pressureBarrier" : "chase";
    return;
  }

  const dir = normalize(target.x - enemy.x, target.y - enemy.y);
  const slowFactor = gameState.getEnemySlowFactor(enemy);
  const speed = enemy.speed * slowFactor;
  const idealDist = 180;

  if (pressuringBarrier && dist <= enemy.attackRange * 0.85) {
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.state = "pressureBarrier";
    return;
  }

  if (dist > idealDist + 40) {
    enemy.vx = dir.x * speed;
    enemy.vy = dir.y * speed;
  } else if (dist < idealDist - 30) {
    enemy.vx = -dir.x * speed * 0.65;
    enemy.vy = -dir.y * speed * 0.65;
  } else {
    const strafeAngle = (enemy.aiOrbitDir || 1) * Math.PI * 0.5;
    const strafeX = Math.cos(Math.atan2(dir.y, dir.x) + strafeAngle);
    const strafeY = Math.sin(Math.atan2(dir.y, dir.x) + strafeAngle);
    enemy.vx = strafeX * speed * 0.5;
    enemy.vy = strafeY * speed * 0.5;
  }

  enemy.state = pressuringBarrier ? "pressureBarrier" : "kite";
}

module.exports = { updateGrade2 };
