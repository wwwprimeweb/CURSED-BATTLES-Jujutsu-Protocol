const C = {
  pinkGlow: "#ff66b2",
  pinkCore: "#cc3388",
  pinkLight: "#ff99cc",
  whiteGlow: "#ffe8ff",
};

export function drawRikaAreaExplosion(ctx, x, y, radius, progress, time) {
  if (progress <= 0 || progress >= 1) return;
  const alpha = Math.min(1, progress * 6) * Math.max(0, 1 - progress * 0.9);
  if (alpha <= 0.01) return;

  const currentRadius = radius * Math.min(1, progress * 1.5);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = C.whiteGlow;
  ctx.shadowBlur = 50;
  ctx.globalCompositeOperation = "lighter";

  const grad = ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.2, "rgba(255,200,230,0.7)");
  grad.addColorStop(0.5, "rgba(204,51,136,0.4)");
  grad.addColorStop(1, "rgba(255,102,178,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255,200,230,${alpha * 0.5})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, currentRadius * 0.7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.4})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, currentRadius * 0.3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export function drawRikaShockwave(ctx, x, y, radius, progress, intensity = 1) {
  if (progress <= 0 || progress >= 1) return;
  const alpha = Math.min(1, progress * 4.6) * Math.max(0, 1 - progress * 0.95) * intensity;
  if (alpha <= 0.01) return;

  const ringRadius = radius * (0.25 + progress * 0.95);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.shadowColor = C.whiteGlow;
  ctx.shadowBlur = 30 + 30 * alpha;

  ctx.strokeStyle = "rgba(255,230,245,0.95)";
  ctx.lineWidth = Math.max(2, radius * 0.035);
  ctx.beginPath();
  ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.65;
  ctx.strokeStyle = "rgba(255,120,200,0.8)";
  ctx.lineWidth = Math.max(1.5, radius * 0.022);
  ctx.beginPath();
  ctx.arc(x, y, ringRadius * 1.12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export function drawM1Combined(ctx, x, y, dirX, dirY, progress, comboStep, range, coneAngle) {
  if (progress <= 0.01 || progress >= 0.98) return;
  const fastPhase = Math.min(1, progress * 8);
  const fadePhase = Math.max(0, 1 - Math.max(0, progress - 0.4) * 1.67);
  const alpha = fastPhase * fadePhase;
  if (alpha <= 0.01) return;

  const angle = Math.atan2(dirY, dirX);
  const sweepAngle = 1.0 + comboStep * 0.08;
  const arcStart = angle - sweepAngle * 0.5;
  const arcEnd = arcStart + sweepAngle * Math.min(1, progress * 3);
  const bladeLen = range * 0.95;
  const innerR = 30;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = "lighter";

  ctx.globalAlpha = alpha * 0.2;
  ctx.shadowColor = "#ff1a80";
  ctx.shadowBlur = 60;
  ctx.fillStyle = "rgba(255,26,128,0.12)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, bladeLen + 16, arcStart, arcEnd);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = alpha * 0.5;
  ctx.shadowColor = "#ff3388";
  ctx.shadowBlur = 40;
  const bladeGrad = ctx.createRadialGradient(0, 0, innerR * 0.5, 0, 0, bladeLen);
  bladeGrad.addColorStop(0, "rgba(255,240,250,0)");
  bladeGrad.addColorStop(0.35, "rgba(255,180,230,0.12)");
  bladeGrad.addColorStop(0.7, "rgba(255,80,190,0.35)");
  bladeGrad.addColorStop(0.9, "rgba(255,50,160,0.55)");
  bladeGrad.addColorStop(1, "rgba(255,40,150,0.1)");
  ctx.fillStyle = bladeGrad;
  ctx.beginPath();
  ctx.arc(0, 0, bladeLen, arcStart, arcEnd);
  ctx.arc(0, 0, innerR, arcEnd, arcStart, true);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = alpha * 0.7;
  ctx.shadowColor = "#ff66cc";
  ctx.shadowBlur = 25;
  ctx.strokeStyle = "rgba(255,102,204,0.8)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, bladeLen, arcStart + 0.05, arcEnd - 0.05);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.5;
  for (let i = 0; i < 8 + comboStep * 3; i += 1) {
    const t = Math.random();
    const a = arcStart + t * (arcEnd - arcStart);
    const dist = bladeLen * (0.7 + Math.random() * 0.28);
    ctx.fillStyle = "#ffb3d9";
    ctx.beginPath();
    ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 1.5 + Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
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

function normalizeDir(x, y) {
  const len = Math.hypot(x, y);
  if (len < 0.001) return { x: 1, y: 0 };
  return { x: x / len, y: y / len };
}

export function drawRikaClawScratch(ctx, x, y, dirX, dirY, progress, intensity = 1) {
  if (progress <= 0 || progress >= 1) return;
  const a = Math.min(1, progress * 4.8) * Math.max(0, 1 - progress * 1.08) * intensity;
  if (a <= 0.01) return;

  const dir = normalizeDir(dirX, dirY);
  const angle = Math.atan2(dir.y, dir.x);
  const extend = 0.2 + Math.min(1, progress * 2.6);
  const baseLen = 72 * extend;
  const width = 7 - progress * 3.6;
  const centerShift = -8 + progress * 11;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = "lighter";

  const laneOffsets = [-16, 0, 16];
  for (let i = 0; i < laneOffsets.length; i += 1) {
    const lane = laneOffsets[i];
    const laneBend = (i - 1) * 4;
    const laneLen = baseLen * (0.9 + i * 0.08);
    const laneAlpha = a * (0.85 + i * 0.08);

    ctx.save();
    ctx.globalAlpha = laneAlpha;
    ctx.strokeStyle = i === 1 ? "#ffe6f4" : "#ff8bc6";
    ctx.shadowColor = "#ff4da6";
    ctx.shadowBlur = 20 + progress * 12;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1.8, width - i * 0.9);

    ctx.beginPath();
    ctx.moveTo(centerShift, lane);
    ctx.bezierCurveTo(
      laneLen * 0.2,
      lane - 12 + laneBend,
      laneLen * 0.62,
      lane + 11 + laneBend,
      laneLen,
      lane + laneBend
    );
    ctx.stroke();

    ctx.globalAlpha = laneAlpha * 0.48;
    ctx.strokeStyle = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.lineWidth = Math.max(1, width * 0.35);
    ctx.beginPath();
    ctx.moveTo(centerShift + 2, lane - 1.2);
    ctx.bezierCurveTo(
      laneLen * 0.23,
      lane - 9 + laneBend,
      laneLen * 0.58,
      lane + 8 + laneBend,
      laneLen - 3,
      lane + laneBend - 0.6
    );
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = a * 0.35;
  const sparkRadius = 36 + progress * 24;
  for (let i = 0; i < 6; i += 1) {
    const ang = -0.55 + i * 0.22 + Math.sin(progress * 9 + i) * 0.05;
    const dist = sparkRadius * (0.45 + (i % 3) * 0.22);
    const px = Math.cos(ang) * dist;
    const py = Math.sin(ang) * dist;
    const r = 1.2 + (i % 3) * 0.45;
    ctx.fillStyle = i % 2 === 0 ? "#ffd6ea" : "#ff8bc6";
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

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

export function drawCursedWave(ctx, x, y, dirX, dirY, progress, range = 300, width = 120) {
  if (progress <= 0.01 || progress >= 0.98) return;
  const alpha = Math.min(1, progress * 5) * Math.max(0, 1 - Math.max(0, progress - 0.45) * 1.82);
  if (alpha <= 0.01) return;

  const dir = normalizeDir(dirX, dirY);
  const angle = Math.atan2(dir.y, dir.x);
  const waveTravel = Math.min(1, progress * 1.6);
  const cx = x + Math.cos(angle) * range * waveTravel;
  const cy = y + Math.sin(angle) * range * waveTravel;
  const sweepAngle = Math.PI * 0.5;
  const startAngle = angle - sweepAngle * 0.5 + Math.PI * 0.5;
  const endAngle = startAngle + sweepAngle;
  const thin = width * 0.04;
  const beforeExp = 0.46;
  const expBoost = progress < beforeExp ? 1 + (beforeExp - progress) * 2.5 : 1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = "lighter";

  ctx.globalAlpha = alpha * 0.3 * expBoost;
  ctx.shadowColor = "#ff3388";
  ctx.shadowBlur = 6;
  ctx.strokeStyle = "rgba(255,51,136,0.5)";
  ctx.lineWidth = thin;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, thin * 5, startAngle - 0.3, endAngle + 0.3);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.7 * expBoost;
  ctx.shadowColor = "#ff66cc";
  ctx.shadowBlur = 4;
  ctx.strokeStyle = "rgba(255,102,204,0.8)";
  ctx.lineWidth = thin;
  ctx.beginPath();
  ctx.arc(0, 0, thin * 5, startAngle - 0.2, endAngle + 0.2);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.95 * expBoost;
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = thin;
  ctx.beginPath();
  ctx.arc(0, 0, thin * 5, startAngle - 0.12, endAngle + 0.12);
  ctx.stroke();

  const sparkCount = 4 + Math.floor(progress * 4);
  ctx.globalAlpha = alpha * 0.6 * expBoost;
  for (let i = 0; i < sparkCount; i += 1) {
    const f = (i / sparkCount) * 0.8 + 0.1;
    const a = startAngle + f * (endAngle - startAngle);
    const r = thin * 5 + thin * (i % 2) * 2;
    const sx = Math.cos(a) * r;
    const sy = Math.sin(a) * r;
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#ffb3d9";
    ctx.beginPath();
    ctx.arc(sx, sy, thin * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawDashSlashTrail(ctx, x, y, dirX, dirY, progress) {
  if (progress <= 0 || progress >= 1) return;
  const alpha = Math.min(1, progress * 3) * Math.max(0, 1 - progress);
  if (alpha <= 0.01) return;

  const trailLen = 140;
  const angle = Math.atan2(dirY, dirX);

  ctx.save();
  ctx.globalAlpha = alpha * 0.45;
  ctx.shadowColor = C.pinkGlow;
  ctx.shadowBlur = 40;
  ctx.globalCompositeOperation = "lighter";

  // Main trail
  ctx.strokeStyle = "#ff99cc";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(angle) * trailLen, y - Math.sin(angle) * trailLen);
  ctx.lineTo(x, y);
  ctx.stroke();

  // Wider outer arcs
  for (let i = -1; i <= 1; i += 2) {
    const arcAngle = angle + i * 0.25;
    ctx.strokeStyle = "#ff88bb";
    ctx.lineWidth = 3;
    ctx.globalAlpha = alpha * 0.25;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(arcAngle) * trailLen * 0.8, y - Math.sin(arcAngle) * trailLen * 0.8);
    ctx.lineTo(x - Math.cos(arcAngle) * trailLen * 0.2, y - Math.sin(arcAngle) * trailLen * 0.2);
    ctx.stroke();
  }

  // Bright core
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.shadowBlur = 20;
  ctx.globalAlpha = alpha * 0.6;
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(angle) * trailLen * 0.7, y - Math.sin(angle) * trailLen * 0.7);
  ctx.lineTo(x, y);
  ctx.stroke();

  // Spark dots along the trail
  ctx.fillStyle = "#ffd0e8";
  ctx.shadowBlur = 15;
  for (let i = 0; i < 6; i++) {
    const t = 0.15 + i * 0.12;
    const dotX = x - Math.cos(angle) * trailLen * t;
    const dotY = y - Math.sin(angle) * trailLen * t;
    const dotSize = 1.5 + Math.sin(progress * 20 + i) * 0.8;
    ctx.globalAlpha = alpha * (0.5 + (1 - t) * 0.5);
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
    ctx.fill();
  }

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

function generateJaggedPoints(startX, startY, endX, endY, segments, amplitude, seed) {
  const points = [];
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const baseX = startX + dx * t;
    const baseY = startY + dy * t;
    const noiseVal = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
    const jitter = (noiseVal - Math.floor(noiseVal)) * 2 - 1;
    const edgeFactor = Math.sin(t * Math.PI);
    const offset = jitter * amplitude * edgeFactor;
    points.push({
      x: Math.round(baseX + nx * offset),
      y: Math.round(baseY + ny * offset),
    });
  }
  return points;
}

function drawSwirlingParticles(ctx, pathStartX, pathStartY, pathEndX, pathEndY, progress, alpha, time) {
  const dx = pathEndX - pathStartX;
  const dy = pathEndY - pathStartY;
  const len = Math.hypot(dx, dy);
  const particleCount = 20;
  const colors = ["#ff80bf", "#ff4da6", "#e6b3ff", "#ffb3d9", "#ff66b2", "#d4a5e5"];

  for (let i = 0; i < particleCount; i++) {
    const phase = (i / particleCount) * Math.PI * 2;
    const speed = 2.5 + (i % 5) * 0.7;
    const orbitRadius = 18 + (i % 4) * 8;
    const t = ((time * speed + phase) % (Math.PI * 2)) / (Math.PI * 2);
    const pathT = Math.min(1, Math.max(0, t));

    const baseX = pathStartX + dx * pathT;
    const baseY = pathStartY + dy * pathT;

    const perpX = -dy / len;
    const perpY = dx / len;

    const swirlAngle = time * 3.5 + phase;
    const offsetR = orbitRadius * (0.6 + Math.sin(time * 2 + i) * 0.4);
    const px = baseX + Math.cos(swirlAngle) * offsetR * perpX + Math.sin(swirlAngle) * offsetR * (dx / len);
    const py = baseY + Math.cos(swirlAngle) * offsetR * perpY + Math.sin(swirlAngle) * offsetR * (dy / len);

    const size = 1 + (i % 3) * 1.2 + Math.sin(time * 4 + i * 0.5) * 0.5;
    const particleAlpha = alpha * (0.4 + Math.sin(time * 3 + i) * 0.3);

    ctx.save();
    ctx.globalAlpha = particleAlpha;
    ctx.fillStyle = colors[i % colors.length];
    ctx.shadowColor = colors[i % colors.length];
    ctx.shadowBlur = size * 4;
    ctx.beginPath();
    ctx.arc(Math.round(px), Math.round(py), Math.round(size), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawEnergyWaveTrail(ctx, startX, startY, endX, endY, progress, time, options = {}) {
  if (progress <= 0.01 || progress >= 0.98) return;

  const waveWidth = options.width || 45;
  const alpha = Math.min(1, progress * 8) * Math.max(0, 1 - progress * 0.95);
  if (alpha <= 0.01) return;

  const dx = endX - startX;
  const dy = endY - startY;
  const currentEndX = startX + dx * progress;
  const currentEndY = startY + dy * progress;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "lighter";

  const jaggedSeed = Math.round(time * 1000);
  const outerJagged = generateJaggedPoints(startX, startY, currentEndX, currentEndY, 18, waveWidth * 0.7, jaggedSeed);
  const midJagged = generateJaggedPoints(startX, startY, currentEndX, currentEndY, 14, waveWidth * 0.45, jaggedSeed + 1);
  const innerJagged = generateJaggedPoints(startX, startY, currentEndX, currentEndY, 10, waveWidth * 0.25, jaggedSeed + 2);

  const angle = Math.atan2(dy, dx);

  // Outer layer - lavender glow
  ctx.globalAlpha = alpha * 0.25;
  ctx.shadowColor = "#d4a5e5";
  ctx.shadowBlur = 50;
  ctx.fillStyle = "rgba(212,165,229,0.15)";
  ctx.beginPath();
  ctx.moveTo(outerJagged[0].x, outerJagged[0].y);
  for (let i = 1; i < outerJagged.length; i++) {
    const prev = outerJagged[i - 1];
    const curr = outerJagged[i];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
  }
  ctx.closePath();
  ctx.fill();

  // Mid layer - bright pink
  ctx.globalAlpha = alpha * 0.55;
  ctx.shadowColor = "#ff66b2";
  ctx.shadowBlur = 35;
  ctx.fillStyle = "rgba(255,102,178,0.3)";
  ctx.beginPath();
  ctx.moveTo(midJagged[0].x, midJagged[0].y);
  for (let i = 1; i < midJagged.length; i++) {
    const prev = midJagged[i - 1];
    const curr = midJagged[i];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
  }
  ctx.closePath();
  ctx.fill();

  // Inner layer - hot pink
  ctx.globalAlpha = alpha * 0.75;
  ctx.shadowColor = "#ff1a80";
  ctx.shadowBlur = 25;
  ctx.fillStyle = "rgba(255,26,128,0.45)";
  ctx.beginPath();
  ctx.moveTo(innerJagged[0].x, innerJagged[0].y);
  for (let i = 1; i < innerJagged.length; i++) {
    const prev = innerJagged[i - 1];
    const curr = innerJagged[i];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
  }
  ctx.closePath();
  ctx.fill();

  // Core - dark magenta
  ctx.globalAlpha = alpha * 0.9;
  ctx.shadowColor = "#8b0055";
  ctx.shadowBlur = 20;
  const coreWidth = waveWidth * 0.12;
  ctx.strokeStyle = "#8b0055";
  ctx.lineWidth = Math.round(coreWidth * 2);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(Math.round(startX), Math.round(startY));
  ctx.lineTo(Math.round(currentEndX), Math.round(currentEndY));
  ctx.stroke();

  // Core bright line
  ctx.globalAlpha = alpha * 0.85;
  ctx.shadowColor = "#ff3399";
  ctx.shadowBlur = 15;
  ctx.strokeStyle = "#ff3399";
  ctx.lineWidth = Math.round(coreWidth);
  ctx.beginPath();
  ctx.moveTo(Math.round(startX), Math.round(startY));
  ctx.lineTo(Math.round(currentEndX), Math.round(currentEndY));
  ctx.stroke();

  // Jagged edge highlights - fiery tips
  ctx.globalAlpha = alpha * 0.6;
  ctx.shadowColor = "#ffb3d9";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#ffb3d9";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < outerJagged.length; i += 2) {
    const pt = outerJagged[i];
    const nextPt = outerJagged[Math.min(i + 1, outerJagged.length - 1)];
    const tipLen = 8 + Math.sin(time * 6 + i) * 4;
    const segAngle = Math.atan2(nextPt.y - pt.y, nextPt.x - pt.x);
    const tipX = pt.x + Math.cos(segAngle + Math.PI * 0.5) * tipLen;
    const tipY = pt.y + Math.sin(segAngle + Math.PI * 0.5) * tipLen;
    ctx.beginPath();
    ctx.moveTo(Math.round(pt.x), Math.round(pt.y));
    ctx.lineTo(Math.round(tipX), Math.round(tipY));
    ctx.stroke();
  }

  // Secondary jagged sparks
  ctx.globalAlpha = alpha * 0.4;
  ctx.shadowColor = "#ff80bf";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "#ff80bf";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < midJagged.length; i += 3) {
    const pt = midJagged[i];
    const sparkLen = 5 + Math.sin(time * 8 + i * 1.3) * 3;
    const perpAngle = angle + Math.PI * 0.5 * (i % 2 === 0 ? 1 : -1);
    const sparkX = pt.x + Math.cos(perpAngle) * sparkLen;
    const sparkY = pt.y + Math.sin(perpAngle) * sparkLen;
    ctx.beginPath();
    ctx.moveTo(Math.round(pt.x), Math.round(pt.y));
    ctx.lineTo(Math.round(sparkX), Math.round(sparkY));
    ctx.stroke();
  }

  ctx.restore();

  // Swirling particles (rendered with normal composite for better visibility)
  drawSwirlingParticles(ctx, startX, startY, currentEndX, currentEndY, progress, alpha, time);
}

export function drawPinkSlashCuts(ctx, x, y, progress, time, zoom) {
  const alpha = Math.min(1, progress * 5) * Math.max(0, 1 - progress * 1.2);
  if (alpha <= 0.01) return;

  const count = 5;
  const maxLen = (80 + Math.sin(time * 3) * 20) * zoom;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = "#ff66b2";
  ctx.shadowBlur = 25 * zoom;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + time * 0.5 + i * 0.3;
    const len = maxLen * (0.7 + Math.sin(time * 2 + i * 1.5) * 0.3);
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;

    ctx.strokeStyle = "#ff66b2";
    ctx.lineWidth = (5 + Math.sin(time * 4 + i) * 2) * zoom;
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.strokeStyle = "#ffd0e8";
    ctx.lineWidth = (2 + Math.sin(time * 3 + i * 0.7) * 0.5) * zoom;
    ctx.globalAlpha = alpha * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1 * zoom;
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * len * 0.2, y + Math.sin(angle) * len * 0.2);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  ctx.restore();
}
