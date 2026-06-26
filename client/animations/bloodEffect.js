const META_PATH = "/assets/bloodfx/blood_frames.json";
const SHEET_PATH = "/assets/bloodfx/blood_sheet.png";
const BLOOD_OFFSET = 20;

export class BloodEffect {
  constructor() {
    this.animations = [];
    this.bursts = [];
    this._loaded = false;
    this.sheetImg = new Image();
  }

  async load() {
    try {
      // Load sprite sheet image
      const imgPromise = new Promise((resolve, reject) => {
        this.sheetImg.onload = resolve;
        this.sheetImg.onerror = () => reject(new Error("Failed to load blood sheet"));
        this.sheetImg.src = SHEET_PATH;
      });

      // Load metadata
      const res = await fetch(META_PATH);
      const meta = await res.json();
      
      await imgPromise;
      
      // meta is an array of animations
      this.animations = meta;
      
      this._loaded = true;
      console.log("Blood: loaded " + this.animations.length + " animations from spritesheet");
    } catch (e) {
      console.warn("Blood: Failed to load", e);
    }
  }

  spawnBurst(x, y, dirX, dirY, damage, targetId) {
    if (!this._loaded) return;
    if (damage < 20) return;

    // Normalize direction
    const norm = Math.sqrt(dirX * dirX + dirY * dirY);
    let dx = 1, dy = 0;
    if (norm >= 0.01) {
      dx = dirX / norm;
      dy = dirY / norm;
    }

    // Damage scaling (max 200 damage)
    // Smallest damage (e.g., 5) -> scale ~0.5, 1 burst
    // Max damage (200) -> scale ~1.8, 2-3 bursts
    const clampedDamage = Math.min(Math.max(damage, 0), 200);
    const intensity = clampedDamage / 200; // 0.0 to 1.0

    const numBursts = Math.floor(1 + intensity * 2); // 1 to 3 bursts
    const baseScale = 0.5 + intensity * 1.3; // 0.5 to 1.8

    // The angle the blood should spray towards. 
    // If attack comes from left to right (dx > 0), blood sprays right.
    const baseAngle = Math.atan2(dy, dx);

    for (let i = 0; i < numBursts; i++) {
      // Pick a random animation from the 9 available
      const animIdx = Math.floor(Math.random() * this.animations.length);
      const anim = this.animations[animIdx];
      if (!anim || !anim.frames || anim.frames.length === 0) continue;
      
      const frameDelay = 60; // 60ms per frame
      const life = (anim.frames.length * frameDelay) / 1000;
      
      // Randomize angle a bit
      const angleOffset = (Math.random() - 0.5) * 1.0; // +/- ~28 degrees
      const finalAngle = baseAngle + angleOffset;
      
      // Offset from the center of the player
      // "sai do ponto contrario do ataque" means it originates from the impact point and flies outward in the direction of the attack.
      // dx, dy is already target.x - attacker.x (direction of attack)
      // So blood sprays in dx, dy direction
      const finalDx = Math.cos(finalAngle);
      const finalDy = Math.sin(finalAngle);

      // Randomize scale per burst
      const burstScale = baseScale * (0.8 + Math.random() * 0.4); 

      // Shift the initial spawn point up so it comes from the torso instead of the feet
      const TORSO_OFFSET_Y = -65;

      this.bursts.push({
        x: x + finalDx * BLOOD_OFFSET,
        y: y + TORSO_OFFSET_Y + finalDy * BLOOD_OFFSET,
        targetId,
        offsetX: finalDx * BLOOD_OFFSET,
        offsetY: TORSO_OFFSET_Y + finalDy * BLOOD_OFFSET,
        anim,
        frameIdx: 0,
        frameTimer: 0,
        frameDelay: frameDelay,
        startScale: burstScale,
        endScale: burstScale * 1.2, // slightly expand over time
        life,
        maxLife: life,
        angle: finalAngle,
      });
    }
  }

  update(dt, players) {
    if (!this._loaded) return;
    const msDt = dt * 1000;

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];

      // Acompanha jogador (sticks to player)
      if (b.targetId && players) {
        const entry = players.get(b.targetId);
        if (entry) {
          b.x = entry.x + b.offsetX;
          b.y = entry.y + b.offsetY;
        }
      }
      
      b.life -= dt;
      if (b.life <= 0) { 
        this.bursts.splice(i, 1); 
        continue; 
      }

      b.frameTimer += msDt;
      if (b.frameTimer >= b.frameDelay && b.frameIdx < b.anim.frames.length - 1) {
        b.frameTimer -= b.frameDelay;
        b.frameIdx++;
      }

      const t = 1 - b.life / b.maxLife;
      b.scale = b.startScale + (b.endScale - b.startScale) * t;
    }
  }

  render(ctx, camera) {
    if (!this._loaded || this.bursts.length === 0) return;

    for (const b of this.bursts) {
      const frameData = b.anim.frames[b.frameIdx];
      if (!frameData) continue;

      const t = 1 - b.life / b.maxLife;
      const alpha = Math.max(0, (1 - t * t)); // Fade out quadratically at the end

      const sx = (b.x - camera.x) * camera.zoom + ctx.canvas.width * 0.5;
      const sy = (b.y - camera.y) * camera.zoom + ctx.canvas.height * 0.5;
      
      // Original frame size
      const fw = frameData.w;
      const fh = b.anim.h;
      
      const renderW = fw * b.scale * camera.zoom;
      const renderH = fh * b.scale * camera.zoom;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sx, sy);
      // The sprites are drawn horizontally, so no need for Math.PI/4 offset if the sprite's natural direction is "right"
      // Assuming blood sprites are drawn flying to the right. 
      ctx.rotate(b.angle);
      
      // Draw from spritesheet
      // dx, dy, dw, dh
      ctx.drawImage(
        this.sheetImg, 
        frameData.x, b.anim.y, fw, fh, 
        -renderW / 2, -renderH / 2, renderW, renderH
      );
      
      ctx.restore();
    }
  }

  clear() {
    this.bursts.length = 0;
  }
}
