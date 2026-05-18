import { AuraSystem, SkillVFX } from "../particles/proceduralEffects.js";

const C = {
  skin: "#f0dcc8",
  skinShade: "#c4a888",
  hairMain: "#e8efff",
  hairShade: "#b0c0e0",
  hairHighlight: "#ffffff",
  uniform: "#0c0c18",
  uniformShade: "#181828",
  uniformLight: "#2a2a3e",
  uniformAccent: "#1c1c2c",
  blindfold: "#080810",
  blueGlow: "#60a8ff",
  blueCore: "#2060cc",
  blueBright: "#a0d0ff",
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawPixelCircle(ctx, x, y, radius, fill, stroke = null) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawPixelLine(ctx, x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export class ProceduralGojo {
  constructor() {
    this.aura = new AuraSystem();
    this.time = 0;
    this.auraParticles = [];
  }

  update(dt, x, y, state) {
    this.time += dt;
    if (Math.random() < 0.2) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 20;
      this.auraParticles.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * -8,
        vy: Math.sin(angle) * -8,
        life: 0.6 + Math.random() * 0.4,
        size: 1 + Math.random() * 2,
        alpha: 0.4 + Math.random() * 0.4,
      });
    }
    for (let i = this.auraParticles.length - 1; i >= 0; i--) {
      const p = this.auraParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.size *= 0.98;
      if (p.life <= 0) this.auraParticles.splice(i, 1);
    }
  }

  renderAura(ctx, x, y) {
    for (const p of this.auraParticles) {
      ctx.save();
      ctx.globalAlpha = p.alpha * (p.life / 0.8);
      ctx.shadowColor = C.blueGlow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = C.blueBright;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  render(ctx, x, y, state, facing = 1, alive = true) {
    this.time += 0.016;
    const t = this.time;
    const breathe = Math.sin(t * 2.2) * 0.8;
    const walkCycle = state === "walk" ? Math.sin(t * 7) : 0;
    const runCycle = state === "run" ? Math.sin(t * 12) : 0;
    const lean = state === "run" ? -12 : state === "walk" ? -5 : 0;
    const bobY = state === "walk" ? Math.abs(walkCycle) * 2.4 : state === "run" ? Math.abs(runCycle) * 4 : breathe;
    const speedTrail = state === "run" ? Math.abs(runCycle) * 12 : 0;

    ctx.save();
    if (!alive) ctx.globalAlpha = 0.4;
    if (facing < 0) {
      ctx.scale(-1, 1);
      ctx.translate(-x * 2, 0);
    }
    if (speedTrail > 0) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = C.blueGlow;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x - i * 12, y, 22 - i * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    this.renderAura(ctx, x, y + bobY);
    const baseY = y + bobY;
    this.drawCoatBack(ctx, x, baseY, lean, speedTrail);
    this.drawLegs(ctx, x, baseY, walkCycle, runCycle);
    this.drawCoatFront(ctx, x, baseY, lean, speedTrail);
    this.drawTorso(ctx, x, baseY - 24 + lean);
    this.drawArmBack(ctx, x, baseY - 24, walkCycle, runCycle, t);
    this.drawHead(ctx, x, baseY - 58 + lean, t, state);
    this.drawArmFront(ctx, x, baseY - 24, walkCycle, runCycle, t, state);
    ctx.restore();
  }

  drawLegs(ctx, x, y, walk, run) {
    const spreadL = run ? Math.sin(this.time * 12) * 14 : walk ? Math.sin(this.time * 7) * 8 : -5;
    const spreadR = run ? -Math.sin(this.time * 12) * 14 : walk ? -Math.sin(this.time * 7) * 8 : 5;
    ctx.fillStyle = C.uniform;
    ctx.strokeStyle = C.uniformShade;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 2);
    ctx.lineTo(x - 8 + spreadL, y + 26);
    ctx.lineTo(x - 3 + spreadL, y + 26);
    ctx.lineTo(x - 1, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 2);
    ctx.lineTo(x + 8 + spreadR, y + 26);
    ctx.lineTo(x + 3 + spreadR, y + 26);
    ctx.lineTo(x + 1, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.uniformShade;
    ctx.fillRect(x - 10 + spreadL, y + 22, 10, 4);
    ctx.fillRect(x + spreadR, y + 22, 10, 4);
  }

  drawCoatBack(ctx, x, y, lean, speedTrail) {
    ctx.fillStyle = C.uniform;
    ctx.beginPath();
    ctx.moveTo(x - 20, y + 8);
    ctx.quadraticCurveTo(x - 22 - speedTrail * 0.5, y - 10, x - 22, y - 24);
    ctx.lineTo(x + 22, y - 24);
    ctx.quadraticCurveTo(x + 20 + speedTrail * 0.5, y - 10, x + 20, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.uniformShade;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawCoatFront(ctx, x, y, lean, speedTrail) {
    const trail = speedTrail * 0.3;
    ctx.fillStyle = C.uniform;
    ctx.beginPath();
    ctx.moveTo(x - 16, y + 6);
    ctx.quadraticCurveTo(x - 15 - trail, y - 12, x - 18, y - 22 + lean);
    ctx.lineTo(x + 18, y - 22 + lean);
    ctx.quadraticCurveTo(x + 15 + trail, y - 12, x + 16, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.uniformLight;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = C.uniformAccent;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 22 + lean);
    ctx.lineTo(x, y - 26 + lean);
    ctx.lineTo(x + 6, y - 22 + lean);
    ctx.lineTo(x, y - 18 + lean);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.uniformLight;
    ctx.beginPath();
    ctx.moveTo(x, y - 18 + lean);
    ctx.lineTo(x - 3, y - 14 + lean);
    ctx.lineTo(x + 3, y - 14 + lean);
    ctx.closePath();
    ctx.fill();
  }

  drawTorso(ctx, x, y) {
    ctx.fillStyle = C.uniform;
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 18);
    ctx.lineTo(x - 11, y + 2);
    ctx.lineTo(x - 7, y - 8);
    ctx.lineTo(x + 7, y - 8);
    ctx.lineTo(x + 11, y + 2);
    ctx.lineTo(x + 14, y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.uniformShade;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = C.uniformLight;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 8);
    ctx.lineTo(x, y - 11);
    ctx.lineTo(x + 6, y - 8);
    ctx.lineTo(x + 4, y - 4);
    ctx.lineTo(x, y - 2);
    ctx.lineTo(x - 4, y - 4);
    ctx.closePath();
    ctx.fill();
  }

  drawArmBack(ctx, x, y, walk, run, t) {
    const swing = run ? Math.sin(t * 12 + Math.PI) * 18 : walk ? Math.sin(t * 7 + Math.PI) * 10 : 0;
    const baseX = x - 14;
    ctx.fillStyle = C.uniform;
    ctx.strokeStyle = C.uniformShade;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(baseX - 5, y + 2);
    ctx.lineTo(baseX - 4 + swing * 0.4, y + 16);
    ctx.lineTo(baseX + 3 + swing * 0.4, y + 18);
    ctx.lineTo(baseX + 5, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.skin;
    ctx.strokeStyle = C.skinShade;
    ctx.beginPath();
    ctx.arc(baseX + swing * 0.5, y + 22, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  drawArmFront(ctx, x, y, walk, run, t, state) {
    const swing = run ? Math.sin(t * 12) * 18 : walk ? Math.sin(t * 7) * 10 : 0;
    const punch = state === "m1" ? 28 : 0;
    const baseX = x + 14;
    const punchGlow = state === "m1";
    ctx.fillStyle = C.uniform;
    ctx.strokeStyle = C.uniformShade;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(baseX - 5, y + 2);
    ctx.lineTo(baseX - 4 + swing * 0.4 + punch, y + 16);
    ctx.lineTo(baseX + 3 + swing * 0.4 + punch, y + 18);
    ctx.lineTo(baseX + 5, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.skin;
    ctx.strokeStyle = C.skinShade;
    ctx.beginPath();
    ctx.arc(baseX + swing * 0.5 + punch, y + 22, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (punchGlow) {
      ctx.save();
      ctx.shadowColor = C.blueGlow;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = C.blueBright;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(baseX + swing * 0.5 + punch, y + 18);
      ctx.lineTo(baseX + swing * 0.5 + punch + 18, y + 16);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawHead(ctx, x, y, t, state) {
    this.drawHairBack(ctx, x, y, t, state);
    ctx.fillStyle = C.skin;
    ctx.strokeStyle = C.skinShade;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this.drawEyes(ctx, x, y, t);
    this.drawMouth(ctx, x, y);
    this.drawHairFront(ctx, x, y, t, state);
  }

  drawHairBack(ctx, x, y, t, state) {
    const sway = Math.sin(t * 1.8) * (state === "run" ? 5 : 2);
    const spikes = [
      { a: -1.2, l: 14, w: 5 },
      { a: -0.85, l: 20, w: 6 },
      { a: -0.45, l: 24, w: 7 },
      { a: -0.1, l: 26, w: 7 },
      { a: 0.25, l: 24, w: 7 },
      { a: 0.6, l: 20, w: 6 },
      { a: 0.95, l: 16, w: 5 },
    ];
    ctx.fillStyle = C.hairMain;
    ctx.strokeStyle = C.hairShade;
    ctx.lineWidth = 1;
    for (const sp of spikes) {
      const bx = x + Math.cos(sp.a) * 10;
      const by = y - 10;
      const tx = bx + Math.cos(sp.a + sway * 0.03) * sp.l;
      const ty = by + Math.sin(sp.a) * sp.l * 0.7 - 6;
      ctx.beginPath();
      ctx.moveTo(bx - sp.w * 0.5, by);
      ctx.lineTo(tx, ty);
      ctx.lineTo(bx + sp.w * 0.5, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = C.hairShade;
    ctx.beginPath();
    ctx.arc(x, y - 6, 15, Math.PI * 0.85, Math.PI * 2.15);
    ctx.fill();
    ctx.fillStyle = C.hairMain;
    ctx.beginPath();
    ctx.arc(x, y - 8, 15, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  drawHairFront(ctx, x, y, t, state) {
    const sway = Math.sin(t * 1.8) * (state === "run" ? 4 : 1.5);
    ctx.fillStyle = C.hairMain;
    const bang1 = x - 8 + sway * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 14);
    ctx.quadraticCurveTo(x - 12 + sway, y - 8, bang1, y - 2);
    ctx.quadraticCurveTo(x - 6, y - 10, x - 10, y - 14);
    ctx.fill();
    const bang2 = x + 6 - sway * 0.3;
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 14);
    ctx.quadraticCurveTo(x + 8 - sway, y - 8, bang2, y - 1);
    ctx.quadraticCurveTo(x + 4, y - 10, x + 10, y - 14);
    ctx.fill();
  }

  drawEyes(ctx, x, y, t) {
    const blink = Math.sin(t * 0.3) > 0.95 ? 0.2 : 1;
    ctx.fillStyle = C.blueGlow;
    ctx.shadowColor = C.blueCore;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(x - 5, y - 1, 3, 3 * blink, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 5, y - 1, 3, 3 * blink, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (blink > 0.5) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(x - 4, y - 2, 1, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 6, y - 2, 1, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawMouth(ctx, x, y) {
    ctx.strokeStyle = C.skinShade;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 5);
    ctx.quadraticCurveTo(x, y + 6, x + 3, y + 5);
    ctx.stroke();
  }
}

export class GojoSkillEffects {
  constructor() {
    this.projectiles = [];
    this.beams = [];
    this.explosions = [];
    this.teleports = [];
    this.domains = [];
    this.afterimages = [];
    this.blueImg = new Image();
    this.blueImg.src = "/assets/habilit/blue.png";
  }

  addBlue(x, y, vx, vy) {
    this.projectiles.push({ type: "blue", x, y, vx, vy, life: 3.5, maxLife: 3.5, radius: 22 });
  }

  addRed(x, y, vx, vy) {
    this.projectiles.push({ type: "red", x, y, vx, vy, life: 0.8, maxLife: 0.8, radius: 18 });
  }

  addPurpleBeam(x1, y1, x2, y2) {
    this.beams.push({ x1, y1, x2, y2, life: 0.6, maxLife: 0.6 });
  }

  addExplosion(x, y, type, radius = 100) {
    this.explosions.push({ x, y, type, radius, life: 0.5, maxLife: 0.5 });
  }

  addTeleport(x, y) {
    this.teleports.push({ x, y, life: 0.35, maxLife: 0.35 });
  }

  addAfterimage(x, y, facing) {
    this.afterimages.push({ x, y, facing, life: 0.3, maxLife: 0.3 });
  }

  addDomain(x, y, radius, ownerId, myId) {
    this.domains.push({ x, y, radius, ownerId, myId, life: 10, maxLife: 10 });
  }

  update(dt) {
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);

    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter(b => b.life > 0);

    for (const e of this.explosions) e.life -= dt;
    this.explosions = this.explosions.filter(e => e.life > 0);

    for (const t of this.teleports) t.life -= dt;
    this.teleports = this.teleports.filter(t => t.life > 0);

    for (const a of this.afterimages) a.life -= dt;
    this.afterimages = this.afterimages.filter(a => a.life > 0);

    for (const d of this.domains) d.life -= dt;
    this.domains = this.domains.filter(d => d.life > 0);
  }

  render(ctx, camera) {
    const w2s = (wx, wy) => ({
      x: wx - camera.x + ctx.canvas.width * 0.5,
      y: wy - camera.y + ctx.canvas.height * 0.5,
    });

    for (const a of this.afterimages) {
      const s = w2s(a.x, a.y);
      const t = a.life / a.maxLife;
      ctx.save();
      ctx.globalAlpha = t * 0.4;
      ctx.fillStyle = C.blueGlow;
      ctx.shadowColor = C.blueCore;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const t of this.teleports) {
      const s = w2s(t.x, t.y);
      const prog = 1 - t.life / t.maxLife;
      ctx.save();
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(96,168,255,${(1 - prog) * (1 - i * 0.3)})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = C.blueGlow;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(s.x, s.y, (15 + i * 12) * prog, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const d of this.domains) {
      const s = w2s(d.x, d.y);
      const alpha = Math.min(1, (d.maxLife - d.life) * 2) * Math.min(1, d.life / 3);
      ctx.save();
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, d.radius);
      grad.addColorStop(0, `rgba(180,220,255,${alpha * 0.12})`);
      grad.addColorStop(0.7, `rgba(140,180,255,${alpha * 0.06})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, d.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(160,210,255,${alpha})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = C.blueBright;
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(s.x, s.y, d.radius, 0, Math.PI * 2);
      ctx.stroke();
      const t = Date.now() * 0.002;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + t;
        const sx = s.x + Math.cos(angle) * d.radius;
        const sy = s.y + Math.sin(angle) * d.radius;
        ctx.fillStyle = `rgba(220,240,255,${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const b of this.beams) {
      const s1 = w2s(b.x1, b.y1);
      const s2 = w2s(b.x2, b.y2);
      const t = b.life / b.maxLife;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.shadowColor = "#c080ff";
      ctx.shadowBlur = 40;
      const gradient = ctx.createLinearGradient(s1.x, s1.y, s2.x, s2.y);
      gradient.addColorStop(0, "rgba(180,80,255,0.9)");
      gradient.addColorStop(0.5, "rgba(220,140,255,1)");
      gradient.addColorStop(1, "rgba(200,100,255,0.9)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 40 * t;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
      ctx.shadowBlur = 20;
      ctx.strokeStyle = "rgba(240,200,255,0.8)";
      ctx.lineWidth = 15 * t;
      ctx.stroke();
      ctx.restore();
    }

    for (const e of this.explosions) {
      const s = w2s(e.x, e.y);
      const t = e.life / e.maxLife;
      ctx.save();
      ctx.globalAlpha = t;
      const r = e.radius * (2 - t);
      if (e.type === "purple") {
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        grad.addColorStop(0, "rgba(220,160,255,0.9)");
        grad.addColorStop(0.5, "rgba(160,80,255,0.5)");
        grad.addColorStop(1, "rgba(80,20,200,0)");
        ctx.fillStyle = grad;
        ctx.shadowColor = "#c080ff";
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === "red") {
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        grad.addColorStop(0, "rgba(255,150,150,0.9)");
        grad.addColorStop(0.5, "rgba(255,60,80,0.4)");
        grad.addColorStop(1, "rgba(200,0,40,0)");
        ctx.fillStyle = grad;
        ctx.shadowColor = "#ff4060";
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const p of this.projectiles) {
      const s = w2s(p.x, p.y);
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = t;
      if (p.type === "blue") {
        const size = p.radius * 2 * 1.4;
        if (this.blueImg.complete && this.blueImg.naturalWidth > 0) {
          ctx.shadowColor = C.blueGlow;
          ctx.shadowBlur = 25;
          ctx.drawImage(this.blueImg, s.x - size / 2, s.y - size / 2, size, size);
        } else {
          ctx.fillStyle = "#4cb4ff";
          ctx.shadowColor = C.blueGlow;
          ctx.shadowBlur = 25;
          ctx.beginPath();
          ctx.arc(s.x, s.y, p.radius * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.type === "red") {
        const angle = Math.atan2(p.vy, p.vx);
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, p.radius);
        grad.addColorStop(0, "rgba(255,220,220,1)");
        grad.addColorStop(0.4, "rgba(255,80,100,0.9)");
        grad.addColorStop(1, "rgba(200,20,60,0)");
        ctx.fillStyle = grad;
        ctx.shadowColor = "#ff4060";
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(s.x, s.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,200,200,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x - Math.cos(angle) * p.radius * 2, s.y - Math.sin(angle) * p.radius * 2);
        ctx.lineTo(s.x + Math.cos(angle) * p.radius * 0.5, s.y + Math.sin(angle) * p.radius * 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  clear() {
    this.projectiles = [];
    this.beams = [];
    this.explosions = [];
    this.teleports = [];
    this.domains = [];
    this.afterimages = [];
  }
}