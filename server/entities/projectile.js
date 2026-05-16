"use strict";

function createProjectile(data) {
  return {
    id: data.id,
    kind: "projectile",
    type: data.type,
    ownerId: data.ownerId,
    ownerKind: data.ownerKind,
    x: data.x,
    y: data.y,
    prevX: data.x,
    prevY: data.y,
    vx: data.vx,
    vy: data.vy,
    speed: data.speed,
    radius: data.radius || 10,
    lifetime: data.lifetime || 1,
    age: 0,
    damage: data.damage || 0,
    tickRate: data.tickRate || 0,
    tickTimer: 0,
    pullRadius: data.pullRadius || 0,
    pullStrength: data.pullStrength || 0,
    knockback: data.knockback || 0,
    color: data.color || "#8ab4ff",
    persistent: Boolean(data.persistent),
    penetration: Boolean(data.penetration),
    width: data.width || 0,
    length: data.length || 0,
    traveled: 0,
    hitTargets: new Set(),
    meta: data.meta || {},
  };
}

module.exports = {
  createProjectile,
};
