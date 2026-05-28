import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const sffPath = "C:\\Cursed Battles\\client\\deoutrojogo\\Jujutsu Kaisen Cursed Clash (camelô) V6\\chars\\Itadori Shinjuku\\sff.sff";
const outDir = "C:\\Cursed Battles\\client\\assets\\sprites\\yuji_shinjuku";

const GROUPS = {
  stand: [7505],
  run: [7506],
  attack: [7000],
  domain: [7011],
};

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const buf = readFileSync(sffPath);
const data = extract(buf, { palettes: true, spriteBuffer: false, decodeSpriteBuffer: true });

const groups = {};
data.sprites.forEach(spr => {
  if (!groups[spr.group]) groups[spr.group] = [];
  groups[spr.group].push(spr);
});

function extractGroup(groupNum) {
  if (!groups[groupNum]) {
    console.log(`Group ${groupNum} NOT FOUND`);
    return null;
  }
  const sprites = groups[groupNum].sort((a, b) => a.number - b.number);
  if (sprites.length === 0) return null;
  
  const baseW = sprites[0].width;
  const baseH = sprites[0].height;
  console.log(`Group ${groupNum}: ${sprites.length} sprites, base ${baseW}x${baseH}`);
  
  const canvases = [];
  for (const spr of sprites) {
    const src = spr.decodedBuffer;
    const canvas = createCanvas(spr.width, spr.height);
    const ctx = canvas.getContext("2d");
    const imgData = ctx.createImageData(spr.width, spr.height);
    const d = imgData.data;
    for (let sy = 0; sy < spr.height; sy++) {
      for (let sx = 0; sx < spr.width; sx++) {
        const si = (sy * spr.width + sx) * 4;
        if (src[si + 3] === 0) continue;
        const di = (sy * spr.width + sx) * 4;
        d[di] = src[di]; d[di+1] = src[di+1]; d[di+2] = src[di+2]; d[di+3] = src[di+3];
      }
    }
    ctx.putImageData(imgData, 0, 0);
    canvases.push(canvas);
  }
  return { canvases, baseW, baseH };
}

function buildSpritesheet(canvases, scale = 0.18) {
  if (!canvases || canvases.length === 0) return null;
  
  const baseW = canvases[0].width;
  const baseH = canvases[0].height;
  const outW = Math.floor(baseW * scale);
  const outH = Math.floor(baseH * scale);
  const cols = canvases.length;
  const totalW = outW * cols;
  const totalH = outH;
  
  const sheetCanvas = createCanvas(totalW, totalH);
  const sCtx = sheetCanvas.getContext("2d");
  sCtx.clearRect(0, 0, totalW, totalH);
  
  for (let i = 0; i < canvases.length; i++) {
    sCtx.drawImage(canvases[i], i * outW, 0, outW, outH);
  }
  
  return { canvas: sheetCanvas, frameW: outW, frameH: outH };
}

for (const [name, groupNums] of Object.entries(GROUPS)) {
  let allCanvases = [];
  for (const g of groupNums) {
    const result = extractGroup(g);
    if (result && result.canvases) {
      allCanvases = allCanvases.concat(result.canvases);
    }
  }
  if (allCanvases.length > 0) {
    const sheet = buildSpritesheet(allCanvases, 0.18);
    if (sheet) {
      writeFileSync(`${outDir}\\${name}.png`, sheet.canvas.toBuffer("image/png"));
      console.log(`Saved ${name}.png: ${allCanvases.length} frames, ${sheet.frameW}x${sheet.frameH}\n`);
    }
  } else {
    console.log(`No frames for ${name}`);
  }
}

console.log("Done!");