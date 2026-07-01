export class SpriteAnimator {
  constructor(config) {
    this.config = config;
    this.image = new Image();
    this.loaded = false;
    this.image.onload = () => {
      this.loaded = true;
    };
    this.image.src = config.sheetPath;

    this.players = new Map();
    this.walkTime = 0;
  }

  getOrCreate(id) {
    if (!this.players.has(id)) {
      this.players.set(id, {
        frame: 0,
        currentState: null,
        time: 0,
        done: false,
      });
    }
    return this.players.get(id);
  }

  update(dt) {
    this.walkTime += dt;
    for (const [, player] of this.players) {
      const anim = this.config.animations[player.currentState];
      if (!anim || player.done) continue;
      player.time += dt;
      player.frame = player.time * anim.speed;
      if (player.frame >= anim.frames) {
        if (anim.loop) {
          player.frame = player.frame % anim.frames;
        } else {
          player.frame = anim.frames - 1;
          player.done = true;
        }
      }
    }
  }

  render(ctx, x, y, state, facing = 1, scale = 1, playerId = "default") {
    if (!this.loaded) return;

    const anim = this.config.animations[state] || this.config.animations.idle;
    if (!anim) return;

    const player = this.getOrCreate(playerId);
    const renderScale = scale * (this.config.renderScale || 1);

    if (player.currentState !== state) {
      player.currentState = state;
      player.frame = 0;
      player.time = 0;
      player.done = false;
    }

    const frameIdx = Math.floor(player.frame) % anim.frames;
    const sx = frameIdx * this.config.cellWidth;
    const sy = anim.row * this.config.cellHeight;
    const sw = this.config.cellWidth;
    const sh = this.config.cellHeight;

    const effectivePivotX = this.config.pivotX - (this.config.offsetX || 0);
    const dx = x - effectivePivotX * renderScale;
    const bobY = (state === "walk" || state === "run") ? Math.sin(this.walkTime * 40) * 2 * renderScale : 0;
    const dy = y - this.config.pivotY * renderScale + bobY;
    const dw = sw * renderScale;
    const dh = sh * renderScale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (facing < 0) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }
    ctx.drawImage(this.image, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
  }

  renderTinted(ctx, x, y, state, facing = 1, scale = 1, playerId = "default", _color = "#ffffff") {
    if (!this.loaded) return;

    const anim = this.config.animations[state] || this.config.animations.idle;
    if (!anim) return;

    const player = this.getOrCreate(playerId);
    const renderScale = scale * (this.config.renderScale || 1);

    if (player.currentState !== state) {
      player.currentState = state;
      player.frame = 0;
      player.time = 0;
      player.done = false;
    }

    const frameIdx = Math.floor(player.frame) % anim.frames;
    const sx = frameIdx * this.config.cellWidth;
    const sy = anim.row * this.config.cellHeight;
    const sw = this.config.cellWidth;
    const sh = this.config.cellHeight;

    const effectivePivotX = this.config.pivotX - (this.config.offsetX || 0);
    const dx = x - effectivePivotX * renderScale;
    const bobY = (state === "walk" || state === "run") ? Math.sin(this.walkTime * 40) * 2 * renderScale : 0;
    const dy = y - this.config.pivotY * renderScale + bobY;
    const dw = sw * renderScale;
    const dh = sh * renderScale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (facing < 0) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }
    ctx.filter = "brightness(0) invert(1)";
    ctx.drawImage(this.image, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
  }

  resetPlayer(playerId) {
    const p = this.players.get(playerId);
    if (p) {
      p.currentState = null;
    }
  }

  getCurrentFrame(playerId) {
    const p = this.players.get(playerId);
    if (!p) return 0;
    const anim = this.config.animations[p.currentState];
    if (!anim) return 0;
    return Math.floor(p.frame) % anim.frames;
  }
}
