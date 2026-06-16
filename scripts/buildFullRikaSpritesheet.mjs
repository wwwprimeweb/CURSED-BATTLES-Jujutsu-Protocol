import { readFileSync, writeFileSync } from "fs";
import { createCanvas, loadImage } from "canvas";
import { join } from "path";

const SPRITES_DIR = "C:\\Cursed Battles\\Yuta_Sprites\\Yuta Base";
const OUT_PATH = "C:\\Cursed Battles\\client\\assets\\sprites\\portador-do-vinculo_full_rika.png";

const ROWS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 11],  // Row 0: intro (9 frames)
  [8, 9, 10],                       // Row 1: idle + attack (3 frames)
];

const CELL_W = 140;
const CELL_H = 120;
const PIVOT_X = 70;
const PIVOT_Y = 100;

const COLS = Math.max(...ROWS.map(r => r.length));
const ROWS_COUNT = ROWS.length;
const W = COLS * CELL_W;
const H = ROWS_COUNT * CELL_H;

async function main() {
  console.log(`Spritesheet: ${W}x${H}, ${ROWS_COUNT} rows, ${COLS} cols`);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  for (let rowIdx = 0; rowIdx < ROWS.length; rowIdx++) {
    const frames = ROWS[rowIdx];
    for (let colIdx = 0; colIdx < frames.length; colIdx++) {
      const num = frames[colIdx];
      const path = join(SPRITES_DIR, `26_${num}.png`);
      try {
        const img = await loadImage(path);
        const cellX = colIdx * CELL_W;
        const cellY = rowIdx * CELL_H;
        const fitScale = CELL_H / img.height;
        const fitW = img.width * fitScale;
        const fitH = CELL_H;
        const dstX = cellX + Math.max(0, CELL_W - fitW) / 2;
        const dstY = cellY;
        ctx.drawImage(img, dstX, dstY, fitW, fitH);
        console.log(`  Row ${rowIdx}, Col ${colIdx}: 26_${num}.png (${img.width}x${img.height})`);
      } catch (e) {
        console.warn(`  Missing: 26_${num}.png - ${e.message}`);
      }
    }
  }

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(OUT_PATH, buffer);
  console.log(`Saved to ${OUT_PATH} (${(buffer.length / 1024).toFixed(0)} KB)`);
  console.log("=== DONE ===");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
