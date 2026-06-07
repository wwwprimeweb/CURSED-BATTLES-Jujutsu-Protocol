export class ParticleSystem {
  constructor(max = 800) {
    this.pool = [];
    this.active = [];
    for (let i = 0; i < max; i += 1) {
      this.pool.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0,
        size: 1,
        color: "#ffffff",
      });
    }
  }

  spawnUpwardBurst({ x, y, color = "#ffffff", count = 8, speed = 220, life = 0.26, size = 2.2, spread = 0.8 }) {
    for (let i = 0; i < count; i += 1) {
      if (this.pool.length === 0) return;
      const p = this.pool.pop();
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const s = speed * (0.7 + Math.random() * 0.7);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * s;
      p.vy = Math.sin(angle) * s;
      p.life = life;
      p.maxLife = life;
      p.size = size * (0.7 + Math.random() * 0.7);
      p.color = color;
      this.active.push(p);
    }
  }

  spawnBurst({ x, y, color = "#ffffff", count = 8, speed = 220, life = 0.26, size = 2.2 }) {
    for (let i = 0; i < count; i += 1) {
      if (this.pool.length === 0) {
        return;
      }
      const p = this.pool.pop();
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.26;
      const s = speed * (0.7 + Math.random() * 0.7);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * s;
      p.vy = Math.sin(angle) * s;
      p.life = life;
      p.maxLife = life;
      p.size = size * (0.7 + Math.random() * 0.7);
      p.color = color;
      this.active.push(p);
    }
  }

  spawnLine({ x, y, dirX, dirY, color = "#8cb8ff", count = 10, life = 0.16 }) {
    for (let i = 0; i < count; i += 1) {
      if (this.pool.length === 0) {
        return;
      }
      const p = this.pool.pop();
      const spread = (Math.random() - 0.5) * 0.9;
      p.x = x + dirX * (i * 6);
      p.y = y + dirY * (i * 6);
      p.vx = dirX * (90 + Math.random() * 120) + spread * 80;
      p.vy = dirY * (90 + Math.random() * 120) + spread * 80;
      p.life = life;
      p.maxLife = life;
      p.size = 1.3 + Math.random() * 2.4;
      p.color = color;
      this.active.push(p);
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.active.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const damp = Math.pow(0.92, dt * 60);
      p.vx *= damp;
      p.vy *= damp;
    }
  }

  clear() {
    while (this.active.length > 0) {
      this.pool.push(this.active.pop());
    }
  }

  render(ctx, camera) {
    const zoom = camera.zoom || 1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < this.active.length; i += 1) {
      const p = this.active[i];
      const t = p.life / p.maxLife;
      const sx = (p.x - camera.x) * zoom + ctx.canvas.width * 0.5;
      const sy = (p.y - camera.y) * zoom + ctx.canvas.height * 0.5;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0.08, t);
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * t * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}
