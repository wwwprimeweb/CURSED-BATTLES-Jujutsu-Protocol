const CHARACTER_SKILLS = {
  gojo: [
    { key: "q", hotkey: "Q", icon: "Az", name: "Azul", cost: 35, baseCooldown: 10, tag: "controle" },
    { key: "e", hotkey: "E", icon: "Vm", name: "Vermelho", cost: 45, baseCooldown: 14, tag: "burst" },
    { key: "r", hotkey: "R", icon: "Pr", name: "Purple", cost: 80, baseCooldown: 24, tag: "beam" },
    { key: "space", hotkey: "Space", icon: "Tp", name: "Teleporte", cost: 45, baseCooldown: 12, tag: "mobilidade" },
    { key: "f", hotkey: "F", icon: "Dm", name: "Dominio", cost: 80, baseCooldown: 70, tag: "dominio" },
    { key: "dodge", hotkey: "Shift", icon: "Ev", name: "Dodge", cost: 0, baseCooldown: 1, tag: "evasao" },
  ],
  yuta: [
    { key: "q", hotkey: "Q", icon: "Rk", name: "Rika", cost: 40, baseCooldown: 12, tag: "area" },
    { key: "e", hotkey: "E", icon: "Fr", name: "Full Rika", cost: 55, baseCooldown: 35, tag: "invocacao" },
    { key: "r", hotkey: "R", icon: "Pl", name: "Pure Love", cost: 90, baseCooldown: 45, tag: "ultimate" },
    { key: "space", hotkey: "Space", icon: "Ds", name: "Dash Slash", cost: 40, baseCooldown: 4, tag: "mobilidade" },
    { key: "f", hotkey: "F", icon: "Dm", name: "Mutual Love", cost: 80, baseCooldown: 75, tag: "dominio" },
    { key: "dodge", hotkey: "Shift", icon: "Ev", name: "Dodge", cost: 0, baseCooldown: 1, tag: "evasao" },
  ],
  sukuna: [
    { key: "q", hotkey: "Q", icon: "Cl", name: "Cleave", cost: 35, baseCooldown: 10, tag: "controle" },
    { key: "e", hotkey: "E", icon: "Fc", name: "Furnace", cost: 45, baseCooldown: 14, tag: "burst" },
    { key: "r", hotkey: "R", icon: "Fo", name: "Full Output", cost: 80, baseCooldown: 22, tag: "beam" },
    { key: "space", hotkey: "Space", icon: "Fs", name: "Flash Step", cost: 40, baseCooldown: 10, tag: "mobilidade" },
    { key: "f", hotkey: "F", icon: "Dm", name: "Malevolent Shrine", cost: 80, baseCooldown: 75, tag: "dominio" },
    { key: "dodge", hotkey: "Shift", icon: "Ev", name: "Dodge", cost: 0, baseCooldown: 1, tag: "evasao" },
  ],
  yuji: [
    { key: "q", hotkey: "Q", icon: "Df", name: "Divergent Fist", cost: 30, baseCooldown: 8, tag: "controle" },
    { key: "e", hotkey: "E", icon: "Si", name: "Soul Impact", cost: 40, baseCooldown: 12, tag: "burst" },
    { key: "r", hotkey: "R", icon: "Td", name: "Taido Beatdown", cost: 50, baseCooldown: 15, tag: "burst" },
    { key: "space", hotkey: "Space", icon: "Fk", name: "Flying Knee", cost: 30, baseCooldown: 8, tag: "mobilidade" },
    { key: "f", hotkey: "F", icon: "Dm", name: "Self-Embodiment", cost: 75, baseCooldown: 65, tag: "dominio" },
    { key: "dodge", hotkey: "Shift", icon: "Ev", name: "Dodge", cost: 0, baseCooldown: 1, tag: "evasao" },
  ],
  megumi: [
    { key: "q", hotkey: "Q", icon: "Nu", name: "Nue", cost: 35, baseCooldown: 10, tag: "controle" },
    { key: "e", hotkey: "E", icon: "Or", name: "Orochi", cost: 50, baseCooldown: 30, tag: "invocacao" },
    { key: "r", hotkey: "R", icon: "Mh", name: "Mahoraga", cost: 85, baseCooldown: 42, tag: "ultimate" },
    { key: "space", hotkey: "Space", icon: "Ss", name: "Shadow Step", cost: 20, baseCooldown: 4, tag: "mobilidade" },
    { key: "f", hotkey: "F", icon: "Dm", name: "Chimera Shadow", cost: 75, baseCooldown: 70, tag: "dominio" },
    { key: "dodge", hotkey: "Shift", icon: "Ev", name: "Dodge", cost: 0, baseCooldown: 1, tag: "evasao" },
  ],
  hakari: [
    { key: "q", hotkey: "Q", icon: "Jr", name: "Jackpot Rush", cost: 30, baseCooldown: 7, tag: "controle" },
    { key: "e", hotkey: "E", icon: "Rg", name: "Restless Gambler", cost: 40, baseCooldown: 12, tag: "burst" },
    { key: "r", hotkey: "R", icon: "Lr", name: "Lucky Roll", cost: 80, baseCooldown: 22, tag: "beam" },
    { key: "space", hotkey: "Space", icon: "Ss", name: "Sudden Strike", cost: 25, baseCooldown: 7, tag: "mobilidade" },
    { key: "f", hotkey: "F", icon: "Dm", name: "Idle Death Gamble", cost: 80, baseCooldown: 65, tag: "dominio" },
    { key: "dodge", hotkey: "Shift", icon: "Ev", name: "Dodge", cost: 0, baseCooldown: 1, tag: "evasao" },
  ],
};

function getSkills(character) {
  return CHARACTER_SKILLS[character] || CHARACTER_SKILLS.gojo;
}

const RARITY_LABELS = {
  common: "comum",
  uncommon: "incomum",
  rare: "raro",
  epic: "epico",
  legendary: "lendario",
};

const BUFF_DEFS = {
  stunTimer: { label: "STN", name: "Atordoado", type: "debuff" },
  almaAbaladaTimer: { label: "ALM", name: "Alma Abalada", type: "debuff" },
  invulnTimer: { label: "INV", name: "Invulnerável", type: "buff" },
  rikaBuffTime: { label: "RIK", name: "Rika Ativa", type: "buff" },
  domainExhaustionTimer: { label: "DOM", name: "Exaustão de Domínio", type: "debuff" },
  energyRecoveryTime: { label: "REC", name: "Recuperação de Energia", type: "buff" },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pct(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return clamp((value / max) * 100, 0, 100);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTime(totalSec) {
  const safe = Math.max(0, Math.floor(totalSec || 0));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatBossName(type) {
  if (!type) return "Boss";
  return String(type)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function upgradeTag(id) {
  if (!id) return "build";
  if (id.includes("blue")) return "area";
  if (id.includes("red")) return "burst";
  if (id.includes("purple")) return "range";
  if (id.includes("teleport")) return "mobilidade";
  if (id.includes("domain")) return "dominio";
  if (id.includes("speed")) return "velocidade";
  if (id.includes("energy")) return "energia";
  if (id.includes("sustain")) return "sustain";
  if (id.includes("damage")) return "dano";
  return "build";
}

function upgradeIcon(id) {
  if (!id) return "*";
  if (id.includes("blue")) return "Az";
  if (id.includes("red")) return "Vm";
  if (id.includes("purple")) return "Pr";
  if (id.includes("teleport")) return "Tp";
  if (id.includes("domain")) return "Dm";
  if (id.includes("energy")) return "En";
  if (id.includes("speed")) return "Sp";
  return "+";
}

function createBarsHtml(stats, flags) {
  const hpPercent = pct(stats.hp, stats.maxHp);
  const energyPercent = pct(stats.energy, stats.maxEnergy);
  const xpPercent = pct(stats.xp, stats.xpToNext);
  const hpState = hpPercent <= 18 ? "critical" : hpPercent <= 35 ? "low" : hpPercent <= 65 ? "mid" : "high";
  const energyDry = energyPercent <= 18;

  const chara = stats.character || "gojo";
  const namesMap = {
    gojo: "Satoru Gojo",
    sukuna: "Ryomen Sukuna",
    yuji: "Yuji Itadori",
    yuta: "Yuta Okkotsu",
    megumi: "Megumi Fushiguro",
    hakari: "Kinji Hakari"
  };
  const charaLabel = namesMap[chara] || chara.toUpperCase();
  const portraitUrl = `/assets/${chara}-icon.png`;

  return `
    <div class="player-hud-core-panel ${flags.tookDamage ? "is-hit" : ""} hp-${hpState}">
      <!-- Portrait & Level Badge -->
      <div class="portrait-outer-ring char-border-${chara}">
        <div class="portrait-image-wrapper">
          <img class="char-portrait-img" src="${portraitUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
          <div class="portrait-fallback-badge">${chara.slice(0, 2).toUpperCase()}</div>
        </div>
        <div class="hud-level-badge">Lv.${stats.level}</div>
      </div>

      <!-- Bars Block -->
      <div class="bars-block-wrapper">
        <div class="bar-row-block health-block">
          <div class="bar-row-header">
            <span class="bar-row-label">${charaLabel}</span>
            <span class="bar-row-value">${Math.ceil(stats.hp)} <span class="bar-max-val">/ ${stats.maxHp}</span></span>
          </div>
          <div class="track hp-track">
            <div class="fill hp-lag-fill" style="width:${hpPercent}%"></div>
            <div class="fill hp" style="width:${hpPercent}%"></div>
            ${stats.shield ? `<div class="fill shield-fill" style="width:${pct(stats.shield, stats.maxHp)}%"></div>` : ""}
          </div>
        </div>

        <div class="bar-row-block energy-block ${energyDry ? "is-dry" : ""}">
          <div class="bar-row-header compact">
            <span class="bar-row-label">Energia Amaldiçoada</span>
            <span class="bar-row-value">${Math.ceil(stats.energy)} <span class="bar-max-val">/ ${stats.maxEnergy}</span></span>
          </div>
          <div class="track energy-track"><div class="fill energy" style="width:${energyPercent}%"></div></div>
        </div>
      </div>
    </div>

    <!-- XP strip underneath -->
    <div class="xp-strip-wrapper">
      <span class="xp-label-pct">${Math.floor(xpPercent)}% XP</span>
      <div class="track xp-track"><div class="fill xp" style="width:${xpPercent}%"></div></div>
    </div>
  `;
}

function buildSkillSlotsHtml(skills, energy) {
  return skills.map((skill) => {
    const costText = skill.cost > 0 ? `${skill.cost}` : "";
    return `
      <div class="skill-slot-wrapper">
        <div class="skill-slot slot-key-${skill.key}" data-key="${skill.key}" style="--cooldown:0deg">
          <div class="skill-cd-sweep"></div>
          <div class="skill-diamond-inner">
            <span class="skill-key-badge">${skill.hotkey}</span>
            <span class="skill-icon-face">${skill.icon}</span>
            ${costText ? `<span class="skill-cost-badge">${costText}</span>` : ""}
            <div class="skill-radial-countdown" style="display:none">0.0</div>
          </div>
        </div>
        <div class="skill-hover-tooltip">
          <strong>${skill.name}</strong>
          <span>Custo: ${skill.cost > 0 ? skill.cost + " Energia" : "Sem Custo"}</span>
        </div>
      </div>
    `;
  }).join("");
}

function updateDockCooldowns(container, cooldowns, energy, skills) {
  skills.forEach((skill) => {
    const slot = container.querySelector(`.skill-slot[data-key="${skill.key}"]`);
    if (!slot) return;

    const value = Math.max(0, cooldowns[skill.key] || 0);
    const ratio = skill.baseCooldown > 0 ? clamp(value / skill.baseCooldown, 0, 1) : 0;
    const ready = value <= 0.01;
    const dry = ready && skill.cost > 0 && energy < skill.cost;

    slot.style.setProperty('--cooldown', `${ratio * 360}deg`);
    slot.classList.remove('is-ready', 'is-cooling', 'is-dry');
    if (dry) slot.classList.add('is-dry');
    else if (ready) slot.classList.add('is-ready');
    else slot.classList.add('is-cooling');

    const countdown = slot.querySelector('.skill-radial-countdown');
    if (countdown) {
      if (!ready) {
        countdown.textContent = value.toFixed(1);
        countdown.style.display = '';
      } else {
        countdown.style.display = 'none';
      }
    }
  });
}

function findBoss(interpolation) {
  if (!interpolation || !interpolation.enemies) return null;
  let boss = null;
  interpolation.enemies.forEach((entry) => {
    const raw = entry.raw || {};
    if (!raw.alive) return;
    if (raw.type === "boss" || raw.type === "fallen_vessel" || raw.maxHp >= 3000) {
      boss = { entry, raw };
    }
  });
  return boss;
}

function miniPoint(map, x, y) {
  return {
    left: pct(x, map.width),
    top: pct(y, map.height),
  };
}

export class Hud {
  constructor() {
    this.hudLayer = document.getElementById("hud-layer");
    this.barsEl = document.getElementById("bars");
    this.quickAccessEl = document.getElementById("quick-access");
    this.mainSkillsEl = document.getElementById("main-skills");
    this.topRightEl = document.getElementById("top-right");
    this.timerEl = document.getElementById("match-timer");
    this.minimapEl = document.getElementById("minimap");
    this.alertsEl = document.getElementById("center-alerts");
    this.bossBarEl = document.getElementById("boss-bar");
    this.buffsEl = document.getElementById("buffs-debuffs");
    this.overlayEl = document.getElementById("upgrade-overlay");
    this.gameoverEl = document.getElementById("gameover-overlay");
    this.spectateEl = document.getElementById("spectate-overlay");
    this.spectateText = document.getElementById("spectate-text");
    this.onPickUpgrade = null;
    this.prevHp = null;
    this.prevEnergy = null;
    this.lastCriticalNoticeAt = 0;
    this.lastEnergyNoticeAt = 0;
    this.upgradePicking = false;
    this.currentChoiceKey = "";
    this.suppressChoiceKey = "";
    this._barsHtml = "";
    this._cooldownsHtml = "";
    this._timerHtml = "";
    this._topRightHtml = "";
    this._bossBarHtml = "";
    this._buffsHtml = "";
    this._minimapHtml = "";
    this._prevChar = "";
    this._prevSkillLock = false;
    this._prevBoss = false;
  }

  _updateInner(el, html) {
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  update({ you, phase, elapsedSec, ping, connected, interpolation, map }) {
    if (!you) {
      return;
    }

    const tookDamage = this.prevHp !== null && you.hp < this.prevHp - 0.5;
    const energyDrop = this.prevEnergy !== null && you.energy < this.prevEnergy - 4;
    const hpPercent = pct(you.hp, you.maxHp);
    const energyPercent = pct(you.energy, you.maxEnergy);
    const now = performance.now();

    const chara = you.character || "gojo";

    const barsHtml = createBarsHtml(you, { tookDamage });
    if (barsHtml !== this._barsHtml) {
      this._barsHtml = barsHtml;
      this.barsEl.innerHTML = barsHtml;
    }

    const skills = getSkills(chara);
    
    // Separate skills into quick-access (m1, dodge) and main-skills (q, e, r, space, f)
    const quickAccessSkills = skills.filter(s => s.key === 'dodge');
    const mainSkillsAll = skills.filter(s => s.key !== 'dodge');
    
    // Reorder main skills: q, e, space, r, f (mobility between combat and ult)
    const skillOrder = ['q', 'e', 'space', 'r', 'f'];
    const mainSkills = skillOrder
      .map(key => mainSkillsAll.find(s => s.key === key))
      .filter(Boolean);

    // Only re-render DOM on character change (preserves hover state)
    if (chara !== this._prevChar) {
      const m1Html = `
        <div class="skill-slot-wrapper">
          <div class="skill-slot slot-key-m1" data-key="m1" style="--cooldown:0deg">
            <div class="skill-diamond-inner">
              <span class="skill-key-badge">M1</span>
              <span class="skill-icon-face">Atq</span>
            </div>
          </div>
          <div class="skill-hover-tooltip">
            <strong>Ataque Básico</strong>
            <span>Sem Custo</span>
          </div>
        </div>
      `;
      if (this.quickAccessEl) {
        this.quickAccessEl.innerHTML = m1Html + buildSkillSlotsHtml(quickAccessSkills, you.energy || 0);
      }
      if (this.mainSkillsEl) {
        this.mainSkillsEl.innerHTML = buildSkillSlotsHtml(mainSkills, you.energy || 0);
      }
    }

    // Update cooldowns every frame via DOM (no HTML re-render)
    updateDockCooldowns(this.quickAccessEl, you.cooldowns || {}, you.energy || 0, quickAccessSkills);
    updateDockCooldowns(this.mainSkillsEl, you.cooldowns || {}, you.energy || 0, mainSkills);

    // M1 active state (energy drop flash)
    const m1Slot = this.quickAccessEl ? this.quickAccessEl.querySelector('.slot-key-m1') : null;
    if (m1Slot) {
      m1Slot.classList.toggle('is-active', energyDrop);
    }

    const timerHtml = `
      <span class="timer-time">${formatTime(elapsedSec)}</span>
      <span class="timer-phase">${escapeHtml(phase)}</span>
    `;
    if (timerHtml !== this._timerHtml) {
      this._timerHtml = timerHtml;
      this.timerEl.innerHTML = timerHtml;
    }

    const topRightHtml = `
      <div class="status-line"><span>Kills</span><b>${you.kills}</b></div>
      <div class="status-line"><span>Deaths</span><b>${you.deaths}</b></div>
      <div class="status-line"><span>Ping</span><b>${ping}ms</b></div>
      <div class="status-line ${connected ? "online" : "offline"}"><span>Net</span><b>${connected ? "Online" : "Reconectando"}</b></div>
      <div class="status-state">${you.alive ? "Ativo" : "Derrubado"}${you.skillLock ? " | Dominio" : ""}</div>
    `;
    if (topRightHtml !== this._topRightHtml) {
      this._topRightHtml = topRightHtml;
      this.topRightEl.innerHTML = topRightHtml;
    }

    const boss = this.updateBossBar(interpolation);
    this.updateMinimap({ map, interpolation, you });
    this.hudLayer.classList.toggle("hud-danger", hpPercent <= 35);
    this.hudLayer.classList.toggle("hud-critical", hpPercent <= 18);
    this.hudLayer.classList.toggle("hud-domain", Boolean(you.skillLock));
    this.hudLayer.classList.toggle("hud-boss", Boolean(boss));

    this.updateBuffs(you.status || {});

    if (you.alive && hpPercent <= 18 && now - this.lastCriticalNoticeAt > 5500) {
      this.pushNotice("Vida critica", "danger", "recuar ou finalizar rapido");
      this.lastCriticalNoticeAt = now;
    }

    if (you.alive && energyPercent <= 12 && now - this.lastEnergyNoticeAt > 7000) {
      this.pushNotice("Energia baixa", "energy", "skills podem falhar");
      this.lastEnergyNoticeAt = now;
    }

    this.prevHp = you.hp;
    this.prevEnergy = you.energy;
    this._prevChar = chara;

    if (you.skillLock && !this._prevSkillLock) {
      this.pushNotice("Expansão de Dominio", "domain", "barreira liberada");
    } else if (!you.skillLock && this._prevSkillLock) {
      this.pushNotice("Dominio dissipado", "info", "");
    }
    this._prevSkillLock = Boolean(you.skillLock);

    if (boss && !this._prevBoss) {
      this.pushNotice("Boss surgiu", "danger", "prepare-se");
    }
    this._prevBoss = Boolean(boss);
  }

  updateBossBar(interpolation) {
    const boss = findBoss(interpolation);
    if (!boss) {
      if (!this.bossBarEl.classList.contains("hidden")) {
        this.bossBarEl.classList.add("hidden");
        this.bossBarEl.innerHTML = "";
        this._bossBarHtml = "";
      }
      return null;
    }

    const hpPercent = pct(boss.raw.hp, boss.raw.maxHp);
    const bossBarHtml = `
      <div class="boss-meta">
        <span>Boss</span>
        <strong>${escapeHtml(formatBossName(boss.raw.type))}</strong>
        <span>${Math.ceil(hpPercent)}%</span>
      </div>
      <div class="boss-track"><div class="boss-fill" style="width:${hpPercent}%"></div></div>
    `;
    if (bossBarHtml !== this._bossBarHtml) {
      this._bossBarHtml = bossBarHtml;
      this.bossBarEl.innerHTML = bossBarHtml;
    }
    this.bossBarEl.classList.remove("hidden");
    return boss;
  }

  updateMinimap({ map, interpolation, you }) {
    if (!this.minimapEl || !map || !map.width || !map.height || !interpolation) {
      return;
    }

    const parts = [`<div class="minimap-title">Mapa</div>`];

    if (Array.isArray(map.obstacles)) {
      map.obstacles.forEach((obs) => {
        const left = pct(obs.x, map.width);
        const top = pct(obs.y, map.height);
        const w = pct(obs.w, map.width);
        const h = pct(obs.h, map.height);
        parts.push(`<span class="mini-obstacle" style="left:${left}%;top:${top}%;width:${w}%;height:${h}%"></span>`);
      });
    }

    if (Array.isArray(map.disputeZones)) {
      map.disputeZones.forEach((zone) => {
        const point = miniPoint(map, zone.x, zone.y);
        const size = clamp((zone.radius / Math.max(map.width, map.height)) * 100, 4, 12);
        parts.push(`<span class="mini-zone" style="left:${point.left}%;top:${point.top}%;width:${size}%;height:${size}%"></span>`);
      });
    }

    if (Array.isArray(map.hazards)) {
      map.hazards.forEach((hazard) => {
        const point = miniPoint(map, hazard.x, hazard.y);
        const size = clamp((hazard.radius / Math.max(map.width, map.height)) * 100, 3, 8);
        parts.push(`<span class="mini-hazard" style="left:${point.left}%;top:${point.top}%;width:${size}%;height:${size}%"></span>`);
      });
    }

    const enemies = [];
    if (interpolation.enemies) {
      interpolation.enemies.forEach((entry) => {
        const raw = entry.raw || {};
        if (!raw.alive) return;
        enemies.push({ entry, raw });
      });
    }

    enemies
      .filter((item) => item.raw.type === "boss" || item.raw.type === "fallen_vessel" || item.raw.maxHp >= 3000)
      .forEach((item) => {
        const point = miniPoint(map, item.entry.x, item.entry.y);
        parts.push(`<span class="mini-dot boss" style="left:${point.left}%;top:${point.top}%"></span>`);
      });

    enemies
      .filter((item) => item.raw.type !== "boss" && item.raw.type !== "fallen_vessel" && item.raw.maxHp < 3000)
      .sort((a, b) => (b.raw.maxHp || 0) - (a.raw.maxHp || 0))
      .slice(0, 16)
      .forEach((item) => {
        const point = miniPoint(map, item.entry.x, item.entry.y);
        const elite = item.raw.maxHp >= 300;
        parts.push(`<span class="mini-dot enemy ${elite ? "elite" : ""}" style="left:${point.left}%;top:${point.top}%"></span>`);
      });

    if (interpolation.players) {
      interpolation.players.forEach((entry) => {
        const raw = entry.raw || {};
        if (!raw.alive) return;
        const point = miniPoint(map, entry.x, entry.y);
        const self = raw.id === you.id;
        parts.push(`<span class="mini-dot ${self ? "self" : "ally"}" style="left:${point.left}%;top:${point.top}%"></span>`);
      });
    }

    const minimapHtml = parts.join("");
    if (minimapHtml !== this._minimapHtml) {
      this._minimapHtml = minimapHtml;
      this.minimapEl.innerHTML = minimapHtml;
    }
  }

  pushNotice(title, tone = "info", detail = "") {
    if (!this.alertsEl) return;
    const item = document.createElement("div");
    item.className = `notice notice-${tone}`;
    item.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
    `;
    this.alertsEl.appendChild(item);
    window.setTimeout(() => {
      item.classList.add("leaving");
      window.setTimeout(() => item.remove(), 220);
    }, 2200);
  }

  showUpgradeChoices(choices, onPick) {
    if (!choices || choices.length === 0) {
      this.hideUpgradeChoices();
      return;
    }
    this.onPickUpgrade = onPick;
    const choiceKey = choices.map((choice) => choice.id).join("|");
    if (this.suppressChoiceKey === choiceKey) {
      return;
    }

    if (this.currentChoiceKey === choiceKey && !this.overlayEl.classList.contains("hidden")) {
      return;
    }

    this.currentChoiceKey = choiceKey;
    this.upgradePicking = false;
    const options = choices.slice(0, 3)
      .map((choice, index) => {
        const rarity = choice.rarity || "common";
        const tag = upgradeTag(choice.id);
        return `
          <button data-upgrade-id="${escapeHtml(choice.id)}" class="upgrade-option u-rarity-${escapeHtml(rarity)}" type="button">
            <span class="u-number">${index + 1}</span>
            <span class="u-icon">${upgradeIcon(choice.id)}</span>
            <span class="u-rarity">${RARITY_LABELS[rarity] || rarity}</span>
            <span class="u-name">${escapeHtml(choice.name)}</span>
            <span class="u-desc">${escapeHtml(choice.description)}</span>
            <span class="u-tag">${tag}</span>
          </button>
        `;
      })
      .join("");

    this.overlayEl.innerHTML = `
      <div class="upgrade-head">
        <span>Level Up</span>
        <h3>Escolha uma melhoria</h3>
        <p>1, 2 ou 3 para selecionar rapido</p>
      </div>
      <div class="upgrade-row">${options}</div>
    `;
    this.overlayEl.classList.remove("hidden");

    const buttons = this.overlayEl.querySelectorAll("button[data-upgrade-id]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.upgradePicking) return;
        this.upgradePicking = true;
        this.suppressChoiceKey = choiceKey;
        btn.classList.add("selected");
        this.overlayEl.classList.add("picking");
        buttons.forEach((other) => {
          if (other !== btn) other.classList.add("fading");
        });
        window.setTimeout(() => {
          if (this.onPickUpgrade) {
            this.onPickUpgrade(btn.dataset.upgradeId);
          }
        }, 120);
      });
    });
  }

  pickUpgradeByIndex(index) {
    const buttons = this.overlayEl.querySelectorAll("button[data-upgrade-id]");
    if (!buttons || !buttons[index]) {
      return;
    }
    buttons[index].click();
  }

  hideUpgradeChoices(options = {}) {
    this.overlayEl.classList.add("hidden");
    this.overlayEl.classList.remove("picking");
    this.overlayEl.innerHTML = "";
    this.onPickUpgrade = null;
    this.upgradePicking = false;
    this.currentChoiceKey = "";
    if (!options.preserveSuppression) {
      this.suppressChoiceKey = "";
    }
  }

  showGameOver() {
    this.gameoverEl.classList.remove("hidden");
  }

  hideGameOver() {
    this.gameoverEl.classList.add("hidden");
  }

  showSpectate(text) {
    if (this.spectateText) this.spectateText.textContent = text;
    if (this.spectateEl) this.spectateEl.classList.remove("hidden");
  }

  hideSpectate() {
    if (this.spectateEl) this.spectateEl.classList.add("hidden");
  }

  updateBuffs(status) {
    const active = Object.entries(status)
      .filter(([, val]) => val > 0)
      .map(([key, val]) => {
        const def = BUFF_DEFS[key];
        if (!def) return null;
        const pct = key === "rikaBuffTime" ? Math.min(val / 3 * 100, 100) :
          key === "almaAbaladaTimer" ? Math.min(val / 3 * 100, 100) :
          key === "stunTimer" ? Math.min(val / 0.5 * 100, 100) :
          key === "domainExhaustionTimer" ? Math.min(val / 60 * 100, 100) :
          key === "energyRecoveryTime" ? 100 : 50;
        return `
          <div class="buff-item" data-key="${key}">
            <div class="buff-icon is-${def.type}">
              ${def.label}
              <div class="buff-timer-fill" style="width:${pct}%"></div>
            </div>
            <span class="buff-timer-text">${val.toFixed(1)}s</span>
          </div>
        `;
      })
      .filter(Boolean)
      .join("");
    if (active !== this._buffsHtml) {
      this._buffsHtml = active;
      if (this.buffsEl) this.buffsEl.innerHTML = active;
    }
  }
}
