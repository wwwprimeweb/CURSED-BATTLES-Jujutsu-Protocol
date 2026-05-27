export const YUJI_ANIMATIONS = {
  idle: { row: 0, frames: 4, speed: 2.6, loop: true },
  walk: { row: 0, frames: 1, speed: 1, loop: true },
  run: { row: 0, frames: 1, speed: 1, loop: true },
  m1_1: { row: 2, frames: 4, speed: 8.2, loop: false },
  m1_2: { row: 3, frames: 4, speed: 8.2, loop: false },
  m1_3: { row: 4, frames: 4, speed: 8.2, loop: false },
  m1_4: { row: 5, frames: 4, speed: 8.2, loop: false },
  dash: { row: 1, frames: 1, speed: 1, loop: true },
  dodge: { row: 1, frames: 1, speed: 1, loop: false },
  hit: { row: 7, frames: 2, speed: 5.2, loop: false },
  death: { row: 8, frames: 1, speed: 1, loop: false },
  domain_prepare: { row: 9, frames: 6, speed: 7, loop: false },
  domain: { row: 10, frames: 1, speed: 1, loop: true },
  skill1: { row: 11, frames: 6, speed: 12, loop: false },
  skill2: { row: 2, frames: 4, speed: 8.2, loop: false },
  skill3: { row: 2, frames: 4, speed: 10, loop: false },
  skill3_prepare: { row: 11, frames: 6, speed: 10, loop: false },
  teleport: { row: 6, frames: 3, speed: 10, loop: false },
};

export const YUJI_SPRITE_CONFIG = {
  sheetWidth: 480,
  sheetHeight: 960,
  cellWidth: 80,
  cellHeight: 80,
  pivotX: 40,
  pivotY: 65,
  renderScale: 1.9,
};

export const YUJI_SHEET_PATH = "/assets/sprites/yuji_shinjuku/yuji_shinjuku_spritesheet.png";
