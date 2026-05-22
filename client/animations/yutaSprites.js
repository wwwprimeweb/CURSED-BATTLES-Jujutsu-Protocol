export const YUTA_ANIMATIONS = {
  idle: { row: 0, frames: 3, speed: 2.5, loop: true },
  dash: { row: 1, frames: 7, speed: 12, loop: true },
  m1: { row: 2, frames: 4, speed: 8, loop: false },
  m1_1: { row: 2, frames: 4, speed: 8, loop: false },
  m1_2: { row: 2, frames: 4, speed: 8, loop: false },
  m1_3: { row: 2, frames: 4, speed: 8, loop: false },
  m1_4: { row: 2, frames: 4, speed: 8, loop: false },
  domain_prepare: { row: 3, frames: 4, speed: 4, loop: false },
  domain: { row: 0, frames: 3, speed: 2.5, loop: true },
  dodge: { row: 0, frames: 1, speed: 1, loop: false },
  hit: { row: 0, frames: 1, speed: 1, loop: false },
  death: { row: 0, frames: 1, speed: 1, loop: false },
  skill1: { row: 0, frames: 1, speed: 1, loop: false },
  skill2: { row: 0, frames: 1, speed: 1, loop: false },
  skill3: { row: 0, frames: 1, speed: 1, loop: false },
  teleport: { row: 0, frames: 1, speed: 1, loop: false },
};

export const YUTA_SPRITE_CONFIG = {
  sheetWidth: 560,
  sheetHeight: 320,
  cellWidth: 80,
  cellHeight: 80,
  pivotX: 40,
  pivotY: 65,
  offsetX: 16,
  renderScale: 1.7,
};

export const YUTA_SHEET_PATH = "/assets/sprites/yuta_shinjuku_spritesheet.png";

export function mapServerStateToAnim(serverState) {
  const map = {
    idle: "idle",
    dash: "dash",
    m1: "m1",
    m1_1: "m1_1",
    m1_2: "m1_2",
    m1_3: "m1_3",
    m1_4: "m1_4",
    dodge: "dodge",
    hit: "hit",
    death: "death",
    skill1: "skill1",
    skill2: "skill2",
    skill3: "skill3",
    teleport: "teleport",
    domain: "domain",
    domain_prepare: "domain_prepare",
  };
  return map[serverState] || "idle";
}
