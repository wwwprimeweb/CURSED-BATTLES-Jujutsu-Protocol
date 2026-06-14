export const O_HONRADO_SKILLS = {
  m1: "Golpe Concentrado",
  q: "Atração Gravitacional",
  e: "Explosão Repulsiva",
  r: "Aniquilador",
  space: "Salto Dimensional",
  f: "Vazio Absoluto",
};

export const PORTADOR_DO_VINCULO_SKILLS = {
  m1: "Corte Laminar",
  q: "Guardião Amaldiçoado",
  e: "Investida Cortante",
  r: "Raio Purificador",
  space: "Laço Eterno",
  f: "Libertação do Guardião",
};

export const PUNHO_INDOMAVEL_SKILLS = {
  m1: "Golpe Impactante",
  q: "Soco Defasado",
  e: "Pancada Espiritual",
  r: "Sequência Brutal",
  space: "Joelhada Voadora",
  f: "Manifestação Interior",
};

export function getSkillsForCharacter(character) {
  if (character === "portadorDoVinculo") return PORTADOR_DO_VINCULO_SKILLS;
  if (character === "punhoIndomavel") return PUNHO_INDOMAVEL_SKILLS;
  return O_HONRADO_SKILLS;
}
