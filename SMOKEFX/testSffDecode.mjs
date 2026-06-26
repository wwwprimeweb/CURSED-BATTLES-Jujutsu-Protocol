import { readFileSync } from "fs";
import extract from "sff-extractor";

const sffPath = "client/deoutrojogo/Jujutsu Kaisen Cursed Clash (camelô) V6/chars/Yuji Itadori Shibuya Start/Yuji Itadori.sff";

const buf = readFileSync(sffPath);
const data = extract(buf, { palettes: true, spriteBuffer: true, decodeSpriteBuffer: true, spriteGroups: [7011] });

const spr = data.sprites[0];
console.log(`decodedBuffer length: ${spr.decodedBuffer ? spr.decodedBuffer.length : "none"}`);
console.log(`Expected size (width * height): ${spr.width * spr.height}`);
