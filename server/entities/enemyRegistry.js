"use strict";

const registry = new Map();

function registerEnemy(def) {
  registry.set(def.type, def);
}

function getEnemyDef(type) {
  return registry.get(type);
}

function getAllByGrade(grade) {
  const result = [];
  for (const def of registry.values()) {
    if (def.grade === grade) result.push(def);
  }
  return result;
}

function getGradeTier(grade) {
  if (grade === 3) return "weak";
  if (grade === 2) return "strong";
  if (grade === 1) return "super";
  if (grade === "special") return "boss";
  return "weak";
}

function getAllDefs() {
  return [...registry.values()];
}

module.exports = {
  registerEnemy,
  getEnemyDef,
  getAllByGrade,
  getGradeTier,
  getAllDefs,
};
