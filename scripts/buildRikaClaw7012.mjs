import { readFileSync, writeFileSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const sffPath = "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars\\Panda Senpai\\Sprite.sff";
const outPath = "C:\\Cursed Battles\\client\\assets\\sprites\\portador-do-vinculo_7012.png";

const GROUP = 7012;
const TOTAL = 18;
const COLS = 18;
const ROWS = 1;

async function main() {
  console.log("Reading Panda SFF...");
  const sffBuf = readFileSync(sffPath);

  console.log(`Extracting group ${GROUP} sprites...`);
  const data = extract(sffBuf, {
    palettes: true,
    spriteBuffer: false,
    decodeSpriteBuffer: true,
    spriteGroups: [GROUP],
  });

  const sprites = data.sprites;
  console.log(`Got ${sprites.length} sprites`);

  // Find max content width/height across all sprites
  let maxW = 0, maxH = 0;
  for (const s of sprites) {
    maxW = Math.max(maxW, s.width);
    maxH = Math.max(maxH, s.height);
  }
  // Round up to even
  const CELL_W = maxW % 2 === 0 ? maxW : maxW + 1;
  const CELL_H = maxH % 2 === 0 ? maxH : maxH + 1;

  console.log(`Cell: ${CELL_W}x${CELL_H}, spritesheet: ${CELL_W * COLS}x${CELL_H * ROWS}`);

  const spriteMap = {};
  for (const spr of sprites) {
    spriteMap[`${spr.group}_${spr.number}`] = spr;
  }

  const W = CELL_W * COLS;
  const H = CELL_H * ROWS;
  const pixels = new Uint8Array(W * H * 4);

  for (let i = 0; i < TOTAL; i++) {
    const key = `${GROUP}_${i}`;
    const spr = spriteMap[key];
    if (!spr) {
      console.warn(`  Missing sprite ${key}`);
      continue;
    }

    const col = i % COLS;
    const dstX = col * CELL_W + Math.floor((CELL_W - spr.width) / 2);
    const dstY = Math.floor((CELL_H - spr.height) / 2);

    const src = spr.decodedBuffer;
    for (let sy = 0; sy < spr.height; sy++) {
      for (let sx = 0; sx < spr.width; sx++) {
        const si = (sy * spr.width + sx) * 4;
        const alpha = src[si + 3];
        if (alpha === 0) continue;

        const r = src[si];
        const g = src[si + 1];
        const b = src[si + 2];
        const brightness = Math.max(r, g, b);

        const dx = dstX + sx;
        const dy = dstY + sy;

        const di = (dy * W + dx) * 4;

        if (brightness < 30) {
          pixels[di] = 0;
          pixels[di + 1] = 0;
          pixels[di + 2] = 0;
          pixels[di + 3] = alpha;
        } else {
          pixels[di] = 255;
          pixels[di + 1] = 80;
          pixels[di + 2] = 180;
          pixels[di + 3] = alpha;
        }
      }
    }
    console.log(`  Sprite ${i} (${spr.width}x${spr.height}) processed`);
  }

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(W, H);
  imgData.data.set(pixels);
  ctx.putImageData(imgData, 0, 0);

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(outPath, buffer);
  console.log(`Saved to ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  console.log("=== DONE ===");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
