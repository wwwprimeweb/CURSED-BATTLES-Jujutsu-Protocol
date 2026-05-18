"use strict";

const { GOJO } = require("./gojoKit");
const { YUTA } = require("./yutaKit");
const { SUKUNA } = require("./sukunaKit");
const { YUJI } = require("./yujiKit");
const { MEGUMI } = require("./megumiKit");
const { HAKARI } = require("./hakariKit");

const CHARACTER_REGISTRY = {
  gojo: GOJO,
  yuta: YUTA,
  sukuna: SUKUNA,
  yuji: YUJI,
  megumi: MEGUMI,
  hakari: HAKARI,
};

module.exports = {
  CHARACTER_REGISTRY,
};
