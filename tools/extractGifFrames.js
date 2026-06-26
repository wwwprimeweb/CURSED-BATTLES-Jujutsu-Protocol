const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

const GIF_DIR = path.join(__dirname, "..", "bloodfx");
const OUT_DIR = path.join(__dirname, "..", "client", "assets", "bloodfx", "frames");
const GIF_COUNT = 9;

function readU16(d, pos) {
  return d[pos] | (d[pos + 1] << 8);
}

function lzwDecode(minCodeSize, data) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  const dict = [];
  for (let i = 0; i < clearCode; i++) dict.push([i]);
  dict.push(null);
  dict.push(null);
  const result = [];
  let bitPos = 0;
  let prevCode = -1;

  const readCode = () => {
    if (bitPos + codeSize > data.length * 8) return -1;
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const byteIdx = Math.floor(bitPos / 8);
      const bitIdx = bitPos % 8;
      if (byteIdx < data.length) code |= ((data[byteIdx] >> bitIdx) & 1) << i;
      bitPos++;
    }
    return code;
  };

  while (true) {
    const code = readCode();
    if (code === -1 || code === eoiCode) break;
    if (code === clearCode) {
      codeSize = minCodeSize + 1;
      dict.length = 0;
      for (let i = 0; i < clearCode; i++) dict.push([i]);
      dict.push(null);
      dict.push(null);
      prevCode = -1;
      continue;
    }
    if (prevCode === -1) {
      if (code < dict.length && dict[code]) { result.push(code); prevCode = code; }
      continue;
    }
    let entry;
    if (code < dict.length && dict[code]) {
      entry = dict[code];
    } else if (code === dict.length) {
      const prev = dict[prevCode];
      if (prev) entry = prev.concat(prev[0]);
      else break;
    } else {
      break;
    }
    for (const v of entry) result.push(v);
    const p = dict[prevCode];
    if (p) dict.push(p.concat(entry[0]));
    if (dict.length >= (1 << codeSize) && codeSize < 12) codeSize++;
    prevCode = code;
  }
  return result;
}

function decodeGif(filePath) {
  const buf = fs.readFileSync(filePath);
  const d = new Uint8Array(buf);
  let pos = 0;

  const sig = String.fromCharCode(d[0], d[1], d[2]);
  if (sig !== "GIF") throw new Error("Not a GIF: " + filePath);

  const width = readU16(d, 6);
  const height = readU16(d, 8);
  const packed = d[10];
  const gctFlag = (packed >> 7) & 1;
  const gctSize = gctFlag ? 2 << (packed & 0x07) : 0;
  pos = 13;

  let globalColorTable = null;
  if (gctFlag) {
    globalColorTable = [];
    for (let i = 0; i < gctSize; i++) {
      globalColorTable.push([d[pos++], d[pos++], d[pos++]]);
    }
  }

  let rawFrames = [];
  let transparentIndex = -1;
  let delay = 100;

  while (pos < d.length - 1) {
    if (d[pos] === 0x21) {
      pos++;
      const label = d[pos++];
      if (label === 0xF9) {
        const blockSize = d[pos++];
        const gcePacked = d[pos++];
        transparentIndex = (gcePacked & 1) ? d[pos + 2] : -1;
        delay = readU16(d, pos) * 10;
        pos += blockSize - 1;
        pos++;
      } else {
        while (d[pos] !== 0) pos += d[pos] + 1;
        pos++;
      }
    } else if (d[pos] === 0x2C) {
      pos++;
      const il = readU16(d, pos); pos += 2;
      const it = readU16(d, pos); pos += 2;
      const iw = readU16(d, pos); pos += 2;
      const ih = readU16(d, pos); pos += 2;
      const ipacked = d[pos++];
      const lctFlag = (ipacked >> 7) & 1;
      const interlace = (ipacked >> 6) & 1;
      const lctSize = lctFlag ? 2 << (ipacked & 0x07) : 0;

      let colorTable;
      if (lctFlag) {
        colorTable = [];
        for (let i = 0; i < lctSize; i++) colorTable.push([d[pos++], d[pos++], d[pos++]]);
      } else {
        colorTable = globalColorTable;
      }

      const imageDataStart = pos;
      const minCodeSize = d[pos++];
      const compressedData = [];
      let blockSize = d[pos++];
      while (blockSize > 0) {
        for (let i = 0; i < blockSize; i++) compressedData.push(d[pos++]);
        blockSize = d[pos++];
      }

      const indices = lzwDecode(minCodeSize, compressedData);
      const pixels = new Uint8Array(iw * ih * 4);
      let idx = 0;
      for (let y = 0; y < ih; y++) {
        const row = interlace ? (() => {
          if (y < ih / 8) return y * 8;
          if (y < ih / 4) return (y - ih / 8) * 8 + 4;
          if (y < ih / 2) return (y - ih / 4) * 4 + 2;
          return (y - ih / 2) * 2 + 1;
        })() : y;
        for (let x = 0; x < iw; x++) {
          const ci = indices[idx++] || 0;
          const pi = (row * iw + x) * 4;
          if (ci === transparentIndex) {
            pixels[pi + 3] = 0;
          } else {
            const c = colorTable[ci];
            if (c) { pixels[pi] = c[0]; pixels[pi + 1] = c[1]; pixels[pi + 2] = c[2]; pixels[pi + 3] = 255; }
          }
        }
      }

      rawFrames.push({ pixels, width: iw, height: ih, left: il, top: it, delay: Math.max(10, delay), transparentIndex });
      delay = 100;
      transparentIndex = -1;
    } else if (d[pos] === 0x3B) {
      break;
    } else {
      pos++;
    }
  }

  // Composite frames onto full canvas
  const compositePixelData = new Uint8Array(width * height * 4);
  let prevPixelData = new Uint8Array(width * height * 4);
  const result = [];

  for (let i = 0; i < rawFrames.length; i++) {
    const f = rawFrames[i];

    if (i > 0) {
      const prev = rawFrames[i - 1];
      // We don't handle disposal method - just overlay each frame on previous
      // For blood splatters, this is fine since frames are full overlays
    }

    for (let y = 0; y < f.height; y++) {
      for (let x = 0; x < f.width; x++) {
        const fi = (y * f.width + x) * 4;
        if (f.pixels[fi + 3] === 0) continue;
        const cx = f.left + x;
        const cy = f.top + y;
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
        const ci = (cy * width + cx) * 4;
        compositePixelData[ci] = f.pixels[fi];
        compositePixelData[ci + 1] = f.pixels[fi + 1];
        compositePixelData[ci + 2] = f.pixels[fi + 2];
        compositePixelData[ci + 3] = 255;
      }
    }

    const c = createCanvas(width, height);
    const ctx = c.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    const clamped = new Uint8ClampedArray(compositePixelData);
    imageData.data.set(clamped);
    ctx.putImageData(imageData, 0, 0);
    result.push({ canvas: c, delay: Math.max(10, f.delay) });
  }

  return { width, height, frames: result };
}

// Main
async function main() {
  console.log("Extracting GIF frames...\n");

  const meta = { animations: [] };

  for (let i = 1; i <= GIF_COUNT; i++) {
    const gifPath = path.join(GIF_DIR, `VFX Blood Batch 1_${i}.gif`);
    if (!fs.existsSync(gifPath)) {
      console.log(`  GIF ${i}: NOT FOUND at ${gifPath}`);
      meta.animations.push({ frames: [] });
      continue;
    }

    try {
      const result = decodeGif(gifPath);
      const animMeta = { frames: [] };

      result.frames.forEach((frame, fi) => {
        const filename = `${i}_${fi}.png`;
        const outPath = path.join(OUT_DIR, filename);
        const buf = frame.canvas.toBuffer("image/png");
        fs.writeFileSync(outPath, buf);
        animMeta.frames.push({ file: filename, delay: frame.delay });
      });

      meta.animations.push(animMeta);
      console.log(`  GIF ${i}: ${result.width}x${result.height}, ${result.frames.length} frames extracted`);
    } catch (e) {
      console.log(`  GIF ${i}: ERROR - ${e.message}`);
      meta.animations.push({ frames: [] });
    }
  }

  const metaPath = path.join(OUT_DIR, "meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log("\nMeta written to " + metaPath);

  const totalFrames = meta.animations.reduce((sum, a) => sum + a.frames.length, 0);
  console.log("Total frames extracted: " + totalFrames);
}

main().catch(console.error);
