import { readFileSync } from "fs";
import { Image, createCanvas } from "canvas";

const imgPath = "client/assets/sprites/debug_frames/frame_0.png";

const buf = readFileSync(imgPath);
const img = new Image();
img.src = buf;

const canvas = createCanvas(img.width, img.height);
const ctx = canvas.getContext("2d");
ctx.drawImage(img, 0, 0);

const imgData = ctx.getImageData(0, 0, img.width, img.height);
const d = imgData.data;

console.log(`Analyzing frame_0.png pixels (${img.width}x${img.height}):`);

// Find the vertical range of non-transparent pixels
let firstY = -1;
let lastY = -1;
let totalNonTransparent = 0;

for (let y = 0; y < img.height; y++) {
  let hasRowPixels = false;
  for (let x = 0; x < img.width; x++) {
    const idx = (y * img.width + x) * 4;
    const a = d[idx + 3];
    if (a > 10) {
      hasRowPixels = true;
      totalNonTransparent++;
    }
  }
  
  if (hasRowPixels) {
    if (firstY === -1) firstY = y;
    lastY = y;
  }
}

console.log(`Vertical range of active pixels: Y = ${firstY} to ${lastY}`);
console.log(`Total active pixels: ${totalNonTransparent} out of ${img.width * img.height}`);
