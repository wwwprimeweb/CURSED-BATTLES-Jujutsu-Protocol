export const YUTA_ANIMATIONS = {
  idle: { row: 0, frames: 3, speed: 7.5, loop: true },
  dash: { row: 1, frames: 7, speed: 12, loop: true },
  m1: { row: 2, frames: 4, speed: 8, loop: false },
  m1_1: { row: 2, frames: 4, speed: 8, loop: false },
  m1_2: { row: 2, frames: 4, speed: 8, loop: false },
  m1_3: { row: 2, frames: 4, speed: 8, loop: false },
  m1_4: { row: 2, frames: 4, speed: 8, loop: false },
  domain_prepare: { row: 3, frames: 4, speed: 4, loop: false },
  domain: { row: 0, frames: 3, speed: 2.5, loop: true },
  dodge: { row: 1, frames: 1, speed: 1, loop: false },
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

export const YUTA_SHEET_PATH = "/assets/sprites/portador-do-vinculo_shinjuku_spritesheet.png";

export const RIKA_INCOMPLETA_CONFIG = {
  sheetWidth: 960,
  sheetHeight: 240,
  cellWidth: 160,
  cellHeight: 120,
  pivotX: 80,
  pivotY: 100,
  renderScale: 1.98,
  idleFrames: [59, 53, 54, 55, 56, 57],
  attackFrames: [33, 34, 35, 36, 37],
  appearFrameIndex: 0,
  loopStartIndex: 1,
  loopEndIndex: 5,
  appearDuration: 0.35,
  loopDuration: 1.15,
  attackDuration: 0.4,
  fadeOutDuration: 0.5,
  totalDuration: 2.4,
};

export const RIKA_INCOMPLETA_SHEET_PATH = "/assets/sprites/rika-incompleta.png";

export const FULL_RIKA_CONFIG = {
  sheetWidth: 1440,
  sheetHeight: 240,
  cellWidth: 160,
  cellHeight: 120,
  pivotX: 70,
  pivotY: 100,
  renderScale: 1.8,
  introFrames: 9,
  introDuration: 1.2,
  moveFrame: 0,
  idleFrame: 1,
  attackFrameIndex: 2,
  heavyFrameRow: 0,
  heavyFrameIndex: 6,
};

export const FULL_RIKA_SHEET_PATH = "/assets/sprites/portador-do-vinculo_full_rika.png";

export const TELEPORT_ANIMATIONS = {
  teleport: { row: 0, frames: 4, speed: 16, loop: false },
};

export const TELEPORT_SPRITE_CONFIG = {
  cellWidth: 80,
  cellHeight: 80,
  pivotX: 40,
  pivotY: 65,
  offsetX: 16,
  renderScale: 1.7,
};

export const TELEPORT_SHEET_PATH = "/assets/sprites/portador-do-vinculo_teleport.png";

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
