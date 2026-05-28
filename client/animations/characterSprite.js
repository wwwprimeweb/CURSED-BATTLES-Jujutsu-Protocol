import { loadImage } from "./imageLoader.js";

const DEFAULT_SIZE = 136;
const DASH_SIZE = Math.round(DEFAULT_SIZE * (150 / 160));

export class CharacterSprite {
  constructor(character) {
    this.character = character;
    this.idleSprite = null;
    this.dashSprite = null;
    this.domainPrepSprite = null;
    this.isLoaded = false;
    this.walkTime = 0;
    this.loadIdleSprite();
    this.loadDashSprite();
    this.loadDomainPrepSprite();
  }

  async loadIdleSprite() {
    const paths = [
      `/assets/sprites/${this.character}.png`,
      `/client/assets/sprites/${this.character}.png`,
      `./assets/sprites/${this.character}.png`,
      `../client/assets/sprites/${this.character}.png`,
      `${this.character}.png`,
    ];
    for (const path of paths) {
      try {
        this.idleSprite = await loadImage(path);
        this.checkLoaded();
        return;
      } catch (e) {}
    }
  }

  async loadDashSprite() {
    const paths = [
      `/assets/sprites/${this.character}-dash.png`,
      `/client/assets/sprites/${this.character}-dash.png`,
      `./assets/sprites/${this.character}-dash.png`,
      `../client/assets/sprites/${this.character}-dash.png`,
      `${this.character}-dash.png`,
    ];
    for (const path of paths) {
      try {
        this.dashSprite = await loadImage(path);
        this.checkLoaded();
        return;
      } catch (e) {}
    }
  }

  async loadDomainPrepSprite() {
    const paths = [
      `/assets/sprites/${this.character}de.png`,
      `/client/assets/sprites/${this.character}de.png`,
      `./assets/sprites/${this.character}de.png`,
      `../client/assets/sprites/${this.character}de.png`,
      `${this.character}de.png`,
    ];
    for (const path of paths) {
      try {
        this.domainPrepSprite = await loadImage(path);
        this.checkLoaded();
        return;
      } catch (e) {}
    }
  }

  checkLoaded() {
    if (this.idleSprite || this.dashSprite || this.domainPrepSprite) {
      this.isLoaded = true;
    }
  }

  update(dt) {
    this.walkTime += dt;
  }

  render(ctx, x, y, state, facing = 1, _scale = 1) {
    const scale = Number.isFinite(_scale) ? Math.max(0.6, _scale) : 1;
    const isDomainPrep = state === "domain_prepare";
    const isDash = state === "dash";
    const bobY = (state === "walk" || state === "run") ? Math.sin(this.walkTime * 40) * 2 : 0;
    const finalY = y + bobY;

    if (isDomainPrep && this.domainPrepSprite) {
      this.drawSprite(ctx, this.domainPrepSprite, x, finalY, facing, DEFAULT_SIZE * scale);
      return;
    }

    if (isDash && this.dashSprite) {
      this.drawSprite(ctx, this.dashSprite, x, finalY, facing, DASH_SIZE * scale);
      return;
    }

    if (this.idleSprite) {
      this.drawSprite(ctx, this.idleSprite, x, finalY, facing, DEFAULT_SIZE * scale);
      return;
    }

    if (this.dashSprite) {
      this.drawSprite(ctx, this.dashSprite, x, finalY, facing, DASH_SIZE * scale);
      return;
    }

    this.drawFallback(ctx, x, finalY, scale);
  }

  drawFallback(ctx, x, y, scale) {
    ctx.fillStyle = "rgba(150,150,150,0.5)";
    ctx.beginPath();
    ctx.arc(x, y, 20 * scale, 0, Math.PI * 2);
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
