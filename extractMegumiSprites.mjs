import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const MEGUMI_SFF = "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars\\Megumi\\Megumi.sff";
const SHIBUYA_SFF = "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars\\Megumi Fushiguro Shibuya Arc\\Megumi Fushiguro.sff";
const BASE_DIR = "C:\\Cursed Battles\\Megumi_Sprites\\Megumi Base";
const LZ5_DIR = "C:\\Cursed Battles\\Megumi_Sprites\\Megumi Base LZ5";

// Missing sprite groups from .air analysis (groups in .air but not in Megumi Base folder)
// Format: { group: [frameIndices] } — null means all frames referenced in .air
// These are the groups from the Xenodar Megumi.air that are NOT in Megumi Base
const MISSING_GROUPS = {
  // Completely missing groups
  100: [0],
  300: [35],
  450: [0,1,2,3,4,5,6,7],
  551: [0,1,2,3,4,5,6,7,8,9],
  1026: [0,1,2],
  1035: [20,21,22,23,24,25,26,27],
  1037: [0,1,2,3,4,5,6,7],
  1055: [1,3],
  1087: [0,1,2,3,4,5,6,7,8,9,10,11,12,13],
  1137: [0,1,2,3,4,5],
  1150: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28],
  1185: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32],
  1186: [4,5,6,9,13,17,18,19,20,21,23,26,27,28,29,31,32,34,35,36,37,38,39,40,41,42,43,50,51,52,53,54,55,56,57,58,59,60,61,62,63,66,87,88],
  1187: [5,12,13,21,36],
  1270: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
  1274: [0,1,2,3,4,5,6,7,8,9,10,11],
  1276: [0,1,2,3,4,5,6,7,8,9],
  2040: [0,1,2,3,4,5,6,7,8,9],
  7000: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
  7013: [5,6,7,8,9,10,11,12],
  7018: [0,1,2,3,4,5,6,7],
  7024: [0,1,2,3,4,5,6,7,8,9],
  7029: [0,1,2],
  7033: [12],
  7060: [0,1,2,3,4,5,6],
  7107: [3],
  7111: [0,1,2,3,4,5,6,7,8,9,10],
  7141: [0,1,2,3,4,5,6],
  7153: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
  7550: [0,1,2,3,4,5,6,7,8,9],
  8230: Array.from({length: 57}, (_, i) => i),
  8240: Array.from({length: 16}, (_, i) => i),
};

// Additional frames missing from groups that partially exist
const PARTIAL_MISSING = {
  830: [0,1,2,3,5,8,9,10],
  1086: [0,1,2,5,7,8],
  9107: Array.from({length: 14}, (_, i) => i).filter(x => x !== 9),
  1272: [0,1,4,5,6,7,8,10],
  1277: [0,1,2,4,5,6,7,8,10],
  1017: [0,4,5,6,8,9,10,11,12],
  1018: [1,2,3,4,5,6,7,8,9,10,11,12],
  2022: [0,3,4,6,8,9],
  7025: [2,3,4,5,6,7,9],
  7500: [24],
  230: [15,16,17,19],
  161: [13],
  130: [1],
  5000: [2,4,6],
  551: [0,1,2,3,4,5,6,7,8,9],
  552: [0,1,2,3,4,5,6,7],
  553: [0,1,2,3,4,5,6,7],
  554: [0,1,2,3,4,5,6,7],
  555: [0,1,2,3],
  0: [5],
  10: [2,3,4,5,6,7,8,9,10,11],
  11: [1],
  20: [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33],
  40: [2,3,4,5,6,7,8,9],
  170: [1,2,3,4,5,6,7,8,9],
  171: [0,2],
  172: [4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29],
};

// Merge all missing into one object
const ALL_MISSING = { ...MISSING_GROUPS };
for (const [group, frames] of Object.entries(PARTIAL_MISSING)) {
  if (ALL_MISSING[group]) {
    // Only add frames not already listed
    const existing = new Set(ALL_MISSING[group]);
    for (const f of frames) existing.add(f);
    ALL_MISSING[group] = [...existing].sort((a, b) => a - b);
  } else {
    ALL_MISSING[group] = frames;
  }
}

function spriteToPngBuffer(spr) {
  const canvas = createCanvas(spr.width, spr.height);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(spr.width, spr.height);
  imgData.data.set(spr.decodedBuffer);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toBuffer("image/png");
}

async function extractFromSFF(sffPath, label) {
  if (!existsSync(sffPath)) {
    console.log(`[${label}] SFF not found at ${sffPath}`);
    return {};
  }

  console.log(`[${label}] Reading ${sffPath}...`);
  const buf = readFileSync(sffPath);
  const groupsToExtract = Object.keys(ALL_MISSING).map(Number);

  console.log(`[${label}] Extracting ${groupsToExtract.length} groups from SFF...`);
  const data = extract(buf, {
    palettes: true,
    spriteBuffer: false,
    decodeSpriteBuffer: true,
    spriteGroups: groupsToExtract,
  });

  console.log(`[${label}] Got ${data.sprites.length} sprites from SFF`);
  const saved = {};
  for (const spr of data.sprites) {
    const key = `${spr.group}_${spr.number}`;
    const outPath = `${BASE_DIR}\\${key}.png`;
    if (!existsSync(outPath)) {
      try {
        const pngBuf = spriteToPngBuffer(spr);
        writeFileSync(outPath, pngBuf);
        saved[key] = true;
        console.log(`  Saved: ${key}.png (${spr.width}x${spr.height})`);
      } catch (e) {
        console.error(`  Failed to save ${key}: ${e.message}`);
      }
    } else {
      console.log(`  Already exists: ${key}.png`);
    }
  }
  return saved;
}

function copyFromLZ5() {
  console.log(`\n[Copiar LZ5] Checking ${LZ5_DIR}...`);
  if (!existsSync(LZ5_DIR)) {
    console.log("[Copiar LZ5] LZ5 directory not found");
    return {};
  }

  const files = readdirSync(LZ5_DIR).filter(f => f.endsWith('.png'));
  console.log(`[Copiar LZ5] Found ${files.length} PNG files in LZ5`);
  let copied = 0;

  for (const f of files) {
    const destPath = `${BASE_DIR}\\${f}`;
    if (!existsSync(destPath)) {
      const srcPath = `${LZ5_DIR}\\${f}`;
      copyFileSync(srcPath, destPath);
      copied++;
      console.log(`  Copied: ${f}`);
    }
  }
  console.log(`[Copiar LZ5] Copied ${copied} new files from LZ5`);
}

function generateViewerData() {
  console.log(`\n[Viewer] Scanning ${BASE_DIR}...`);
  const files = readdirSync(BASE_DIR).filter(f => f.endsWith('.png'));
  const groups = {};

  for (const f of files) {
    const parts = f.replace('.png', '').split('_');
    if (parts.length < 2) continue;
    const group = parts[0];
    if (!groups[group]) groups[group] = [];
    groups[group].push(f);
  }

  // Sort by group number (numeric) and then by frame number
  const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
    const na = parseInt(a), nb = parseInt(b);
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  });

  const allGroupsObj = {};
  for (const g of sortedGroupKeys) {
    const frames = groups[g].sort((a, b) => {
      const na = parseInt(a.replace('.png', '').split('_')[1]);
      const nb = parseInt(b.replace('.png', '').split('_')[1]);
      return na - nb;
    });
    allGroupsObj[g] = frames;
  }

  const totalGroups = Object.keys(allGroupsObj).length;
  const totalSprites = Object.values(allGroupsObj).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`[Viewer] Total: ${totalGroups} groups, ${totalSprites} sprites`);

  return { allGroupsObj, totalGroups, totalSprites };
}

function updateViewerHtml(allGroupsObj, totalGroups, totalSprites) {
  const viewerPath = "C:\\Cursed Battles\\Megumi_Sprites\\viewer.html";
  let viewerHtml = readFileSync(viewerPath, 'utf-8');

  const jsonStr = JSON.stringify(allGroupsObj);
  // Replace the allGroups variable in the viewer
  const newVarLine = `var allGroups = ${jsonStr};`;

  viewerHtml = viewerHtml.replace(/var allGroups = \{.+?\};/s, newVarLine);
  // Update stats line
  viewerHtml = viewerHtml.replace(
    /<p class=stats>\d+ grupos \| \d+ sprites<\/p>/,
    `<p class=stats>${totalGroups} grupos | ${totalSprites} sprites</p>`
  );

  writeFileSync(viewerPath, viewerHtml, 'utf-8');
  console.log(`\n[Viewer] Updated viewer.html: ${totalGroups} groups, ${totalSprites} sprites`);
}

async function main() {
  mkdirSync(BASE_DIR, { recursive: true });

  // Step 1: Copy from LZ5 first
  copyFromLZ5();

  // Step 2: Extract from Megumi.sff (Xenodar)
  await extractFromSFF(MEGUMI_SFF, "Megumi.sff");

  // Step 3: Extract from Shibuya .sff
  await extractFromSFF(SHIBUYA_SFF, "Shibuya.sff");

  // Step 4: Generate viewer data and update HTML
  const { allGroupsObj, totalGroups, totalSprites } = generateViewerData();
  updateViewerHtml(allGroupsObj, totalGroups, totalSprites);

  console.log("\n=== DONE ===");
  console.log(`Total: ${totalGroups} groups, ${totalSprites} sprites in Megumi Base`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
