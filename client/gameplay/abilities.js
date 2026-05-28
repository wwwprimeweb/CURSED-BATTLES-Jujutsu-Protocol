export const GOJO_SKILLS = {
  m1: "Cursed Jab Combo",
  q: "Blue Singularity",
  e: "Red Repulsion",
  r: "Hollow Purple",
  space: "Spatial Step",
  f: "Domain Expansion: Infinite Void",
};

export const YUTA_SKILLS = {
  m1: "Katana Combat",
  q: "Rika",
  e: "Dash Slash",
  r: "Full Rika Manifestation",
  space: "True Mutual Love",
  f: "Pure Love",
};

export const YUJI_SKILLS = {
  m1: "Black Flash Combo",
  q: "Divergent Fist",
  e: "Soul Impact",
  r: "Taido Beatdown",
  space: "Flying Knee",
  f: "Self-Embodiment",
};

export function getSkillsForCharacter(character) {
  if (character === "yuta") return YUTA_SKILLS;
  if (character === "yuji") return YUJI_SKILLS;
  return GOJO_SKILLS;
}
