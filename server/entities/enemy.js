"use strict";

const { registerAll } = require("./enemies/index");
const { getEnemyDef, getGradeTier } = require("./enemyRegistry");

registerAll();

function createEnemy(id, type, x, y, scale = 1) {
  const def = getEnemyDef(type);
  if (!def) {
    const fallback = getEnemyDef("grunt");
    if (!fallback) throw new Error(`No enemy definition for "${type}" and no fallback available`);
    def = fallback;
  }

  const s = def.stats;
  const hpScale = 0.9 + scale * 0.1;
  const speedScale = 0.94 + scale * 0.06;
  const damageScale = 0.9 + scale * 0.1;
  const gradeHpBonus = def.grade === 2 ? 1.2 : 1;
  const baseHp = s.hp * gradeHpBonus;

  return {
    id,
    kind: "enemy",
    type,
    grade: def.grade,
    tier: getGradeTier(def.grade),
    role: def.description || "",
    tags: def.tags || [],
    x,
    y,
    vx: 0,
    vy: 0,
    faceX: 1,
    faceY: 0,
    hp: Math.round(baseHp * hpScale),
    maxHp: Math.round(baseHp * hpScale),
    speed: s.speed * speedScale,
    radius: s.radius,
    damage: Math.round(s.attackDamage * damageScale),
    attackRange: s.attackRange,
    attackCooldownBase: s.attackCooldown,
    attackCooldown: 0,
    attackWindup: s.attackStartup,
    windupTimer: 0,
    recoveryTimer: 0,
    cast: null,
    castTier: null,
    abilityCooldowns: {},
    aiOrbitDir: Math.random() < 0.5 ? -1 : 1,
    targetId: null,
    alive: true,
    hitFlash: 0,
    lastDamageTaken: -Infinity,
    state: "idle",
    xpReward: s.xp,
    telegraph: null,
    aiTimer: 0,
    bossPatternTimer: 0,
    phase: 1,
    isRaged: false,
    counterWindow: 0,
    freezeTimer: 0,
    freezeFxTimer: 0,
    slowedByDomain: false,
  };
}

module.exports = {
  createEnemy,
};
