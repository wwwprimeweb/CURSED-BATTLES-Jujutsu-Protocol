export class ParticleEmitter {
  constructor() {
    this.particles = [];
  }

  emit(x, y, config) {
    const {
      color = "#ffffff",
      count = 1,
      speed = 100,
      life = 0.5,
      size = 3,
      angle = null,
      spread = Math.PI * 2,
      gravity = 0,
      friction = 0.95,
      glow = false,
    } = config;

    for (let i = 0; i < count; i++) {
      const dir = angle !== null ? angle + (Math.random() - 0.5) * spread : Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x, y,
        vx: Math.cos(dir) * spd,
        vy: Math.sin(dir) * spd,
        life,
        maxLife: life,
        size,
        color,
        glow,
        gravity,
        friction,
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  render(ctx) {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, t);
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 3;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }
}

export class AuraSystem {
  constructor() {
    this.particles = [];
    this.time = 0;
  }

  update(dt, x, y, intensity = 1) {
    this.time += dt;
    if (Math.random() < 0.3 * intensity) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * 15;
      this.particles.push({
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        targetX: x + Math.cos(angle) * (radius + 10),
        targetY: y + Math.sin(angle) * (radius + 10),
        life: 0.8 + Math.random() * 0.4,
        maxLife: 0.8 + Math.random() * 0.4,
        size: 1.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      p.x += (p.targetX - p.x) * 0.05;
      p.y += (p.targetY - p.y) * 0.05;
      p.size *= 0.98;
    }
  }

  render(ctx) {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = t * 0.6;
      ctx.fillStyle = "#88ccff";
      ctx.shadowColor = "#4488ff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export class SkillVFX {
  static drawBlue(ctx, x, y, size = 20) {
    ctx.save();
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    gradient.addColorStop(0, "rgba(120,200,255,0.95)");
    gradient.addColorStop(0.4, "rgba(80,160,255,0.7)");
    gradient.addColorStop(1, "rgba(40,100,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(180,220,255,0.8)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#66aaff";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  static drawRed(ctx, x, y, vx, vy, size = 16) {
    ctx.save();
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    gradient.addColorStop(0, "rgba(255,150,150,1)");
    gradient.addColorStop(0.5, "rgba(255,80,100,0.8)");
    gradient.addColorStop(1, "rgba(255,40,60,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    const angle = Math.atan2(vy, vx);
    ctx.strokeStyle = "rgba(255,200,200,0.9)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ff4466";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * size * 1.5, y - Math.sin(angle) * size * 1.5);
    ctx.lineTo(x + Math.cos(angle) * size * 0.5, y + Math.sin(angle) * size * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  static drawPurpleBeam(ctx, x1, y1, x2, y2, width = 30) {
    ctx.save();
    ctx.strokeStyle = "rgba(180,100,255,0.9)";
    ctx.shadowColor = "rgba(200,130,255,1)";
    ctx.shadowBlur = 30;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(220,180,255,0.7)";
    ctx.lineWidth = width * 0.4;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.restore();
  }

  static drawPinkBeam(ctx, x1, y1, x2, y2, width = 30, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(255,102,178,0.9)";
    ctx.shadowColor = "rgba(255,51,153,1)";
    ctx.shadowBlur = 40;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,200,230,0.7)";
    ctx.lineWidth = width * 0.35;
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.restore();
  }

  static drawPinkSphere(ctx, x, y, radius, progress, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const pulse = 1 + Math.sin(progress * Math.PI * 6) * 0.08;
    const currentRadius = radius * pulse;
    ctx.shadowColor = "rgba(255,51,153,1)";
    ctx.shadowBlur = 60;
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
    grad.addColorStop(0, `rgba(255,255,255,${0.95 * alpha})`);
    grad.addColorStop(0.2, `rgba(255,200,230,${0.7 * alpha})`);
    grad.addColorStop(0.5, `rgba(255,51,153,${0.4 * alpha})`);
    grad.addColorStop(1, `rgba(255,102,178,0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static drawPurpleExplosion(ctx, x, y, radius) {
    ctx.save();
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(220,180,255,0.9)");
    gradient.addColorStop(0.5, "rgba(160,80,255,0.5)");
    gradient.addColorStop(1, "rgba(100,40,200,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static drawTeleportDistortion(ctx, x, y, progress) {
    ctx.save();
    const radius = 30 * progress;
    ctx.strokeStyle = `rgba(150,200,255,${1 - progress})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = "#66aaff";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  static drawDomainRing(ctx, x, y, radius, alpha) {
    ctx.save();
    ctx.strokeStyle = `rgba(180,220,255,${alpha})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#88bbff";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Date.now() * 0.001;
      const sx = x + Math.cos(angle) * radius;
      const sy = y + Math.sin(angle) * radius;
      ctx.fillStyle = `rgba(200,230,255,${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  static drawHitFlash(ctx, x, y, size = 30) {
    ctx.save();
    ctx.fillStyle = "rgba(255,100,100,0.4)";
    ctx.shadowColor = "#ff4444";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static drawBluePullEffect(ctx, x, y, radius) {
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Date.now() * 0.003;
      const r = radius * 0.5 + Math.sin(Date.now() * 0.005 + i) * radius * 0.2;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      ctx.strokeStyle = "rgba(100,180,255,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(angle) * 20, py + Math.sin(angle) * 20);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    ctx.restore();
  }

  static drawRedExplosion(ctx, x, y, radius) {
    ctx.save();
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(255,150,150,0.9)");
    gradient.addColorStop(0.6, "rgba(255,80,100,0.4)");
    gradient.addColorStop(1, "rgba(255,40,60,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,200,200,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}