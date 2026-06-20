import { createCanvas, loadImage } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const INPUT  = resolve(ROOT, "Maki_Sprites", "Maki Base");
const OUTPUT = resolve(ROOT, "client", "assets", "spritesmonsters");

mkdirSync(OUTPUT, { recursive: true });

const FRAMES = 8;

for (let i = 0; i < FRAMES; i++) {
  const src = resolve(INPUT, `417_${i}.png`);
  const dst = resolve(OUTPUT, `staring_beast_atk_${i}.png`);

  const img = await loadImage(src);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (r < 10 && g < 4 && b < 4 && a > 0) {
      data[i + 3] = 0;
    } else {
      const intensity = Math.max(r, g, b);
      data[i]     = Math.min(255, r);
      data[i + 1] = Math.min(255, Math.max(g, intensity * 0.15));
      data[i + 2] = Math.min(255, Math.max(b, intensity * 0.85));
    }
  }
  ctx.putImageData(imageData, 0, 0);

  writeFileSync(dst, canvas.toBuffer("image/png"));
  console.log(`[OK] staring_beast_atk_${i}.png (${img.width}x${img.height})`);
}

console.log("\nDone! 8 frames generated.");
