import { loadImage } from "./imageLoader.js";

const DEFAULT_SIZE = 136;
const DASH_SIZE = Math.round(DEFAULT_SIZE * (150 / 160));

export class GojoSpriteRenderer {
  constructor() {
    this.idleSprite = null;
    this.dashSprite = null;
    this.isLoaded = false;
    this.loadError = null;
    this.loadedState = null;
    this.walkTime = 0;
    this.loadIdleSprite();
    this.loadDashSprite();
  }

  async loadIdleSprite() {
    const paths = [
      "/assets/sprites/gojo.png",
      "/client/assets/sprites/gojo.png",
      "./assets/sprites/gojo.png",
      "../client/assets/sprites/gojo.png",
      "gojo.png",
    ];

    for (const path of paths) {
      try {
        this.idleSprite = await loadImage(path);
        this.checkLoaded();
        console.log(`[GojoSprite] Idle loaded from ${path} (${this.idleSprite.width}x${this.idleSprite.height})`);
        return;
      } catch (e) {
        console.log(`[GojoSprite] Idle failed: ${path}`);
      }
    }
    console.error("[GojoSprite] All idle paths failed");
  }

  async loadDashSprite() {
    const paths = [
      "/assets/sprites/gojo-dash.png",
      "/client/assets/sprites/gojo-dash.png",
      "./assets/sprites/gojo-dash.png",
      "../client/assets/sprites/gojo-dash.png",
      "gojo-dash.png",
    ];

    for (const path of paths) {
      try {
        this.dashSprite = await loadImage(path);
        this.checkLoaded();
        console.log(`[GojoSprite] Dash loaded from ${path} (${this.dashSprite.width}x${this.dashSprite.height})`);
        return;
      } catch (e) {
        console.log(`[GojoSprite] Dash failed: ${path}`);
      }
    }
    console.error("[GojoSprite] All dash paths failed");
  }

  checkLoaded() {
    if (this.idleSprite || this.dashSprite) {
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

    ctx.fillStyle = "rgba(100,100,255,0.5)";
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
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
