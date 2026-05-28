import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { createCanvas, loadImage } from "canvas";
import extract from "sff-extractor";

const sffPath = "C:\\Cursed Battles\\client\\deoutrojogo\\Jujutsu Kaisen Cursed Clash (camelô) V6\\chars\\Itadori Shinjuku\\sff.sff";
const sffPathFinalArc = "C:\\Cursed Battles\\client\\deoutrojogo\\Jujutsu Kaisen Cursed Clash (camelô) V6\\chars\\Itadori Final Arc\\Yuji Itadori.sff";
const outDir = "C:\\Cursed Battles\\client\\assets\\sprites\\yuji_shinjuku";

mkdirSync(outDir, { recursive: true });

const CELL = 80;
const PIVOT_X = 40;
const PIVOT_Y = 65;

const ROWS = [
  { name: "idle", frames: [[0, 0], [0, 1], [0, 2], [0, 1]] },
  { name: "run", frames: [[20, 0], [20, 1], [20, 2], [20, 3], [20, 4]] },
  { name: "m1_1", frames: [[0, 0], [3, 5], [3, 6], [3, 7]] },
  { name: "m1_2", frames: [[2, 7], [2, 0], [4, 1], [4, 2]] },
  { name: "m1_3", frames: [[3, 0], [3, 1], [3, 2], [3, 3]] },
  { name: "m1_4", frames: [[4, 8], [4, 3], [4, 4], [3, 7]] },
  { name: "dash", frames: [[2, 0], [2, 1], [2, 2]] },
  { name: "hit", frames: [[6, 0], [6, 1]] },
  { name: "death", frames: [[1, 0]] },
  { name: "domain_prepare", frames: [[9, 7], [9, 8], [9, 9], [9, 9], [9, 9], [9, 9]] },
  { name: "domain", frames: [[0, 0]] },
  // skill1 will be patched after the main build with composited divergent fist
  { name: "skill1", frames: [[7010, 0], [7010, 1], [7010, 2], [7010, 3], [7010, 4], [7010, 5]] },
];

const DOMAIN_GROUP = 7011;
const IMPACT_GROUPS = [7021, 7022];

function toMap(sprites) {
  const map = new Map();
  for (const spr of sprites) {
    map.set(`${spr.group}_${spr.number}`, spr);
  }
  return map;
}

function copySpriteToPixels({ spr, pixels, sheetW, dstX, dstY }) {
  const src = spr.decodedBuffer;
  for (let sy = 0; sy < spr.height; sy += 1) {
    for (let sx = 0; sx < spr.width; sx += 1) {
      const si = (sy * spr.width + sx) * 4;
      const alpha = src[si + 3];
      if (alpha === 0) continue;

      const dx = dstX + sx;
      const dy = dstY + sy;
      if (dx < 0 || dy < 0) continue;

      const di = (dy * sheetW + dx) * 4;
      if (di < 0 || di + 3 >= pixels.length) continue;

      pixels[di] = src[si];
      pixels[di + 1] = src[si + 1];
      pixels[di + 2] = src[si + 2];
      pixels[di + 3] = alpha;
    }
  }
}

function buildCharacterSheet(spriteMap) {
  const cols = Math.max(...ROWS.map((row) => row.frames.length));
  const rows = ROWS.length;
  const width = cols * CELL;
  const height = rows * CELL;
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let rowIdx = 0; rowIdx < ROWS.length; rowIdx += 1) {
    const row = ROWS[rowIdx];
    for (let colIdx = 0; colIdx < row.frames.length; colIdx += 1) {
      const [group, number] = row.frames[colIdx];
      const spr = spriteMap.get(`${group}_${number}`);
      if (!spr) {
        console.warn(`Missing frame: ${group},${number} for row ${row.name}`);
        continue;
      }

      const cellX = colIdx * CELL;
      const cellY = rowIdx * CELL;
      const dstX = cellX + PIVOT_X - spr.x;
      const dstY = cellY + PIVOT_Y - spr.y;
      copySpriteToPixels({ spr, pixels, sheetW: width, dstX, dstY });
    }
  }

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(pixels);
  ctx.putImageData(imgData, 0, 0);

  const outPath = `${outDir}\\yuji_shinjuku_spritesheet.png`;
  writeFileSync(outPath, canvas.toBuffer("image/png"));

  const meta = {
    cellWidth: CELL,
    cellHeight: CELL,
    pivotX: PIVOT_X,
    pivotY: PIVOT_Y,
    rows: ROWS,
  };
  writeFileSync(`${outDir}\\yuji_shinjuku_sheet_meta.json`, JSON.stringify(meta, null, 2));
  console.log(`Saved character sheet: ${outPath}`);
}

function buildSimpleStrip({ sprites, outPath, scale }) {
  if (!sprites.length) return;
  const frameW = Math.max(1, Math.round(sprites[0].width * scale));
  const frameH = Math.max(1, Math.round(sprites[0].height * scale));
  const canvas = createCanvas(frameW * sprites.length, frameH);
  const ctx = canvas.getContext("2d");

  for (let i = 0; i < sprites.length; i += 1) {
    const spr = sprites[i];
    const srcCanvas = createCanvas(spr.width, spr.height);
    const sctx = srcCanvas.getContext("2d");
    const imgData = sctx.createImageData(spr.width, spr.height);
    imgData.data.set(spr.decodedBuffer);
    sctx.putImageData(imgData, 0, 0);
    ctx.drawImage(srcCanvas, i * frameW, 0, frameW, frameH);
  }

  writeFileSync(outPath, canvas.toBuffer("image/png"));
}

function buildImpactSheet(sprites) {
  if (!sprites.length) return;
  const scale = 0.24;
  const maxW = Math.max(...sprites.map((s) => s.width));
  const maxH = Math.max(...sprites.map((s) => s.height));
  const frameW = Math.max(1, Math.round(maxW * scale));
  const frameH = Math.max(1, Math.round(maxH * scale));
  const canvas = createCanvas(frameW * sprites.length, frameH);
  const ctx = canvas.getContext("2d");

  for (let i = 0; i < sprites.length; i += 1) {
    const spr = sprites[i];
    const srcCanvas = createCanvas(spr.width, spr.height);
    const sctx = srcCanvas.getContext("2d");
    const imgData = sctx.createImageData(spr.width, spr.height);
    imgData.data.set(spr.decodedBuffer);
    sctx.putImageData(imgData, 0, 0);

    const drawW = Math.max(1, Math.round(spr.width * scale));
    const drawH = Math.max(1, Math.round(spr.height * scale));
    const x = i * frameW + Math.round((frameW - drawW) * 0.5);
    const y = Math.round((frameH - drawH) * 0.5);
    ctx.drawImage(srcCanvas, x, y, drawW, drawH);
  }

  const outPath = `${outDir}\\impact_sheet.png`;
  writeFileSync(outPath, canvas.toBuffer("image/png"));
  writeFileSync(`${outDir}\\impact_sheet_meta.json`, JSON.stringify({
    frameWidth: frameW,
    frameHeight: frameH,
    frames: sprites.length,
  }, null, 2));
  console.log(`Saved impact sheet: ${outPath}`);
}

function main() {
  const sffBuf = readFileSync(sffPath);
  const data = extract(sffBuf, {
    palettes: true,
    spriteBuffer: false,
    decodeSpriteBuffer: true,
  });

  const spriteMap = toMap(data.sprites);
  buildCharacterSheet(spriteMap);

  const domainFrames = data.sprites
    .filter((spr) => spr.group === DOMAIN_GROUP)
    .sort((a, b) => a.number - b.number);
  buildSimpleStrip({
    sprites: domainFrames,
    outPath: `${outDir}\\domain_sheet.png`,
    scale: 0.22,
  });
  writeFileSync(`${outDir}\\domain_sheet_meta.json`, JSON.stringify({
    frameWidth: Math.round((domainFrames[0]?.width || 0) * 0.22),
    frameHeight: Math.round((domainFrames[0]?.height || 0) * 0.22),
    frames: domainFrames.length,
  }, null, 2));
  console.log("Saved domain sheet");

  const impactFrames = [];
  for (const group of IMPACT_GROUPS) {
    const sorted = data.sprites
      .filter((spr) => spr.group === group)
      .sort((a, b) => a.number - b.number);
    impactFrames.push(...sorted);
  }
  buildImpactSheet(impactFrames);

  console.log("Done.");
}

main();

// ─── Step 2: Patch skill1 row with composited divergent fist ───
// Body from Shinjuku SFF (groups 0, 2, 3), blue flame from Final Arc SFF (group 7008, original colors)
// Sequence: charge (frames 0-2, fire grows on hand) → punch (frames 3-5, fire trails the fist)

async function patchDivergentFist() {
  const outPath = `${outDir}\\yuji_shinjuku_spritesheet.png`;
  if (!existsSync(outPath)) { console.log("No spritesheet to patch"); return; }

  const shinjukuBuf = readFileSync(sffPath);
  const finalArcBuf = readFileSync(sffPathFinalArc);
  const ssData = extract(shinjukuBuf, { palettes: true, spriteBuffer: false, decodeSpriteBuffer: true });
  const faData = extract(finalArcBuf, { palettes: true, spriteBuffer: false, decodeSpriteBuffer: true });

  function getSS(group, number) { return ssData.sprites.find(s => s.group === group && s.number === number); }
  function getFA(group, number) { return faData.sprites.find(s => s.group === group && s.number === number); }

  function spriteToCanvas(spr) {
    const c = createCanvas(spr.width, spr.height);
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(spr.width, spr.height);
    img.data.set(spr.decodedBuffer);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Each frame: [bodyGroup, bodyNum, flameGroup, flameNum, scale, targetX, targetY]
  // body = Shinjuku SFF, flame = Final Arc SFF group 7008 (original blue/cyan colors)
  const frameSpecs = [
    [0, 0,   7008, 0, 0.07, 54, 28],   // idle: small spark on hand
    [0, 2,   7008, 1, 0.07, 54, 27],   // idle: flame growing
    [2, 0,   7008, 2, 0.08, 45, 26],   // charge: flame at max
    [3, 5,   7008, 3, 0.08, 43, 23],   // punch start: flame trails
    [3, 6,   7008, 4, 0.08, 43, 21],   // punch extend: flame burst
    [3, 7,   null, 0, 0,    0,  0],   // punch full: no flame
  ];

  const compositeFrames = [];
  for (const [bg, bn, fg, fn, scale, tx, ty] of frameSpecs) {
    const bodySpr = getSS(bg, bn);
    if (!bodySpr) { continue; }

    const canvas = createCanvas(CELL, CELL);
    const ctx = canvas.getContext("2d");

    // Body from Shinjuku SFF (original pixels)
    ctx.drawImage(spriteToCanvas(bodySpr), PIVOT_X - bodySpr.x, PIVOT_Y - bodySpr.y);

    // Blue flame from Final Arc SFF group 7008 (original colors, no palette modification)
    // null group = no flame (body only)
    if (fg !== null) {
      const flameSpr = getFA(fg, fn);
      if (flameSpr) {
        const fw = Math.round(flameSpr.width * scale);
        const fh = Math.round(flameSpr.height * scale);
        const fx = tx - flameSpr.x * scale;
        const fy = ty - flameSpr.y * scale;
        ctx.drawImage(spriteToCanvas(flameSpr), fx, fy, fw, fh);
      }
    }

    compositeFrames.push(canvas);
  }

  // Patch spritesheet row 11
  const sheetBuf = readFileSync(outPath);
  const sheet = await loadImage(sheetBuf);
  const sheetCanvas = createCanvas(sheet.width, sheet.height);
  const sCtx = sheetCanvas.getContext("2d");
  sCtx.drawImage(sheet, 0, 0);
  sCtx.clearRect(0, 11 * CELL, CELL * 6, CELL);
  for (let i = 0; i < Math.min(compositeFrames.length, 6); i++) {
    sCtx.drawImage(compositeFrames[i], i * CELL, 11 * CELL);
  }
  writeFileSync(outPath, sheetCanvas.toBuffer("image/png"));
  console.log(`Patched row 11 with ${compositeFrames.length} divergent fist frames (Shinjuku body + 7008 flame)`);
}

patchDivergentFist().catch(e => { console.error("Divergent fist patch failed:", e); });
