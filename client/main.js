import { InputManager } from "./core/input.js";
import { NetworkClient } from "./core/netClient.js";
import { InterpolationBuffer } from "./core/interpolation.js";
import { Renderer } from "./core/renderer.js";
import { ParticleSystem } from "./particles/particleSystem.js";
import { AudioSystem } from "./audio/audioSystem.js";
import { Hud } from "./ui/hud.js";
import { AnimationStateMachine } from "./animations/stateMachine.js";
import { initGifBackground } from "./animations/gifBackground.js";

const SESSION_KEY = "cursed_battles_session";
const NICK_KEY = "cursed_battles_nick";

const canvas = document.getElementById("game-canvas");
const startScreen = document.getElementById("start-screen");
const playBtn = document.getElementById("play-btn");
const nickInput = document.getElementById("nick-input");
const characterCards = document.querySelectorAll(".character-card[data-character]");

const menuBg = document.getElementById("menu-bg");
if (menuBg) {
  initGifBackground(menuBg, "/assets/backgrounds/telainicio.gif");
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
audio.loadSound("/assets/sounds/domain_entrancesound.mp3", "domainStart");
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
  selectedChar: "gojo",
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
  gojo: 172, yuta: 178, sukuna: 168, yuji: 180, megumi: 175, hakari: 170,
};

function applyInputPrediction(pred, payload, dt) {
  const keys = payload.keys;
  const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const moveY = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const len = Math.hypot(moveX, moveY);
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
      if (ev.kind !== "divergentFist" && ev.kind !== "divergentFistDelayed") {
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffd7e2", count: 6, speed: 140, life: 0.15, size: 2 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#88ccff", count: 4, speed: 80, life: 0.12, size: 3 });
      }
      if (ev.kind === "m1") {
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 10, speed: 260, life: 0.25, size: 3 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 14, speed: 200, life: 0.28, size: 2.5 });
        renderer.yutaVisual && renderer.yutaVisual.triggerHit(ev.x, ev.y, 1.2);
      }
      audio.play("hit");
    } else if (ev.type === "m1") {
      const dirX = ev.dirX || (renderer.playerFacing.get(ev.playerId) || 1);
      const dirY = ev.dirY || 0;
      const combo = ev.combo || 1;
      const attackerCharacter = ev.character || "gojo";
      if (attackerCharacter === "yuta") {
        const slashRange = Number.isFinite(ev.slashRange) ? ev.slashRange : 160;
        const coneAngle = Number.isFinite(ev.coneAngle) ? ev.coneAngle : 1.4;

        renderer.yutaVisual.triggerKatanaSlash(ev.x, ev.y, dirX, dirY, combo, slashRange, coneAngle);
      } else if (attackerCharacter === "gojo") {
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
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffff00", count: 20, speed: 250, life: 0.35, size: 3.5 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#000000", count: 12, speed: 180, life: 0.3, size: 2.5 });
        particles.spawnLine({ x: ev.x, y: ev.y, dirX, dirY, color: "#ffdd00", count: 8, life: 0.3, size: 3 });
        renderer.triggerBlackFlash(ev.x, ev.y, dirX, dirY);
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
    } else if (ev.type === "yujiDivergentPunch") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#40e0d0", count: 12, speed: 220, life: 0.3, size: 2.8 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 6, speed: 140, life: 0.2, size: 1.8 });
    } else if (ev.type === "divergentFistDelayed") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#40e0d0", count: 18, speed: 260, life: 0.35, size: 3.2 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 8, speed: 150, life: 0.25, size: 2 });
    } else if (ev.type === "flyingKneeStart") {
      particles.spawnLine({ x: ev.x, y: ev.y, dirX: ev.dirX, dirY: ev.dirY, color: "#ffaa44", count: 15, life: 0.3 });
    } else if (ev.type === "flyingKnee") {
      renderer.yujiVisual.triggerFlyingKnee(ev.x, ev.y, 0, 0, ev.hit);
      if (ev.hit) {
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#66ccff", count: 20, speed: 250, life: 0.3, size: 3 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#b6e2ff", count: 10, speed: 150, life: 0.2, size: 2 });
      }
    } else if (ev.type === "soulImpact") {
      renderer.yujiVisual.triggerSoulImpact(ev.x, ev.y, ev.dirX, ev.dirY);
      if (!ev.miss) {
        renderer.triggerBlackFlash(ev.x, ev.y, ev.dirX || 0, ev.dirY || 1);
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff0000", count: 30, speed: 300, life: 0.5, size: 4 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 20, speed: 200, life: 0.35, size: 2.5 });
      }
    } else if (ev.type === "taidoBeatdownHit") {
      renderer.yujiVisual.triggerTaidoBeatdownHit(ev.x, ev.y, ev.hitNum);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffaa66", count: 12, speed: 150, life: 0.15, size: 2 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#40e0d0", count: 8, speed: 180, life: 0.2, size: 2.5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 4, speed: 120, life: 0.15, size: 1.5 });
    } else if (ev.type === "taidoBeatdownFinal") {
      renderer.yujiVisual.triggerTaidoBeatdownFinal(ev.x, ev.y, ev.hitNum, ev.blackFlash);
      if (ev.blackFlash) {
        renderer.triggerBlackFlash(ev.x, ev.y, ev.dirX || 0, ev.dirY || 1);
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffff00", count: 25, speed: 280, life: 0.4, size: 3.5 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#000000", count: 15, speed: 200, life: 0.35, size: 2.5 });
      } else {
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff6633", count: 20, speed: 220, life: 0.3, size: 3 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#40e0d0", count: 16, speed: 260, life: 0.35, size: 3.5 });
        particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 8, speed: 180, life: 0.25, size: 2 });
      }
    } else if (ev.type === "rika") {
      const dirX = Number.isFinite(ev.dirX) ? ev.dirX : (renderer.playerFacing.get(ev.playerId) || 1);
      const dirY = Number.isFinite(ev.dirY) ? ev.dirY : 0;
      const impactRange = 140;
      const impactX = ev.x + dirX * impactRange;
      const impactY = ev.y + dirY * impactRange;

      renderer.yutaVisual.triggerRika(ev.x, ev.y, dirX, dirY);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 12, speed: 200, life: 0.28, size: 2.4 });
      particles.spawnBurst({ x: impactX, y: impactY, color: "#ff66b2", count: 24, speed: 300, life: 0.38, size: 3.2 });
      particles.spawnBurst({ x: impactX, y: impactY, color: "#ffffff", count: 10, speed: 210, life: 0.24, size: 2.2 });
      particles.spawnLine({ x: impactX, y: impactY, dirX, dirY, color: "#ffd0e8", count: 7, life: 0.22 });
      audio.play("skillRed");
    } else if (ev.type === "rikaImpulse") {
      renderer.yutaVisual.triggerRikaCompanionAttack(ev.x, ev.y, 0, 0, "heavy", ev.radius);
      renderer.yutaVisual.triggerRikaImpulse(ev.x, ev.y, ev.radius);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff3399", count: 40, speed: 400, life: 0.6, size: 6 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 20, speed: 300, life: 0.45, size: 4 });
      audio.play("skillPurple");
    } else if (ev.type === "rikaDash") {
      renderer.yutaVisual.triggerRikaDash(ev.startX, ev.startY, ev.endX, ev.endY);
      particles.spawnBurst({ x: ev.startX, y: ev.startY, color: "#ff99cc", count: 15, speed: 200, life: 0.3, size: 3 });
      particles.spawnBurst({ x: ev.endX, y: ev.endY, color: "#ff66b2", count: 20, speed: 300, life: 0.4, size: 4 });
      audio.play("skillBlue");
    } else if (ev.type === "dashSlash") {
      renderer.yutaVisual.triggerDashSlash(ev.startX || ev.x, ev.startY || ev.y, ev.x, ev.y, ev.radius);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 25, speed: 350, life: 0.5, size: 4 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 12, speed: 200, life: 0.35, size: 2.5 });
      audio.play("skillBlue");
    } else if (ev.type === "dashSlashDelayed") {
      renderer.yutaVisual.triggerSlashCuts(ev.x, ev.y);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 30, speed: 400, life: 0.55, size: 5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 20, speed: 250, life: 0.4, size: 3 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff99cc", count: 25, speed: 300, life: 0.5, size: 3.5 });
    } else if (ev.type === "fullRika") {
      renderer.yutaVisual.triggerFullRika(ev.x, ev.y, ev.duration || 20);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#cc3388", count: 30, speed: 300, life: 0.6, size: 4 });
      audio.play("skillPurple");
    } else if (ev.type === "rikaAttack") {
      renderer.yutaVisual.effects.addRikaAttack(ev.x, ev.y, ev.dirX, ev.dirY);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 12, speed: 180, life: 0.3, size: 2.5 });
    } else if (ev.type === "rikaCompanionAttack") {
      const heavy = ev.attackType === "heavy";
      renderer.yutaVisual.triggerRikaCompanionAttack(ev.x, ev.y, ev.dirX, ev.dirY, ev.attackType, ev.radius);
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
      }
    } else if (ev.type === "pureLoveCharge") {
      renderer.yutaVisual.triggerPureLoveCharge(ev.playerId, ev.x, ev.y, ev.dirX, ev.dirY, ev.duration);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 8, speed: 120, life: 0.4, size: 2 });
    } else if (ev.type === "pureLoveBeam") {
      renderer.yutaVisual.triggerPureLoveBeam(ev.x, ev.y, ev.dirX, ev.dirY, ev.width, ev.lifetime);
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ffffff", count: 20, speed: 300, life: 0.5, size: 3.5 });
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff66b2", count: 15, speed: 200, life: 0.4, size: 2.5 });
      audio.play("skillPurple");
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

      audio.play("skillPurple");
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
    } else if (ev.type === "yujiDomainHit") {
      renderer.yujiVisual.addCutLine(ev.x, ev.y);
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
      renderer.addMarker({ x: ev.x, y: ev.y, radius: ev.radius || 70, color: "rgba(255,140,180,0.5)", ttl: 0.45 });
    } else if (ev.type === "bossSlamTelegraph") {
      renderer.addMarker({ x: ev.x, y: ev.y, radius: ev.radius || 120, color: "rgba(255,110,140,0.58)", ttl: ev.delay || 0.85 });
    } else if (ev.type === "bossSlamImpact") {
      particles.spawnBurst({ x: ev.x, y: ev.y, color: "#ff7d9f", count: 20, speed: 290, life: 0.36, size: 3.2 });
    } else if (ev.type === "gameOver") {
      handleGameOver();
    } else if (ev.type === "matchReset") {
      handleMatchReset();
    } else if (ev.type === "levelUp") {
      hud.pushNotice("Level " + ev.level, "info", "escolha uma melhoria");
    } else if (ev.type === "upgradeApplied") {
      hud.pushNotice(ev.name || "Melhoria aplicada", "upgrade", ev.timedOut ? "selecionada automaticamente" : "build atualizada");
    } else if (ev.type === "skillNoTarget") {
      hud.pushNotice("Sem alvos", "info", ev.skill + " sem inimigos no alcance");
    } else if (ev.type === "domainCopyUsed") {
      hud.pushNotice("Cópia já utilizada", "info", "só pode copiar 1 vez por expansão");
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
  const nick = (nickInput.value || "Sorcerer").trim().slice(0, 20) || "Sorcerer";
  localStorage.setItem(NICK_KEY, nick);
  audio.unlock();

  const char = state.selectedChar || 'gojo';
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

playBtn.addEventListener("click", () => {
  start();
});

const CHAR_COLORS = {
  gojo: [0, 229, 255],
  sukuna: [255, 0, 51],
  yuta: [255, 255, 255],
  yuji: [255, 107, 157],
  megumi: [10, 26, 74],
  hakari: [170, 68, 255],
};

function setAccentColor(charId) {
  const rgb = CHAR_COLORS[charId] || [0, 229, 255];
  const hex = "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
  document.documentElement.style.setProperty("--accent", hex);
  document.documentElement.style.setProperty("--accent-rgb", rgb.join(", "));
}

characterCards.forEach((card) => {
  card.addEventListener("click", () => {
    characterCards.forEach((item) => item.classList.remove("selected"));
    characterCards.forEach((item) => item.setAttribute("aria-pressed", "false"));
    card.classList.add("selected");
    card.setAttribute("aria-pressed", "true");
    const charId = card.dataset.character;
    state.selectedChar = charId;
    setAccentColor(charId);
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

requestAnimationFrame(loop);
