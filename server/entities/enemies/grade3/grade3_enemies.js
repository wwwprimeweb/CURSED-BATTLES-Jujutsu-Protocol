"use strict";

const { registerEnemy } = require("../../enemyRegistry");

function register() {
  registerEnemy({
    type: "crawler_baby",
    grade: 3,
    spawnable: false,
    tags: ["melee", "enxame"],
    stats: { hp: 30, speed: 220, radius: 12, attackDamage: 8, attackRange: 28, attackCooldown: 1.0, attackStartup: 0.15, xp: 8 },
    onDeath: function (target, server) {
      server.enemySystem.spawnAcidPuddle(target.x, target.y);
      return false;
    },
  });
}

module.exports = { register };
