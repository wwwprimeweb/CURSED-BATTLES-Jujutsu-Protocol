"use strict";

const { registerEnemy } = require("../../enemyRegistry");

function register() {
  registerEnemy({
    type: "crawler_nest",
    grade: 1,
    tags: ["melee", "nest", "spawner"],
    stats: { hp: 400, speed: 75, radius: 32, attackDamage: 50, attackRange: 250, attackCooldown: 3.0, attackStartup: 0.7, xp: 120 },
    behaviors: { barrierDamage: 1.0 },
    onDeath: function (target, server, source) {
      target.dying = true;
      target.deathTimer = 1.5;
      target.protectionReduction = 0;
      target.killedBy = source || null;
      return true;
    },
  });
}

module.exports = { register };
