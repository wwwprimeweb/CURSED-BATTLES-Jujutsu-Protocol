import { SpriteAnimator } from "./spriteAnimator.js";
import { loadImage } from "./imageLoader.js";
import { YUTA_ANIMATIONS, YUTA_SPRITE_CONFIG, YUTA_SHEET_PATH, RIKA_INCOMPLETA_CONFIG, RIKA_INCOMPLETA_SHEET_PATH, FULL_RIKA_CONFIG, FULL_RIKA_SHEET_PATH } from "./yutaSprites.js";

const ALT_SHEET_PATH = "/assets/sprites/portador-do-vinculo_m1_alt.png";
const ALT_ANIMATIONS = {
  m1_2: { row: 0, frames: 5, speed: 10, loop: false },
  m1_4: { row: 0, frames: 5, speed: 10, loop: false },
  idle: { row: 0, frames: 1, speed: 1, loop: true },
};

const ALT_STATES = ["m1_2", "m1_4"];

const DEFAULT_SIZE = 136;
const DASH_SIZE = Math.round(DEFAULT_SIZE * (150 / 160));
const RIKA_SIZE = Math.round(DEFAULT_SIZE * 1.5);

export class YutaSpriteRenderer {
  constructor() {
    this.animator = new SpriteAnimator({
      sheetPath: YUTA_SHEET_PATH,
      cellWidth: YUTA_SPRITE_CONFIG.cellWidth,
      cellHeight: YUTA_SPRITE_CONFIG.cellHeight,
      pivotX: YUTA_SPRITE_CONFIG.pivotX,
      pivotY: YUTA_SPRITE_CONFIG.pivotY,
      offsetX: YUTA_SPRITE_CONFIG.offsetX,
      renderScale: YUTA_SPRITE_CONFIG.renderScale,
      animations: YUTA_ANIMATIONS,
    });
    this.altAnimator = new SpriteAnimator({
      sheetPath: ALT_SHEET_PATH,
      cellWidth: 108,
      cellHeight: YUTA_SPRITE_CONFIG.cellHeight,
      pivotX: 52,
      pivotY: 70,
      offsetX: YUTA_SPRITE_CONFIG.offsetX,
      renderScale: YUTA_SPRITE_CONFIG.renderScale,
      animations: ALT_ANIMATIONS,
    });
    this.rikaSprite = null;
    this.rikaIncompletaSheet = null;
    this.fullRikaSheet = null;
    this.domainPrepSprite = null;
    this.isLoaded = false;
    this.loadError = null;
    this.walkTime = 0;
    this.loadRikaSprite();
    this.loadRikaIncompletaSheet();
    this.loadFullRikaSheet();
    this.loadDomainPrepSprite();
  }

  async loadRikaSprite() {
    const paths = [
      "/assets/sprites/rika-portador-do-vinculo.png",
      "/client/assets/sprites/rika-portador-do-vinculo.png",
      "./assets/sprites/rika-portador-do-vinculo.png",
      "../client/assets/sprites/rika-portador-do-vinculo.png",
      "rika-portador-do-vinculo.png",
    ];
    for (const path of paths) {
      try {
        this.rikaSprite = await loadImage(path);
        this.checkLoaded();
        return;
      } catch (e) {
      }
    }
    console.error("[YutaSprite] All rika paths failed");
  }

  async loadDomainPrepSprite() {
    const paths = [
      "/assets/sprites/portador-do-vinculode.png",
      "/client/assets/sprites/portador-do-vinculode.png",
      "./assets/sprites/portador-do-vinculode.png",
      "../client/assets/sprites/portador-do-vinculode.png",
      "portador-do-vinculode.png",
    ];
    for (const path of paths) {
      try {
        this.domainPrepSprite = await loadImage(path);
        this.checkLoaded();
        return;
      } catch (e) {
      }
    }
  }

  async loadRikaIncompletaSheet() {
    const paths = [
      "/assets/sprites/rika-incompleta.png",
      "/client/assets/sprites/rika-incompleta.png",
      "./assets/sprites/rika-incompleta.png",
      "../client/assets/sprites/rika-incompleta.png",
      "rika-incompleta.png",
    ];
    for (const path of paths) {
      try {
        this.rikaIncompletaSheet = await loadImage(path);
        this.checkLoaded();
        return;
      } catch (e) {
      }
    }
    console.error("[YutaSprite] All rika incompleta paths failed");
  }

  async loadFullRikaSheet() {
    const paths = [
      "/assets/sprites/portador-do-vinculo_full_rika.png",
      "/client/assets/sprites/portador-do-vinculo_full_rika.png",
      "./assets/sprites/portador-do-vinculo_full_rika.png",
      "../client/assets/sprites/portador-do-vinculo_full_rika.png",
      "portador-do-vinculo_full_rika.png",
    ];
    for (const path of paths) {
      try {
        this.fullRikaSheet = await loadImage(path);
        this.checkLoaded();
        return;
      } catch (e) {
      }
    }
    console.error("[YutaSprite] All full rika paths failed");
  }

  checkLoaded() {
    if (this.rikaSprite || this.rikaIncompletaSheet || this.fullRikaSheet || this.domainPrepSprite) {
      this.isLoaded = true;
    }
  }

  update(dt) {
    this.walkTime += dt;
    this.animator.update(dt);
    this.altAnimator.update(dt);
  }

  render(ctx, x, y, state, facing = 1, _scale = 1, playerId = "default") {
    const scale = Number.isFinite(_scale) ? Math.max(0.6, _scale) : 1;
    const animator = ALT_STATES.includes(state) ? this.altAnimator : this.animator;
    animator.render(ctx, x, y, state, facing, scale, playerId);
  }

  renderRika(ctx, x, y, facing = 1, floatPhase = 0, floatAmp = 2.2, _scale = 1) {
    const scale = Number.isFinite(_scale) ? Math.max(0.6, _scale) : 1;
    const hover = floatAmp > 0 ? Math.sin(this.walkTime * 3.1 + floatPhase) * floatAmp : 0;
    const finalY = y + hover;
    if (this.rikaSprite) {
      this.drawSprite(ctx, this.rikaSprite, x, finalY, facing, RIKA_SIZE * scale);
      return;
    }
    ctx.fillStyle = "rgba(200,100,255,0.5)";
    ctx.beginPath();
    ctx.arc(x, finalY, 45 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  renderRikaIncompletaFrame(ctx, x, y, facing, row, frameIndex, alpha = 1, _scale = 1) {
    const scale = Number.isFinite(_scale) ? Math.max(0.6, _scale) : 1;
    if (!this.rikaIncompletaSheet) {
      ctx.fillStyle = `rgba(200,100,255,${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, 45 * scale, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const cfg = RIKA_INCOMPLETA_CONFIG;
    const sx = frameIndex * cfg.cellWidth;
    const sy = row * cfg.cellHeight;
    const targetSize = DEFAULT_SIZE * cfg.renderScale * scale;
    const aspect = cfg.cellWidth / cfg.cellHeight;
    let drawW, drawH;
    if (cfg.cellWidth >= cfg.cellHeight) {
      drawW = targetSize;
      drawH = drawW / aspect;
    } else {
      drawH = targetSize;
      drawW = drawH * aspect;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    if (facing < 0) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }
    ctx.drawImage(this.rikaIncompletaSheet, sx, sy, cfg.cellWidth, cfg.cellHeight, x - drawW / 2, y - drawH / 2, drawW, drawH);
    ctx.restore();
  }

  renderFullRikaFrame(ctx, x, y, facing, row, frameIndex, alpha = 1, _scale = 1) {
    const scale = Number.isFinite(_scale) ? Math.max(0.6, _scale) : 1;
    if (!this.fullRikaSheet) {
      ctx.fillStyle = `rgba(200,100,255,${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, 45 * scale, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const cfg = FULL_RIKA_CONFIG;
    const sx = frameIndex * cfg.cellWidth;
    const sy = row * cfg.cellHeight;
    const targetSize = DEFAULT_SIZE * cfg.renderScale * scale;
    const aspect = cfg.cellWidth / cfg.cellHeight;
    let drawW, drawH;
    if (cfg.cellWidth >= cfg.cellHeight) {
      drawW = targetSize;
      drawH = drawW / aspect;
    } else {
      drawH = targetSize;
      drawW = drawH * aspect;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    if (facing < 0) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }
    const drawX = x - cfg.pivotX * (drawW / cfg.cellWidth);
    const drawY = y - cfg.pivotY * (drawH / cfg.cellHeight);
    ctx.drawImage(this.fullRikaSheet, sx, sy, cfg.cellWidth, cfg.cellHeight, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  drawSprite(ctx, img, x, y, facing, targetSize) {
    const aspect = img.width / img.height;
    let drawW, drawH;
    if (img.width >= img.height) {
      drawW = targetSize;
      drawH = drawW / aspect;
    } else {
      drawH = targetSize;
      drawW = drawH * aspect;
    }

    ctx.save();
    if (facing < 0) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }
    ctx.drawImage(img, x - drawW / 2, y - drawH / 2, drawW, drawH);
    ctx.restore();
  }
}
