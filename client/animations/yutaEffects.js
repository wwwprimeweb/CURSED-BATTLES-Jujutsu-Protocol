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

export function drawM1Combined(ctx, x, y, dirX, dirY, progress, comboStep, range, coneAngle, m1Spritesheet) {
  if (progress <= 0.01 || progress >= 0.98) return;
  const fastPhase = Math.min(1, progress * 8);
  const fadePhase = Math.max(0, 1 - Math.max(0, progress - 0.4) * 1.67);
  const alpha = fastPhase * fadePhase;
  if (alpha <= 0.01) return;

  const angle = Math.atan2(dirY, dirX);

  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = "lighter";

  if (m1Spritesheet && m1Spritesheet.complete && m1Spritesheet.naturalWidth > 0) {
    const TOTAL_FRAMES = 9;
    const FRAME_COLS = 9;
    const frameW = m1Spritesheet.naturalWidth / FRAME_COLS;
    const frameH = m1Spritesheet.naturalHeight;

    // Frame selection: 0→4 on entry (0→0.5), 4→8 on exit (0.5→1)
    let frameIdx;
    if (progress < 0.5) {
      frameIdx = Math.floor((progress / 0.5) * 4 + 0.5);
      frameIdx = Math.min(4, Math.max(0, frameIdx));
    } else {
      frameIdx = 4 + Math.floor(((progress - 0.5) / 0.5) * 4 + 0.5);
      frameIdx = Math.min(8, Math.max(4, frameIdx));
    }

    const col = frameIdx % FRAME_COLS;
    const sx = col * frameW;
    const sy = 0;

    const moveIn = Math.min(1, progress * 5);
    const growScale = Math.min(1, 0.3 + progress * 3.5);
    const spriteWidth = (110 + comboStep * 15) * 3.25 * growScale;
    const spriteHeight = spriteWidth * (frameH / frameW);
    const spriteAlpha = alpha * (1 - Math.max(0, progress - 0.8) * 5);
    const dist = range * 0.4 * moveIn;

    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    if (dirX > 0) ctx.scale(1, -1);
    ctx.globalAlpha = spriteAlpha;
    ctx.shadowColor = "#ff66cc";
    ctx.shadowBlur = 35;
    ctx.drawImage(m1Spritesheet, sx, sy, frameW, frameH, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
    ctx.restore();
  }

  ctx.restore();
}

export function drawRikaClawSprite(ctx, x, y, dirX, dirY, progress, spritesheet) {
  if (progress <= 0.01 || progress >= 0.98) return;
  const fadeIn = Math.min(1, progress * 6);
  const fadeOut = Math.max(0, 1 - Math.max(0, progress - 0.5) * 2);
  const alpha = fadeIn * fadeOut;
  if (alpha <= 0.01) return;

  const angle = Math.atan2(dirY, dirX);

  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = "lighter";

  if (spritesheet && spritesheet.complete && spritesheet.naturalWidth > 0) {
    const TOTAL_FRAMES = 9;
    const FRAME_COLS = 9;
    const frameW = spritesheet.naturalWidth / FRAME_COLS;
    const frameH = spritesheet.naturalHeight;

    let frameIdx;
    if (progress < 0.5) {
      frameIdx = Math.min(4, Math.max(0, Math.floor((progress / 0.5) * 4 + 0.5)));
    } else {
      frameIdx = 4 + Math.min(4, Math.max(0, Math.floor(((progress - 0.5) / 0.5) * 4 + 0.5)));
    }

    const col = frameIdx % FRAME_COLS;
    const sx = col * frameW;
    const sy = 0;

    const growScale = Math.min(1, 0.3 + progress * 3.5);
    const spriteWidth = 130 * 3.5 * growScale;
    const spriteHeight = spriteWidth * (frameH / frameW);
    const dist = 50 * Math.min(1, progress * 3);

    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    if (dirX > 0) ctx.scale(1, -1);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "#ff66b2";
    ctx.shadowBlur = 45;
    ctx.drawImage(spritesheet, sx, sy, frameW, frameH,
      -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
    ctx.restore();
  }

  ctx.restore();
}

export function drawRikaSwing(ctx, x, y, progress) {
  if (progress <= 0 || progress >= 1) return;
  const alpha = Math.min(1, progress * 4) * Math.max(0, 1 - progress);
  if (alpha <= 0.01) return;

  const radius = 80 * progress;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = C.whiteGlow;
  ctx.shadowBlur = 50;
  ctx.globalCompositeOperation = "lighter";

  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.2, "rgba(255,200,230,0.6)");
  grad.addColorStop(0.6, "rgba(204,51,136,0.3)");
  grad.addColorStop(1, "rgba(255,102,178,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255,200,230,${alpha * 0.5})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function normalizeDir(x, y) {
  const len = Math.sqrt(x * x + y * y);
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
  const len = Math.sqrt(dx * dx + dy * dy);
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
  const len = Math.sqrt(dx * dx + dy * dy);
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

export function drawDashSlideTrail(ctx, x, y, dirX, dirY, progress, time, zoom) {
  if (progress <= 0 || progress >= 1) return;
  const alpha = Math.sin(progress * Math.PI) * 0.7;
  if (alpha <= 0.01) return;

  const trailLen = (120 + Math.sin(time * 3) * 20) * zoom;
  const bx = x - dirX * trailLen;
  const by = y - dirY * trailLen;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = false;

  const perpX = -dirY;
  const perpY = dirX;

  // 4 wind streak layers
  for (let layer = 0; layer < 4; layer++) {
    const offset = (layer - 1.5) * 10 * zoom;
    const lx = bx + perpX * offset;
    const ly = by + perpY * offset;
    const wobble = Math.sin(time * 8 + layer * 2 + x * 0.01) * 12 * zoom;
    const cx = (x + lx) * 0.5 + perpX * wobble;
    const cy = (y + ly) * 0.5 + perpY * wobble;

    const layerAlpha = alpha * (1 - layer * 0.2);
    const colors = [
      { stroke: "#ff66b2", shadow: "#ff66b2", blur: 25, width: 5 },
      { stroke: "#ff99cc", shadow: "#ff80bf", blur: 18, width: 3.5 },
      { stroke: "#ffcce6", shadow: "#ffb3d9", blur: 12, width: 2 },
      { stroke: "#ffffff", shadow: "#ffe8ff", blur: 8, width: 1 },
    ];

    const c = colors[layer];
    ctx.globalAlpha = layerAlpha * c.width / 5;
    ctx.shadowColor = c.shadow;
    ctx.shadowBlur = c.blur * zoom;
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = c.width * zoom;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lx + (x - lx) * 0.05 + Math.sin(time * 5 + layer) * 4 * zoom, ly + (y - ly) * 0.05 + Math.cos(time * 4 + layer) * 4 * zoom);
    ctx.quadraticCurveTo(cx, cy, x - dirX * 8 * zoom, y - dirY * 8 * zoom);
    ctx.stroke();
  }

  // Sparkle tips at midpoints of streaks
  ctx.globalAlpha = alpha * 0.5;
  ctx.shadowColor = "#ffb3d9";
  ctx.shadowBlur = 15 * zoom;
  for (let i = 0; i < 6; i++) {
    const t = 0.2 + i * 0.12;
    const sx = x + (bx - x) * t + perpX * Math.sin(time * 7 + i * 2) * 16 * zoom;
    const sy = y + (by - y) * t + perpY * Math.cos(time * 6 + i * 1.7) * 16 * zoom;
    const sparkSize = (1.5 + Math.sin(time * 5 + i * 1.3) * 0.8) * zoom;
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#ff99cc";
    ctx.beginPath();
    ctx.arc(sx, sy, sparkSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small trailing particles
  ctx.globalAlpha = alpha * 0.3;
  ctx.shadowBlur = 0;
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * (1 - progress * 0.3);
    const px = x + (bx - x) * t + (Math.random() - 0.5) * 18 * zoom;
    const py = y + (by - y) * t + (Math.random() - 0.5) * 18 * zoom;
    const ps = (1 + Math.random() * 1.5) * zoom;
    ctx.fillStyle = Math.random() > 0.5 ? "#ffcce6" : "#ffe8ff";
    ctx.beginPath();
    ctx.arc(px, py, ps, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawRikaAppearGlow(ctx, x, y, progress, time) {
  if (progress <= 0 || progress >= 1) return;
  const a = Math.min(1, progress * 4) * Math.max(0, 1 - progress * 0.9);
  if (a <= 0.01) return;

  const pulse = a * (0.7 + Math.sin(time * 12 + x) * 0.3);
  const radius = 35 + pulse * 25;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = "#ff66b2";
  ctx.shadowBlur = 50 + pulse * 40;

  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(255,255,255,${pulse * 0.6})`);
  grad.addColorStop(0.3, `rgba(255,180,220,${pulse * 0.4})`);
  grad.addColorStop(0.6, `rgba(204,51,136,${pulse * 0.2})`);
  grad.addColorStop(1, "rgba(255,102,178,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  const ringCount = 3;
  for (let i = 0; i < ringCount; i++) {
    const ringPhase = (time * 3 + i * 0.5) % 1;
    const r = radius * (0.3 + ringPhase * 0.6);
    const ringAlpha = (1 - ringPhase) * pulse * 0.3;
    ctx.globalAlpha = ringAlpha;
    ctx.shadowBlur = 20 + pulse * 20;
    ctx.strokeStyle = i === 0 ? "#ff99cc" : i === 1 ? "#cc3388" : "#ff66b2";
    ctx.lineWidth = 2.5 - i * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawRikaImpactBurst(ctx, x, y, progress, time) {
  if (progress <= 0 || progress >= 1) return;
  const a = Math.min(1, progress * 5) * Math.max(0, 1 - progress * 0.85);
  if (a <= 0.01) return;

  const radius = 45 + progress * 85;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a;

  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 60;
  const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.4);
  coreGrad.addColorStop(0, "rgba(255,255,255,0.9)");
  coreGrad.addColorStop(0.5, "rgba(255,200,230,0.5)");
  coreGrad.addColorStop(1, "rgba(204,51,136,0)");
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  const ringColors = ["#ff99cc", "#ff66b2", "#cc3388"];
  const ringSizes = [1, 0.72, 0.45];
  for (let i = 0; i < 3; i++) {
    const ringR = radius * ringSizes[i];
    const ringA = a * (1 - i * 0.25);
    ctx.shadowColor = ringColors[i];
    ctx.shadowBlur = 30 - i * 8;
    ctx.globalAlpha = ringA;
    ctx.strokeStyle = ringColors[i];
    ctx.lineWidth = (4 - i * 1.2);
    ctx.beginPath();
    ctx.arc(x, y, ringR, 0, Math.PI * 2);
    ctx.stroke();
  }

  const spikeCount = 10;
  ctx.globalAlpha = a * 0.6;
  for (let i = 0; i < spikeCount; i++) {
    const angle = (i / spikeCount) * Math.PI * 2 + time * 2 + i * 0.3;
    const spikeLen = radius * (0.5 + Math.sin(time * 8 + i * 1.5) * 0.2);
    const spikeWidth = 3 + Math.sin(time * 6 + i * 0.7) * 1.5;
    const sx = x + Math.cos(angle) * radius * 0.15;
    const sy = y + Math.sin(angle) * radius * 0.15;
    const ex = x + Math.cos(angle) * spikeLen;
    const ey = y + Math.sin(angle) * spikeLen;

    ctx.shadowBlur = 20;
    ctx.strokeStyle = i % 2 === 0 ? "#ffffff" : "#ff99cc";
    ctx.lineWidth = spikeWidth;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  ctx.globalAlpha = a * 0.4;
  ctx.shadowBlur = 15;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + time * 3 + i;
    const dist = radius * (0.35 + Math.sin(time * 5 + i * 0.8) * 0.15);
    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist;
    const sz = 2 + Math.sin(time * 4 + i * 1.1) * 1;
    ctx.fillStyle = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#ffb3d9" : "#d4a5e5";
    ctx.beginPath();
    ctx.arc(px, py, sz, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawRikaDashTrail(ctx, startX, startY, endX, endY, progress, time) {
  if (progress <= 0.01 || progress >= 0.99) return;
  const a = Math.min(1, progress * 5) * Math.max(0, 1 - progress * 0.9);
  if (a <= 0.01) return;

  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "lighter";

  const seed = Math.round(time * 1000);
  const trailWidth = 25 + (1 - progress) * 20;
  const outerJagged = generateJaggedPoints(startX, startY, endX, endY, 12, trailWidth * 0.55, seed);
  const midJagged = generateJaggedPoints(startX, startY, endX, endY, 10, trailWidth * 0.35, seed + 1);
  const innerJagged = generateJaggedPoints(startX, startY, endX, endY, 8, trailWidth * 0.18, seed + 2);

  const drawJaggedFill = (points, alpha, color, blur) => {
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
    }
    ctx.closePath();
    ctx.fill();
  };

  drawJaggedFill(outerJagged, a * 0.3, "rgba(212,165,229,0.15)", 50);
  drawJaggedFill(midJagged, a * 0.6, "rgba(255,102,178,0.3)", 35);
  drawJaggedFill(innerJagged, a * 0.8, "rgba(255,26,128,0.45)", 25);

  ctx.globalAlpha = a * 0.9;
  ctx.shadowColor = "#ff3399";
  ctx.shadowBlur = 15;
  ctx.strokeStyle = "#ff3399";
  ctx.lineWidth = Math.max(3, trailWidth * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(Math.round(startX), Math.round(startY));
  ctx.lineTo(Math.round(endX), Math.round(endY));
  ctx.stroke();

  ctx.globalAlpha = a * 0.85;
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 20;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, trailWidth * 0.06);
  ctx.beginPath();
  ctx.moveTo(Math.round(startX), Math.round(startY));
  ctx.lineTo(Math.round(endX), Math.round(endY));
  ctx.stroke();

  ctx.globalAlpha = a * 0.5;
  ctx.shadowColor = "#ffb3d9";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#ffb3d9";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < outerJagged.length; i += 2) {
    const pt = outerJagged[i];
    const nextPt = outerJagged[Math.min(i + 1, outerJagged.length - 1)];
    const tipLen = 6 + Math.sin(time * 7 + i) * 3;
    const segAngle = Math.atan2(nextPt.y - pt.y, nextPt.x - pt.x);
    const tipX = pt.x + Math.cos(segAngle + Math.PI * 0.5) * tipLen;
    const tipY = pt.y + Math.sin(segAngle + Math.PI * 0.5) * tipLen;
    ctx.beginPath();
    ctx.moveTo(Math.round(pt.x), Math.round(pt.y));
    ctx.lineTo(Math.round(tipX), Math.round(tipY));
    ctx.stroke();
  }

  const partCount = 14;
  ctx.shadowBlur = 10;
  for (let i = 0; i < partCount; i++) {
    const t = (i / partCount) * progress;
    const px = startX + dx * t;
    const py = startY + dy * t;
    const perpX = -dy / len;
    const perpY = dx / len;
    const distFromCenter = (Math.sin(time * 10 + i * 1.3) * 0.5 + 0.5) * trailWidth * 0.3;
    const offX = px + perpX * distFromCenter;
    const offY = py + perpY * distFromCenter;
    const sz = 2 + Math.sin(time * 9 + i * 2.1) * 1;
    ctx.globalAlpha = a * (0.3 + Math.sin(time * 6 + i) * 0.2);
    ctx.fillStyle = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#ffb3d9" : "#d4a5e5";
    ctx.beginPath();
    ctx.arc(offX, offY, sz, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
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
