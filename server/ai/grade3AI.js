"use strict";

const { distance, normalize } = require("../utils/math");

function updateGrade3(enemy, target, dist, dt, gameState, pressuringBarrier) {
  const dir = normalize(target.x - enemy.x, target.y - enemy.y);
  const slowFactor = gameState.getEnemySlowFactor(enemy);
  let speed = enemy.speed * slowFactor;

  if (enemy.type === "crawler_baby") {
    let nearbyBabies = 0;
    gameState.server.enemies.forEach((other) => {
      if (!other.alive || other.id === enemy.id) return;
      if (other.type === "crawler_baby" && distance(enemy.x, enemy.y, other.x, other.y) <= 250) {
        nearbyBabies += 1;
      }
    });
    if (nearbyBabies >= 3) {
      speed *= 1.25;
    }
  }

  if (pressuringBarrier && dist <= Math.max(10, enemy.attackRange * 0.55)) {
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.state = "pressureBarrier";
    return;
  }

  enemy.vx = dir.x * speed;
  enemy.vy = dir.y * speed;

  enemy.state = pressuringBarrier ? "pressureBarrier" : "chase";
}

module.exports = { updateGrade3 };
