import { readFileSync, writeFileSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const sffPath = "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars\\Panda Senpai\\Sprite.sff";
const outPath = "C:\\Cursed Battles\\client\\assets\\habilit\\yuta_m1_7033.png";

const GROUP = 7033;
const COLS = 9;
const ROWS = 1;
const IMAGES = 9;

async function main() {
  console.log("Reading Panda SFF...");
  const sffBuf = readFileSync(sffPath);

  console.log("Extracting group 7033 sprites...");
  const data = extract(sffBuf, {
    palettes: true,
    spriteBuffer: false,
    decodeSpriteBuffer: true,
    spriteGroups: [GROUP],
  });

  const sprites = data.sprites;
  console.log(`Got ${sprites.length} sprites`);

  // Convert unsigned 16-bit pivot to signed
  function toSigned16(v) { return v > 32767 ? v - 65536 : v; }

  let maxLeft = 0, maxRight = 0, maxTop = 0, maxBottom = 0;
  for (const s of sprites) {
    const px = toSigned16(s.x);
    const py = toSigned16(s.y);
    maxLeft = Math.max(maxLeft, -px);
    maxRight = Math.max(maxRight, s.width + px);
    maxTop = Math.max(maxTop, -py);
    maxBottom = Math.max(maxBottom, s.height + py);
  }

  const frameW = Math.max(maxLeft, maxRight) * 2;
  const frameH = Math.max(maxTop, maxBottom) * 2;

  console.log(`Frame: ${frameW}x${frameH}`);
  console.log(`Spritesheet: ${frameW * COLS}x${frameH * ROWS}`);

  const spriteMap = {};
  for (const spr of sprites) {
    spriteMap[`${spr.group}_${spr.number}`] = spr;
  }

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
    const px = toSigned16(spr.x);
    const py = toSigned16(spr.y);
    const pivotX = frameW / 2;
    const pivotY = frameH / 2;
    const dstX = cellX + pivotX - px;
    const dstY = cellY + pivotY - py;

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
        if (dx < 0 || dx >= W || dy < 0 || dy >= H) continue;

        const di = (dy * W + dx) * 4;

        if (brightness < 30) {
          // Escuro → preto (borda)
          pixels[di] = 0;
          pixels[di + 1] = 0;
          pixels[di + 2] = 0;
          pixels[di + 3] = alpha;
        } else {
          // Claro → rosa vibrante
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
