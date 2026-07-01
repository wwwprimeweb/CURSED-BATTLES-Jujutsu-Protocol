export const GOJO_ANIMATIONS = {
  idle: { row: 0, frames: 4, speed: 7.2, loop: true },
  walk: { row: 0, frames: 1, speed: 1, loop: true },
  run: { row: 0, frames: 1, speed: 1, loop: true },
  m1_1: { row: 1, frames: 3, speed: 12, loop: false },
  m1_2: { row: 2, frames: 5, speed: 14, loop: false },
  m1_3: { row: 3, frames: 4, speed: 13, loop: false },
  dodge: { row: 7, frames: 2, speed: 4, loop: false },
  hit: { row: 5, frames: 3, speed: 4.8, loop: false },
  death: { row: 6, frames: 7, speed: 4, loop: false },
  skill_blue: { row: 0, frames: 1, speed: 1, loop: false },
  skill_red: { row: 0, frames: 1, speed: 1, loop: false },
  skill_purple: { row: 0, frames: 1, speed: 1, loop: false },
  skill1: { row: 0, frames: 1, speed: 1, loop: false },
  skill2: { row: 0, frames: 1, speed: 1, loop: false },
  skill3: { row: 0, frames: 1, speed: 1, loop: false },
  teleport: { row: 0, frames: 1, speed: 1, loop: false },
  domain_prepare: { row: 8, frames: 3, speed: 4, loop: true },
  domain: { row: 0, frames: 1, speed: 1, loop: false },
};

export const SPRITE_CONFIG = {
  sheetWidth: 560,
  sheetHeight: 720,
  cellWidth: 80,
  cellHeight: 80,
  pivotX: 40,
  pivotY: 65,
  renderScale: 1.7,
};

export const GOJO_MANGA_SPRITE_PATH = "/assets/sprites/o-honrado_manga_spritesheet.png";

export const GOJO_TELEPORT_ANIMATIONS = {
  teleport: { row: 0, frames: 6, speed: 20, loop: false },
};
export const GOJO_TELEPORT_SPRITE_CONFIG = {
  cellWidth: 119,
  cellHeight: 273,
  pivotX: 28,
  pivotY: 271,
  renderScale: 0.78,
};
export const GOJO_TELEPORT_SHEET_PATH = "/assets/sprites/o-honrado_teleport.png";

export function mapServerStateToAnim(serverState) {
  const map = {
    idle: "idle",
    walk: "walk",
    run: "run",
    m1: "m1_1",
    m1_1: "m1_1",
    m1_2: "m1_2",
    m1_3: "m1_3",
    dodge: "dodge",
    hit: "hit",
    death: "death",
    skill1: "skill_blue",
    skill2: "skill_red",
    skill3: "skill_purple",
    teleport: "teleport",
    domain: "domain",
    domain_prepare: "domain_prepare",
  };
  return map[serverState] || "idle";
}
