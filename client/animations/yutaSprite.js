import { loadImage } from "./imageLoader.js";

const DEFAULT_SIZE = 136;
const DASH_SIZE = Math.round(DEFAULT_SIZE * (150 / 160));

export class YutaSpriteRenderer {
  constructor() {
    this.idleSprite = null;
    this.dashSprite = null;
    this.rikaSprite = null;
    this.isLoaded = false;
    this.loadError = null;
    this.walkTime = 0;
    this.loadIdleSprite();
    this.loadDashSprite();
    this.loadRikaSprite();
  }

  async loadIdleSprite() {
    const paths = [
      "/assets/sprites/yuta.png",
      "/client/assets/sprites/yuta.png",
      "./assets/sprites/yuta.png",
      "../client/assets/sprites/yuta.png",
      "yuta.png",
    ];
    for (const path of paths) {
      try {
        this.idleSprite = await loadImage(path);
        this.checkLoaded();
        return;
      } catch (e) {
      }
    }
    console.error("[YutaSprite] All idle paths failed");
  }

  async loadDashSprite() {
    const paths = [
      "/assets/sprites/yuta-dash.png",
      "/client/assets/sprites/yuta-dash.png",
      "./assets/sprites/yuta-dash.png",
      "../client/assets/sprites/yuta-dash.png",
      "yuta-dash.png",
    ];
    for (const path of paths) {
      try {
        this.dashSprite = await loadImage(path);
        this.checkLoaded();
        return;
      } catch (e) {
      }
    }
    console.error("[YutaSprite] All dash paths failed");
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

  checkLoaded() {
    if (this.idleSprite || this.dashSprite || this.rikaSprite) {
      this.isLoaded = true;
    }
  }

  update(dt) {
    this.walkTime += dt;
  }

  render(ctx, x, y, state, facing = 1, _scale = 1) {
    const isDash = state === "dash";
    const bobY = (state === "walk" || state === "run") ? Math.sin(this.walkTime * 10) * 2.5 : 0;
    const finalY = y + bobY;

    if (isDash && this.dashSprite) {
      this.drawSprite(ctx, this.dashSprite, x, finalY, facing, DASH_SIZE);
      return;
    }

    if (this.idleSprite) {
      this.drawSprite(ctx, this.idleSprite, x, finalY, facing, DEFAULT_SIZE);
      return;
    }

    if (this.dashSprite) {
      this.drawSprite(ctx, this.dashSprite, x, finalY, facing, DASH_SIZE);
      return;
    }

    ctx.fillStyle = "rgba(255,150,200,0.5)";
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  renderRika(ctx, x, y, facing = 1) {
    if (this.rikaSprite) {
      this.drawSprite(ctx, this.rikaSprite, x, y, facing, DEFAULT_SIZE);
      return;
    }
    ctx.fillStyle = "rgba(200,100,255,0.5)";
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
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
