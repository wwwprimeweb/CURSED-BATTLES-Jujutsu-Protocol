import { SpriteAnimator } from "./spriteAnimator.js";
import { loadImage } from "./imageLoader.js";
import { YUTA_ANIMATIONS, YUTA_SPRITE_CONFIG, YUTA_SHEET_PATH } from "./yutaSprites.js";

const ALT_SHEET_PATH = "/assets/sprites/yuta_m1_alt.png";
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
    this.domainPrepSprite = null;
    this.isLoaded = false;
    this.loadError = null;
    this.walkTime = 0;
    this.loadRikaSprite();
    this.loadDomainPrepSprite();
  }

  async loadRikaSprite() {
    const paths = [
      "/assets/sprites/rika-yuta.png",
      "/client/assets/sprites/rika-yuta.png",
      "./assets/sprites/rika-yuta.png",
      "../client/assets/sprites/rika-yuta.png",
      "rika-yuta.png",
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
      "/assets/sprites/yutade.png",
      "/client/assets/sprites/yutade.png",
      "./assets/sprites/yutade.png",
      "../client/assets/sprites/yutade.png",
      "yutade.png",
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

  checkLoaded() {
    if (this.rikaSprite || this.domainPrepSprite) {
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
