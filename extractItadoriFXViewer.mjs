import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { createCanvas } from "canvas";
import extract from "sff-extractor";

const SOURCES = [
  {
    name: "Shibuya",
    sffPath: "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars\\Itadori Shibuya\\Itadori Shibuya.sff",
    outDir: "C:\\Cursed Battles\\Itadori_FX_Sprites\\Itadori FX Shibuya Base",
    baseDirName: "Itadori FX Shibuya Base",
    groups: ["30001", "30003", "30007", "30008", "30009", "30010", "30011", "7001", "7002"],
  },
  {
    name: "Shinjuku",
    sffPath: "C:\\Cursed Battles\\client\\Jujutsu Kaisen Mugen V9 (OpenGL)\\chars\\Itadori Shinjuku\\sff.sff",
    outDir: "C:\\Cursed Battles\\Itadori_FX_Sprites\\Itadori FX Shinjuku Base",
    baseDirName: "Itadori FX Shinjuku Base",
    groups: ["6120", "1043", "1044", "30200", "30201", "30202", "30203", "30204", "30205", "30206", "7001", "7002"],
  },
];

function spriteToPngBuffer(spr) {
  const canvas = createCanvas(spr.width, spr.height);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(spr.width, spr.height);
  imgData.data.set(spr.decodedBuffer);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toBuffer("image/png");
}

function collectGroupsBySource(source) {
  const buf = readFileSync(source.sffPath);
  const data = extract(buf, {
    palettes: true,
    spriteBuffer: false,
    decodeSpriteBuffer: true,
    spriteGroups: source.groups.map((g) => parseInt(g, 10)),
  });

  const groups = {};
  for (const spr of data.sprites) {
    const key = `${spr.group}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(spr);
  }

  return groups;
}

async function main() {
  const allSourceData = [];

  for (const source of SOURCES) {
    mkdirSync(source.outDir, { recursive: true });
    console.log(`Reading ${source.name} SFF...`);
    const groups = collectGroupsBySource(source);

    let saved = 0;
    for (const [groupId, sprites] of Object.entries(groups)) {
      sprites.sort((a, b) => a.number - b.number);
      for (const spr of sprites) {
        const key = `${groupId}_${spr.number}`;
        const outPath = `${source.outDir}\\${key}.png`;
        if (!existsSync(outPath)) {
          try {
            writeFileSync(outPath, spriteToPngBuffer(spr));
            saved++;
          } catch (e) {
            console.error(`  Failed to save ${source.name} ${key}: ${e.message}`);
          }
        }
      }
    }
    console.log(`Saved ${saved} new sprites to ${source.outDir}`);
    allSourceData.push({ source, groups });
  }

  const viewerData = {};
  let totalGroups = 0;
  let totalSprites = 0;

  for (const { source, groups } of allSourceData) {
    viewerData[source.name] = {};
    const sortedKeys = Object.keys(groups).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    totalGroups += sortedKeys.length;
    for (const key of sortedKeys) {
      const files = readdirSync(source.outDir)
        .filter((f) => f.startsWith(`${key}_`) && f.endsWith(".png"))
        .sort((a, b) => parseInt(a.replace(".png", "").split("_")[1], 10) - parseInt(b.replace(".png", "").split("_")[1], 10));
      totalSprites += files.length;
      viewerData[source.name][key] = files;
    }
  }

  const sourceNames = SOURCES.map((s) => s.name);
  const sourceBaseDirs = Object.fromEntries(SOURCES.map((s) => [s.name, s.baseDirName]));

  const viewerHtml = `<!DOCTYPE html>
<html lang=pt-BR>
<head>
<meta charset=UTF-8>
<title>Itadori FX - Sprites Viewer</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; background: #10131f; color: #eee; padding: 20px; }
h1 { text-align: center; margin-bottom: 5px; color: #40e0d0; }
p.sub { text-align: center; color: #888; margin-bottom: 10px; font-size: 14px; }
.stats { text-align: center; color: #aaa; margin-bottom: 12px; font-size: 13px; }
.hint { text-align: center; color: #9fb; margin-bottom: 14px; font-size: 12px; }
.sources, .groups { display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; max-height: 140px; overflow-y: auto; padding: 8px; background: #16213e; border-radius: 8px; }
.sources button, .groups button { padding: 3px 10px; background: #0f3460; border: 1px solid #533483; color: #eee; cursor: pointer; border-radius: 4px; font-size: 12px; white-space: nowrap; }
.sources button:hover, .groups button:hover { background: #533483; }
.sources button.active, .groups button.active { background: #40e0d0; border-color: #40e0d0; color: #001; }
.sprite-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-items: flex-start; }
.sprite-item { background: #16213e; border-radius: 4px; padding: 4px; text-align: center; }
.sprite-item img { display: block; image-rendering: pixelated; background: repeating-conic-gradient(#2a2a4a 0% 25%, transparent 0% 50%) 0 0 / 20px 20px; max-width: 300px; }
.sprite-item .label { font-size: 11px; color: #aaa; margin-top: 2px; }
.section-title { margin: 18px 0 8px; color: #40e0d0; font-size: 13px; }
</style>
</head>
<body>
<h1>Itadori FX - Sprites</h1>
<p class=sub>FX e impactos do Itadori / Yuji no V9</p>
<p class=stats>${totalGroups} grupos | ${totalSprites} sprites</p>
<p class=hint>FX úteis para análise: 30001, 30003, 30007, 30008, 30009, 30010, 30011, 6120, 7001, 7002, 30200-30206</p>

<div class=section-title>Fontes</div>
<div class=sources id=source-nav></div>

<div class=section-title>Grupos</div>
<div class=groups id=group-nav></div>
<div class=sprite-grid id=grid></div>

<script>
var viewerData = ${JSON.stringify(viewerData)};
var sources = ${JSON.stringify(sourceNames)};
var sourceBaseDirs = ${JSON.stringify(sourceBaseDirs)};
var currentSource = sources[0];

var sourceNav = document.getElementById('source-nav');
var groupNav = document.getElementById('group-nav');

function setActiveButtons(container, labelPrefix, value) {
  var buttons = container.querySelectorAll('button');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove('active');
    if (buttons[i].textContent.indexOf(labelPrefix + value + ' ') === 0) {
      buttons[i].classList.add('active');
    }
  }
}

function renderGroups() {
  groupNav.innerHTML = '';
  var groups = viewerData[currentSource] || {};
  var ids = Object.keys(groups).sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); });
  for (var i = 0; i < ids.length; i++) {
    var g = ids[i];
    var btn = document.createElement('button');
    btn.textContent = 'Grupo ' + g + ' (' + groups[g].length + ')';
    btn.onclick = (function(grp) { return function() { showGroup(grp); }; })(g);
    groupNav.appendChild(btn);
  }
  if (groups['30001']) {
    showGroup('30001');
  } else if (ids.length > 0) {
    showGroup(ids[0]);
  } else {
    document.getElementById('grid').innerHTML = '';
  }
}

for (var i = 0; i < sources.length; i++) {
  var s = sources[i];
  var btn = document.createElement('button');
  btn.textContent = 'Fonte ' + s;
  btn.onclick = (function(src) {
    return function() {
      currentSource = src;
      setActiveButtons(sourceNav, 'Fonte ', src);
      renderGroups();
    };
  })(s);
  sourceNav.appendChild(btn);
}

function showGroup(groupId) {
  setActiveButtons(groupNav, 'Grupo ', groupId);
  var grid = document.getElementById('grid');
  grid.innerHTML = '';
  var sprites = (viewerData[currentSource] || {})[groupId];
  if (!sprites) return;

  for (var i = 0; i < sprites.length; i++) {
    var sprite = sprites[i];
    var div = document.createElement('div');
    div.className = 'sprite-item';
    var img = document.createElement('img');
    img.src = sourceBaseDirs[currentSource] + '/' + sprite;
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

if (sourceNav.firstChild) {
  sourceNav.firstChild.classList.add('active');
}
renderGroups();
</script>
</body>
</html>`;

  const viewerPath = "C:\\Cursed Battles\\Itadori_FX_Sprites\\viewer.html";
  writeFileSync(viewerPath, viewerHtml, "utf-8");
  console.log(`Created viewer: ${viewerPath}`);
  console.log("\n=== DONE ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
