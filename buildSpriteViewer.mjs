import { readFileSync, writeFileSync, mkdirSync } from "fs";
import extract from "sff-extractor";
import { createCanvas } from "canvas";

const basePath = "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars";

const characters = [
  {
    name: "Toji",
    outDir: "C:\\Cursed Battles\\Toji_Sprites",
    sffs: [
      { label: "Toji", path: `${basePath}\\Toji\\Toji.sff` },
      { label: "Toji Fushiguro", path: `${basePath}\\Toji Fushiguro\\Toji Fushiguro.sff` },
    ],
  },
  {
    name: "Maki",
    outDir: "C:\\Cursed Battles\\Maki_Sprites",
    sffs: [
      { label: "Maki", path: `${basePath}\\Maki\\Maki.sff` },
    ],
  },
];

function spriteToCanvas(spr) {
  const c = createCanvas(spr.width, spr.height);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(spr.width, spr.height);
  img.data.set(spr.decodedBuffer);
  ctx.putImageData(img, 0, 0);
  return c;
}

function buildGroups(sprList) {
  const groups = {};
  for (const spr of sprList) {
    const g = String(spr.group);
    if (!groups[g]) groups[g] = [];
    groups[g].push(spr);
  }
  // sort each group by number
  for (const g in groups) {
    groups[g].sort((a, b) => a.number - b.number);
  }
  return groups;
}

for (const char of characters) {
  console.log(`\n=== ${char.name} ===`);

  mkdirSync(char.outDir, { recursive: true });

  const allVariants = [];

  for (const sff of char.sffs) {
    console.log(`  Reading ${sff.label}...`);
    const buf = readFileSync(sff.path);
    const data = extract(buf, { palettes: true, spriteBuffer: false, decodeSpriteBuffer: true });
    console.log(`    ${data.sprites.length} sprites`);

    const baseDir = `${char.outDir}\\${sff.label} Base`;
    mkdirSync(baseDir, { recursive: true });

    const groups = buildGroups(data.sprites);
    const variantFiles = {};
    let totalSaved = 0;

    for (const groupId in groups) {
      variantFiles[groupId] = [];
      for (const spr of groups[groupId]) {
        const filename = `${groupId}_${spr.number}.png`;
        const filepath = `${baseDir}\\${filename}`;
        const canvas = spriteToCanvas(spr);
        writeFileSync(filepath, canvas.toBuffer("image/png"));
        variantFiles[groupId].push(filename);
        totalSaved++;
      }
    }

    allVariants.push({ label: sff.label, files: variantFiles, baseDir: `${sff.label} Base` });
    console.log(`    Saved ${totalSaved} PNGs to ${baseDir}`);
  }

  // Write viewer.html
  const variantData = allVariants.map(v => ({
    label: v.label,
    baseDir: v.baseDir,
    groups: v.files,
  }));

  const html = `<!DOCTYPE html>
<html lang=pt-BR>
<head>
<meta charset=UTF-8>
<title>${char.name} - Sprites Viewer</title>
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
<h1>${char.name} - Sprites</h1>
<p class=sub>Extra\u00eddo de Jujutsu Kaisen Mugen V9</p>
<div class=tabs id=tabs></div>
<p class=stats id=stats></p>
<div class=groups id=group-nav></div>
<div class=sprite-grid id=grid></div>

<script>
var variants = ${JSON.stringify(variantData)};
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

  writeFileSync(`${char.outDir}\\viewer.html`, html);
  console.log(`  Written viewer.html`);
}

console.log("\nDone!");
