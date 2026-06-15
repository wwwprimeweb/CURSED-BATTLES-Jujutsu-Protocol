"use strict";

const { registerEnemy } = require("../../enemyRegistry");

function register() {
  registerEnemy({
    type: "fleshmaw",
    grade: 2,
    tags: ["melee", "heavy"],
    behaviors: { immuneKnockback: true, pureChase: true },
    stats: { hp: 400, speed: 100, radius: 73, attackDamage: 55, attackRange: 130, attackCooldown: 2.5, attackStartup: 0.5, xp: 80 },
  });
}

module.exports = { register };
