export const GOJO_ANIMATIONS = {
  idle: { row: 0, frames: 4, speed: 6, loop: true },
  walk: { row: 1, frames: 8, speed: 10, loop: true },
  run: { row: 2, frames: 6, speed: 14, loop: true },
  m1_1: { row: 3, frames: 5, speed: 18, loop: false },
  m1_2: { row: 4, frames: 5, speed: 18, loop: false },
  m1_3: { row: 5, frames: 5, speed: 18, loop: false },
  dodge: { row: 6, frames: 5, speed: 24, loop: false },
  hit: { row: 7, frames: 3, speed: 12, loop: false },
  death: { row: 8, frames: 8, speed: 8, loop: false },
  skill_blue: { row: 9, frames: 6, speed: 12, loop: false },
  skill_red: { row: 10, frames: 6, speed: 14, loop: false },
  skill_purple: { row: 11, frames: 10, speed: 10, loop: false },
  teleport: { row: 12, frames: 5, speed: 20, loop: false },
  domain: { row: 13, frames: 12, speed: 10, loop: false },
};

export const SPRITE_CONFIG = {
  sheetWidth: 790,
  sheetHeight: 1780,
  frameWidth: 158,
  frameHeight: 178,
  scale: 1.0,
  pivotX: 0,
  pivotY: 20,
};

export function mapServerStateToAnim(serverState) {
  const map = {
    idle: "idle",
    walk: "walk",
    run: "run",
    m1: "m1_1",
    dodge: "dodge",
    hit: "hit",
    death: "death",
    skill1: "skill_blue",
    skill2: "skill_red",
    skill3: "skill_purple",
    teleport: "teleport",
    domain: "domain",
  };
  return map[serverState] || "idle";
}