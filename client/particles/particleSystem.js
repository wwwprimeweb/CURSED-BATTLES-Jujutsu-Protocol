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
        borderColor: null,
        borderWidth: 0,
        shape: "circle",
        rotation: 0,
        spin: 0,
        gravity: 0,
        seed: 0,
        damping: 0.92,
        layer: "front",
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
      p.gravity = 0;
      p.seed = 0;
      p.damping = 0.92;
      p.layer = "front";
      this.active.push(p);
    }
  }

  spawnBurst({ x, y, color = "#ffffff", count = 8, speed = 220, life = 0.26, size = 2.2, borderColor, borderWidth }) {
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
      p.shape = "circle";
      p.rotation = 0;
      p.spin = 0;
      p.borderColor = borderColor || null;
      p.borderWidth = borderWidth || 0;
      p.gravity = 0;
      p.seed = 0;
      p.damping = 0.92;
      p.layer = "front";
      this.active.push(p);
    }
  }

  spawnSplatter({ x, y, dirX, dirY, count = 8, speed = 200, life = 0.35, size = 3, gravity = 0.1, spread = 0.6, damping = 0.96, colors } = {}) {
    if (!colors) colors = ["#9933FF", "#7B2DBF", "#4A1A7A", "#8833DD"];
    for (let i = 0; i < count; i += 1) {
      if (this.pool.length === 0) return;
      const p = this.pool.pop();
      const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * spread;
      const s = speed * (0.5 + Math.random());
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * s;
      p.vy = Math.sin(angle) * s;
      p.life = life * (0.7 + Math.random() * 0.3);
      p.maxLife = p.life;
      p.size = size * (0.6 + Math.random() * 0.8);
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.shape = "splatter";
      p.rotation = Math.random() * Math.PI * 2;
      p.spin = (Math.random() - 0.5) * 6;
      p.borderColor = null;
      p.borderWidth = 0;
      p.gravity = gravity;
      p.seed = Math.random() * 1000;
      p.damping = damping;
      p.layer = "back";
      this.active.push(p);
    }
  }

  spawnStars({ x, y, color = "#ffffff", count = 3, radius = 16, life = 0.35, size = 3 }) {
    for (let i = 0; i < count; i += 1) {
      if (this.pool.length === 0) return;
      const p = this.pool.pop();
      const angle = (Math.PI * 2 * i) / Math.max(1, count) + (Math.random() - 0.5) * 0.7;
      const r = radius * (0.7 + Math.random() * 0.5);
      p.x = x + Math.cos(angle) * r;
      p.y = y - 28 + Math.sin(angle) * 4;
      p.vx = (Math.random() - 0.5) * 18;
      p.vy = -8 - Math.random() * 16;
      p.life = life;
      p.maxLife = life;
      p.size = size * (0.8 + Math.random() * 0.4);
      p.color = color;
      p.borderColor = null;
      p.borderWidth = 0;
      p.shape = "star";
      p.rotation = Math.random() * Math.PI * 2;
      p.spin = (Math.random() - 0.5) * 2.0;
      p.gravity = 0;
      p.seed = 0;
      p.damping = 0.92;
      p.layer = "front";
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
      p.gravity = 0;
      p.seed = 0;
      p.damping = 0.92;
      p.layer = "front";
      this.active.push(p);
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
        this.pool.push(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += (p.spin || 0) * dt;
      if (p.gravity) {
        p.vy += p.gravity * 60 * dt;
      }
      const damp = Math.pow(p.damping || 0.92, dt * 60);
      p.vx *= damp;
      p.vy *= damp;
    }
  }

  clear() {
    while (this.active.length > 0) {
      this.pool.push(this.active.pop());
    }
  }

  render(ctx, camera, layerFilter) {
    const zoom = camera.zoom;
    for (let i = 0; i < this.active.length; i += 1) {
      const p = this.active[i];
      if (layerFilter && p.layer !== layerFilter) continue;
      const t = p.life / p.maxLife;
      const alpha = Math.max(0.08, t);
      const sx = (p.x - camera.x) * zoom + ctx.canvas.width * 0.5;
      const sy = (p.y - camera.y) * zoom + ctx.canvas.height * 0.5;
      const r = p.size * t * zoom;

      if (p.borderColor) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.borderColor;
        ctx.beginPath();
        ctx.arc(sx, sy, r + (p.borderWidth || 3) * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      if (!p.borderColor) ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      if (p.shape === "star") {
        ctx.translate(sx, sy);
        ctx.rotate(p.rotation || 0);
        ctx.beginPath();
        for (let k = 0; k < 5; k += 1) {
          const outer = Math.PI / 2 + (k * Math.PI * 2) / 5;
          const inner = outer + Math.PI / 5;
          const ox = Math.cos(outer) * r;
          const oy = Math.sin(outer) * r;
          const ix = Math.cos(inner) * (r * 0.45);
          const iy = Math.sin(inner) * (r * 0.45);
          if (k === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
          ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === "splatter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.translate(sx, sy);
        ctx.rotate(p.rotation || 0);
        const steps = 14;
        const baseR = r;
        ctx.beginPath();
        for (let k = 0; k < steps; k += 1) {
          const a = (k / steps) * Math.PI * 2;
          const wobble = 1 + Math.sin(a * 3 + p.seed) * 0.2 + Math.sin(a * 5 + p.seed * 1.7) * 0.1;
          const rr = baseR * wobble;
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}
