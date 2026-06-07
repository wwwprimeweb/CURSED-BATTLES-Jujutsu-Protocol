"use strict";

const { distance, normalize } = require("../utils/math");

function predictPosition(enemy, target, lookAhead = 0.35) {
  const px = target.x + (target.vx || 0) * lookAhead;
  const py = target.y + (target.vy || 0) * lookAhead;
  return { x: px, y: py };
}

function updateGrade1(enemy, target, dist, dt, gameState, pressuringBarrier) {
  const predicted = predictPosition(enemy, target, 0.35);
  const dir = normalize(predicted.x - enemy.x, predicted.y - enemy.y);
  const slowFactor = gameState.getEnemySlowFactor(enemy);
  const speed = enemy.speed * slowFactor;
  const idealDist = 140;

  if (pressuringBarrier && dist <= enemy.attackRange * 0.85) {
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.state = "pressureBarrier";
    return;
  }

  const dodgeInterval = 1.8;
  if (enemy.aiTimer % (dodgeInterval * 2) > dodgeInterval * 1.5) {
    const evadeAngle = (enemy.aiOrbitDir || 1) * Math.PI * 0.4;
    const evadeX = Math.cos(Math.atan2(dir.y, dir.x) + evadeAngle);
    const evadeY = Math.sin(Math.atan2(dir.y, dir.x) + evadeAngle);
    enemy.vx = evadeX * speed * 1.2;
    enemy.vy = evadeY * speed * 1.2;
    enemy.state = "evade";
    return;
  }

  if (dist > idealDist + 40) {
    enemy.vx = dir.x * speed;
    enemy.vy = dir.y * speed;
  } else if (dist < idealDist - 20) {
    enemy.vx = -dir.x * speed * 0.7;
    enemy.vy = -dir.y * speed * 0.7;
  } else {
    const strafeAngle = (enemy.aiOrbitDir || 1) * Math.PI * 0.5;
    const strafeX = Math.cos(Math.atan2(dir.y, dir.x) + strafeAngle);
    const strafeY = Math.sin(Math.atan2(dir.y, dir.x) + strafeAngle);
    enemy.vx = strafeX * speed * 0.6;
    enemy.vy = strafeY * speed * 0.6;
  }

  enemy.state = pressuringBarrier ? "pressureBarrier" : "hunt";
}

module.exports = { updateGrade1 };
