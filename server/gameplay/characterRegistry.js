"use strict";

const { GOJO } = require("./gojoKit");
const { YUTA } = require("./yutaKit");

const CHARACTER_REGISTRY = {
  gojo: GOJO,
  yuta: YUTA,
};

module.exports = {
  CHARACTER_REGISTRY,
};
