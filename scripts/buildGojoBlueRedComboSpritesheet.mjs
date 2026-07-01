import { writeFileSync } from "fs";
import { createCanvas, loadImage } from "canvas";

const srcDir = "C:\\Cursed Battles\\client\\assets\\sprites\\TC_Gojo_Satoru";
const outPath = "C:\\Cursed Battles\\client\\assets\\sprites\\o-honrado_blue_red_combo.png";

const START = 1106;
const END = 1121;
const FRAME_COUNT = END - START + 1;
const CELL_W = 388;
const CELL_H = 388;

async function main() {
  const canvas = createCanvas(FRAME_COUNT * CELL_W, CELL_H);
  const ctx = canvas.getContext("2d");

  console.log(`Spritesheet: ${canvas.width}x${canvas.height}, ${FRAME_COUNT} frames`);

  for (let i = 0; i < FRAME_COUNT; i++) {
    const frameNo = START + i;
    const srcPath = `${srcDir}\\0_${frameNo}.png`;
    const img = await loadImage(srcPath);
    const dx = i * CELL_W + Math.floor((CELL_W - img.width) / 2);
    const dy = Math.floor((CELL_H - img.height) / 2);
    ctx.drawImage(img, dx, dy);
    console.log(`  Frame ${i}: 0_${frameNo}.png ${img.width}x${img.height} at (${dx},${dy})`);
  }

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(outPath, buffer);
  console.log(`Saved to ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
