import { readFileSync, writeFileSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const sffPath = "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars\\Yuta Shinjuku\\Yuta Shinjuku.sff";
const outPath = "C:\\Cursed Battles\\client\\assets\\sprites\\portador-do-vinculo_teleport.png";

const CELL = 80;
const PIVOT_X = 40;
const PIVOT_Y = 65;

const FRAMES = [[0, 40], [0, 41], [0, 42], [0, 43]];
const COLS = FRAMES.length;
const ROWS = 1;
const W = COLS * CELL;
const H = ROWS * CELL;

async function main() {
  console.log(`Spritesheet: ${W}x${H}, ${ROWS} row, ${COLS} cols`);

  const sffBuf = readFileSync(sffPath);
  const data = extract(sffBuf, {
    palettes: true,
    spriteBuffer: false,
    decodeSpriteBuffer: true,
    spriteGroups: [0],
  });

  const spriteMap = new Map();
  for (const spr of data.sprites) {
    spriteMap.set(`${spr.group}_${spr.number}`, spr);
  }

  const pixels = new Uint8ClampedArray(W * H * 4);

  for (let colIdx = 0; colIdx < FRAMES.length; colIdx++) {
    const [group, number] = FRAMES[colIdx];
    const key = `${group}_${number}`;
    const spr = spriteMap.get(key);
    if (!spr) {
      console.warn(`  Missing: ${key}`);
      continue;
    }

    const cellX = colIdx * CELL;
    const dstX = cellX + PIVOT_X - spr.x;
    const dstY = PIVOT_Y - spr.y;

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
    console.log(`  Col ${colIdx}: ${key} (${spr.width}x${spr.height}) axis=(${spr.x},${spr.y}) placed at (${dstX},${dstY})`);
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
