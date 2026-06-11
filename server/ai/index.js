"use strict";

const { updateGrade3 } = require("./grade3AI");
const { updateGrade2 } = require("./grade2AI");
const { updateGrade1 } = require("./grade1AI");
const { updateGradeSpecial } = require("./gradeSpecialAI");

function updateAI(enemy, target, dist, dt, gameState, pressuringBarrier) {
  switch (enemy.grade) {
    case 3:
      return updateGrade3(enemy, target, dist, dt, gameState, pressuringBarrier);
    case 2:
      return updateGrade2(enemy, target, dist, dt, gameState, pressuringBarrier);
    case 1:
      return updateGrade1(enemy, target, dist, dt, gameState, pressuringBarrier);
    case "special":
      return updateGradeSpecial(enemy, target, dist, dt, gameState, pressuringBarrier);
    default:
      return updateGrade3(enemy, target, dist, dt, gameState, pressuringBarrier);
  }
}

module.exports = { updateAI };
