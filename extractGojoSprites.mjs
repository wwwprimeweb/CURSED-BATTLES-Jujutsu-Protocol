import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const MUGEN_DIR = "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars";
const OUTPUT_DIR = "C:\\Cursed Battles\\Gojo_Sprites";

const variants = [
  { label: "Gojo Base", sffPath: "Gojo\\Satoru.sff" },
  { label: "Gojo de muleta", sffPath: "Gojo de muleta\\Satoru.sff" },
  { label: "Gojo Filme 0", sffPath: "Gojo Filme 0\\=\\spr.sff" },
  { label: "Gojo MANGA", sffPath: "Gojo MANGA\\Satoru.sff" },
  { label: "Gojo Shinjuku", sffPath: "Gojo Shinjuku\\spr.sff" },
  { label: "Gojo Teen", sffPath: "Gojo Teen\\Gojo.sff" },
  { label: "Gojo Waifu", sffPath: "Gojo Waifu\\Gojo Waifu.sff" },
  { label: "Gojo(Infinite Venerable)", sffPath: "Gojo(Infinite Venerable)\\Gojo(revealed).sff" },
  { label: "TC_Gojo_Satoru", sffPath: "TC_Gojo_Satoru\\TC_Gojo_Satoru.sff" },
  { label: "Yuta Body Gojo Jus", sffPath: "Yuta Body Gojo Jus\\Yuta Body Gojo Jus.sff" },
];

function spriteToPngBuffer(spr) {
  const canvas = createCanvas(Math.max(1, spr.width), Math.max(1, spr.height));
  const ctx = canvas.getContext("2d");
  if (spr.width > 0 && spr.height > 0 && spr.decodedBuffer) {
    const imgData = ctx.createImageData(spr.width, spr.height);
    imgData.data.set(spr.decodedBuffer);
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas.toBuffer("image/png");
}

function scanGroups(outDir) {
  if (!existsSync(outDir)) return null;
  const files = readdirSync(outDir).filter(f => f.endsWith('.png'));
  const groups = {};
  for (const f of files) {
    const parts = f.replace('.png', '').split('_');
    if (parts.length < 2) continue;
    const group = parts[0];
    if (!groups[group]) groups[group] = [];
    groups[group].push(f);
  }
  const sortedGroups = {};
  Object.keys(groups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(g => {
    sortedGroups[g] = groups[g].sort((a, b) => {
      const na = parseInt(a.replace('.png', '').split('_')[1]);
      const nb = parseInt(b.replace('.png', '').split('_')[1]);
      return na - nb;
    });
  });
  return sortedGroups;
}

async function extractVariant(variant) {
  const sffFullPath = `${MUGEN_DIR}\\${variant.sffPath}`;
  const outDir = `${OUTPUT_DIR}\\${variant.label}`;

  if (!existsSync(sffFullPath)) {
    console.log(`[${variant.label}] SFF not found at ${sffFullPath}`);
    const existing = scanGroups(outDir);
    if (existing) {
      const total = Object.values(existing).reduce((s, a) => s + a.length, 0);
      console.log(`[${variant.label}] Using existing ${Object.keys(existing).length} groups, ${total} sprites`);
      return { label: variant.label, baseDir: variant.label, groups: existing };
    }
    return null;
  }

  mkdirSync(outDir, { recursive: true });

  console.log(`[${variant.label}] Reading SFF...`);
  const buf = readFileSync(sffFullPath);

  console.log(`[${variant.label}] Extracting sprites...`);
  const data = extract(buf, {
    palettes: true,
    spriteBuffer: false,
    decodeSpriteBuffer: true,
  });

  console.log(`[${variant.label}] Got ${data.sprites.length} sprites, saving...`);
  let saved = 0;

  for (const spr of data.sprites) {
    const key = `${spr.group}_${spr.number}`;
    const outPath = `${outDir}\\${key}.png`;
    if (!existsSync(outPath)) {
      try {
        const pngBuf = spriteToPngBuffer(spr);
        writeFileSync(outPath, pngBuf);
        saved++;
      } catch (e) {
        console.error(`  Failed to save ${key}: ${e.message}`);
      }
    }
  }

  console.log(`[${variant.label}] Saved ${saved} new sprites`);

  const groups = scanGroups(outDir);
  const totalSprites = groups ? Object.values(groups).reduce((s, a) => s + a.length, 0) : 0;
  const groupCount = groups ? Object.keys(groups).length : 0;
  console.log(`[${variant.label}] Total: ${groupCount} groups, ${totalSprites} sprites`);

  return { label: variant.label, baseDir: variant.label, groups: groups || {} };
}

function escapeJsStr(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function generateViewer(variantData) {
  const viewerPath = `${OUTPUT_DIR}\\viewer.html`;

  const variantsJson = JSON.stringify(variantData.map(v => ({
    label: v.label,
    baseDir: v.baseDir,
    groups: v.groups,
  })));

  const html = `<!DOCTYPE html>
<html lang=pt-BR>
<head>
<meta charset=UTF-8>
<title>Gojo - Sprites Viewer</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }
h1 { text-align: center; margin-bottom: 5px; color: #e94560; }
p.sub { text-align: center; color: #888; margin-bottom: 5px; font-size: 14px; }
.tabs { text-align: center; margin-bottom: 12px; }
.tabs button { padding: 5px 16px; background: #0f3460; border: 1px solid #533483; color: #eee; cursor: pointer; border-radius: 4px; font-size: 13px; margin: 0 3px; }
.tabs button:hover { background: #533483; }
.tabs button.active { background: #e94560; border-color: #e94560; }
.stats { text-align: center; color: #aaa; margin-bottom: 15px; font-size: 13px; }
.groups { display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; max-height: 120px; overflow-y: auto; padding: 8px; background: #16213e; border-radius: 8px; }
.groups button { padding: 3px 10px; background: #0f3460; border: 1px solid #533483; color: #eee; cursor: pointer; border-radius: 4px; font-size: 12px; white-space: nowrap; }
.groups button:hover { background: #533483; }
.groups button.active { background: #e94560; border-color: #e94560; }
.sprite-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-items: flex-start; }
.sprite-item { background: #16213e; border-radius: 4px; padding: 4px; text-align: center; }
.sprite-item img { display: block; image-rendering: pixelated; background: repeating-conic-gradient(#2a2a4a 0% 25%, transparent 0% 50%) 0 0 / 20px 20px; max-width: 300px; }
.sprite-item .label { font-size: 11px; color: #aaa; margin-top: 2px; }
</style>
</head>
<body>
<h1>Gojo - Sprites</h1>
<p class=sub>Extraido de Jujutsu Kaisen Mugen V9</p>
<div class=tabs id=tabs></div>
<p class=stats id=stats></p>
<div class=groups id=group-nav></div>
<div class=sprite-grid id=grid></div>

<script>
var variants = ${variantsJson};
var currentVariant = null;
var tabButtons = document.getElementById('tabs');
var nav = document.getElementById('group-nav');
var grid = document.getElementById('grid');
var stats = document.getElementById('stats');

var variantGroupIds = {};

for (var i = 0; i < variants.length; i++) {
  var v = variants[i];
  variantGroupIds[v.label] = Object.keys(v.groups);
  var btn = document.createElement('button');
  btn.textContent = v.label;
  btn.onclick = (function(idx) {
    return function() { switchVariant(idx); };
  })(i);
  tabButtons.appendChild(btn);
}

function switchVariant(idx) {
  currentVariant = variants[idx];
  var buttons = tabButtons.querySelectorAll('button');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove('active');
  }
  buttons[idx].classList.add('active');

  var groupIds = variantGroupIds[currentVariant.label];
  var totalSprites = 0;
  for (var g in currentVariant.groups) { totalSprites += currentVariant.groups[g].length; }
  stats.textContent = Object.keys(currentVariant.groups).length + ' grupos | ' + totalSprites + ' sprites';

  nav.innerHTML = '';
  for (var i = 0; i < groupIds.length; i++) {
    var g = groupIds[i];
    var btn = document.createElement('button');
    btn.textContent = 'Grupo ' + g + ' (' + currentVariant.groups[g].length + ')';
    btn.onclick = (function(grp) {
      return function() { showGroup(grp); };
    })(g);
    nav.appendChild(btn);
  }

  if (groupIds.length > 0) showGroup(groupIds[0]);
}

function showGroup(groupId) {
  var buttons = nav.querySelectorAll('button');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove('active');
    if (buttons[i].textContent.indexOf('Grupo ' + groupId + ' ') === 0) {
      buttons[i].classList.add('active');
    }
  }

  grid.innerHTML = '';
  var sprites = currentVariant.groups[groupId];
  if (!sprites) return;

  for (var i = 0; i < sprites.length; i++) {
    var sprite = sprites[i];
    var div = document.createElement('div');
    div.className = 'sprite-item';
    var img = document.createElement('img');
    img.src = currentVariant.baseDir + '/' + sprite;
    img.alt = sprite;
    img.loading = 'lazy';
    var label = document.createElement('div');
    label.className = 'label';
    label.textContent = sprite.replace('.png', '');
    div.appendChild(img);
    div.appendChild(label);
    grid.appendChild(div);
  }
}

switchVariant(0);
</script>
</body>
</html>`;

  writeFileSync(viewerPath, html, 'utf-8');
  console.log(`\n[Viewer] Created viewer.html`);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const variantData = [];
  for (const variant of variants) {
    const data = await extractVariant(variant);
    if (data) variantData.push(data);
  }

  if (variantData.length > 0) {
    generateViewer(variantData);
  }

  console.log("\n=== DONE ===");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
