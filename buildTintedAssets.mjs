import { readFileSync, writeFileSync } from "fs";
import { createCanvas, loadImage } from "canvas";

const COLORS = {
  gojo:   { r: 80,  g: 235, b: 255 },
  yuta:   { r: 255, g: 20,  b: 140 },
  sukuna: { r: 230, g: 50,  b: 50  },
  yuji:   { r: 80,  g: 235, b: 255 },
  megumi: { r: 80,  g: 235, b: 255 },
  hakari: { r: 50,  g: 220, b: 80  },
};

const ALPHA_MULS = {
  yuta: 0.7,
};
const DEFAULT_ALPHA = 0.5;

const ASSETS_DIR = "client/assets";

// Convenience: load a PNG file and return a {canvas, ctx} pair
function loadPng(path) {
  const buf = readFileSync(path);
  return loadImage(buf);
}

// Tint a single frame canvas in-place with the given color and brightness rules.
// Algorithm: for each pixel, if alpha >= 10:
//   brightness = max(r,g,b)
//   if brightness < threshold → black with alpha * alphaMul
//   else → character color with alpha * alphaMul
function tintFrame(ctx, w, h, color, alphaMul, brightnessThreshold) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a < 10) continue;
    const brightness = Math.max(px[i], px[i + 1], px[i + 2]);
    if (brightness < brightnessThreshold) {
      px[i] = 0; px[i + 1] = 0; px[i + 2] = 0;
      px[i + 3] = Math.round(a * alphaMul);
    } else {
      px[i] = color.r; px[i + 1] = color.g; px[i + 2] = color.b;
      px[i + 3] = Math.round(a * alphaMul);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// Tint a single frame canvas to a flat color (all non-transparent pixels → solid color)
function tintFrameFlat(ctx, w, h, cr, cg, cb) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 10) continue;
    px[i] = cr; px[i + 1] = cg; px[i + 2] = cb;
  }
  ctx.putImageData(imageData, 0, 0);
}

// ────────────────────────────────────────────
// 1. recovery_flame.png → per-character tinted spritesheets
//    12 frames, 4 cols × 3 rows, each 500×567
// ────────────────────────────────────────────
async function buildRecoveryFlame() {
  const srcPath = `${ASSETS_DIR}/energyrecover/recovery_flame.png`;
  const img = await loadPng(srcPath);
  const cols = 4, rows = 3;
  const fw = 500, fh = 567;
  const totalFrames = 12;

  for (const [char, color] of Object.entries(COLORS)) {
    const canvas = createCanvas(cols * fw, rows * fh);
    const ctx = canvas.getContext("2d");

    for (let i = 0; i < totalFrames; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const sx = col * fw, sy = row * fh;

      // Extract single frame to a temp canvas
      const frameCanvas = createCanvas(fw, fh);
      const fCtx = frameCanvas.getContext("2d");
      fCtx.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);

      // Tint to character color (brightness threshold 50, alphaMul 0.7)
      tintFrame(fCtx, fw, fh, color, 0.7, 50);

      // Place into output spritesheet
      ctx.drawImage(frameCanvas, sx, sy, fw, fh);
    }

    const outPath = `${ASSETS_DIR}/energyrecover/recovery_flame_${char}.png`;
    writeFileSync(outPath, canvas.toBuffer("image/png"));
    console.log(`Saved: ${outPath}`);
  }
}

// ────────────────────────────────────────────
// 2. energyspritesheet.png → per-character tinted
//    19 frames, 6 cols, each 136×292
// ────────────────────────────────────────────
async function buildEnergyRecover() {
  const srcPath = `${ASSETS_DIR}/energyrecover/energyspritesheet.png`;
  const img = await loadPng(srcPath);
  const cols = 6;
  const fw = 136, fh = 292;
  const totalFrames = 19;
  const rows = Math.ceil(totalFrames / cols);

  for (const [char, color] of Object.entries(COLORS)) {
    const alphaMul = ALPHA_MULS[char] || DEFAULT_ALPHA;

    const canvas = createCanvas(cols * fw, rows * fh);
    const ctx = canvas.getContext("2d");

    for (let i = 0; i < totalFrames; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const sx = col * fw, sy = row * fh;

      const frameCanvas = createCanvas(fw, fh);
      const fCtx = frameCanvas.getContext("2d");
      fCtx.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);

      tintFrame(fCtx, fw, fh, color, alphaMul, 25);

      ctx.drawImage(frameCanvas, sx, sy, fw, fh);
    }

    const outPath = `${ASSETS_DIR}/energyrecover/energyspritesheet_${char}.png`;
    writeFileSync(outPath, canvas.toBuffer("image/png"));
    console.log(`Saved: ${outPath}`);
  }
}

// ────────────────────────────────────────────
// 3. impact_sheet.png → black + red versions (flat color)
//    21 frames in a row, each 132×96
// ────────────────────────────────────────────
async function buildImpactSheet() {
  const srcPath = `${ASSETS_DIR}/sprites/yuji_shinjuku/impact_sheet.png`;
  const img = await loadPng(srcPath);
  const fw = 132, fh = 96;
  const totalFrames = 21;

  for (const [name, cr, cg, cb] of [["black", 0, 0, 0], ["red", 255, 0, 0]]) {
    const canvas = createCanvas(fw * totalFrames, fh);
    const ctx = canvas.getContext("2d");

    for (let i = 0; i < totalFrames; i++) {
      const sx = i * fw;
      const frameCanvas = createCanvas(fw, fh);
      const fCtx = frameCanvas.getContext("2d");
      fCtx.drawImage(img, sx, 0, fw, fh, 0, 0, fw, fh);

      tintFrameFlat(fCtx, fw, fh, cr, cg, cb);

      ctx.drawImage(frameCanvas, sx, 0, fw, fh);
    }

    const outPath = `${ASSETS_DIR}/sprites/yuji_shinjuku/impact_sheet_${name}.png`;
    writeFileSync(outPath, canvas.toBuffer("image/png"));
    console.log(`Saved: ${outPath}`);
  }
}

// ────────────────────────────────────────────
async function main() {
  console.log("Building tinted assets...\n");
  await buildRecoveryFlame();
  await buildEnergyRecover();
  await buildImpactSheet();
  console.log("\nDone!");
}

main().catch((e) => { console.error("Error:", e); process.exit(1); });
