export class SpriteSheet {
  constructor(imageSrc) {
    this.image = new Image();
    this.loaded = false;
    this.image.onload = () => {
      this.loaded = true;
    };
    this.image.src = imageSrc;
  }

  getFrame(x, y, w, h) {
    return { sx: x, sy: y, sw: w, sh: h };
  }
}

export class Sprite {
  constructor(spritesheet, frameWidth, frameHeight, scale = 1) {
    this.ss = spritesheet;
    this.fw = frameWidth;
    this.fh = frameHeight;
    this.scale = scale;
    this.ox = 0;
    this.oy = 0;
  }

  setOffset(x, y) {
    this.ox = x;
    this.oy = y;
  }

  drawFrame(ctx, frameX, frameY, dx, dy) {
    if (!this.ss.loaded) return;
    ctx.save();
    ctx.drawImage(
      this.ss.image,
      frameX * this.fw,
      frameY * this.fh,
      this.fw,
      this.fh,
      dx - (this.fw * this.scale * 0.5) + this.ox,
      dy - (this.fh * this.scale * 0.5) + this.oy,
      this.fw * this.scale,
      this.fh * this.scale
    );
    ctx.restore();
  }

  drawFrameRaw(ctx, frameX, frameY, dx, dy, dw, dh) {
    if (!this.ss.loaded) return;
    ctx.save();
    ctx.drawImage(
      this.ss.image,
      frameX * this.fw,
      frameY * this.fh,
      this.fw,
      this.fh,
      dx - dw * 0.5,
      dy - dh * 0.5,
      dw,
      dh
    );
    ctx.restore();
  }
}

export class AnimationController {
  constructor(sprite, row) {
    this.sprite = sprite;
    this.row = row;
    this.frame = 0;
    this.frameCount = 0;
    this.speed = 0;
    this.loop = true;
    this.oscillate = false;
    this.oscDir = 1;
    this.done = false;
    this.finishedCallbacks = [];
  }

  play(frames, speed, loop = true, oscillate = false) {
    this.frameCount = frames;
    this.speed = speed;
    this.loop = loop;
    this.oscillate = oscillate;
    this.frame = 0;
    this.oscDir = 1;
    this.done = false;
  }

  onFinished(cb) {
    this.finishedCallbacks.push(cb);
  }

  update(dt) {
    if (this.done && !this.loop) return;
    this.frame += this.speed * dt;
    if (this.frame >= this.frameCount) {
      if (this.loop) {
        this.frame = this.frame % this.frameCount;
      } else {
        this.frame = this.frameCount - 1;
        this.done = true;
        this.finishedCallbacks.forEach(cb => cb());
      }
    }
  }

  getFrame() {
    return Math.floor(this.frame) % this.frameCount;
  }

  draw(ctx, x, y) {
    this.sprite.drawFrame(ctx, this.getFrame(), this.row, x, y);
  }

  drawScaled(ctx, x, y, w, h) {
    this.sprite.drawFrameRaw(ctx, this.getFrame(), this.row, x, y, w, h);
  }
}