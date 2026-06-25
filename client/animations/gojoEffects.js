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

export function drawHitReaction(ctx, x, y, facing, flashIntensity, zoom = 1) {
  if (flashIntensity <= 0) return;
  ctx.save();
  ctx.globalAlpha = flashIntensity * 0.4;
  ctx.fillStyle = "#ff3030";
  ctx.shadowColor = "#ff0000";
  ctx.shadowBlur = 25 * zoom;
  ctx.beginPath();
  ctx.arc(x, y, 35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawDodgeEffect(ctx, x, y, facing, progress, zoom = 1) {
  if (progress <= 0) return;
  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.5;
  for (let i = 0; i < 4; i++) {
    const offset = i * 10 * (1 - progress);
    ctx.strokeStyle = C.blueGlow;
    ctx.lineWidth = 2.5 - i * 0.5;
    ctx.shadowColor = C.blueCore;
    ctx.shadowBlur = 15 * zoom;
    ctx.beginPath();
    ctx.arc(x - facing * offset, y, 24 - i * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGojoM1Slash(ctx, x, y, dirX, dirY, progress, comboStep, vSprite, hSprite, zoom = 1) {
  if (progress <= 0.01 || progress >= 0.98) return;

  const fadeIn = Math.min(1, progress * 5);
  const fadeOut = Math.max(0, 1 - progress * 1.8);
  const alpha = fadeIn * fadeOut * (3 - 2 * fadeIn) * fadeOut * (3 - 2 * fadeOut);
  if (alpha <= 0.01) return;

  const sprite = comboStep === 2 ? hSprite : vSprite;
  if (!sprite || !sprite.complete || sprite.naturalWidth === 0) return;

  const sizeMap = { 1: 130, 2: 100, 3: 160 };
  const distMap = { 1: 25, 2: 35, 3: 20 };
  const displaySize = (sizeMap[comboStep] || 60) * zoom;

  const frameW = 48;
  const frameH = 48;
  const totalFrames = Math.floor(sprite.naturalWidth / frameW);
  const usableFrames = totalFrames > 5 ? 5 : totalFrames;
  const frameIndex = Math.min(Math.floor(progress * usableFrames), usableFrames - 1);

  const angle = Math.atan2(dirY, dirX);
  const dist = distMap[comboStep] * zoom;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(x, y - 30 * zoom);
  ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;

  ctx.shadowColor = "rgba(255,255,255,0.5)";
  ctx.shadowBlur = 15 * zoom;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, frameIndex * frameW, 0, frameW, frameH, -displaySize / 2, -displaySize / 2, displaySize, displaySize);
  ctx.restore();
}