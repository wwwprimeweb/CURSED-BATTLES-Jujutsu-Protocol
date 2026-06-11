"use strict";

const { O_HONRADO } = require("./oHonradoKit");
const { PORTADOR_DO_VINCULO } = require("./portadorDoVinculoKit");
const { REI_AMALDICOADO } = require("./reiAmaldicoadoKit");
const { PUNHO_INDOMAVEL } = require("./punhoIndomavelKit");
const { INVOCADOR_DE_SOMBRAS } = require("./invocadorDeSombrasKit");
const { LUTADOR_DE_SORTE } = require("./lutadorDeSorteKit");

const CHARACTER_REGISTRY = {
  "o-honrado": O_HONRADO,
  "portador-do-vinculo": PORTADOR_DO_VINCULO,
  "rei-amaldicoado": REI_AMALDICOADO,
  "punho-indomavel": PUNHO_INDOMAVEL,
  "invocador-de-sombras": INVOCADOR_DE_SOMBRAS,
  "lutador-de-sorte": LUTADOR_DE_SORTE,
};

module.exports = {
  CHARACTER_REGISTRY,
};
