import { SpriteSheet, Sprite, AnimationController } from "./spriteSystem.js";
import { GOJO_ANIMATIONS, SPRITE_CONFIG } from "./gojoSprites.js";

export class GojoRenderer {
  constructor() {
    this.sheet = new SpriteSheet("assets/gojo_spritesheet.png");
    this.sprite = new Sprite(this.sheet, SPRITE_CONFIG.frameWidth, SPRITE_CONFIG.frameHeight, SPRITE_CONFIG.scale);
    this.sprite.setOffset(SPRITE_CONFIG.pivotX, SPRITE_CONFIG.pivotY);
    this.animators = new Map();
    this.lastDir = 0;
  }

  getOrCreate(id) {
    if (!this.animators.has(id)) {
      const ctrl = new AnimationController(this.sprite, 0);
      ctrl.play(GOJO_ANIMATIONS.idle.frames, GOJO_ANIMATIONS.idle.speed, true);
      this.animators.set(id, ctrl);
    }
    return this.animators.get(id);
  }

  setAnimation(id, state) {
    const ctrl = this.getOrCreate(id);
    const anim = GOJO_ANIMATIONS[state];
    if (!anim) return;
    const currentRow = ctrl.row;
    const newRow = anim.row;
    if (currentRow !== newRow) {
      ctrl.row = newRow;
      ctrl.frame = 0;
      ctrl.done = false;
    }
    ctrl.play(anim.frames, anim.speed, anim.loop);
  }

  update(dt) {
    this.animators.forEach(ctrl => ctrl.update(dt));
  }

  clearRemoved(validIds) {
    this.animators.forEach((_ctrl, id) => {
      if (!validIds.has(id)) {
        this.animators.delete(id);
      }
    });
  }

  draw(ctx, x, y, state, facingDir = 1) {
    this.setAnimation(`current_${Date.now()}`, state);
    const ctrl = this.getOrCreate("current");
    ctx.save();
    if (facingDir < 0) {
      ctx.scale(-1, 1);
      ctx.translate(-x * 2, 0);
    }
    ctrl.draw(ctx, x, y);
    ctx.restore();
  }

  drawFromState(ctx, id, x, y, state, facingDir = 1, alive = true) {
    this.setAnimation(id, state);
    const ctrl = this.getOrCreate(id);
    ctx.save();
    if (!alive) ctx.globalAlpha = 0.35;
    if (facingDir < 0) {
      ctx.scale(-1, 1);
      ctx.translate(-x * 2, 0);
    }
    ctrl.draw(ctx, x, y);
    ctx.restore();
  }
}