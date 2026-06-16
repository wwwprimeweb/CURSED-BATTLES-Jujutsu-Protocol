import { readdirSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { join, parse } from "path";

const BASE_DIR = "C:\\Cursed Battles\\Yuta_Sprites\\Yuta Base";
const OUTPUT_DIR = "C:\\Cursed Battles\\Yuta_Sprites";
const RIKA_SRC = "C:\\Cursed Battles\\client\\assets\\sprites\\rika-portador-do-vinculo.png";
const RIKA_DST = join(OUTPUT_DIR, "rika-portador-do-vinculo.png");

const files = readdirSync(BASE_DIR).filter(f => f.endsWith('.png'));
const groups = {};

for (const f of files) {
  const parts = f.replace('.png', '').split('_');
  if (parts.length < 2) continue;
  const group = parts[0];
  if (!groups[group]) groups[group] = [];
  groups[group].push(f);
}

const sortedGroups = Object.keys(groups).sort((a, b) => parseInt(a) - parseInt(b));
const allGroups = {};
for (const g of sortedGroups) {
  allGroups[g] = groups[g].sort((a, b) => {
    const na = parseInt(a.replace('.png', '').split('_')[1]);
    const nb = parseInt(b.replace('.png', '').split('_')[1]);
    return na - nb;
  });
}

if (existsSync(RIKA_SRC)) {
  copyFileSync(RIKA_SRC, RIKA_DST);
}

const totalGroups = Object.keys(allGroups).length;
const totalSprites = Object.values(allGroups).reduce((s, a) => s + a.length, 0);

const groupData = {};
for (const g of sortedGroups) {
  groupData[g] = allGroups[g];
}

function categoryFor(g) {
  const n = parseInt(g);
  if (n === 0) return "Idle / Base";
  if (n >= 1 && n <= 4) return "Andar / Correr";
  if (n >= 5 && n <= 10) return "Pulo / Queda";
  if (n >= 11 && n <= 99) return "Ataques (Grupos 11-99)";
  if (n >= 100 && n <= 199) return "Specials (Grupos 100-199)";
  if (n >= 200 && n <= 299) return "Golpes Especiais (200-299)";
  if (n >= 300 && n <= 699) return "Combos / Skills (300-699)";
  if (n >= 700 && n <= 999) return "Vitória / Intro / Dano (700-999)";
  if (n >= 7000 && n <= 7999) return "Efeitos / Rika (7000-7999)";
  if (n >= 8000 && n <= 8999) return "Aura / Explosões (8000-8999)";
  if (n >= 9000) return "Domínio / Final (9000+)";
  return "Outros";
}

const GROUP_JSON = JSON.stringify(groupData);
const CATEGORIES_JSON = JSON.stringify(
  [...new Set(sortedGroups.map(categoryFor))]
);

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Yuta Shinjuku - Sprite Viewer</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; background: #0d0d1a; color: #ddd; display: flex; height: 100vh; overflow: hidden; }

/* Sidebar */
.sidebar { width: 240px; background: #13132a; border-right: 1px solid #2a2a4a; display: flex; flex-direction: column; flex-shrink: 0; }
.sidebar h2 { font-size: 15px; padding: 14px 16px 6px; color: #e94560; font-weight: 700; letter-spacing: 0.3px; }
.sidebar .sub { font-size: 11px; padding: 0 16px 10px; color: #777; }
.search-box { padding: 8px 12px; }
.search-box input { width: 100%; padding: 6px 10px; background: #1a1a35; border: 1px solid #2a2a4a; border-radius: 6px; color: #ddd; font-size: 12px; outline: none; }
.search-box input:focus { border-color: #e94560; }
.cat-label { font-size: 10px; text-transform: uppercase; color: #666; padding: 8px 16px 4px; letter-spacing: 0.5px; font-weight: 600; }
.group-list { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
.group-list::-webkit-scrollbar { width: 4px; }
.group-list::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 2px; }
.grp-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 5px 10px; background: none; border: none; border-radius: 4px; color: #999; cursor: pointer; font-size: 12px; text-align: left; transition: all 0.15s; }
.grp-btn:hover { background: #1a1a35; color: #ddd; }
.grp-btn.active { background: #e9456033; color: #e94560; border-left: 2px solid #e94560; }
.grp-btn .preview { width: 24px; height: 24px; image-rendering: pixelated; background: repeating-conic-gradient(#1a1a35 0% 25%, #0d0d1a 0% 50%) 0 0 / 8px 8px; border-radius: 2px; flex-shrink: 0; object-fit: contain; }
.grp-btn .info { display: flex; flex-direction: column; min-width: 0; }
.grp-btn .gid { font-weight: 600; font-size: 12px; }
.grp-btn .gcount { font-size: 10px; color: #666; }

/* Main */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.toolbar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #13132a; border-bottom: 1px solid #2a2a4a; flex-shrink: 0; flex-wrap: wrap; }
.toolbar .tabs { display: flex; gap: 4px; }
.toolbar .tabs button { padding: 5px 14px; background: #1a1a35; border: 1px solid #2a2a4a; border-radius: 6px; color: #888; cursor: pointer; font-size: 12px; transition: all 0.15s; }
.toolbar .tabs button:hover { background: #2a2a4a; color: #ddd; }
.toolbar .tabs button.active { background: #e94560; border-color: #e94560; color: #fff; }
.toolbar .ctrl-group { display: flex; align-items: center; gap: 6px; }
.toolbar .ctrl-group label { font-size: 11px; color: #888; }
.toolbar input[type=range] { width: 70px; accent-color: #e94560; }
.toolbar .zoom-val { font-size: 11px; color: #aaa; min-width: 32px; }
.toolbar .play-btn { padding: 4px 12px; background: #1a1a35; border: 1px solid #2a2a4a; border-radius: 6px; color: #ddd; cursor: pointer; font-size: 13px; }
.toolbar .play-btn:hover { background: #e9456033; border-color: #e94560; }
.toolbar .play-btn.active { background: #e9456022; border-color: #e94560; color: #e94560; }
.toolbar .spacer { flex: 1; }
.toolbar .group-info { font-size: 12px; color: #888; }

.content { flex: 1; overflow-y: auto; padding: 16px; }
.content::-webkit-scrollbar { width: 6px; }
.content::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 3px; }

.sprite-grid { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-start; }
.sprite-item { background: #13132a; border-radius: 4px; padding: 4px; text-align: center; transition: transform 0.1s; }
.sprite-item:hover { transform: scale(1.05); z-index: 1; }
.sprite-item img { display: block; image-rendering: pixelated; background: repeating-conic-gradient(#1a1a35 0% 25%, #0d0d1a 0% 50%) 0 0 / 16px 16px; }
.sprite-item .label { font-size: 10px; color: #666; margin-top: 2px; white-space: nowrap; }
.sprite-item .dims { font-size: 9px; color: #444; }

/* Rika tab */
.rika-section { padding: 20px; text-align: center; }
.rika-section h2 { color: #ff66b2; font-size: 22px; margin-bottom: 8px; }
.rika-section p { color: #999; font-size: 13px; margin-bottom: 20px; }
.rika-section .rika-img { display: inline-block; max-width: 100%; border-radius: 8px; background: repeating-conic-gradient(#1a1a35 0% 25%, #0d0d1a 0% 50%) 0 0 / 20px 20px; }
.rika-section .rika-img img { display: block; max-width: 100%; max-height: 80vh; image-rendering: auto; border-radius: 8px; }
.rika-section .rika-dims { font-size: 12px; color: #666; margin-top: 8px; }
.rika-section .rika-info { font-size: 12px; color: #888; margin-top: 12px; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.5; }

.no-sprites { padding: 40px; text-align: center; color: #555; font-size: 14px; }
</style>
</head>
<body>

<div class="sidebar">
  <h2>Yuta Shinjuku</h2>
  <p class="sub">${totalGroups} grupos &middot; ${totalSprites} sprites</p>
  <div class="search-box">
    <input type="text" id="search" placeholder="Buscar grupo...">
  </div>
  <div class="group-list" id="groupList"></div>
</div>

<div class="main">
  <div class="toolbar">
    <div class="tabs" id="tabs">
      <button class="active" data-tab="sprites">Sprites</button>
      <button data-tab="rika">Rika</button>
    </div>
    <div class="ctrl-group" id="spriteControls">
      <button class="play-btn" id="playBtn">&#9654; Play</button>
      <label>FPS</label>
      <input type="range" id="fpsSlider" min="1" max="30" value="8">
      <span class="zoom-val" id="fpsVal">8</span>
      <label>Zoom</label>
      <input type="range" id="zoomSlider" min="16" max="256" value="80">
      <span class="zoom-val" id="zoomVal">80</span>
    </div>
    <div class="spacer"></div>
    <span class="group-info" id="groupInfo">Nenhum grupo selecionado</span>
  </div>

  <div class="content" id="content">
    <div class="sprite-grid" id="grid"></div>
  </div>
</div>

<script>
var GROUPS = ${GROUP_JSON};
var SORTED_GROUPS = ${JSON.stringify(sortedGroups)};

var state = {
  currentGroup: SORTED_GROUPS[0] || null,
  playing: false,
  fps: 8,
  zoom: 80,
  frameIndex: 0,
  frameTimer: null,
  tab: 'sprites',
};

var grid = document.getElementById('grid');
var groupList = document.getElementById('groupList');
var groupInfo = document.getElementById('groupInfo');
var content = document.getElementById('content');
var playBtn = document.getElementById('playBtn');
var fpsSlider = document.getElementById('fpsSlider');
var fpsVal = document.getElementById('fpsVal');
var zoomSlider = document.getElementById('zoomSlider');
var zoomVal = document.getElementById('zoomVal');
var search = document.getElementById('search');

/* Build sidebar */
function buildSidebar(filter) {
  groupList.innerHTML = '';
  var lastCat = '';
  for (var i = 0; i < SORTED_GROUPS.length; i++) {
    var g = SORTED_GROUPS[i];
    if (filter && !g.includes(filter) && g !== filter) continue;
    var cat = categoryFor(g);
    if (cat !== lastCat) {
      var lbl = document.createElement('div');
      lbl.className = 'cat-label';
      lbl.textContent = cat;
      groupList.appendChild(lbl);
      lastCat = cat;
    }
    var btn = document.createElement('button');
    btn.className = 'grp-btn' + (g === state.currentGroup ? ' active' : '');
    btn.dataset.group = g;
    var frame0 = GROUPS[g][0];
    btn.innerHTML = '<img class="preview" src="Yuta Base/' + frame0 + '" alt="">' +
      '<div class="info"><span class="gid">Grupo ' + g + '</span><span class="gcount">' + GROUPS[g].length + ' frames</span></div>';
    btn.onclick = function() { selectGroup(this.dataset.group); };
    groupList.appendChild(btn);
  }
}

function categoryFor(g) {
  var n = parseInt(g);
  if (n === 0) return "Idle / Base";
  if (n >= 1 && n <= 4) return "Andar / Correr";
  if (n >= 5 && n <= 10) return "Pulo / Queda";
  if (n >= 11 && n <= 99) return "Ataques";
  if (n >= 100 && n <= 199) return "Specials";
  if (n >= 200 && n <= 299) return "Golpes Especiais";
  if (n >= 300 && n <= 699) return "Combos / Skills";
  if (n >= 700 && n <= 999) return "Vit\u00f3ria / Intro";
  if (n >= 7000 && n <= 7999) return "Efeitos / Rika";
  if (n >= 8000 && n <= 8999) return "Aura / Explos\u00f5es";
  if (n >= 9000) return "Dom\u00ednio / Final";
  return "Outros";
}

/* Render sprites */
function renderGroup(groupId) {
  if (state.tab === 'rika') return;
  grid.innerHTML = '';
  var sprites = GROUPS[groupId];
  if (!sprites || sprites.length === 0) {
    grid.innerHTML = '<div class="no-sprites">Nenhum sprite neste grupo</div>';
    groupInfo.textContent = 'Grupo ' + groupId + ' — 0 sprites';
    return;
  }
  groupInfo.textContent = 'Grupo ' + groupId + ' — ' + sprites.length + ' frames';

  var startIdx = state.playing ? state.frameIndex : 0;
  for (var i = 0; i < sprites.length; i++) {
    var s = sprites[i];
    var div = document.createElement('div');
    div.className = 'sprite-item';
    var img = document.createElement('img');
    img.src = 'Yuta Base/' + s;
    img.alt = s;
    img.loading = 'lazy';
    img.style.width = state.zoom + 'px';
    img.onload = function() {
      var d = this.parentElement.querySelector('.dims');
      if (d) d.textContent = this.naturalWidth + '\u00d7' + this.naturalHeight;
    };
    var label = document.createElement('div');
    label.className = 'label';
    label.textContent = s.replace('.png', '');
    var dims = document.createElement('div');
    dims.className = 'dims';
    dims.textContent = '...';
    div.appendChild(img);
    div.appendChild(label);
    div.appendChild(dims);
    grid.appendChild(div);
  }
}

function selectGroup(groupId) {
  state.currentGroup = groupId;
  state.frameIndex = 0;
  stopAnimation();

  var btns = groupList.querySelectorAll('.grp-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].dataset.group === groupId);
  }

  if (state.tab === 'sprites') {
    renderGroup(groupId);
  }
}

/* Animation */
function startAnimation() {
  stopAnimation();
  state.playing = true;
  playBtn.textContent = '\u25A0 Stop';
  playBtn.classList.add('active');
  tickAnimation();
}

function tickAnimation() {
  if (!state.playing) return;
  var sprites = GROUPS[state.currentGroup];
  if (!sprites || sprites.length === 0) { stopAnimation(); return; }
  state.frameIndex = (state.frameIndex + 1) % sprites.length;
  renderGroup(state.currentGroup);

  var imgs = grid.querySelectorAll('img');
  if (imgs[state.frameIndex]) {
    imgs[state.frameIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  state.frameTimer = setTimeout(tickAnimation, 1000 / state.fps);
}

function stopAnimation() {
  state.playing = false;
  playBtn.textContent = '\u25B6 Play';
  playBtn.classList.remove('active');
  if (state.frameTimer) {
    clearTimeout(state.frameTimer);
    state.frameTimer = null;
  }
}

/* Tab switching */
function switchTab(tab) {
  state.tab = tab;
  stopAnimation();

  var btns = document.querySelectorAll('.tabs button');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].dataset.tab === tab);
  }

  document.getElementById('spriteControls').style.display = tab === 'sprites' ? '' : 'none';

  if (tab === 'sprites') {
    renderGroup(state.currentGroup);
  } else {
    grid.innerHTML = '<div class="rika-section">' +
      '<h2>Rika</h2>' +
      '<p>Yuta\u2019s Cursed Spirit — Or\u00e1culo Amaldi\u00e7oado</p>' +
      '<div class="rika-img"><img src="rika-portador-do-vinculo.png" alt="Rika"></div>' +
      '<div class="rika-dims">1728 \u00d7 2418 px — 838 KB</div>' +
      '<div class="rika-info">' +
      'Rika \u00e9 uma imagem standalone (n\u00e3o uma spritesheet). ' +
      'Os grupos de efeitos e helpers de Rika est\u00e3o misturados nos grupos 7000\u20139000+ do Yuta Shinjuku. ' +
      'Navegue pelos grupos de sprites para encontrar os frames de Rika, efeitos de dom\u00ednio e abilities especiais.' +
      '</div>' +
      '<div class="rika-info" style="margin-top:16px;font-size:11px;color:#555;">' +
      'Grupos provavelmente relacionados \u00e0 Rika (MUGEN helpers): 7122, 7200, 7500, 7600, 7777, 8115, 8120, 8121, 8200, 8230, 8240, 8250, 8330, 8338, 8345, 8360, 8370, 8375, 8390, 8500' +
      '</div>' +
      '</div>';
  }
}

/* Events */
playBtn.onclick = function() {
  if (state.playing) stopAnimation();
  else startAnimation();
};

fpsSlider.oninput = function() {
  state.fps = parseInt(this.value);
  fpsVal.textContent = state.fps;
  if (state.playing) { stopAnimation(); startAnimation(); }
};

zoomSlider.oninput = function() {
  state.zoom = parseInt(this.value);
  zoomVal.textContent = state.zoom;
  if (state.tab === 'sprites') renderGroup(state.currentGroup);
};

search.oninput = function() {
  var q = this.value.trim();
  buildSidebar(q);
};

/* Keyboard */
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT') return;
  if (state.tab !== 'sprites') return;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    var idx = SORTED_GROUPS.indexOf(state.currentGroup);
    if (idx < SORTED_GROUPS.length - 1) selectGroup(SORTED_GROUPS[idx + 1]);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    var idx = SORTED_GROUPS.indexOf(state.currentGroup);
    if (idx > 0) selectGroup(SORTED_GROUPS[idx - 1]);
  } else if (e.key === ' ') {
    e.preventDefault();
    playBtn.click();
  } else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    search.focus();
  }
});

/* Tab buttons */
document.querySelectorAll('.tabs button').forEach(function(btn) {
  btn.onclick = function() { switchTab(this.dataset.tab); };
});

/* Init */
buildSidebar('');
switchTab('sprites');
</script>
</body>
</html>`;

writeFileSync(join(OUTPUT_DIR, "viewer.html"), html, 'utf-8');
console.log(`Viewer criado: ${OUTPUT_DIR}\\viewer.html`);
console.log(`${totalGroups} grupos, ${totalSprites} sprites`);
if (existsSync(RIKA_SRC)) {
  console.log(`Rika incluída: ${RIKA_DST}`);
}
