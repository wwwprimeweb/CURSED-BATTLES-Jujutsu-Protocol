import { InputManager } from "./core/input.js";
import { NetworkClient } from "./core/netClient.js";
import { InterpolationBuffer } from "./core/interpolation.js";
import { Renderer } from "./core/renderer.js";
import { ParticleSystem } from "./particles/particleSystem.js";
import { AudioSystem } from "./audio/audioSystem.js";
import { AUDIO_PATHS } from "./audio/audioConfig.js";
import { Hud } from "./ui/hud.js";
import { AnimationStateMachine } from "./animations/stateMachine.js";
import { initCyclingBackground } from "./animations/gifBackground.js";
import { playHoverSound, playClickSound, playSelectSound, playOpenSound, playCloseSound, playTabSwitchSound, playSliderTickSound } from "./audio/uiSounds.js";

const SESSION_KEY = "cursed_battles_session";
const NICK_KEY = "cursed_battles_nick";

let _lastTremorSound = 0;
const _prevWindup = new Map();

function playSoundIfNear(ev, sound) {
  const px = state.localPred?.x;
  const py = state.localPred?.y;
  if (px == null) return;
  const dx = px - ev.x;
  const dy = py - ev.y;
  const distSq = dx * dx + dy * dy;
  const zoom = renderer.camera.zoom;
  const halfW = (renderer.canvas.clientWidth * 0.5) / zoom;
  const halfH = (renderer.canvas.clientHeight * 0.5) / zoom;
  const screenRadiusSq = halfW * halfW + halfH * halfH;
  if (distSq <= screenRadiusSq) {
    audio.play(sound);
  }
}

function updateEnemyAttackSounds(enemies) {
  enemies.forEach((entry) => {
    const e = entry.raw;
    if (!e || e.windupTimer == null) return;
    const prev = _prevWindup.get(e.id) || 0;
    if (prev <= 0 && e.windupTimer > 0) {
      const map = { fleshmaw: "fleshmawAttack", crawler_nest: "crawlerNestAttack", crawler_baby: "crawlerBabyAttack" };
      const sound = map[e.type];
      if (sound) playSoundIfNear({ x: entry.x, y: entry.y }, sound);
    }
    _prevWindup.set(e.id, e.windupTimer);
  });
}

const canvas = document.getElementById("game-canvas");
const startScreen = document.getElementById("start-screen");
const playBtn = document.getElementById("play-btn");
const nickInput = document.getElementById("nick-input");
const characterCards = document.querySelectorAll(".character-card[data-character]");

const menuBg = document.getElementById("menu-bg");
if (menuBg) {
  initCyclingBackground(menuBg, [
    "/assets/backgrounds/telainicio.gif",
    "/assets/backgrounds/telainicio2.gif",
    "/assets/backgrounds/telainicio3.gif",
    "/assets/backgrounds/telainicio4.gif",
  ]);
}

function loadIcons() {
  document.querySelectorAll(".char-icon[data-src]").forEach((el) => {
    const src = el.getAttribute("data-src");
    if (!src) return;

    // Check if it's a PNG icon we need to load differently
    if (src.endsWith(".png")) {
      const imgElement = document.createElement("img");
      imgElement.className = "char-icon-img";
      imgElement.src = src;
      const card = el.closest('.character-card');
      if (card) {
        const charName = card.dataset.character;
        imgElement.alt = `${charName} icon`;
      }
      el.parentNode.replaceChild(imgElement, el);
    } else { // Assume SVG and keep existing logic
      fetch(src)
        .then((r) => r.text())
        .then((svg) => { el.innerHTML = svg; })
        .catch(() => {});
    }
  });
}
loadIcons();

const particles = new ParticleSystem();
const renderer = new Renderer(canvas, particles);
const input = new InputManager(canvas);
const hud = new Hud();
const audio = new AudioSystem();
audio.loadSound(AUDIO_PATHS.domainStart, "domainStart");
audio.loadSound(AUDIO_PATHS.yutaVoice, "yutaVoice");
audio.preloadMusic(AUDIO_PATHS.menuMusic);
audio.unlock();
async function resumeOnInteraction(event) {
  await audio.resume();
  if (!audio._gameActive) {
    audio.playMusic();
  }
  document.removeEventListener("click", resumeOnInteraction);
  document.removeEventListener("keydown", resumeOnInteraction);
}
document.addEventListener("click", resumeOnInteraction);
document.addEventListener("keydown", resumeOnInteraction);
const interpolation = new InterpolationBuffer();
const animation = new AnimationStateMachine();

const state = {
  joined: false,
  connected: false,
  reconnecting: false,
  ping: 0,
  phase: "EARLY",
  elapsedSec: 0,
  playerId: null,
  you: null,
  sessionToken: localStorage.getItem(SESSION_KEY) || "",
  seq: 0,
  pendingInputs: [],
  lastInputSendAt: 0,
  lastPingAt: 0,
  localPred: {
    x: 0,
    y: 0,
  },
  spectating: false,
  spectateTargetId: null,
  spectateIndex: 0,
  selectedChar: "o-honrado",
};

const net = new NetworkClient({
  onJoined: handleJoined,
  onSnapshot: handleSnapshot,
  onPong: handlePong,
  onConnectionState: handleConnectionState,
});

function handleJoined(msg) {
  console.log(`[DIAG] handleJoined: playerId=${msg.playerId}, joined set to true`);
  state.joined = true;
  state.playerId = msg.playerId;
  state.sessionToken = msg.sessionToken || state.sessionToken;
  if (state.sessionToken) {
    localStorage.setItem(SESSION_KEY, state.sessionToken);
  }
  renderer.setMap(msg.map);
  input.setEnabled(true);
  console.log(`[DIAG] Camera now at (${renderer.camera.x}, ${renderer.camera.y})`);
  startScreen.classList.remove("visible");
  startScreen.style.display = "none";
  if (menuBg) {
    menuBg.style.opacity = "0";
    menuBg.style.display = "none";
  }
}

function handleConnectionState(info) {
  state.connected = info.connected;
  state.reconnecting = info.reconnecting;
}

function handlePong(msg) {
  const now = Date.now();
  if (msg && msg.clientTime) {
    state.ping = Math.max(0, now - msg.clientTime);
  }
}

const CHAR_MOVE_SPEED = {
  "o-honrado": 172, "portador-do-vinculo": 178, "rei-amaldicoado": 168, "punho-indomavel": 180, "invocador-de-sombras": 175, "lutador-de-sorte": 170,
};

function applyInputPrediction(pred, payload, dt) {
  const keys = payload.keys;
  const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const moveY = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const len = Math.sqrt(moveX * moveX + moveY * moveY);
  if (len < 0.001) return;
  const nx = moveX / len;
  const ny = moveY / len;
  const speed = CHAR_MOVE_SPEED[state.selectedChar] || 172;
  pred.x += nx * speed * dt;
  pred.y += ny * speed * dt;
  if (renderer && renderer.map) {
    const m = renderer.map;
    const r = 38;
    pred.x = Math.max(r, Math.min(m.width - r, pred.x));
    pred.y = Math.max(r, Math.min(m.height - r, pred.y));
  }
}

function handleSnapshot(snapshot) {
  state.phase = snapshot.phase;
  state.elapsedSec = snapshot.elapsedSec;
  state.you = snapshot.you;

  if (typeof snapshot.tick !== 'undefined' && snapshot.tick < 3) {
    console.log(`[DIAG] handleSnapshot #${snapshot.tick}: you=${JSON.stringify(snapshot.you)}, players_in_delta=${snapshot.delta.players.length}`);
    console.log(`[DIAG]   interpolation.players.size BEFORE ingest: ${interpolation.players.size}`);
  }

  interpolation.ingest(snapshot);

  const validIds = new Set();
  interpolation.players.forEach((entry) => validIds.add(entry.id));
  animation.clearRemoved(validIds);
  interpolation.players.forEach((entry) => {
    animation.set(entry.id, entry.raw.animState || "idle");
  });

  if (state.you) {
    state.localPred.x = state.you.x;
    state.localPred.y = state.you.y;

    if (typeof snapshot.tick !== 'undefined' && snapshot.tick < 3) {
      const me = interpolation.players.get(state.playerId);
      console.log(`[DIAG] After ingest: interpolation.players.size=${interpolation.players.size}, me=${me ? `found at (${me.x},${me.y}) alive=${me.raw.alive}` : 'NOT FOUND'}`);
      console.log(`[DIAG] localPred now at (${state.localPred.x}, ${state.localPred.y})`);
    }

    const ack = state.you.ackSeq || 0;
    state.pendingInputs = state.pendingInputs.filter((item) => item.seq > ack);
    for (let i = 0; i < state.pendingInputs.length; i += 1) {
      applyInputPrediction(state.localPred, state.pendingInputs[i].payload, 1 / 30);
    }
    if (!state.you.alive && state.joined && !state.spectating) {
      console.log(`[DIAG] Player is dead! alive=${state.you.alive}, hp=${state.you.hp}, entering spectate`);
      enterSpectateMode();
    }
  }

  if (state.spectating) {
    updateSpectateTarget();
  }

  if (snapshot.events && snapshot.events.length) {
    handleEvents(snapshot.events);
  }

  if (state.you && state.you.pendingChoices && state.you.pendingChoices.length) {
    hud.showUpgradeChoices(state.you.pendingChoices, (upgradeId) => {
      net.chooseUpgrade(upgradeId);
      hud.hideUpgradeChoices({ preserveSuppression: true });
    });
  } else {
    hud.hideUpgradeChoices();
  }
}

function handleEvents(events) {
  for (let i = 0; i < events.length; i += 1) {
    const ev = events[i];
    if (ev.type === "hit") {
      console.log("HIT EVENT:", JSON.stringify(ev));
      if (ev.amount > 0) {
        let category = "other";
        if (ev.targetId === state.playerId) {
          category = "self";
        } else if (ev.sourceId === state.playerId) {
          category = "dealt";
        }
        renderer.spawnDamageNumber(ev.targetId, ev.amount, category, ev.x, ev.y);
      }
      const isYujiM1Hit = ev.kind === "m1" && ev.sourceCharacter === "punho-indomavel" && !ev.sourceBlackFlash;
      if (ev.kind !== "divergentFist" && ev.kind !== "divergentFistDelayed" && !isYujiM1Hit) {
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffd7e2", count: 6, speed: 140, life: 0.15, size: 2 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#88ccff", count: 4, speed: 80, life: 0.12, size: 3 });
      }
      if (ev.kind === "m1") {
        if (isYujiM1Hit) {
          const heavy = ev.sourceCombo === 3 || ev.sourceCombo === 4;
          particles.spawnBurst({ x: ev.x, y: ev.y, color: "#40e0d0", count: heavy ? 8 : 6, speed: heavy ? 180 : 140, life: heavy ? 0.18 : 0.14, size: heavy ? 2.5 : 2, borderColor: "#000000", borderWidth: 3 });
          if (heavy) renderer.triggerScreenShake(3, 0.12);
        } else {
          particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 10, speed: 260, life: 0.25, size: 3 });
          particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 14, speed: 200, life: 0.28, size: 2.5 });
          renderer.yutaVisual && renderer.yutaVisual.triggerHit(ev.x, ev.y, 1.2);
        }
      }
      if (isYujiM1Hit) {
        audio.play(ev.sourceCombo === 3 ? "yujiM1HeavyImpact" : "yujiM1Impact");
      } else if (!(ev.kind === "m1" && ev.sourceCharacter === "punho-indomavel")) {
        audio.play("hit");
      }
    } else if (ev.type === "m1") {
      const dirX = ev.dirX || (renderer.playerFacing.get(ev.playerId) || 1);
      const dirY = ev.dirY || 0;
      const combo = ev.combo || 1;
      const attackerCharacter = ev.character || "o-honrado";
      if (attackerCharacter === "portador-do-vinculo") {
        const slashRange = Number.isFinite(ev.slashRange) ? ev.slashRange : 160;
        const coneAngle = Number.isFinite(ev.coneAngle) ? ev.coneAngle : 1.4;

        renderer.yutaVisual.triggerKatanaSlash(ev.x, ev.y, dirX, dirY, combo, slashRange, coneAngle);
        audio.play("yutaM1");
      } else if (attackerCharacter === "punho-indomavel") {
        if (!ev.blackFlash) {
          renderer.yujiVisual.triggerM1Fx(ev.x, ev.y, dirX, dirY, combo);
          audio.play("yujiM1Start");
        }
      } else if (attackerCharacter === "o-honrado") {
        renderer.gojoVisual.triggerM1(ev.x, ev.y, dirX, dirY, combo, ev.playerId);
      } else {
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#88ccff", count: 5, speed: 100, life: 0.12, size: 1.5 });
        particles.spawnLine({ x: ev.x, y: ev.y, dirX, dirY, color: "#66c6ff", count: 4, life: 0.15 });
        if (combo === 3) {
          particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 8, speed: 150, life: 0.1, size: 1.8 });
        }
        renderer.gojoVisual.triggerM1(ev.x, ev.y, dirX, dirY, combo, ev.playerId);
      }
      if (ev.blackFlash) {
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 25, speed: 350, life: 0.4, size: 4 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffff00", count: 30, speed: 280, life: 0.4, size: 3.5 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff2200", count: 15, speed: 220, life: 0.35, size: 3 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#000000", count: 20, speed: 200, life: 0.35, size: 3, borderColor: "#ff0000", borderWidth: 2 });
        particles.spawnLine({ x: ev.x, y: ev.y, dirX, dirY, color: "#ffdd00", count: 12, life: 0.35, size: 3.5 });
        renderer.triggerBlackFlash(ev.x, ev.y, dirX, dirY);
        renderer.triggerScreenShake(6, 0.2);
        audio.play("skillRed");
      }
    } else if (ev.type === "kill" || ev.type === "enemyDeath") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff78a0", count: 16, speed: 220, life: 0.33, size: 2.8 });
      audio.play("kill");
    } else if (ev.type === "skillBlue") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#66c6ff", count: 12, speed: 180, life: 0.24, size: 2.4 });
      audio.play("skillBlue");
    } else if (ev.type === "skillRed") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff6f8f", count: 12, speed: 210, life: 0.22, size: 2.7 });
      audio.play("skillRed");
    } else if (ev.type === "skillPurple") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#bb8dff", count: 30, speed: 320, life: 0.4, size: 3.5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 15, speed: 200, life: 0.3, size: 2.5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#e0c0ff", count: 20, speed: 250, life: 0.35, size: 2 });
      renderer.addMarker({ x: ev.x, y: ev.y, radius: ev.radius || 120, color: "rgba(200,130,255,0.6)", ttl: 0.5 });
      audio.play("skillPurple");
    } else if (ev.type === "spatialCollapse") {
      renderer.triggerPurpleExplosion(ev);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#bb8dff", count: 40, speed: 400, life: 0.6, size: 4 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 20, speed: 200, life: 0.4, size: 2 });
      audio.play("skillPurple");
    } else if (ev.type === "purpleCharge") {
      renderer.addMarker({ x: ev.x, y: ev.y, radius: 78, color: "rgba(195,142,255,0.45)", ttl: ev.delay || 0.55 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#dbc1ff", count: 10, speed: 110, life: 0.2, size: 1.9 });
    } else if (ev.type === "blueRedReaction") {
      renderer.startPurpleCharge(ev);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#c080ff", count: 25, speed: 250, life: 0.5, size: 3.5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 12, speed: 180, life: 0.3, size: 2 });
    } else if (ev.type === "dodge") {
      const entry = interpolation.players.get(ev.playerId);
      const sx = entry ? entry.x : ev.x;
      const sy = entry ? entry.y : ev.y;
      renderer.triggerDash(ev.playerId, ev, sx, sy);
      const dirX = ev.dirX !== undefined ? ev.dirX : 1;
      const dirY = ev.dirY !== undefined ? ev.dirY : 0;
      const oppX = ev.x - dirX * 60;
      const oppY = ev.y - dirY * 60;
      particles.spawnLine({ x: oppX, y: oppY, dirX: -dirX, dirY: -dirY, color: "#b6e2ff", count: 12, life: 0.4 });
    } else if (ev.type === "teleportStart") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 6, speed: 100, life: 0.15, size: 1.2 });
      renderer.gojoVisual.addTeleport(ev.x, ev.y);
    } else if (ev.type === "teleportEnd") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 8, speed: 120, life: 0.18, size: 1.5 });
      renderer.gojoVisual.addTeleport(ev.x, ev.y);
    } else if (ev.type === "punhoIndomavelSocoDefasado") {
      playSoundIfNear(ev, "divergentFistHit");
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#40e0d0", count: 20, speed: 260, life: 0.3, size: 3, borderColor: "#000000", borderWidth: 3 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 10, speed: 180, life: 0.25, size: 1.5 });
      renderer.triggerScreenShake(4, 0.15);
    } else if (ev.type === "divergentFistDelayed") {
      playSoundIfNear(ev, "divergentFistDelayed");
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#40e0d0", count: 30, speed: 320, life: 0.4, size: 4, borderColor: "#000000", borderWidth: 4 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 14, speed: 220, life: 0.3, size: 2 });
      renderer.triggerScreenShake(7, 0.3);
    } else if (ev.type === "divergentFistStart") {
      playSoundIfNear(ev, "divergentFistStart");
    } else if (ev.type === "flyingKneeStart") {
      particles.spawnLine({ x: ev.x, y: ev.y, dirX: ev.dirX, dirY: ev.dirY, color: "#ffaa44", count: 15, life: 0.3 });
    } else if (ev.type === "flyingKnee") {
      renderer.yujiVisual.triggerFlyingKnee(ev.x, ev.y, 0, 0, ev.hit);
      if (ev.hit) {
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#00d4c0", count: 25, speed: 300, life: 0.4, size: 4, borderColor: "#000000", borderWidth: 4 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#40e0d0", count: 15, speed: 200, life: 0.3, size: 3, borderColor: "#000000", borderWidth: 3 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 10, speed: 150, life: 0.2, size: 2, borderColor: "#000000", borderWidth: 2 });
      }
    } else if (ev.type === "soulImpact") {
      if (!ev.miss) {
        playSoundIfNear(ev, "soulImpactHit");
        renderer.triggerBlackFlash(ev.x, ev.y, ev.dirX || 0, ev.dirY || 1);
        renderer.triggerScreenShake(8, 0.35);
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff0000", count: 30, speed: 350, life: 0.5, size: 5, borderColor: "#000000", borderWidth: 4 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff3333", count: 20, speed: 220, life: 0.35, size: 3, borderColor: "#000000", borderWidth: 3 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 12, speed: 180, life: 0.25, size: 2, borderColor: "#000000", borderWidth: 2 });
      } else {
        playSoundIfNear(ev, "soulImpactMiss");
        renderer.yujiVisual.triggerSoulImpactMiss(ev.x, ev.y, ev.dirX, ev.dirY);
      }
    } else if (ev.type === "soulImpactStart") {
      playSoundIfNear(ev, "soulImpactStart");
    } else if (ev.type === "taidoBeatdownHit") {
      renderer.yujiVisual.triggerTaidoBeatdownHit(ev.x, ev.y, ev.hitNum);
      playSoundIfNear(ev, "taidoBeatdownHit");
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#40e0d0", count: 14, speed: 170, life: 0.18, size: 2.6, borderColor: "#000000", borderWidth: 4 });
    } else if (ev.type === "taidoBeatdownFinal") {
      renderer.yujiVisual.triggerTaidoBeatdownFinal(ev.x, ev.y, ev.hitNum, false);
      playSoundIfNear(ev, "taidoBeatdownFinal");
      renderer.triggerScreenShake(ev.shakeIntensity || 10, ev.shakeDuration || 0.16);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#40e0d0", count: 26, speed: 280, life: 0.34, size: 3.8, borderColor: "#000000", borderWidth: 5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#40e0d0", count: 10, speed: 180, life: 0.22, size: 2.4, borderColor: "#000000", borderWidth: 4 });
    } else if (ev.type === "taidoBeatdown") {
      playSoundIfNear(ev, "taidoBeatdownStart");
    } else if (ev.type === "rika") {
      const targetX = Number.isFinite(ev.targetX) ? ev.targetX : ev.x + 140;
      const targetY = Number.isFinite(ev.targetY) ? ev.targetY : ev.y;
      const isIncomplete = ev.incomplete === true;

      renderer.yutaVisual.triggerRikaSummon(ev.playerId, ev.x, ev.y, targetX, targetY, isIncomplete);

      if (isIncomplete) {
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#d4a5e5", count: 12, speed: 140, life: 0.4, size: 2.5 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffccff", count: 8, speed: 100, life: 0.6, size: 1.5 });
      } else {
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 8, speed: 180, life: 0.3, size: 2 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#d4a5e5", count: 6, speed: 120, life: 0.5, size: 1.5 });
      }

      audio.playBuffer("yutaVoice", 1.5);
      audio.play("yutaRikaSummon");
    } else if (ev.type === "rikaImpulse") {
      renderer.yutaVisual.triggerRikaCompanionAttack(ev.x, ev.y, 0, 0, "heavy", ev.radius);
      renderer.yutaVisual.triggerRikaImpulse(ev.x, ev.y, ev.radius, ev.playerId, ev.startX, ev.startY, ev.endX, ev.endY);
      const impCount = ev.playerId && renderer.yutaVisual.fullRikaStates.has(ev.playerId) ? 25 : 35;
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff3399", count: impCount, speed: 400, life: 0.6, size: 6 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 12, speed: 300, life: 0.45, size: 4 });
      audio.play("yutaRikaImpulse");
    } else if (ev.type === "rikaDash") {
      renderer.yutaVisual.triggerRikaDash(ev.startX, ev.startY, ev.endX, ev.endY, ev.playerId);
      const dashCount = ev.playerId && renderer.yutaVisual.fullRikaStates.has(ev.playerId) ? 10 : 15;
      particles.spawnBurst({ x: ev.startX, y: ev.startY, color: "#ff99cc", count: dashCount, speed: 200, life: 0.3, size: 3 });
      particles.spawnBurst({ x: ev.endX, y: ev.endY, color: "#ff66b2", count: dashCount + 5, speed: 300, life: 0.4, size: 4 });
      audio.play("yutaRikaDash");
    } else if (ev.type === "dashSlashStart") {
      renderer.yutaVisual.triggerDashSlashStart(ev.playerId, ev.x, ev.y, ev.dirX, ev.dirY);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff99cc", count: 20, speed: 250, life: 0.3, size: 3.5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 10, speed: 150, life: 0.2, size: 2 });
      audio.play("yutaDashSlashWindup");
    } else if (ev.type === "dashSlash") {
      renderer.yutaVisual.triggerDashSlash(ev.startX || ev.x, ev.startY || ev.y, ev.x, ev.y, ev.radius);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 40, speed: 400, life: 0.6, size: 5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 20, speed: 250, life: 0.4, size: 3 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff99cc", count: 15, speed: 300, life: 0.45, size: 3.5 });
      renderer.yutaVisual.needsShake = true;
      audio.play("yutaDashSlash");
    } else if (ev.type === "dashSlashDelayed") {
      renderer.yutaVisual.triggerSlashCuts(ev.x, ev.y);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 45, speed: 450, life: 0.6, size: 5.5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 30, speed: 300, life: 0.45, size: 3.5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff99cc", count: 35, speed: 350, life: 0.55, size: 4 });
      audio.play("yutaDashSlashDelayed");
    } else if (ev.type === "fullRika") {
      renderer.yutaVisual.triggerFullRika(ev.playerId, ev.x, ev.y, ev.duration || 20);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#cc3388", count: 30, speed: 300, life: 0.6, size: 4 });
      audio.play("yutaFullRika");
    } else if (ev.type === "rikaAppear") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#cc66ff", count: 20, speed: 200, life: 0.5, size: 3 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 10, speed: 120, life: 0.4, size: 2 });
    } else if (ev.type === "rikaDisappear") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 30, speed: 150, life: 0.8, size: 2 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#d4a5e5", count: 15, speed: 100, life: 0.6, size: 1.5 });
    } else if (ev.type === "rikaAttack") {
      renderer.yutaVisual.triggerRikaCompanionAttack(ev.x, ev.y, ev.dirX, ev.dirY, ev.attackType, undefined, ev.ownerId);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 12, speed: 180, life: 0.3, size: 2.5 });
      audio.play("yutaRikaAttack");
    } else if (ev.type === "rikaCompanionAttack") {
      const heavy = ev.attackType === "heavy";
      renderer.yutaVisual.triggerRikaCompanionAttack(ev.x, ev.y, ev.dirX, ev.dirY, ev.attackType, ev.radius, ev.ownerId);
      particles.spawnBurst({
        x: ev.x,
        y: ev.y,
        color: heavy ? "#ffd2ea" : "#cc3388",
        count: heavy ? 22 : 8,
        speed: heavy ? 290 : 150,
        life: heavy ? 0.45 : 0.25,
        size: heavy ? 4 : 2,
      });
      if (heavy) {
        renderer.addMarker({
          x: ev.x,
          y: ev.y,
          radius: ev.radius || 170,
          color: "rgba(255,130,200,0.55)",
          ttl: 0.52,
        });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 16, speed: 220, life: 0.32, size: 3.2 });
        audio.play("yutaRikaHeavy");
      }
    } else if (ev.type === "pureLoveCharge") {
      renderer.yutaVisual.triggerPureLoveCharge(ev.playerId, ev.x, ev.y, ev.dirX, ev.dirY, ev.duration);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 8, speed: 120, life: 0.4, size: 2 });
      audio.play("yutaPureLoveCharge");
    } else if (ev.type === "pureLoveBeam") {
      renderer.yutaVisual.triggerPureLoveBeam(ev.x, ev.y, ev.dirX, ev.dirY, ev.width, ev.lifetime);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 20, speed: 300, life: 0.5, size: 3.5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 15, speed: 200, life: 0.4, size: 2.5 });
      audio.play("yutaPureLoveBeam");
    } else if (ev.type === "cursedWave") {
      const waveRange = Number.isFinite(ev.range) ? ev.range : 300;
      const waveWidth = Number.isFinite(ev.width) ? ev.width : 120;
      const dirX = ev.dirX || (renderer.playerFacing.get(ev.playerId) || 1);
      const dirY = ev.dirY || 0;
      const midX = ev.x + dirX * waveRange * 0.4;
      const midY = ev.y + dirY * waveRange * 0.4;

      renderer.yutaVisual.triggerCursedWave(ev.x, ev.y, dirX, dirY, waveRange, waveWidth);

      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff3399", count: 12, speed: 200, life: 0.3, size: 3 });
      particles.spawnBurst({ x: midX, y: midY, color: "#ff66cc", count: 18, speed: 280, life: 0.4, size: 4 });
      particles.spawnLine({ x: ev.x, y: ev.y, dirX, dirY, color: "#ff99cc", count: 10, life: 0.3 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 8, speed: 150, life: 0.2, size: 2.5 });

      audio.play("yutaCursedWave");
    } else if (ev.type === "domainStart") {
      renderer.onDomainStart(ev);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#d6ebff", count: 28, speed: 320, life: 0.45, size: 3.1 });
      audio.play("domainStart");
      hud.pushNotice("Dominio ativado", "domain", "a atmosfera mudou");

      if (ev.ownerId === state.playerId && ev.copiedCharacter !== undefined) {
        if (!document.getElementById("domain-hint-style")) {
          const styleEl = document.createElement("style");
          styleEl.id = "domain-hint-style";
          styleEl.textContent = "@keyframes dhFadeIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}";
          document.head.appendChild(styleEl);
        }
        const hintEl = document.createElement("div");
        hintEl.id = "domain-hint";
        hintEl.style.cssText =
          "position:fixed;bottom:120px;left:50%;transform:translateX(-50%);" +
          "background:rgba(8,13,22,0.85);border:1px solid rgba(255,102,178,0.5);" +
          "border-radius:14px;padding:14px 28px;text-align:center;z-index:9999;" +
          "backdrop-filter:blur(10px);box-shadow:0 8px 32px rgba(0,0,0,0.5);" +
          "animation:dhFadeIn 0.25s ease-out;";
        const cap = ev.copiedCharacter ? ev.copiedCharacter.charAt(0).toUpperCase() + ev.copiedCharacter.slice(1) : "Pure Love";
        hintEl.innerHTML =
          '<div style="font-size:15px;color:#ff99cc;font-weight:bold;letter-spacing:0.5px;">' +
          'Clique [F] para ativar habilidade' +
          '</div>' +
          '<div style="font-size:12px;color:#b3b3b3;margin-top:4px;">' +
          cap +
          '</div>';
        document.body.appendChild(hintEl);
        setTimeout(() => {
          hintEl.style.transition = "opacity 0.3s,transform 0.3s";
          hintEl.style.opacity = "0";
          hintEl.style.transform = "translateX(-50%) translateY(10px)";
          setTimeout(() => hintEl.remove(), 300);
        }, 4000);
      }
    } else if (ev.type === "domainCollapse") {
      renderer.onDomainCollapse(ev);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#f4d2ff", count: 20, speed: 260, life: 0.32, size: 2.9 });
      if (ev.broken) {
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 30, speed: 300, life: 0.5, size: 3.5 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#c080ff", count: 20, speed: 200, life: 0.4, size: 4 });
        renderer.addMarker({ x: ev.x, y: ev.y, radius: ev.radius || 100, color: "rgba(200,150,255,0.6)", ttl: 0.6 });
      }
    } else if (ev.type === "domainBarrierHit") {
      const byEnemy = ev.attackerKind === "enemy";
      const isPurple = ev.projectileType === "purple";
      const baseColor = byEnemy ? "#ffae62" : (isPurple ? "#b995ff" : "#a9d9ff");
      const coreColor = byEnemy ? "#ffd7b0" : "#ffffff";
      particles.spawnBurst({
        x: ev.x,
        y: ev.y,
        color: baseColor,
        count: byEnemy ? 16 : 12,
        speed: byEnemy ? 220 : 180,
        life: byEnemy ? 0.24 : 0.2,
        size: byEnemy ? 2.6 : 2.2,
      });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: coreColor, count: byEnemy ? 7 : 5, speed: 120, life: 0.14, size: 1.8 });
      particles.spawnLine({
        x: ev.x,
        y: ev.y,
        dirX: Math.cos(Date.now() * 0.01),
        dirY: Math.sin(Date.now() * 0.01),
        color: byEnemy ? "#ffd7b0" : "#d6ecff",
        count: byEnemy ? 5 : 4,
        life: 0.12,
      });
    } else if (ev.type === "freezeTick") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#f8fdff", count: 8, speed: 125, life: 0.18, size: 2.1 });
    } else if (ev.type === "stunTick") {
      particles.spawnStars({ x: ev.x, y: ev.y, color: "#ffffff", count: 3, radius: 14, life: 0.34, size: 3.1 });
    } else if (ev.type === "punhoIndomavelDominioImpacto") {
      renderer.yujiVisual.addCutLine(ev.x, ev.y);
    } else if (ev.type === "trainHit") {
      renderer.yujiVisual.addTrainImpact(ev.x, ev.y);
      audio.play("trainHit");
    } else if (ev.type === "trainApproach") {
      audio.play("trainApproach");
    } else if (ev.type === "blueExplosion") {
      renderer.addBlueExplosion({ x: ev.x, y: ev.y, radius: ev.radius || 200 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#66ccff", count: 30, speed: 250, life: 0.4, size: 3 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 15, speed: 150, life: 0.3, size: 2 });
    } else if (ev.type === "redExplosion") {
      renderer.addRedExplosion({ x: ev.x, y: ev.y, radius: ev.radius || 110 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff4d6d", count: 25, speed: 350, life: 0.3, size: 2.5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 15, speed: 200, life: 0.2, size: 2 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#2a0000", count: 10, speed: 250, life: 0.25, size: 3 });
    } else if (ev.type === "bossSpawn") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff6d94", count: 26, speed: 300, life: 0.5, size: 3.2 });
      hud.pushNotice("Boss apareceu", "danger", "perigo no centro da arena");
    } else if (ev.type === "telegraph") {
      if (ev.radius < 250 && ev.enemyType !== "fleshmaw") {
        renderer.addMarker({ x: ev.x, y: ev.y, radius: ev.radius || 70, color: "rgba(255,140,180,0.5)", ttl: 0.45 });
      }
    } else if (ev.type === "bossSlamTelegraph") {
      renderer.addMarker({ x: ev.x, y: ev.y, radius: ev.radius || 120, color: "rgba(255,110,140,0.58)", ttl: ev.delay || 0.85 });
    } else if (ev.type === "bossSlamImpact") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff7d9f", count: 20, speed: 290, life: 0.36, size: 3.2 });
    } else if (ev.type === "gameOver") {
      handleGameOver();
    } else if (ev.type === "matchReset") {
      handleMatchReset();
    } else if (ev.type === "crawlerBabySpawn") {
      particles.spawnUpwardBurst({ x: ev.x, y: ev.y, color: "#60ff80", count: 14, speed: 100, life: 0.5, size: 2.5, spread: 1.0 });
      particles.spawnUpwardBurst({ x: ev.x, y: ev.y, color: "#b0ffc0", count: 8, speed: 70, life: 0.4, size: 2, spread: 0.6 });
      playSoundIfNear(ev, "crawlerExplosion");
    } else if (ev.type === "crawlerExplosion") {
      renderer.addCrawlerExplosion({ x: ev.x, y: ev.y, radius: ev.radius || 160 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#60ff80", count: 20, speed: 250, life: 0.4, size: 3 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#b0ffc0", count: 12, speed: 150, life: 0.3, size: 2 });
      playSoundIfNear(ev, "crawlerExplosion");
    } else if (ev.type === "crawlerTremor") {
      renderer.addMarker({ x: ev.x, y: ev.y, radius: 40 + (1 - ev.intensity) * 30, color: "rgba(100,255,120,0.4)", ttl: 0.3 });
      if (Date.now() - _lastTremorSound > 350) {
        playSoundIfNear(ev, "crawlerTremor");
        _lastTremorSound = Date.now();
      }
    } else if (ev.type === "acidPuddle") {
      renderer.addAcidPuddle({ x: ev.x, y: ev.y, radius: ev.radius || 60, duration: ev.duration || 4, dps: ev.dps || 8 });
      playSoundIfNear(ev, "acidPuddle");
    } else if (ev.type === "levelUp") {
      hud.pushNotice("Level " + ev.level, "info", "escolha uma melhoria");
    } else if (ev.type === "upgradeApplied") {
      hud.pushNotice(ev.name || "Melhoria aplicada", "upgrade", ev.timedOut ? "selecionada automaticamente" : "build atualizada");
    } else if (ev.type === "skillNoTarget") {
      hud.pushNotice("Sem alvos", "info", ev.skill + " sem inimigos no alcance");
    } else if (ev.type === "domainCopyUsed") {
      hud.pushNotice("CÃ³pia jÃ¡ utilizada", "info", "sÃ³ pode copiar 1 vez por expansÃ£o");
    }
  }
}

function handleGameOver() {
  hud.showGameOver();
  input.setEnabled(false);
  input.resetActionKeys();
}

function handleMatchReset() {
  hud.hideGameOver();
  state.spectating = false;
  state.spectateTargetId = null;
  state.spectateIndex = 0;
  state.pendingInputs = [];
  if (state.you) {
    state.localPred.x = state.you.x;
    state.localPred.y = state.you.y;
  }
  startScreen.classList.remove("visible");
  startScreen.style.display = "none";
  if (menuBg) {
    menuBg.style.opacity = "0";
    menuBg.style.display = "none";
  }
  input.setEnabled(true);
  input.resetActionKeys();
  hud.hideUpgradeChoices();
  hud.hideSpectate();
}

function enterSpectateMode() {
  state.spectating = true;
  state.spectateIndex = 0;
  hud.showSpectate("Spectating...");
  input.setEnabled(false);
  updateSpectateTarget();
}

function getAlivePlayers() {
  if (!interpolation || !interpolation.players) return [];
  const arr = [];
  interpolation.players.forEach((entry) => {
    if (entry.raw && entry.raw.alive) arr.push(entry);
  });
  return arr;
}

function updateSpectateTarget() {
  const alivePlayers = getAlivePlayers();
  if (alivePlayers.length === 0) return;
  if (state.spectateIndex >= alivePlayers.length) state.spectateIndex = 0;
  const target = alivePlayers[state.spectateIndex];
  if (target) {
    state.spectateTargetId = target.id;
    hud.showSpectate("Spectating: " + (target.raw.name || "Player"));
  }
}

function cycleSpectateNext() {
  const alivePlayers = getAlivePlayers();
  if (alivePlayers.length === 0) return;
  state.spectateIndex = (state.spectateIndex + 1) % alivePlayers.length;
  updateSpectateTarget();
}

function cycleSpectatePrev() {
  const alivePlayers = getAlivePlayers();
  if (alivePlayers.length === 0) return;
  state.spectateIndex = (state.spectateIndex - 1 + alivePlayers.length) % alivePlayers.length;
  updateSpectateTarget();
}

function start() {
  closeSettings();
  const nick = (nickInput.value || "Sorcerer").trim().slice(0, 20) || "Sorcerer";
  localStorage.setItem(NICK_KEY, nick);
  audio.setGameActive(true);
  audio.resume();
  audio.stopMusic(300);

  const char = state.selectedChar || 'o-honrado';
  state.sessionToken = state.sessionToken || localStorage.getItem(SESSION_KEY) || "";

  if (state.connected || state.reconnecting || state.joined) {
    clearTimeout(net.reconnectTimer);
    net.disconnect();
  }

  state.joined = false;
  state.reconnecting = false;
  state.connected = false;

  net.connect({ name: nick, sessionToken: state.sessionToken, character: char });
}

function sendInputIfNeeded(nowMs) {
  if (!state.joined || !state.connected) {
    return;
  }

  const intervalMs = 1000 / 30;
  if (nowMs - state.lastInputSendAt < intervalMs) {
    return;
  }

  state.seq += 1;
  const payload = input.toPayload(renderer.camera, state.seq);

  if (state.seq === 1 || state.seq % 60 === 0) {
    console.log(`[DIAG] Sending input seq=${state.seq}: keys=${JSON.stringify(payload.keys)}, aim=(${payload.aimX.toFixed(0)},${payload.aimY.toFixed(0)}), camera=(${renderer.camera.x.toFixed(0)},${renderer.camera.y.toFixed(0)})`);
  }

  net.sendInput(payload);
  state.pendingInputs.push({ seq: state.seq, payload });
  applyInputPrediction(state.localPred, payload, intervalMs / 1000);
  state.lastInputSendAt = nowMs;

  input.resetActionKeys();
}

let _diagLoopFrames = 0;
let _lastFrameTime = 0;
let _accumulator = 0;
const FIXED_DT = 1 / 60;

function loop(nowMs) {
  requestAnimationFrame(loop);

  const rawDt = _lastFrameTime ? Math.min((nowMs - _lastFrameTime) / 1000, 0.05) : FIXED_DT;
  _lastFrameTime = nowMs;

  _accumulator += rawDt;
  if (_accumulator > 0.2) _accumulator = 0.2;

  while (_accumulator >= FIXED_DT) {
    interpolation.updateSmoothing(FIXED_DT);
    particles.update(FIXED_DT);
    renderer.updateEffects(FIXED_DT);
    _accumulator -= FIXED_DT;
  }

  if (state.spectating && state.spectateTargetId) {
    let target = null;
    if (interpolation && interpolation.players) {
      interpolation.players.forEach((entry) => {
        if (entry.id === state.spectateTargetId) target = entry;
      });
    }
    if (target && target.raw) {
      renderer.updateCamera(target.raw.x, target.raw.y, rawDt);
    }
  } else if (state.joined && state.you) {
    renderer.updateCamera(state.localPred.x, state.localPred.y, rawDt);
  }

  if (_diagLoopFrames < 30 && state.joined) {
    console.log(`[DIAG] loop #${_diagLoopFrames}: joined=${state.joined}, connected=${state.connected}, you=${!!state.you}, camera=(${renderer.camera.x.toFixed(0)},${renderer.camera.y.toFixed(0)}), localPred=(${state.localPred.x.toFixed(0)},${state.localPred.y.toFixed(0)})`);
    _diagLoopFrames++;
  }

  updateEnemyAttackSounds(interpolation.enemies);

  renderer.render({
    interpolation,
    youId: state.playerId,
    you: state.you,
    localPred: state.localPred,
  });

  if (state.joined) {
    hud.update({
      you: state.you || {
        hp: 0,
        maxHp: 1,
        energy: 0,
        maxEnergy: 1,
        level: 1,
        xp: 0,
        xpToNext: 1,
        cooldowns: {},
        kills: 0,
        deaths: 0,
        alive: false,
        skillLock: false,
      },
      phase: state.phase,
      elapsedSec: state.elapsedSec,
      ping: state.ping,
      connected: state.connected,
      interpolation,
      map: renderer.map,
    });
  }

  if (state.joined) {
    if (input.keys.help) hud.showHelp(state.selectedChar);
    else hud.hideHelp();
  }

  sendInputIfNeeded(nowMs);

  if (state.connected && nowMs - state.lastPingAt > 1100) {
    net.ping();
    state.lastPingAt = nowMs;
  }
}

input.install();
input.onUpgradeKey = (index) => {
  hud.pickUpgradeByIndex(index);
};



canvas.addEventListener("wheel", (event) => {
  if (!state.joined) return;
  event.preventDefault();
  const factor = event.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.4, Math.min(2.0, renderer.camera.zoom * factor));
  renderer.startZoom(newZoom, 60);
}, { passive: false });

playBtn.addEventListener("click", () => {
  start();
});
playBtn.addEventListener("mouseenter", () => playHoverSound(audio));

const CHAR_COLORS = {
  "o-honrado": [0, 229, 255],
  "rei-amaldicoado": [255, 0, 51],
  "portador-do-vinculo": [255, 255, 255],
  "punho-indomavel": [255, 107, 157],
  "invocador-de-sombras": [10, 26, 74],
  "lutador-de-sorte": [170, 68, 255],
};

function setAccentColor(charId) {
  const rgb = CHAR_COLORS[charId] || [0, 229, 255];
  const hex = "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
  document.documentElement.style.setProperty("--accent", hex);
  document.documentElement.style.setProperty("--accent-rgb", rgb.join(", "));
}

characterCards.forEach((card) => {
  card.addEventListener("mouseenter", () => playHoverSound(audio));
  card.addEventListener("click", () => {
    if (card.classList.contains("selected")) return;
    characterCards.forEach((item) => item.classList.remove("selected"));
    characterCards.forEach((item) => item.setAttribute("aria-pressed", "false"));
    card.classList.add("selected");
    card.setAttribute("aria-pressed", "true");
    const charId = card.dataset.character;
    state.selectedChar = charId;
    setAccentColor(charId);
    playSelectSound(audio);
  });
});

nickInput.value = localStorage.getItem(NICK_KEY) || "";
nickInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    start();
  }
});

document.addEventListener("keydown", (event) => {
  if (!state.spectating) return;
  if (event.key === "]" || event.code === "BracketRight") {
    cycleSpectateNext();
  } else if (event.key === "[" || event.code === "BracketLeft") {
    cycleSpectatePrev();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    _lastFrameTime = 0;
  } else {
    renderer.clearEffects();
    particles.clear();
  }
});

/* =========================================================================
   SETTINGS PANEL LOGIC
   ========================================================================= */
const settingsGear = document.getElementById("settings-gear");
const settingsPanel = document.getElementById("settings-panel");
const settingsBackdrop = document.getElementById("settings-backdrop");
const settingsClose = document.getElementById("settings-close");
const settingsTabs = document.querySelectorAll(".settings-tab");
const tabContents = {
  audio: document.getElementById("settings-audio"),
  controls: document.getElementById("settings-controls"),
  bindings: document.getElementById("settings-bindings"),
};
const volMaster = document.getElementById("vol-master");
const volMusic = document.getElementById("vol-music");
const volSfx = document.getElementById("vol-sfx");
const volMasterLabel = document.getElementById("vol-master-label");
const volMusicLabel = document.getElementById("vol-music-label");
const volSfxLabel = document.getElementById("vol-sfx-label");
const bindingsList = document.getElementById("bindings-list");
const bindingsReset = document.getElementById("bindings-reset");
const controlsKeys = document.querySelectorAll(".ctrl-keys[data-action]");

function openSettings() {
  settingsBackdrop.classList.remove("hidden");
  settingsPanel.classList.remove("hidden");
  loadSettingsUI();
  playOpenSound(audio);
}

function closeSettings() {
  settingsBackdrop.classList.add("hidden");
  settingsPanel.classList.add("hidden");
  stopListening();
  playCloseSound(audio);
}

function loadSettingsUI() {
  volMaster.value = audio.getMasterVolume();
  volMasterLabel.textContent = Math.round(audio.getMasterVolume() * 100) + "%";
  volMusic.value = audio.getMusicVolume();
  volMusicLabel.textContent = Math.round(audio.getMusicVolume() * 100) + "%";
  volSfx.value = audio.getSfxVolume();
  volSfxLabel.textContent = Math.round(audio.getSfxVolume() * 100) + "%";
  updateBindingsUI();
  updateControlsUI();
}

function updateControlsUI() {
  const bindings = input.getBindings();
  controlsKeys.forEach((el) => {
    const action = el.dataset.action;
    if (bindings[action]) {
      const code = bindings[action];
      el.textContent = formatCode(code);
    }
  });
}

function updateBindingsUI() {
  const bindings = input.getBindings();
  const btns = bindingsList.querySelectorAll(".binding-btn");
  btns.forEach((btn) => {
    const action = btn.dataset.action;
    if (bindings[action]) {
      btn.textContent = formatCode(bindings[action]);
    }
  });
}

function formatCode(code) {
  const map = {
    Space: "ESPAÃ‡O",
    ShiftLeft: "SHIFT",
    ShiftRight: "SHIFT",
    ControlLeft: "CTRL",
    ControlRight: "CTRL",
    AltLeft: "ALT",
    AltRight: "ALT",
    ArrowUp: "â†‘",
    ArrowDown: "â†“",
    ArrowLeft: "â†",
    ArrowRight: "â†’",
    Enter: "ENTER",
    Escape: "ESC",
    Tab: "TAB",
    Backspace: "BACK",
    Delete: "DEL",
  };
  if (map[code]) return map[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "NUM" + code.slice(6);
  return code;
}

let listeningBtn = null;

function stopListening() {
  if (listeningBtn) {
    listeningBtn.classList.remove("listening");
    listeningBtn.textContent = formatCode(input.getBindings()[listeningBtn.dataset.action]);
    listeningBtn = null;
  }
}

function startListening(btn) {
  stopListening();
  listeningBtn = btn;
  btn.classList.add("listening");
  btn.textContent = "...";
}

function handleBindingKeydown(event) {
  if (!listeningBtn) return;
  event.preventDefault();
  event.stopPropagation();

  const action = listeningBtn.dataset.action;
  const code = event.code;

  if (code === "Escape") {
    stopListening();
    return;
  }

  const ok = input.setBinding(action, code);
  if (!ok) {
    listeningBtn.classList.add("conflict");
    setTimeout(() => listeningBtn.classList.remove("conflict"), 400);
    return;
  }

  stopListening();
  updateBindingsUI();
  updateControlsUI();
}

settingsGear.addEventListener("click", openSettings);
settingsGear.addEventListener("mouseenter", () => playHoverSound(audio));

settingsClose.addEventListener("click", closeSettings);
settingsClose.addEventListener("mouseenter", () => playHoverSound(audio));

settingsBackdrop.addEventListener("click", closeSettings);

settingsTabs.forEach((tab) => {
  tab.addEventListener("mouseenter", () => playHoverSound(audio));
  tab.addEventListener("click", () => {
    if (tab.classList.contains("active")) return;
    settingsTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    Object.values(tabContents).forEach((c) => c.classList.remove("active"));
    const target = tab.dataset.tab;
    if (tabContents[target]) tabContents[target].classList.add("active");
    playTabSwitchSound(audio);
  });
});

let _sliderThrottle = 0;
function onSliderInput(value, label, setter) {
  label.textContent = Math.round(value * 100) + "%";
  setter(value);
  const now = Date.now();
  if (now - _sliderThrottle > 100) {
    _sliderThrottle = now;
    playSliderTickSound(audio);
  }
}

volMaster.addEventListener("input", () => {
  onSliderInput(parseFloat(volMaster.value), volMasterLabel, (v) => audio.setMasterVolume(v));
});

volMusic.addEventListener("input", () => {
  onSliderInput(parseFloat(volMusic.value), volMusicLabel, (v) => audio.setMusicVolume(v));
});

volSfx.addEventListener("input", () => {
  onSliderInput(parseFloat(volSfx.value), volSfxLabel, (v) => audio.setSfxVolume(v));
});

bindingsList.addEventListener("click", (event) => {
  const btn = event.target.closest(".binding-btn");
  if (!btn) return;
  playClickSound(audio);
  startListening(btn);
});
document.querySelectorAll(".binding-btn").forEach((btn) => {
  btn.addEventListener("mouseenter", () => playHoverSound(audio));
});

bindingsReset.addEventListener("click", () => {
  playClickSound(audio);
  input.resetBindings();
  updateBindingsUI();
  updateControlsUI();
});
bindingsReset.addEventListener("mouseenter", () => playHoverSound(audio));

document.addEventListener("keydown", handleBindingKeydown);

requestAnimationFrame(loop);
