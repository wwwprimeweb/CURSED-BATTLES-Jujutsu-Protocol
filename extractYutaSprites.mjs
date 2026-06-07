import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const SFF_PATH = "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars\\Yuta Shinjuku\\Yuta Shinjuku.sff";
const BASE_DIR = "C:\\Cursed Battles\\Yuta_Sprites\\Yuta Base";

function spriteToPngBuffer(spr) {
  const canvas = createCanvas(spr.width, spr.height);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(spr.width, spr.height);
  imgData.data.set(spr.decodedBuffer);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toBuffer("image/png");
}

async function main() {
  mkdirSync(BASE_DIR, { recursive: true });

  console.log("Reading Yuta Shinjuku SFF...");
  const buf = readFileSync(SFF_PATH);

  console.log("Extracting all sprites...");
  const data = extract(buf, {
    palettes: true,
    spriteBuffer: false,
    decodeSpriteBuffer: true,
  });

  console.log(`Got ${data.sprites.length} sprites from SFF`);

  let saved = 0;
  for (const spr of data.sprites) {
    const key = `${spr.group}_${spr.number}`;
    const outPath = `${BASE_DIR}\\${key}.png`;
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
  console.log(`Saved ${saved} new sprites to ${BASE_DIR}`);

  // Generate viewer data
  console.log("\nScanning Yuta Base for viewer data...");
  const files = readdirSync(BASE_DIR).filter(f => f.endsWith('.png'));
  const groups = {};

  for (const f of files) {
    const parts = f.replace('.png', '').split('_');
    if (parts.length < 2) continue;
    const group = parts[0];
    if (!groups[group]) groups[group] = [];
    groups[group].push(f);
  }

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
  console.log(`Total: ${totalGroups} groups, ${totalSprites} sprites`);

  // Create viewer.html
  const viewerHtml = `<!DOCTYPE html>
<html lang=pt-BR>
<head>
<meta charset=UTF-8>
<title>Yuta Shinjuku - Sprites Viewer</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }
h1 { text-align: center; margin-bottom: 5px; color: #e94560; }
p.sub { text-align: center; color: #888; margin-bottom: 20px; font-size: 14px; }
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
<h1>Yuta Shinjuku - Sprites</h1>
<p class=sub>Extraído de Jujutsu Kaisen Mugen V9</p>
<p class=stats>${totalGroups} grupos | ${totalSprites} sprites</p>

<div class=groups id=group-nav></div>
<div class=sprite-grid id=grid></div>

<script>
var allGroups = ${JSON.stringify(allGroupsObj)};

var groupIds = Object.keys(allGroups);
var nav = document.getElementById('group-nav');

for (var i = 0; i < groupIds.length; i++) {
  var g = groupIds[i];
  var btn = document.createElement('button');
  btn.textContent = 'Grupo ' + g + ' (' + allGroups[g].length + ')';
  btn.onclick = (function(grp) {
    return function() { showGroup(grp); };
  })(g);
  nav.appendChild(btn);
}

function showGroup(groupId) {
  var buttons = document.querySelectorAll('.groups button');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove('active');
    if (buttons[i].textContent.indexOf('Grupo ' + groupId + ' ') === 0) {
      buttons[i].classList.add('active');
    }
  }

  var grid = document.getElementById('grid');
  grid.innerHTML = '';
  var sprites = allGroups[groupId];
  if (!sprites) return;

  for (var i = 0; i < sprites.length; i++) {
    var sprite = sprites[i];
    var div = document.createElement('div');
    div.className = 'sprite-item';
    var img = document.createElement('img');
    img.src = 'Yuta Base/' + sprite;
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

if (groupIds.length > 0) showGroup(groupIds[0]);
</script>
</body>
</html>`;

  const viewerPath = "C:\\Cursed Battles\\Yuta_Sprites\\viewer.html";
  writeFileSync(viewerPath, viewerHtml, 'utf-8');
  console.log(`Created viewer: ${viewerPath}`);
  console.log("\n=== DONE ===");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
