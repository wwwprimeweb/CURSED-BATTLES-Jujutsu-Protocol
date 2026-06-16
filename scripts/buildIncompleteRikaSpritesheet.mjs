import { readFileSync, writeFileSync } from "fs";
import { createCanvas, loadImage } from "canvas";
import { join } from "path";

const SPRITES_DIR = "C:\\Cursed Battles\\Yuta_Sprites\\Yuta Base";
const OUT_PATH = "C:\\Cursed Battles\\client\\assets\\sprites\\rika-incompleta.png";

const ROWS = [
  [59, 53, 54, 55, 56, 57],   // Row 0: appear + idle loop
  [33, 34, 35, 36, 37],        // Row 1: attack
];

const CELL_W = 160;
const CELL_H = 120;
const PIVOT_X = 80;
const PIVOT_Y = 100;

const COLS = Math.max(...ROWS.map(r => r.length));
const ROWS_COUNT = ROWS.length;
const W = COLS * CELL_W;
const H = ROWS_COUNT * CELL_H;

async function main() {
  console.log(`Spritesheet: ${W}x${H}, ${ROWS_COUNT} rows, ${COLS} cols`);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Transparent background
  ctx.clearRect(0, 0, W, H);

  for (let rowIdx = 0; rowIdx < ROWS.length; rowIdx++) {
    const frames = ROWS[rowIdx];
    for (let colIdx = 0; colIdx < frames.length; colIdx++) {
      const num = frames[colIdx];
      const path = join(SPRITES_DIR, `21_${num}.png`);
      try {
        const img = await loadImage(path);
        const cellX = colIdx * CELL_W;
        const cellY = rowIdx * CELL_H;

        // Center the sprite in the cell
        const dstX = cellX + (CELL_W - img.width) / 2;
        const dstY = cellY + (CELL_H - img.height) / 2;

        ctx.drawImage(img, dstX, dstY);
        console.log(`  Row ${rowIdx}, Col ${colIdx}: 21_${num}.png (${img.width}x${img.height}) placed at (${Math.round(dstX)}, ${Math.round(dstY)})`);
      } catch (e) {
        console.warn(`  Missing: 21_${num}.png - ${e.message}`);
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
