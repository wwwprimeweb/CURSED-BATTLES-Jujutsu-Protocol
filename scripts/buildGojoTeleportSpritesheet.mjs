import { readFileSync, writeFileSync } from "fs";
import { createCanvas, loadImage } from "canvas";

const srcDir = "C:\\Cursed Battles\\Gojo_Sprites\\Yuta Body Gojo Jus";
const outPath = "C:\\Cursed Battles\\client\\assets\\sprites\\o-honrado_teleport.png";

const FRAME_COUNT = 6;
const CELL_W = 119;
const CELL_H = 273;

async function main() {
  const W = FRAME_COUNT * CELL_W;
  const H = CELL_H;

  console.log(`Spritesheet: ${W}x${H}, ${FRAME_COUNT} frames`);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  for (let i = 0; i < FRAME_COUNT; i++) {
    const srcPath = `${srcDir}\\465_${i}.png`;
    const img = await loadImage(srcPath);
    ctx.drawImage(img, i * CELL_W, 0, CELL_W, CELL_H);
    console.log(`  Frame ${i}: 465_${i}.png placed at x=${i * CELL_W}`);
  }

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(outPath, buffer);
  console.log(`Saved to ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  console.log("=== DONE ===");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
