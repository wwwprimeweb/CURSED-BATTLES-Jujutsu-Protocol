import { writeFileSync, existsSync, readFileSync } from "fs";
import { createCanvas, loadImage } from "canvas";

const outDir = "C:\\Cursed Battles\\client\\assets\\sprites\\yuji_shinjuku";
const flameDir = `${outDir}\\divergent_flame_only`;

const flameFiles = [
  `${flameDir}\\flame_0.png`,
  `${flameDir}\\flame_1.png`,
  `${flameDir}\\flame_2.png`,
  `${flameDir}\\flame_3.png`,
  `${flameDir}\\flame_4.png`,
  `${flameDir}\\flame_5.png`,
  `${flameDir}\\flame_6.png`,
];

async function buildFlameSheet() {
  const images = [];
  for (const path of flameFiles) {
    if (existsSync(path)) {
      const img = await loadImage(readFileSync(path));
      images.push(img);
    } else {
      console.warn(`Missing: ${path}`);
    }
  }

  if (images.length === 0) {
    console.error("No flame images found!");
    return;
  }

  const scale = 0.35;
  const maxW = Math.max(...images.map((img) => img.width));
  const maxH = Math.max(...images.map((img) => img.height));
  const frameW = Math.max(1, Math.round(maxW * scale));
  const frameH = Math.max(1, Math.round(maxH * scale));

  const canvas = createCanvas(frameW * images.length, frameH);
  const ctx = canvas.getContext("2d");

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const drawW = Math.max(1, Math.round(img.width * scale));
    const drawH = Math.max(1, Math.round(img.height * scale));
    const x = i * frameW + Math.round((frameW - drawW) * 0.5);
    const y = Math.round((frameH - drawH) * 0.5);
    ctx.drawImage(img, x, y, drawW, drawH);
  }

  const outPath = `${outDir}\\flame_sheet.png`;
  writeFileSync(outPath, canvas.toBuffer("image/png"));

  const meta = {
    frameWidth: frameW,
    frameHeight: frameH,
    frames: images.length,
  };
  writeFileSync(`${outDir}\\flame_sheet_meta.json`, JSON.stringify(meta, null, 2));

  console.log(`Saved flame sheet: ${outPath} (${frameW}x${frameH}, ${images.length} frames)`);
}

buildFlameSheet().catch((e) => console.error("Error:", e));