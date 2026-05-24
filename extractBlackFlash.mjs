import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const sffPath = "C:\\Cursed Battles\\client\\deoutrojogo\\Jujutsu Kaisen Cursed Clash (camelô) V6\\chars\\Itadori Final Arc\\Yuji Itadori.sff";
const outDir = "C:\\Cursed Battles\\client\\assets\\habilit";
const GROUP = 7005;
const CELL_W = 2142;
const CELL_H = 206;

const framesDir = `${outDir}\\blackflash_frames`;
if (existsSync(framesDir)) rmSync(framesDir, { recursive: true });
mkdirSync(framesDir);

const buf = readFileSync(sffPath);
const data = extract(buf, { palettes: true, spriteBuffer: false, decodeSpriteBuffer: true, spriteGroups: [GROUP] });

const sprites = data.sprites.sort((a, b) => a.number - b.number);
console.log(`Found ${sprites.length} sprites in group ${GROUP}: [${sprites.map(s => s.number).join(',')}]`);

const canvases = [];

for (const spr of sprites) {
  const src = spr.decodedBuffer;
  const canvas = createCanvas(spr.width, spr.height);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(spr.width, spr.height);
  const d = imgData.data;
  let colored = 0;
  for (let sy = 0; sy < spr.height; sy++) {
    for (let sx = 0; sx < spr.width; sx++) {
      const si = (sy * spr.width + sx) * 4;
      if (src[si + 3] === 0) continue;
      const di = (sy * spr.width + sx) * 4;
      d[di] = src[di]; d[di+1] = src[di+1]; d[di+2] = src[di+2]; d[di+3] = src[di+3];
      colored++;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  writeFileSync(`${framesDir}\\${GROUP}_${spr.number}.png`, canvas.toBuffer("image/png"));
  console.log(`Frame ${spr.number}: ${spr.width}x${spr.height}, ${colored}px`);
  canvases.push(canvas);
}

const scalar = 0.2;
const outW = Math.floor(CELL_W * scalar);
const outH = Math.floor(CELL_H * scalar);
const cols = canvases.length;
const totalW = outW * cols;
if (totalW > 32767) throw new Error(`Sheet too wide: ${totalW}`);

const sheetCanvas = createCanvas(totalW, outH);
const sCtx = sheetCanvas.getContext("2d");
sCtx.clearRect(0, 0, totalW, outH);

for (let i = 0; i < canvases.length; i++) {
  sCtx.drawImage(canvases[i], i * outW, 0, outW, outH);
}

writeFileSync(`${outDir}\\blackflash.png`, sheetCanvas.toBuffer("image/png"));
console.log(`\nSaved blackflash.png (${canvases.length}f, ${CELL_W}x${CELL_H} each)`);

const meta = { group: GROUP, frames: canvases.length, frameWidth: outW, frameHeight: outH, originalW: CELL_W, originalH: CELL_H, frameMs: Array(canvases.length).fill(33), totalMs: canvases.length * 33 };
writeFileSync(`${outDir}\\blackflash_meta.json`, JSON.stringify(meta, null, 2));
console.log(`Timing: 33ms/frame, ${meta.totalMs}ms total`);
console.log("Done!");
