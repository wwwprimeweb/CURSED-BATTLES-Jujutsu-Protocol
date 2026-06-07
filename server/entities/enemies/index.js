"use strict";

const { register } = require("./grade3/grade3_enemies");
const { register: registerGrade2 } = require("./grade2/grade2_enemies");
const { register: registerGrade1 } = require("./grade1/grade1_enemies");
const { register: registerGradeSpecial } = require("./gradeSpecial/gradeSpecial_enemies");

function registerAll() {
  register();
  registerGrade2();
  registerGrade1();
  registerGradeSpecial();
}

module.exports = { registerAll };
