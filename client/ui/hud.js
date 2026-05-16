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
    { key: "e", hotkey: "E", icon: "Ds", name: "Dash Slash", cost: 20, baseCooldown: 4, tag: "mobilidade" },
    { key: "r", hotkey: "R", icon: "Fr", name: "Full Rika", cost: 55, baseCooldown: 35, tag: "invocacao" },
    { key: "space", hotkey: "Space", icon: "Dm", name: "Mutual Love", cost: 80, baseCooldown: 75, tag: "dominio" },
    { key: "f", hotkey: "F", icon: "Pl", name: "Pure Love", cost: 90, baseCooldown: 45, tag: "ultimate" },
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

  return `
    <div class="hud-panel bars-panel ${flags.tookDamage ? "is-hit" : ""} hp-${hpState}">
      <div class="bar-block health-block">
        <div class="bar-head">
          <span class="bar-label">Vida</span>
          <span class="bar-value">${Math.ceil(stats.hp)}</span>
        </div>
        <div class="track hp-track"><div class="fill hp" style="width:${hpPercent}%"></div></div>
      </div>

      <div class="bar-block energy-block ${energyDry ? "is-dry" : ""}">
        <div class="bar-head compact">
          <span class="bar-label">Energia Amaldicoada</span>
          <span class="bar-value">${Math.ceil(stats.energy)}</span>
        </div>
        <div class="track energy-track"><div class="fill energy" style="width:${energyPercent}%"></div></div>
      </div>

      <div class="xp-strip">
        <span>Lv ${stats.level}</span>
        <div class="track xp-track"><div class="fill xp" style="width:${xpPercent}%"></div></div>
        <span>${Math.floor(xpPercent)}%</span>
      </div>
    </div>
  `;
}

function createSkillHtml(cooldowns, energy, skills) {
  return skills.map((skill) => {
    const value = Math.max(0, cooldowns[skill.key] || 0);
    const ratio = skill.baseCooldown > 0 ? clamp(value / skill.baseCooldown, 0, 1) : 0;
    const ready = value <= 0.01;
    const dry = ready && skill.cost > 0 && energy < skill.cost;
    const state = dry ? "is-dry" : ready ? "is-ready" : "is-cooling";
    const status = dry ? "energia" : ready ? "pronto" : value.toFixed(1);
    const costText = skill.cost > 0 ? `${skill.cost} EN` : "sem custo";

    return `
      <div class="skill-slot ${state}" style="--cooldown:${ratio * 360}deg">
        <div class="skill-ring">
          <span class="skill-icon">${skill.icon}</span>
        </div>
        <div class="skill-meta">
          <span class="skill-key">${skill.hotkey}</span>
          <span class="skill-name">${skill.name}</span>
        </div>
        <div class="skill-status">${status}</div>
        <div class="skill-cost">${costText}</div>
      </div>
    `;
  }).join("");
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
    this.cooldownsEl = document.getElementById("cooldowns");
    this.m1El = document.getElementById("m1-indicator");
    this.topRightEl = document.getElementById("top-right");
    this.timerEl = document.getElementById("match-timer");
    this.minimapEl = document.getElementById("minimap");
    this.alertsEl = document.getElementById("center-alerts");
    this.bossBarEl = document.getElementById("boss-bar");
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
    const skills = getSkills(chara);
    this.barsEl.innerHTML = createBarsHtml(you, { tookDamage });
    this.cooldownsEl.innerHTML = createSkillHtml(you.cooldowns || {}, you.energy || 0, skills);
    this.m1El.innerHTML = `
      <div class="m1-chip ${energyDrop ? "is-active" : ""}">
        <span>M1</span>
        <small>Ataque basico</small>
      </div>
    `;

    this.timerEl.innerHTML = `
      <span class="timer-time">${formatTime(elapsedSec)}</span>
      <span class="timer-phase">${escapeHtml(phase)}</span>
    `;

    this.topRightEl.innerHTML = `
      <div class="status-line"><span>Kills</span><b>${you.kills}</b></div>
      <div class="status-line"><span>Deaths</span><b>${you.deaths}</b></div>
      <div class="status-line"><span>Ping</span><b>${ping}ms</b></div>
      <div class="status-line ${connected ? "online" : "offline"}"><span>Net</span><b>${connected ? "Online" : "Reconectando"}</b></div>
      <div class="status-state">${you.alive ? "Ativo" : "Derrubado"}${you.skillLock ? " | Dominio" : ""}</div>
    `;

    const boss = this.updateBossBar(interpolation);
    this.updateMinimap({ map, interpolation, you });
    this.hudLayer.classList.toggle("hud-danger", hpPercent <= 35);
    this.hudLayer.classList.toggle("hud-critical", hpPercent <= 18);
    this.hudLayer.classList.toggle("hud-domain", Boolean(you.skillLock));
    this.hudLayer.classList.toggle("hud-boss", Boolean(boss));

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
  }

  updateBossBar(interpolation) {
    const boss = findBoss(interpolation);
    if (!boss) {
      this.bossBarEl.classList.add("hidden");
      this.bossBarEl.innerHTML = "";
      return null;
    }

    const hpPercent = pct(boss.raw.hp, boss.raw.maxHp);
    this.bossBarEl.innerHTML = `
      <div class="boss-meta">
        <span>Boss</span>
        <strong>${escapeHtml(formatBossName(boss.raw.type))}</strong>
        <span>${Math.ceil(hpPercent)}%</span>
      </div>
      <div class="boss-track"><div class="boss-fill" style="width:${hpPercent}%"></div></div>
    `;
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

    this.minimapEl.innerHTML = parts.join("");
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
}
