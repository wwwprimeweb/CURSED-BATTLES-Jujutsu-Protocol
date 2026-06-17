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
      const damp = Math.pow(p.friction, dt * 60);
      p.vx *= damp;
      p.vy *= damp;
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
      const auraLerp = 1 - Math.pow(1 - 0.05, dt * 60);
      p.x += (p.targetX - p.x) * auraLerp;
      p.y += (p.targetY - p.y) * auraLerp;
      p.size *= Math.pow(0.98, dt * 60);
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
    ctx.lineCap = "round";
    ctx.lineJoin = "miter";
    const t = performance.now() / 1000;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) { ctx.restore(); return; }
    const nx = dx / dist;
    const ny = dy / dist;
    const px = -ny;
    const py = nx;

    // Draw volatile, jagged energy paths
    const drawJaggedPath = (wobbleAmp, freq, speed) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const segments = Math.max(10, Math.floor(dist / 20));
      for (let i = 1; i < segments; i++) {
        const p = i / segments;
        const d = p * dist;
        // Envelope to taper the volatility at the origin and tip
        const envelope = Math.sin(p * Math.PI);
        const w = (Math.sin(d * freq - t * speed) + Math.sin(d * freq * 1.5 + t * speed * 1.2)) * wobbleAmp * envelope;
        ctx.lineTo(x1 + nx * d + px * w, y1 + ny * d + py * w);
      }
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    // Outer glow (deep purple) volatile
    ctx.strokeStyle = "rgba(160, 20, 200, 0.4)";
    ctx.shadowColor = "rgba(200, 50, 255, 0.8)";
    ctx.shadowBlur = 40;
    ctx.lineWidth = width * 1.2;
    drawJaggedPath(width * 0.1, 0.03, 20);
    drawJaggedPath(width * 0.08, 0.05, -15);

    // Main body (vibrant purple/pink)
    ctx.strokeStyle = "rgba(220, 80, 230, 0.85)";
    ctx.shadowBlur = 30;
    ctx.lineWidth = width * 0.8;
    drawJaggedPath(width * 0.06, 0.08, 25);
    drawJaggedPath(width * 0.04, 0.06, -20);

    // Inner bright pink layer (mostly straight but slight wobble)
    ctx.strokeStyle = "rgba(255, 150, 255, 0.95)";
    ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
    ctx.shadowBlur = 20;
    ctx.lineWidth = width * 0.4;
    drawJaggedPath(width * 0.02, 0.1, 30);

    // Core (pure white, straight)
    ctx.strokeStyle = "rgba(255, 255, 255, 1)";
    ctx.shadowColor = "rgba(255, 255, 255, 1)";
    ctx.shadowBlur = 15;
    ctx.lineWidth = width * 0.2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
  }

  static drawPinkSphere(ctx, x, y, radius, progress, alpha = 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const t = performance.now() / 1000;
    const p = progress;
    const ss = (e0, e1, x) => { const c = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return c * c * (3 - 2 * c); };

    const R = radius * Math.pow(p, 0.7);

    // === FRAGMENTOS ORBITAIS (fases 1-2) ===
    const fragAppear = ss(0, 0.08, p);
    const fragFade = 1 - ss(0.3, 0.42, p);
    const fragActive = fragAppear * fragFade;
    if (fragActive > 0.01) {
      ctx.shadowBlur = 0;
      for (let i = 0; i < 24; i++) {
        const baseAngle = (i * 137.5 * Math.PI / 180) % (Math.PI * 2);
        const speed = 0.3 + Math.sin(i * 53.1) * 0.15 + 0.15;
        const jitter = 0.7 + Math.sin(t * 2.3 + i * 7.1) * 0.3;

        const driftW = 1 - ss(0.08, 0.18, p);
        const orbitW = 1 - driftW;
        const driftDist = R * Math.max(0.8, 2.5 - Math.min(p / 0.15, 1) * 1.7);
        const orbitDist = R * (0.5 + Math.min((p - 0.15) / 0.2, 1) * 0.3);
        const dist = driftW * driftDist + orbitW * orbitDist;
        const driftAngle = baseAngle + t * 0.05;
        const orbitAngle = baseAngle + t * speed;
        const angle = driftW * driftAngle + orbitW * orbitAngle;
        const fx = x + Math.cos(angle) * dist;
        const fy = y + Math.sin(angle) * dist;
        const fa = fragActive * (0.4 + (p < 0.15 ? p / 0.15 * 0.2 : 0.2)) * alpha * jitter;
        ctx.globalAlpha = fa;
        ctx.fillStyle = "rgba(255,200,230,1)";
        ctx.beginPath();
        ctx.arc(fx, fy, 1.5 + Math.sin(i * 43.7) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === PARTICULAS ORBITAIS COM ABSORÇÃO (fases 3-5) ===
    const orbitActive = ss(0.3, 0.42, p) * (1 - ss(0.88, 0.95, p));
    if (orbitActive > 0.01) {
      const pCount = 45;
      for (let i = 0; i < pCount; i++) {
        const seedA = i * 137.5 * Math.PI / 180;
        const speed = 0.3 + Math.sin(i * 53.1) * 0.15 + 0.15;
        const dist = 1.0 + (Math.sin(i * 73.3) * 0.5 + 0.5) * 1.3;
        const deathPhase = 0.35 + (i / pCount) * 0.55;
        const absorbStart = deathPhase - 0.12;
        const absorbEnd = deathPhase;

        let orbitR, pa;
        if (p < absorbStart) {
          orbitR = R * dist;
          pa = 1;
        } else if (p < absorbEnd) {
          const tA = (p - absorbStart) / (absorbEnd - absorbStart);
          orbitR = R * (dist - (dist - 0.3) * tA);
          pa = 1 - tA * 0.85;
        } else {
          const fadeOut = Math.max(0, Math.min(1, (p - absorbEnd) / 0.06));
          orbitR = R * 0.3;
          pa = (1 - fadeOut) * 0.15;
        }

        const angle = seedA + t * speed;
        const jitter = 0.7 + Math.sin(t * 1.5 + i * 3.1) * 0.3;
        const partAlpha = orbitActive * pa * alpha * jitter;

        const px = x + Math.cos(angle) * orbitR;
        const py = y + Math.sin(angle) * orbitR;

        // Trail
        ctx.shadowBlur = 0;
        const trailDt = [0.06, 0.12];
        for (let tr = 0; tr < trailDt.length; tr++) {
          const tAngle = angle - speed * trailDt[tr];
          const tx = x + Math.cos(tAngle) * orbitR;
          const ty = y + Math.sin(tAngle) * orbitR;
          ctx.globalAlpha = partAlpha * (0.3 - tr * 0.12);
          ctx.fillStyle = "rgba(255,200,230,1)";
          ctx.beginPath();
          ctx.arc(tx, ty, 2 - tr * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Main particle
        ctx.globalAlpha = partAlpha;
        ctx.fillStyle = "rgba(255,255,255,1)";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#ff66cc";
        const size = 2 + (1 - orbitR / Math.max(R * 0.3, R * dist)) * 2;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();

        // Absorption flash
        if (p >= absorbEnd && p < absorbEnd + 0.04) {
          const flashP = (p - absorbEnd) / 0.04;
          ctx.globalAlpha = (1 - flashP) * partAlpha * 0.6;
          ctx.shadowBlur = 25;
          ctx.shadowColor = "#ff33cc";
          ctx.fillStyle = "rgba(255,255,255,1)";
          const flashR = 3 + flashP * 10;
          ctx.beginPath();
          ctx.arc(px, py, flashR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // === ONDAS CIRCULARES (fase 4) ===
    const waveActive = ss(0.5, 0.58, p) * (1 - ss(0.72, 0.78, p));
    if (waveActive > 0.01) {
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "rgba(255,180,220,1)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const wavePhase = ((t * 6 + i * 0.33) % 1);
        const waveR = R * (0.2 + wavePhase * 0.65);
        const waveAlpha = (1 - wavePhase) * waveActive * 0.25 * alpha;
        ctx.globalAlpha = waveAlpha;
        ctx.beginPath();
        ctx.arc(x, y, waveR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // === PARTICULAS SUGADAS (fase 5) ===
    const suckActive = ss(0.7, 0.78, p) * (1 - ss(0.85, 0.9, p));
    if (suckActive > 0.01) {
      ctx.shadowBlur = 0;
      for (let i = 0; i < 30; i++) {
        const angle = (i * 91.3 * Math.PI / 180) % (Math.PI * 2);
        const spd = Math.sin(i * 37.7) * 0.3 + 0.5;
        const dist = R * (2 + spd) * (1 - Math.min((p - 0.7) / 0.2, 1) * (0.7 + spd * 0.3));
        const px = x + Math.cos(angle + t * 0.2) * dist;
        const py = y + Math.sin(angle + t * 0.2) * dist;
        const jitter = 0.7 + Math.sin(t * 3.1 + i * 5.3) * 0.3;
        const pa = suckActive * (1 - dist / (R * 3)) * 0.5 * alpha * jitter;
        ctx.globalAlpha = pa;
        ctx.fillStyle = "rgba(255,220,240,1)";
        const size = 1 + (1 - dist / (R * 3)) * 1.5;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === NUCLEO / MASSA DENSA (todas as fases) ===
    const corePct = 0.06 + p * 0.32 + ss(0.9, 0.97, p) * 0.47;
    const coreR = R * Math.min(corePct, 0.85);
    const pulseWeight = ss(0.55, 0.75, p);
    const pulseFreq = 10 - pulseWeight * 4;
    const pulseAmp = 0.05 + pulseWeight * 0.2;
    const settleWeight = ss(0.9, 0.95, p);
    const finalAmp = pulseAmp * (1 - settleWeight * 0.8);
    const corePulse = 1 + Math.sin(t * pulseFreq) * finalAmp;
    const coreShadow = 30 + p * 55;

    // Particulas internas sutis
    const partActive = Math.max(0, (p - 0.15) / 0.1);
    if (partActive > 0) {
      ctx.shadowBlur = 0;
      for (let i = 0; i < 10; i++) {
        const seed = i * 73.1;
        const baseAngle = (seed * Math.PI / 180) % (Math.PI * 2);
        const baseDist = coreR * (0.2 + Math.sin(seed * 1.7) * 0.3 + 0.3);
        const dx = Math.sin(t * 0.3 + i * 2.1) * coreR * 0.02;
        const dy = Math.cos(t * 0.4 + i * 1.3) * coreR * 0.02;
        const px = x + Math.cos(baseAngle + t * 0.05) * baseDist + dx;
        const py = y + Math.sin(baseAngle + t * 0.05) * baseDist + dy;
        ctx.globalAlpha = partActive * 0.015 * alpha;
        ctx.fillStyle = "rgba(255,180,220,1)";
        ctx.beginPath();
        ctx.arc(px, py, 1 + Math.sin(seed) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const grad = ctx.createRadialGradient(x, y, 0, x, y, coreR * corePulse * 1.5);
    grad.addColorStop(0, `rgba(255,255,255,${0.95 * alpha})`);
    grad.addColorStop(0.3, `rgba(255,200,230,${0.7 * alpha})`);
    grad.addColorStop(0.6, `rgba(255,51,153,${0.4 * alpha})`);
    grad.addColorStop(1, `rgba(255,102,178,0)`);
    ctx.shadowBlur = coreShadow;
    ctx.shadowColor = "#ff33cc";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, coreR * corePulse * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Borda externa com spikes de energia
    const edgeActive = Math.min(1, p * 1.2);
    if (edgeActive > 0.01) {
      const baseR = coreR * corePulse * 1.5;
      ctx.shadowBlur = 0;

      // Spikes de energia (24, 3 tamanhos)
      for (let i = 0; i < 24; i++) {
        const theta = (i / 24) * Math.PI * 2 + Math.sin(i * 29.3) * 0.35;
        const displace = Math.sin(theta * 3 + t * 1.2) * 0.02 + Math.sin(theta * 5 + t * 0.7) * 0.015;
        const r = baseR * (1 + displace);
        const px = x + Math.cos(theta) * r;
        const py = y + Math.sin(theta) * r;
        const baseLen = i < 8 ? 14 : i < 16 ? 8 : 4;
        const pulse = Math.sin(t * (1.1 + i * 0.13) + i * 2.7) * 0.4 + 0.6;
        const spikeLen = baseLen * pulse;
        const outAngle = theta + Math.sin(i * 37.1 + t * 0.6) * 0.25;
        const ex = px + Math.cos(outAngle) * spikeLen;
        const ey = py + Math.sin(outAngle) * spikeLen;
        ctx.globalAlpha = edgeActive * 0.04 * alpha * pulse;
        ctx.strokeStyle = "rgba(255,200,230,1)";
        ctx.lineWidth = 1.2 + (baseLen / 14) * 0.8;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // Partículas na superfície
      for (let i = 0; i < 20; i++) {
        const theta = (i / 20) * Math.PI * 2 + Math.sin(i * 47.1) * 0.2 + t * 0.03;
        const displace = Math.sin(theta * 3 + t) * 0.02 + Math.sin(theta * 5 + t * 0.7) * 0.015;
        const r = baseR * (1 + displace);
        const px = x + Math.cos(theta) * r;
        const py = y + Math.sin(theta) * r;
        const freq = 1.5 + Math.sin(i * 23.1) * 0.5;
        const pa = (Math.sin(t * freq + i * 3.7) * 0.3 + 0.6) * edgeActive * 0.02 * alpha;
        ctx.globalAlpha = pa;
        ctx.fillStyle = "rgba(255,200,230,1)";
        ctx.beginPath();
        ctx.arc(px, py, 1 + Math.sin(i * 43.1) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (p > 0.88) {
      const dense = ss(0.88, 0.94, p);
      const denseR = R * 0.75 * dense;
      const dGrad = ctx.createRadialGradient(x, y, 0, x, y, denseR);
      dGrad.addColorStop(0, `rgba(255,255,255,${0.5 * dense * alpha})`);
      dGrad.addColorStop(0.5, `rgba(255,150,200,${0.3 * dense * alpha})`);
      dGrad.addColorStop(1, `rgba(255,51,153,0)`);
      ctx.shadowBlur = 0;
      ctx.fillStyle = dGrad;
      ctx.beginPath();
      ctx.arc(x, y, denseR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  static drawPinkSparks(ctx, x, y, radius, progress, alpha = 1) {
    const sparkActive = Math.max(0, Math.min(1, (progress - 0.25) * 2.5));
    if (sparkActive <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const t = performance.now() / 1000;
    const numPoints = 48;
    const waveAmp = 0.02 + Math.pow(progress, 1.5) * 0.12;
    const pulse = 1 + Math.sin(t * 4) * 0.04;
    const cr = radius * pulse;

    const sparkCount = 6 + Math.floor(sparkActive * 12);
    ctx.shadowBlur = 0;
    for (let i = 0; i < sparkCount; i++) {
      const seed = (i * 53.7 + t * 0.7) % 1;
      const theta = (seed * numPoints / numPoints | 0) / numPoints * Math.PI * 2;
      const w1 = Math.sin(theta * 3 - t * 2.0) * waveAmp;
      const w2 = Math.sin(theta * 5 + t * 1.3) * waveAmp * 0.75;
      const w3 = Math.sin(theta * 7 - t * 0.7) * waveAmp * 0.5;
      const r = cr * (1 + w1 + w2 + w3);
      const px = x + Math.cos(theta) * r;
      const py = y + Math.sin(theta) * r;
      const sparkLen = 3 + ((i * 17 + t * 5) % 4) * (0.5 + sparkActive * 0.5);
      const outAngle = theta + Math.sin(i * 27 + t * 2) * 0.6;
      const sx = px + Math.cos(outAngle) * 2;
      const sy = py + Math.sin(outAngle) * 2;
      const ex = sx + Math.cos(outAngle) * sparkLen;
      const ey = sy + Math.sin(outAngle) * sparkLen;
      ctx.globalAlpha = alpha * (0.35 + Math.sin(t * 3 + i * 1.7) * 0.25) * (0.4 + sparkActive * 0.6);
      ctx.strokeStyle = `rgba(255,220,240,${0.6 + sparkActive * 0.4})`;
      ctx.lineWidth = 1.5 + sparkActive * 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
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