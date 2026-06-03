import { readFileSync, writeFileSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const sffPath = "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars\\Yuta Shinjuku\\Yuta Shinjuku.sff";
const outPath = "C:\\Cursed Battles\\client\\assets\\sprites\\yuta_m1_alt.png";

const SPRITES = [53, 54, 55, 51, 52];
const GROUP_ID = 0;
const CELL_W = 108;
const CELL_H = 80;
const COLS = SPRITES.length;
const ROWS = 1;
const CELL_PIVOT_X = 40;
const CELL_PIVOT_Y = 65;
const Y_SHIFT = 5;
const X_SHIFT = 12;

// Convert unsigned 16-bit to signed
function toSigned16(v) {
  return v > 32767 ? v - 65536 : v;
}

async function main() {
  console.log("Reading Yuta Shinjuku SFF...");
  const sffBuf = readFileSync(sffPath);

  console.log("Extracting sprites 0_51~0_55...");
  const data = extract(sffBuf, {
    palettes: true,
    spriteBuffer: false,
    decodeSpriteBuffer: true,
    spriteGroups: [GROUP_ID],
  });

  const spriteMap = {};
  for (const spr of data.sprites) {
    if (spr.group === GROUP_ID && SPRITES.includes(spr.number)) {
      spriteMap[spr.number] = spr;
    }
  }

  const W = CELL_W * COLS;
  const H = CELL_H * ROWS;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  for (let i = 0; i < SPRITES.length; i++) {
    const num = SPRITES[i];
    const spr = spriteMap[num];
    if (!spr) {
      console.warn(`  Sprite 0_${num} not found, skipping`);
      continue;
    }

    const cellX = i * CELL_W;
    const cellY = 0;
    const px = toSigned16(spr.x);
    const py = toSigned16(spr.y);
    const dstX = cellX + CELL_PIVOT_X - px + X_SHIFT;
    const dstY = cellY + CELL_PIVOT_Y - py + Y_SHIFT;

    const imgData = ctx.createImageData(spr.width, spr.height);
    const srcData = new Uint8ClampedArray(spr.decodedBuffer);
    for (let j = 0; j < imgData.data.length; j++) {
      imgData.data[j] = srcData[j];
    }
    ctx.putImageData(imgData, dstX, dstY);

    console.log(`  Sprite 0_${num} (${spr.width}x${spr.height}) placed at (${dstX}, ${dstY})`);
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
