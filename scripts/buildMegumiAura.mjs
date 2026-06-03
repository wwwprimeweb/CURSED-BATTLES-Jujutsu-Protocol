import { readFileSync, writeFileSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const sffPath = "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars\\Megumi Fushiguro Shibuya Arc\\Megumi Fushiguro.sff";
const outPath = "C:\\Cursed Battles\\client\\assets\\energyrecover\\energyspritesheet.png";

const GROUP = 450;
const IMAGES = 8;
const COLS = 6;
const ROWS = Math.ceil(IMAGES / COLS);

async function main() {
  console.log("Reading SFF...");
  const sffBuf = readFileSync(sffPath);

  console.log("Extracting sprites...");
  const data = extract(sffBuf, {
    palettes: true,
    spriteBuffer: false,
    decodeSpriteBuffer: true,
    spriteGroups: [GROUP],
  });

  const sprites = data.sprites;
  console.log(`Got ${sprites.length} sprites`);

  if (sprites.length !== IMAGES) {
    console.warn(`Expected ${IMAGES} sprites, got ${sprites.length}`);
  }

  // Calculate bounding box across all sprites
  let maxLeft = 0, maxRight = 0, maxTop = 0, maxBottom = 0;
  for (const s of sprites) {
    maxLeft = Math.max(maxLeft, s.x);
    maxRight = Math.max(maxRight, s.width - s.x);
    maxTop = Math.max(maxTop, s.y);
    maxBottom = Math.max(maxBottom, s.height - s.y);
  }

  const frameW = Math.max(maxLeft, maxRight) * 2;
  const frameH = Math.max(maxTop, maxBottom) * 2;

  console.log(`Frame: ${frameW}x${frameH}`);
  console.log(`Spritesheet: ${frameW * COLS}x${frameH * ROWS}`);

  // Build sprite map
  const spriteMap = {};
  for (const spr of sprites) {
    spriteMap[`${spr.group}_${spr.number}`] = spr;
  }

  // Create buffer
  const W = frameW * COLS;
  const H = frameH * ROWS;
  const totalPixels = W * H * 4;
  const pixels = new Uint8Array(totalPixels);

  for (let i = 0; i < IMAGES; i++) {
    const key = `${GROUP}_${i}`;
    const spr = spriteMap[key];
    if (!spr) {
      console.warn(`  Missing sprite ${key}`);
      continue;
    }

    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cellX = col * frameW;
    const cellY = row * frameH;

    // Center the pivot in the cell
    const pivotX = frameW / 2;
    const pivotY = frameH / 2;
    const dstX = cellX + pivotX - spr.x;
    const dstY = cellY + pivotY - spr.y;

    const src = spr.decodedBuffer;
    for (let sy = 0; sy < spr.height; sy++) {
      for (let sx = 0; sx < spr.width; sx++) {
        const si = (sy * spr.width + sx) * 4;
        const alpha = src[si + 3];
        if (alpha === 0) continue;

        const dx = dstX + sx;
        const dy = dstY + sy;
        if (dx < 0 || dx >= W || dy < 0 || dy >= H) continue;

        const di = (dy * W + dx) * 4;
        pixels[di] = src[si];
        pixels[di + 1] = src[si + 1];
        pixels[di + 2] = src[si + 2];
        pixels[di + 3] = alpha;
      }
    }
    console.log(`  Sprite ${i} (${spr.width}x${spr.height}) placed`);
  }

  // Create canvas and save
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(W, H);
  imgData.data.set(pixels);
  ctx.putImageData(imgData, 0, 0);

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(outPath, buffer);
  console.log(`Saved to ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
