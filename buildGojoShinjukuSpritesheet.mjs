import { readFileSync, writeFileSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const sffPath = "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars\\Gojo Shinjuku\\spr.sff";

const CELL = 80;
const PIVOT_X = 40;
const PIVOT_Y = 65;

const ROWS = [
  [0,    [0, 1, 2, 3]],               // 0: idle (4)
  [200,  [0, 1, 2]],                   // 1: m1_1 (3)
  [200,  [3, 4, 5, 6, 7]],            // 2: m1_2 (5)
  [200,  [8, 9, 10, 11]],             // 3: m1_3 (4)
  [0,    []],                          // 4: reserved (empty)
  [1000, [2, 3, 4]],                   // 5: hit (3)
  [6000, [0, 1, 2, 3, 4, 5, 6]],      // 6: death (7)
  [60,   [0, 1, 2, 3, 4, 5]],         // 7: dash/dodge (6)
  [3000, [1, 2, 3]],                   // 8: domain_prepare (3)
];

const numCols = Math.max(...ROWS.map(r => r[1].length));
const numRows = ROWS.length;
const W = numCols * CELL;
const H = numRows * CELL;

console.log(`Spritesheet: ${W}x${H}, ${numRows} rows, ${numCols} cols`);

async function main() {
  console.log("Reading SFF...");
  const sffBuf = readFileSync(sffPath);

  console.log("Extracting sprites...");
  const data = extract(sffBuf, {
    palettes: true,
    spriteBuffer: false,
    decodeSpriteBuffer: true,
  });

  const sprites = data.sprites;
  console.log(`Got ${sprites.length} sprites`);

  const spriteMap = {};
  for (const spr of sprites) {
    spriteMap[`${spr.group}_${spr.number}`] = spr;
  }

  const totalPixels = W * H * 4;
  const pixels = new Uint8Array(totalPixels);

  for (let rowIdx = 0; rowIdx < ROWS.length; rowIdx++) {
    const [group, images] = ROWS[rowIdx];
    for (let colIdx = 0; colIdx < images.length; colIdx++) {
      const imageNum = images[colIdx];
      const key = `${group}_${imageNum}`;
      const spr = spriteMap[key];
      if (!spr) {
        console.warn(`  Missing: ${key}`);
        continue;
      }

      const cellX = colIdx * CELL;
      const cellY = rowIdx * CELL;
      const dstX = cellX + PIVOT_X - spr.x;
      const dstY = cellY + PIVOT_Y - spr.y;

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
    }
    console.log(`  Row ${rowIdx} (group ${group}) done`);
  }

  let nonZeroAlpha = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) nonZeroAlpha++;
  }
  console.log(`Buffer has ${nonZeroAlpha} non-zero alpha pixels`);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(W, H);
  imgData.data.set(pixels);
  ctx.putImageData(imgData, 0, 0);

  const outPath = "C:\\Cursed Battles\\client\\assets\\sprites\\o-honrado_manga_spritesheet.png";
  const buffer = canvas.toBuffer("image/png");
  writeFileSync(outPath, buffer);
  console.log(`Saved to ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
