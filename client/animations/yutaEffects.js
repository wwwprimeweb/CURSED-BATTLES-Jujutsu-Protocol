const C = {
  pinkGlow: "#ff66b2",
  pinkCore: "#cc3388",
  pinkLight: "#ff99cc",
  whiteGlow: "#ffe8ff",
};

export function drawM1Slash(ctx, x, y, dirX, dirY, progress, comboStep) {
  if (progress <= 0.01 || progress >= 0.98) return;
  const alpha = Math.min(1, progress * 5) * Math.max(0, 1 - progress * 1.2);
  if (alpha <= 0.01) return;

  const range = 90;
  const extend = Math.min(1, progress * 3.5);
  const angle = Math.atan2(dirY, dirX);
  const endX = x + dirX * range * extend;
  const endY = y + dirY * range * extend;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);

  const shapeLen = range * extend;
  const curv = 20 + comboStep * 10;

  ctx.shadowColor = C.pinkGlow;
  ctx.shadowBlur = 40 + comboStep * 10;
  ctx.globalCompositeOperation = "lighter";

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(shapeLen * 0.4, -curv, shapeLen, -5);
  ctx.quadraticCurveTo(shapeLen * 0.5, curv * 0.3, 0, 0);
  const grad = ctx.createLinearGradient(0, 0, shapeLen, 0);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.3, "#ff99cc");
  grad.addColorStop(0.7, "#ff66b2");
  grad.addColorStop(1, "#cc3388");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();

  if (comboStep === 3 && progress < 0.4) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.shadowColor = C.pinkGlow;
    ctx.shadowBlur = 20;
    for (let i = 0; i < 8; i++) {
      const t = Math.random();
      const dist = range * (0.3 + t * 0.6);
      const spread = (Math.random() - 0.5) * 0.5;
      const a = angle + spread;
      ctx.fillStyle = `rgba(255,200,230,${0.2 + Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawRikaSwing(ctx, x, y, progress) {
  if (progress <= 0 || progress >= 1) return;
  const alpha = Math.min(1, progress * 4) * Math.max(0, 1 - progress);
  if (alpha <= 0.01) return;

  const radius = 60 * progress;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = C.pinkCore;
  ctx.shadowBlur = 30;
  ctx.globalCompositeOperation = "lighter";

  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, "rgba(255,200,230,0.8)");
  grad.addColorStop(0.5, "rgba(204,51,136,0.4)");
  grad.addColorStop(1, "rgba(255,102,178,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,150,200,0.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawPureLoveExplosion(ctx, x, y, radius, progress) {
  if (progress <= 0 || progress >= 1) return;
  const alpha = Math.min(1, progress * 3) * Math.max(0, 1 - progress * 0.8);
  if (alpha <= 0.01) return;

  const currentRadius = radius * progress * 1.2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 80;
  ctx.globalCompositeOperation = "lighter";

  const grad = ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.3, "rgba(255,200,230,0.7)");
  grad.addColorStop(0.6, "rgba(204,51,136,0.4)");
  grad.addColorStop(1, "rgba(255,102,178,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, currentRadius * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawDashSlashTrail(ctx, x, y, dirX, dirY, progress) {
  if (progress <= 0 || progress >= 1) return;
  const alpha = Math.min(1, progress * 3) * Math.max(0, 1 - progress);
  if (alpha <= 0.01) return;

  const trailLen = 80;
  const angle = Math.atan2(dirY, dirX);

  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.shadowColor = C.pinkGlow;
  ctx.shadowBlur = 25;
  ctx.globalCompositeOperation = "lighter";

  ctx.strokeStyle = "#ff99cc";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(angle) * trailLen, y - Math.sin(angle) * trailLen);
  ctx.lineTo(x, y);
  ctx.stroke();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(angle) * trailLen * 0.7, y - Math.sin(angle) * trailLen * 0.7);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}

export function drawRowOfKatanas(ctx, x, y, progress, time) {
  if (progress <= 0) return;
  const alpha = Math.min(1, progress * 2) * (1 - Math.max(0, progress - 0.5) * 2);
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha * 0.4;
  const count = 7;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + time * 0.3;
    const r = 60 + Math.sin(time * 0.5 + i) * 10;
    const kx = x + Math.cos(angle) * r;
    const ky = y + Math.sin(angle) * r;
    const rot = angle + Math.PI * 0.5 + Math.sin(time * 0.7 + i) * 0.3;

    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate(rot);
    ctx.shadowColor = C.pinkGlow;
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#ffb3d9";
    ctx.fillRect(-2, -15, 4, 30);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-1, -10, 2, 20);
    ctx.restore();
  }
  ctx.restore();
}
