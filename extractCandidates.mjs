import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const sffPath = "client/deoutrojogo/Jujutsu Kaisen Cursed Clash (camelô) V6/chars/Yuji Itadori Shibuya Start/Yuji Itadori.sff";
const outDir = "client/assets/sprites/aura_candidates";

mkdirSync(outDir, { recursive: true });

const CANDIDATE_GROUPS = [
  7000, 7001, 7002, 7007, 7014, 7016, 7018, 7038,
  7044, 7055, 7056, 7057, 7069, 7104,
];

console.log("Loading Shibuya Start SFF...");
const buf = readFileSync(sffPath);

for (const group of CANDIDATE_GROUPS) {
  const data = extract(buf, {
    palettes: true,
    spriteBuffer: true,
    decodeSpriteBuffer: true,
    spriteGroups: [group],
  });

  const sprites = data.sprites.sort((a, b) => a.number - b.number);
  if (sprites.length === 0) {
    console.log(`Group ${group}: no sprites found`);
    continue;
  }

  let maxW = 0, maxH = 0;
  for (const spr of sprites) {
    if (spr.width > maxW) maxW = spr.width;
    if (spr.height > maxH) maxH = spr.height;
  }

  const TARGET_SIZE = 100;
  const scale = Math.min(1, Math.min(TARGET_SIZE / maxW, TARGET_SIZE / maxH));
  const frameW = Math.max(1, Math.round(maxW * scale));
  const frameH = Math.max(1, Math.round(maxH * scale));

  console.log(`Group ${group}: ${sprites.length} sprites, max ${maxW}x${maxH}, scaled to ${frameW}x${frameH}`);

  const canvas = createCanvas(frameW * sprites.length, frameH);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < sprites.length; i++) {
    const spr = sprites[i];
    if (!spr.decodedBuffer) {
      console.error(`  Frame ${i} missing decodedBuffer`);
      continue;
    }

    const srcCanvas = createCanvas(spr.width, spr.height);
    const srcCtx = srcCanvas.getContext("2d");
    const imgData = srcCtx.createImageData(spr.width, spr.height);
    spr.decodedBuffer.copy(imgData.data);
    srcCtx.putImageData(imgData, 0, 0);

    const drawW = Math.round(spr.width * scale);
    const drawH = Math.round(spr.height * scale);
    const x = i * frameW + Math.round((frameW - drawW) * 0.5);
    const y = Math.round((frameH - drawH) * 0.5);
    ctx.drawImage(srcCanvas, x, y, drawW, drawH);
  }

  const outPath = `${outDir}/group_${group}.png`;
  writeFileSync(outPath, canvas.toBuffer("image/png"));

  const meta = {
    group,
    frames: sprites.length,
    frameWidth: frameW,
    frameHeight: frameH,
    totalWidth: canvas.width,
    totalHeight: canvas.height,
  };
  writeFileSync(`${outDir}/group_${group}_meta.json`, JSON.stringify(meta, null, 2));
  console.log(`  Saved group_${group}.png`);
}

console.log("\nDone! Check client/assets/sprites/aura_candidates/");
