const C = {
  skin: "#f0dcc8",
  hairMain: "#e8efff",
  uniform: "#0c0c18",
  uniformShade: "#181828",
  uniformLight: "#2a2a3e",
  blueGlow: "#60a8ff",
  blueCore: "#2060cc",
};

export function drawDeathPose(ctx, x, y, progress, time) {
  ctx.save();
  ctx.globalAlpha = Math.max(0.15, 1 - progress * 0.85);

  const fallAngle = progress * Math.PI * 0.45;
  ctx.translate(x, y);
  ctx.rotate(fallAngle);
  ctx.translate(-x, -y);

  const breathe = Math.sin(time * 1.5) * 0.5;
  const baseY = y + breathe;

  ctx.fillStyle = C.uniform;
  ctx.beginPath();
  ctx.moveTo(x - 20, baseY + 10);
  ctx.quadraticCurveTo(x - 22, baseY - 10, x - 22, baseY - 22);
  ctx.lineTo(x + 22, baseY - 22);
  ctx.quadraticCurveTo(x + 20, baseY - 10, x + 20, baseY + 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.uniform;
  ctx.beginPath();
  ctx.moveTo(x - 8, baseY);
  ctx.lineTo(x - 10 + Math.sin(time * 3) * 2, baseY + 26);
  ctx.lineTo(x - 3 + Math.sin(time * 3) * 2, baseY + 26);
  ctx.lineTo(x, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 8, baseY);
  ctx.lineTo(x + 10 - Math.sin(time * 3) * 2, baseY + 26);
  ctx.lineTo(x + 3 - Math.sin(time * 3) * 2, baseY + 26);
  ctx.lineTo(x, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.hairMain;
  const spikes = [
    { a: -1.0, l: 12, w: 4 },
    { a: -0.6, l: 16, w: 5 },
    { a: -0.2, l: 18, w: 5 },
    { a: 0.2, l: 18, w: 5 },
    { a: 0.6, l: 14, w: 4 },
    { a: 1.0, l: 10, w: 4 },
  ];
  for (const sp of spikes) {
    const bx = x + Math.cos(sp.a) * 8;
    const by = baseY - 58;
    ctx.beginPath();
    ctx.moveTo(bx - sp.w * 0.5, by);
    ctx.lineTo(bx + Math.cos(sp.a) * sp.l, by + Math.sin(sp.a) * sp.l * 0.6 - 4);
    ctx.lineTo(bx + sp.w * 0.5, by);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = C.hairMain;
  ctx.beginPath();
  ctx.arc(x, baseY - 52, 14, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(x, baseY - 52, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = C.blueGlow;
  ctx.globalAlpha = ctx.globalAlpha * 0.25;
  ctx.beginPath();
  ctx.ellipse(x - 4, baseY - 53, 2.5, 2, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 4, baseY - 53, 2.5, 2, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = Math.max(0.15, 1 - progress * 0.85);

  ctx.fillStyle = "#cc3344";
  ctx.beginPath();
  ctx.ellipse(x + 4, baseY - 46, 5, 3, 0.2, 0, Math.PI * 2);
  ctx.fill();

  if (progress < 0.8) {
    ctx.globalAlpha = (1 - progress) * 0.3;
    ctx.fillStyle = C.blueGlow;
    ctx.beginPath();
    ctx.arc(x, baseY - 52, 30 * (1 - progress * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawHitReaction(ctx, x, y, facing, flashIntensity) {
  if (flashIntensity <= 0) return;
  ctx.save();
  ctx.globalAlpha = flashIntensity * 0.4;
  ctx.fillStyle = "#ff3030";
  ctx.shadowColor = "#ff0000";
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.arc(x, y, 35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawDodgeEffect(ctx, x, y, facing, progress) {
  if (progress <= 0) return;
  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.5;
  for (let i = 0; i < 4; i++) {
    const offset = i * 10 * (1 - progress);
    ctx.strokeStyle = C.blueGlow;
    ctx.lineWidth = 2.5 - i * 0.5;
    ctx.shadowColor = C.blueCore;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(x - facing * offset, y, 24 - i * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawM1Punch(ctx, x, y, dirX, dirY, progress, comboStep, time) {
  if (progress <= 0.01 || progress >= 0.98) return;

  const alpha = Math.min(1, progress * 5) * Math.max(0, 1 - progress * 1.2);
  if (alpha <= 0.01) return;

  const range = 85;
  const extend = Math.min(1, progress * 3.5);
  const angle = Math.atan2(dirY, dirX);
  const endX = x + dirX * range * extend;
  const endY = y + dirY * range * extend;
  const wMul = 0.3 + comboStep * 0.35;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);

  const shapeLen = range * extend;
  const cp1x = shapeLen * 0.44;
  const cp1y = -30 * wMul;
  const epx = shapeLen;
  const epy = -10 * wMul;
  const cp2x = shapeLen * 0.55;
  const cp2y = 5 * wMul;

  ctx.shadowColor = "#4488ff";
  ctx.shadowBlur = 50 + comboStep * 15;
  ctx.globalCompositeOperation = "lighter";

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(cp1x, cp1y, epx, epy);
  ctx.quadraticCurveTo(cp2x, cp2y, 0, 0);
  const grad = ctx.createLinearGradient(0, 0, shapeLen, 0);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.4, "#6fefff");
  grad.addColorStop(1, "#32d6c9");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();

  if (comboStep === 3 && progress < 0.4) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.shadowBlur = 0;
    for (let i = 0; i < 4; i++) {
      const seed = i * 0.618;
      const dist = range * (0.3 + seed * 0.4);
      const spread = (seed - 0.5) * 0.4;
      const a = angle + spread;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + seed * 0.2})`;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist, 1.5 + seed * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}