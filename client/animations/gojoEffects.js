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

export function drawGojoM1Sprite(ctx, x, y, dirX, dirY, progress, comboStep, sprite) {
  if (progress <= 0.01 || progress >= 0.98) return;

  const rawFadeIn = Math.min(1, progress * 4);
  const fadeIn = rawFadeIn * rawFadeIn * (3 - 2 * rawFadeIn);
  const rawFadeOut = Math.max(0, 1 - progress * 1.4);
  const fadeOut = rawFadeOut * rawFadeOut * (3 - 2 * rawFadeOut);
  const alpha = fadeIn * fadeOut;
  if (alpha <= 0.01) return;

  const angle = Math.atan2(dirY, dirX);
  const range = 85;
  const moveIn = 0.7;
  const spriteDist = range * 1.15 * moveIn;
  const perpX = -dirY;
  const perpY = dirX;
  const offsetMap = { 1: 0, 2: 35, 3: 18 };
  const offset = offsetMap[comboStep] || 0;
  const baseY = y - 25;
  const sx = Math.cos(angle) * spriteDist + perpX * offset;
  const sy = Math.sin(angle) * spriteDist + perpY * offset;

  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    const aspect = sprite.naturalWidth / sprite.naturalHeight;
    const sizes = { 1: 65, 2: 85, 3: 75 };
    const spriteHeight = (sizes[comboStep] || 65) * 0.7;
    const spriteWidth = spriteHeight * aspect;

    ctx.save();
    ctx.translate(x, baseY);
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
    ctx.restore();
  }
}