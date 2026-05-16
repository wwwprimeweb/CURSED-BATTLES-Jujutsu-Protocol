"use strict";

const { generateMap } = require("./mapGenerator");
const { createPlayer, BASE_STATS } = require("../entities/player");
const { createProjectile } = require("../entities/projectile");
const { CombatSystem } = require("../systems/combatSystem");
const { EnemySystem } = require("../systems/enemySystem");
const { ProgressionSystem } = require("../systems/progressionSystem");
const { DomainSystem } = require("../systems/domainSystem");
const { GOJO } = require("../gameplay/gojoKit");
const { YUTA } = require("../gameplay/yutaKit");
const { CHARACTER_REGISTRY } = require("../gameplay/characterRegistry");
const {
  clamp,
  distance,
  normalize,
  dot,
  circleIntersectsRect,
  distancePointToSegment,
} = require("../utils/math");
const { Rng } = require("../utils/rng");

class GameServer {
  constructor(config) {
    this.config = config;
    this.now = Date.now();
    this.startedAt = this.now;
    this.rng = new Rng(Math.floor(this.now % 2147483647));
    this.map = generateMap(config.map.width, config.map.height, this.rng.int(1, 99999999));

    this.players = new Map();
    this.enemies = new Map();
    this.projectiles = new Map();
    this.sessionToPlayer = new Map();
    this.wsToPlayer = new Map();

    this.delayedActions = [];

    this.combat = new CombatSystem(this);
    this.enemySystem = new EnemySystem(this);
    this.progression = new ProgressionSystem(this);
    this.domainSystem = new DomainSystem(this);

    this.nextPlayerId = 1;
    this.nextEnemyId = 1;
    this.nextProjectileId = 1;
    this.rikas = new Map();

    this._tickTimer = null;
    this._snapshotTimer = null;
    this._matchResetTimer = null;
    this._gameOver = false;

    this.clientStateCache = new Map();
  }

  attachSocketLayer(io) {
    this.io = io;
  }

  start() {
    const tickMs = Math.floor(1000 / this.config.net.tickRate);
    const snapshotMs = Math.floor(1000 / this.config.net.snapshotRate);

    this._tickTimer = setInterval(() => {
      const dt = 1 / this.config.net.tickRate;
      this.step(dt);
    }, tickMs);

    this._snapshotTimer = setInterval(() => {
      this.broadcastSnapshots();
    }, snapshotMs);
  }

  stop() {
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
    }
    if (this._snapshotTimer) {
      clearInterval(this._snapshotTimer);
    }
  }

  get elapsedSeconds() {
    return (this.now - this.startedAt) / 1000;
  }

  countAlivePlayers() {
    let alive = 0;
    this.players.forEach((p) => {
      if (p.alive) {
        alive += 1;
      }
    });
    return alive;
  }

  getSpawnPoint() {
    const radius = BASE_STATS.gojo.radius;
    const jitter = 20;
    const anchoredAttempts = Math.max(1, this.map.spawnPoints.length * 6);

    for (let i = 0; i < anchoredAttempts; i += 1) {
      const point = this.rng.pick(this.map.spawnPoints);
      const x = clamp(point.x + this.rng.int(-jitter, jitter), radius, this.map.width - radius);
      const y = clamp(point.y + this.rng.int(-jitter, jitter), radius, this.map.height - radius);
      if (!this.isUnsafeSpawnPoint(x, y, radius)) {
        return { x, y };
      }
    }

    for (let i = 0; i < 120; i += 1) {
      const x = this.rng.int(radius, this.map.width - radius);
      const y = this.rng.int(radius, this.map.height - radius);
      if (!this.isUnsafeSpawnPoint(x, y, radius)) {
        return { x, y };
      }
    }

    return {
      x: clamp(this.map.width * 0.5, radius, this.map.width - radius),
      y: clamp(this.map.height * 0.5, radius, this.map.height - radius),
    };
  }

  isUnsafeSpawnPoint(x, y, radius) {
    if (this.isCollidingAnyObstacle(x, y, radius)) {
      return true;
    }
    for (let i = 0; i < this.map.hazards.length; i += 1) {
      const hazard = this.map.hazards[i];
      if (distance(x, y, hazard.x, hazard.y) <= hazard.radius + radius + 10) {
        return true;
      }
    }
    return false;
  }

  getSpawnEdgePoint() {
    const side = this.rng.int(0, 3);
    const margin = 64;
    if (side === 0) {
      return { x: margin, y: this.rng.int(margin, this.map.height - margin) };
    }
    if (side === 1) {
      return { x: this.map.width - margin, y: this.rng.int(margin, this.map.height - margin) };
    }
    if (side === 2) {
      return { x: this.rng.int(margin, this.map.width - margin), y: margin };
    }
    return { x: this.rng.int(margin, this.map.width - margin), y: this.map.height - margin };
  }

  addPlayer({ sessionToken, name, character, socket }) {
    console.log(`[DIAG] addPlayer called: name="${name}", character="${character || 'gojo'}", sessionToken="${sessionToken.slice(0,8)}..."`);
    const existingId = this.sessionToPlayer.get(sessionToken);
    if (existingId) {
      const existing = this.players.get(existingId);
      if (existing) {
        existing.socket = socket;
        existing.offline = false;
        existing.disconnectedAt = 0;
        existing.name = name || existing.name;
        this.wsToPlayer.set(socket, existing.id);
        return { player: existing, reconnected: true };
      }
    }

    const spawn = this.getSpawnPoint();
    const id = `p${this.nextPlayerId++}`;
    const player = createPlayer({
      id,
      sessionToken,
      name,
      character,
      x: spawn.x,
      y: spawn.y,
      now: this.now,
    });
    player.socket = socket;
    this.players.set(player.id, player);
    this.sessionToPlayer.set(sessionToken, player.id);
    this.wsToPlayer.set(socket, player.id);
    console.log(`[DIAG] New player created: id=${player.id}, x=${player.x}, y=${player.y}, alive=${player.alive}, hp=${player.hp}`);

    this.emitEventAll({
      type: "playerJoined",
      id: player.id,
      name: player.name,
    });
    return { player, reconnected: false };
  }

  removeSocket(socket) {
    const id = this.wsToPlayer.get(socket);
    if (!id) {
      return;
    }
    this.wsToPlayer.delete(socket);
    const player = this.players.get(id);
    if (!player) {
      return;
    }
    player.socket = null;
    player.offline = true;
    player.disconnectedAt = this.now;
    player.input.up = false;
    player.input.down = false;
    player.input.left = false;
    player.input.right = false;
    player.input.m1 = false;
    player.input.q = false;
    player.input.e = false;
    player.input.r = false;
    player.input.space = false;
    player.input.f = false;
    player.input.dodge = false;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) {
      return;
    }
    this.players.delete(playerId);
    this.sessionToPlayer.delete(player.sessionToken);
    this.clientStateCache.delete(playerId);
    this.emitEventAll({ type: "playerLeft", id: playerId });
  }

  queueDelayedAction(delaySec, action) {
    this.delayedActions.push({
      executeAt: this.now + delaySec * 1000,
      action,
    });
  }

  step(dt) {
    this.now = Date.now();

    this.cleanupDisconnected();
    this.updatePlayers(dt);
    this.domainSystem.update(dt);
    this.enemySystem.update(dt, this.elapsedSeconds);
    this.updateProjectiles(dt);
    this.updateRikas(dt);
    this.applyHazards(dt);
    this.updateDelayedActions();
    this.progression.resolvePendingChoices();
    this.checkGameOver();
  }

  checkGameOver() {
    if (this._gameOver) return;
    if (this.players.size === 0) return;
    const alivePlayers = this.countAlivePlayers();
    if (alivePlayers > 0) return;
    this.triggerGameOver();
  }

  triggerGameOver() {
    if (this._gameOver) {
      return;
    }

    const winner = null;
    this.broadcastEvent({ type: "gameOver", winner });
    this._gameOver = true;
    if (this._matchResetTimer) {
      clearTimeout(this._matchResetTimer);
      this._matchResetTimer = null;
    }

    this._matchResetTimer = setTimeout(() => {
      this._matchResetTimer = null;
      this.resetMatch();
    }, 5000);
  }

  resetMatch() {
    if (this._matchResetTimer) {
      clearTimeout(this._matchResetTimer);
      this._matchResetTimer = null;
    }

    this.enemies.clear();
    this.projectiles.clear();
    this.rikas.clear();
    this.domainSystem.domains.clear();
    this.players.forEach((player) => {
      player.hp = player.maxHp;
      player.energy = player.maxEnergy;
      player.alive = true;
      const spawn = this.getSpawnPoint();
      player.x = spawn.x;
      player.y = spawn.y;
      player.vx = 0;
      player.vy = 0;
      player.aimX = spawn.x;
      player.aimY = spawn.y;
      player.cast = null;
      player.invulnTimer = 0;
      player.stunTimer = 0;
      player.hitFlash = 0;
      player.comboStep = 0;
      player.comboResetTimer = 0;
      player.m1Timer = 0;
      player.dodgeCooldown = 0;
      player.respawnTimer = 0;
      Object.keys(player.cooldowns).forEach((key) => {
        player.cooldowns[key] = 0;
      });
      player.animState = "idle";
      player.statePriority = 8;
      player.skillLock = false;
      player.pendingUpgrades = null;
      player.pendingUpgradeExpiresAt = 0;
      player.input.up = false;
      player.input.down = false;
      player.input.left = false;
      player.input.right = false;
      player.input.m1 = false;
      player.input.q = false;
      player.input.e = false;
      player.input.r = false;
      player.input.space = false;
      player.input.f = false;
      player.input.dodge = false;
      player.input.aimX = spawn.x;
      player.input.aimY = spawn.y;
      player.input.seq = 0;
      player.prevInput.m1 = false;
      player.prevInput.q = false;
      player.prevInput.e = false;
      player.prevInput.r = false;
      player.prevInput.space = false;
      player.prevInput.f = false;
      player.prevInput.dodge = false;
      player.lastProcessedInputSeq = 0;
      player._eventQueue = [];
      player.level = 1;
      player.xp = 0;
      player.xpToNext = 100;
      player.survivalXpTimer = 0;
      player.kills = 0;
      player.deaths = 0;
      player.appliedUpgrades = {};
      player.modifiers = {
        damageMul: 1,
        speedMul: 1,
        cooldownMul: 1,
        m1DamageMul: 1,
        energyRegenMul: 1,
        sustainOnKill: 0,
        blueRadiusMul: 1,
        bluePullMul: 1,
        blueDurationMul: 1,
        blueTickDamageMul: 1,
        redKnockbackMul: 1,
        redExplosionMul: 1,
        redDamageMul: 1,
        purpleWidthMul: 1,
        purpleLengthMul: 1,
        purpleDamageMul: 1,
        teleportCooldownMul: 1,
        teleportRecoveryMul: 1,
        teleportDistanceMul: 1,
        domainDrainMul: 1,
        domainRadiusMul: 1,
        domainSlowMul: 1,
        domainDurationMul: 1,
        domainPowerMul: 1,
      };
    });
    this.startedAt = Date.now();
    this._gameOver = false;
    this.broadcastEvent({ type: "matchReset" });
  }

  broadcastEvent(event) {
    this.players.forEach((player) => {
      if (!player._eventQueue) player._eventQueue = [];
      player._eventQueue.push(event);
    });
  }

  cleanupDisconnected() {
    this.players.forEach((player) => {
      if (!player.offline) {
        return;
      }
      if (this.now - player.disconnectedAt > this.config.net.reconnectGraceMs) {
        this.removePlayer(player.id);
      }
    });
  }

  updatePlayers(dt) {
    const skillLockedAtTickStart = this.domainSystem.isSkillLocked();

    this.players.forEach((player) => {
      player.hitFlash = Math.max(0, player.hitFlash - dt);
      player.invulnTimer = Math.max(0, player.invulnTimer - dt);
      player.stunTimer = Math.max(0, player.stunTimer - dt);
      player.comboResetTimer = Math.max(0, player.comboResetTimer - dt);
      player.m1Timer = Math.max(0, player.m1Timer - dt);

      if (!player.alive) {
        player.respawnTimer = -1;
        return;
      }

      player.energy = Math.min(
        player.maxEnergy,
        player.energy + player.energyRegen * player.modifiers.energyRegenMul * dt
      );

      Object.keys(player.cooldowns).forEach((key) => {
        player.cooldowns[key] = Math.max(0, player.cooldowns[key] - dt);
      });
      player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt);

      this.resolveCasting(player, dt);
      this.resolveInput(player, dt, skillLockedAtTickStart);

      if (player.comboResetTimer <= 0) {
        player.comboStep = 0;
      }

      this.updateAnimationState(player);

      const rika = this.rikas.get(player.id);
      if (rika) {
        rika.x = player.x;
        rika.y = player.y;
      }
    });
  }

  respawnPlayer(player) {
    const spawn = this.getSpawnPoint();
    player.alive = true;
    player.hp = player.maxHp;
    player.energy = player.maxEnergy;
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.invulnTimer = 0.7;
    player.respawnTimer = 0;
    this.emitEventToPlayer(player.id, {
      type: "respawn",
      x: player.x,
      y: player.y,
    });
  }

  resolveCasting(player, dt) {
    if (!player.cast) {
      return;
    }
    player.cast.timer -= dt;
    if (player.cast.timer > 0) {
      return;
    }

    const cast = player.cast;
    player.cast = null;

    if (cast.type === "blue") {
      this.fireBlue(player, cast);
    } else if (cast.type === "red") {
      this.fireRed(player, cast);
    } else if (cast.type === "purple") {
      this.firePurple(player, cast);
    } else if (cast.type === "teleport") {
      this.fireTeleport(player, cast);
    } else if (cast.type === "domain") {
      this.fireDomain(player);
    } else if (cast.type === "rika") {
      this.fireRika(player, cast);
    } else if (cast.type === "dashSlash") {
      this.fireDashSlash(player, cast);
    } else if (cast.type === "fullRika") {
      this.fireFullRika(player);
    } else if (cast.type === "pureLove") {
      this.firePureLove(player);
    }
  }

  resolveInput(player, dt, skillLockedAtTickStart) {
    if (player.stunTimer > 0) {
      player.vx *= 0.8;
      player.vy *= 0.8;
      this.moveEntityWithCollisions(player, player.vx * dt, player.vy * dt);
      return;
    }

    const input = player.input;
    player.aimX = input.aimX;
    player.aimY = input.aimY;

    const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const moveNorm = normalize(moveX, moveY);
    const isDomainCasting = player.cast && player.cast.type === "domain";
    const isCharging = player.cast && (player.cast.type === "purple" || player.cast.type === "pureLove");
    const castSlow = isCharging ? 0.72 : isDomainCasting ? 0 : 1;
    const domainSlow = this.domainSystem.getPlayerSlowFactor(player);
    const moveSpeed = player.moveSpeed * player.modifiers.speedMul * castSlow * domainSlow;
    player.vx = moveNorm.x * moveSpeed;
    player.vy = moveNorm.y * moveSpeed;

    if (!isDomainCasting) {
      const dodgePressed = input.dodge && !player.prevInput.dodge;
      if (dodgePressed) {
        this.tryDodge(player, moveNorm);
      }

      const m1Held = input.m1;
      if (m1Held) {
        this.tryM1(player);
      }
    }

    const qPressed = input.q && !player.prevInput.q;
    const ePressed = input.e && !player.prevInput.e;
    const rPressed = input.r && !player.prevInput.r;
    const spacePressed = input.space && !player.prevInput.space;
    const fPressed = input.f && !player.prevInput.f;

    if (!player.cast && !skillLockedAtTickStart) {
      const chara = player.character || "gojo";
      if (chara === "yuta") {
        if (qPressed) this.tryCastRika(player);
        if (ePressed) this.tryCastDashSlash(player);
        if (rPressed) this.tryCastFullRika(player);
        if (spacePressed) this.tryCastDomain(player);
        if (fPressed) this.tryCastPureLove(player);
      } else {
        if (qPressed) this.tryCastBlue(player);
        if (ePressed) this.tryCastRed(player);
        if (rPressed) this.tryCastPurple(player);
        if (spacePressed) this.tryCastTeleport(player);
        if (fPressed) this.tryCastDomain(player);
      }
    }

    this.moveEntityWithCollisions(player, player.vx * dt, player.vy * dt);

    player.prevInput.m1 = input.m1;
    player.prevInput.q = input.q;
    player.prevInput.e = input.e;
    player.prevInput.r = input.r;
    player.prevInput.space = input.space;
    player.prevInput.f = input.f;
    player.prevInput.dodge = input.dodge;
    player.lastProcessedInputSeq = input.seq;
  }

  updateAnimationState(player) {
    if (!player.alive) {
      player.animState = "death";
      player.statePriority = 1;
      return;
    }

    if (this.domainSystem.domains.has(player.id)) {
      player.animState = "domain";
      player.statePriority = 2;
      return;
    }

    if (player.cast && player.cast.type === "pureLove") {
      player.animState = "skill3";
      player.statePriority = 3;
      return;
    }
    if (player.cast && player.cast.type === "purple") {
      player.animState = "skill3";
      player.statePriority = 3;
      return;
    }
    if (player.cast && player.cast.type === "fullRika") {
      player.animState = "skill2";
      player.statePriority = 4;
      return;
    }
    if (player.cast && player.cast.type === "red") {
      player.animState = "skill2";
      player.statePriority = 4;
      return;
    }
    if (player.cast && player.cast.type === "rika") {
      player.animState = "skill1";
      player.statePriority = 5;
      return;
    }
    if (player.cast && player.cast.type === "blue") {
      player.animState = "skill1";
      player.statePriority = 5;
      return;
    }
    if (player.cast && player.cast.type === "dashSlash") {
      player.animState = "teleport";
      player.statePriority = 6;
      return;
    }
    if (player.cast && player.cast.type === "teleport") {
      player.animState = "teleport";
      player.statePriority = 6;
      return;
    }
    if (player.m1Timer > 0) {
      player.animState = "m1";
      player.statePriority = 7;
      return;
    }
    if (Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1) {
      player.animState = "run";
      player.statePriority = 8;
    } else {
      player.animState = "idle";
      player.statePriority = 8;
    }
  }

  tryDodge(player, moveNorm) {
    if (player.dodgeCooldown > 0) {
      return false;
    }

    let dirX = moveNorm.x;
    let dirY = moveNorm.y;
    if (Math.abs(dirX) < 0.001 && Math.abs(dirY) < 0.001) {
      const aim = normalize(player.aimX - player.x, player.aimY - player.y);
      dirX = aim.x;
      dirY = aim.y;
    }
    if (Math.abs(dirX) < 0.001 && Math.abs(dirY) < 0.001) {
      dirX = 1;
      dirY = 0;
    }

    player.dodgeCooldown = player.dodgeCooldownBase;
    player.invulnTimer = Math.max(player.invulnTimer, 0.18);
    this.moveEntityWithCollisions(player, dirX * player.dodgeDistance, dirY * player.dodgeDistance, true);

    this.emitEventNear(player.x, player.y, {
      type: "dodge",
      x: player.x,
      y: player.y,
      playerId: player.id,
      dirX,
      dirY,
    });
    return true;
  }

  tryM1(player) {
    if (player.m1Timer > 0 || !player.alive) {
      return false;
    }
    const kit = this.getKit(player);

    player.m1Timer = kit.m1.cooldown;
    player.comboStep = (player.comboStep % 3) + 1;
    player.comboResetTimer = 0.9;

    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    this.players.forEach((target) => {
      if (target.id === player.id || !target.alive) {
        return;
      }
      if (!this.config.match.friendlyFire && target.kind === "player") {
        return;
      }
      const toTarget = normalize(target.x - player.x, target.y - player.y);
      const inRange = distance(player.x, player.y, target.x, target.y) <= kit.m1.range + target.radius;
      const facing = dot(aim.x, aim.y, toTarget.x, toTarget.y) > 0.2;
      if (inRange && facing) {
        this.combat.applyDamage({
          target,
          source: player,
          amount: kit.m1.damage * player.modifiers.m1DamageMul,
          kind: "m1",
          knockback: player.comboStep === 3 ? 180 : 85,
          fromX: player.x,
          fromY: player.y,
        });
      }
    });

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      const toTarget = normalize(enemy.x - player.x, enemy.y - player.y);
      const inRange = distance(player.x, player.y, enemy.x, enemy.y) <= kit.m1.range + enemy.radius;
      const facing = dot(aim.x, aim.y, toTarget.x, toTarget.y) > 0.2;
      if (inRange && facing) {
        this.combat.applyDamage({
          target: enemy,
          source: player,
          amount: kit.m1.damage * player.modifiers.m1DamageMul,
          kind: "m1",
          knockback: player.comboStep === 3 ? 150 : 80,
          fromX: player.x,
          fromY: player.y,
        });
      }
    });

    this.emitEventNear(player.x, player.y, {
      type: "m1",
      x: player.x,
      y: player.y,
      dirX: aim.x,
      dirY: aim.y,
      combo: player.comboStep,
      playerId: player.id,
    });
    return true;
  }

  canUseSkill(player, energyCost, cooldownKey, baseCooldown) {
    if (!player.alive) {
      return false;
    }
    if (this.domainSystem.isSkillLocked()) {
      return false;
    }
    if (player.cooldowns[cooldownKey] > 0) {
      return false;
    }
    if (player.energy < energyCost) {
      return false;
    }
    player.energy -= energyCost;
    player.cooldowns[cooldownKey] = baseCooldown * player.modifiers.cooldownMul;
    return true;
  }

  tryCastBlue(player) {
    if (!this.canUseSkill(player, GOJO.blue.energy, "q", GOJO.blue.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "blue",
      timer: GOJO.blue.startup,
      dirX: aim.x,
      dirY: aim.y,
    };
    return true;
  }

  fireBlue(player, cast) {
    const p = createProjectile({
      id: `pr${this.nextProjectileId++}`,
      type: "blue",
      ownerId: player.id,
      ownerKind: "player",
      x: player.x + cast.dirX * 28,
      y: player.y + cast.dirY * 28,
      vx: cast.dirX,
      vy: cast.dirY,
      speed: GOJO.blue.speed,
      radius: GOJO.blue.radius,
      lifetime: GOJO.blue.lifetime * player.modifiers.blueDurationMul,
      damage: GOJO.blue.tickDamage * player.modifiers.blueTickDamageMul,
      tickRate: GOJO.blue.tickRate,
      pullRadius: GOJO.blue.pullRadius * player.modifiers.blueRadiusMul,
      pullStrength: GOJO.blue.pullStrength * player.modifiers.bluePullMul,
      color: "#4cb4ff",
      persistent: true,
    });
    this.projectiles.set(p.id, p);
    this.emitEventNear(player.x, player.y, {
      type: "skillBlue",
      x: p.x,
      y: p.y,
      ownerId: player.id,
    });
  }

  tryCastRed(player) {
    if (!this.canUseSkill(player, GOJO.red.energy, "e", GOJO.red.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "red",
      timer: GOJO.red.startup,
      dirX: aim.x,
      dirY: aim.y,
    };
    return true;
  }

  fireRed(player, cast) {
    const projectile = createProjectile({
      id: `pr${this.nextProjectileId++}`,
      type: "red",
      ownerId: player.id,
      ownerKind: "player",
      x: player.x + cast.dirX * 30,
      y: player.y + cast.dirY * 30,
      vx: cast.dirX,
      vy: cast.dirY,
      speed: GOJO.red.speed,
      radius: GOJO.red.radius,
      lifetime: GOJO.red.lifetime,
      damage: GOJO.red.damage * player.modifiers.redDamageMul,
      knockback: GOJO.red.knockback * player.modifiers.redKnockbackMul,
      color: "#ff4d6d",
      meta: {
        explosionRadius: GOJO.red.explosionRadius * player.modifiers.redExplosionMul,
      },
    });
    this.projectiles.set(projectile.id, projectile);
    this.emitEventNear(player.x, player.y, {
      type: "skillRed",
      x: projectile.x,
      y: projectile.y,
      ownerId: player.id,
    });
  }

  tryCastPurple(player) {
    if (!this.canUseSkill(player, GOJO.purple.energy, "r", GOJO.purple.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "purple",
      timer: GOJO.purple.charge,
      dirX: aim.x,
      dirY: aim.y,
    };
    this.emitEventNear(player.x, player.y, {
      type: "purpleCharge",
      x: player.x,
      y: player.y,
      ownerId: player.id,
      delay: GOJO.purple.charge,
    });
    return true;
  }

  firePurple(player, cast) {
    const beam = createProjectile({
      id: `pr${this.nextProjectileId++}`,
      type: "purple",
      ownerId: player.id,
      ownerKind: "player",
      x: player.x,
      y: player.y,
      vx: cast.dirX,
      vy: cast.dirY,
      speed: GOJO.purple.speed,
      radius: 0,
      lifetime: GOJO.purple.length / GOJO.purple.speed + 0.08,
      damage: GOJO.purple.damage * player.modifiers.purpleDamageMul,
      penetration: true,
      width: GOJO.purple.width * player.modifiers.purpleWidthMul,
      length: GOJO.purple.length * player.modifiers.purpleLengthMul,
      color: "#9b5cff",
      meta: {
        startX: player.x,
        startY: player.y,
      },
    });
    this.projectiles.set(beam.id, beam);
    this.emitEventNear(player.x, player.y, {
      type: "skillPurple",
      x: player.x,
      y: player.y,
      ownerId: player.id,
      dirX: cast.dirX,
      dirY: cast.dirY,
      width: beam.width,
      length: beam.length,
    });
  }

  tryCastTeleport(player) {
    const cooldown = GOJO.teleport.cooldown * player.modifiers.teleportCooldownMul;
    if (!this.canUseSkill(player, GOJO.teleport.energy, "space", cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "teleport",
      timer: GOJO.teleport.startup,
      dirX: aim.x,
      dirY: aim.y,
    };
    return true;
  }

  fireTeleport(player, cast) {
    const distanceValue = GOJO.teleport.distance * player.modifiers.teleportDistanceMul;
    const desiredX = player.x + cast.dirX * distanceValue;
    const desiredY = player.y + cast.dirY * distanceValue;
    const dest = this.findTeleportDestination(player, desiredX, desiredY);

    this.emitEventNear(player.x, player.y, {
      type: "teleportStart",
      x: player.x,
      y: player.y,
      ownerId: player.id,
    });

    player.x = dest.x;
    player.y = dest.y;
    player.stunTimer = Math.max(
      player.stunTimer,
      GOJO.teleport.recovery * player.modifiers.teleportRecoveryMul
    );

    this.emitEventNear(player.x, player.y, {
      type: "teleportEnd",
      x: player.x,
      y: player.y,
      ownerId: player.id,
    });
  }

  findTeleportDestination(player, desiredX, desiredY) {
    const samples = 24;
    let best = { x: player.x, y: player.y };
    for (let i = 1; i <= samples; i += 1) {
      const t = i / samples;
      const x = player.x + (desiredX - player.x) * t;
      const y = player.y + (desiredY - player.y) * t;
      const candidate = {
        x: clamp(x, player.radius, this.map.width - player.radius),
        y: clamp(y, player.radius, this.map.height - player.radius),
      };
      if (
        !this.isCollidingAnyObstacle(candidate.x, candidate.y, player.radius) &&
        !this.isBlockedByDomainWalls(player, player.x, player.y, candidate.x, candidate.y)
      ) {
        best = candidate;
      } else {
        break;
      }
    }
    return best;
  }

  tryCastDomain(player) {
    if (!player.alive) {
      return false;
    }
    const kit = this.getKit(player);
    const cooldownKey = player.character === "yuta" ? "space" : "f";
    if (player.cooldowns[cooldownKey] > 0) {
      return false;
    }
    if (player.energy < kit.domain.energyInitial) {
      return false;
    }

    player.energy -= kit.domain.energyInitial;
    player.cooldowns[cooldownKey] = kit.domain.cooldown * player.modifiers.cooldownMul;
    player.cast = {
      type: "domain",
      timer: kit.domain.startup,
    };
    return true;
  }

  fireDomain(player) {
    this.domainSystem.activateDomain(player);
  }

  spawnEnemyProjectile(data) {
    const projectile = createProjectile({
      id: `pr${this.nextProjectileId++}`,
      type: data.type,
      ownerId: data.ownerId || "enemy",
      ownerKind: "enemy",
      x: data.x,
      y: data.y,
      vx: data.dirX,
      vy: data.dirY,
      speed: data.speed,
      radius: data.radius,
      lifetime: data.lifetime,
      damage: data.damage,
      knockback: data.knockback || 120,
      color: "#ffae62",
    });
    this.projectiles.set(projectile.id, projectile);
  }

  updateProjectiles(dt) {
    this.projectiles.forEach((projectile) => {
      projectile.age += dt;
      projectile.prevX = projectile.x;
      projectile.prevY = projectile.y;

      if (projectile.age >= projectile.lifetime) {
        if (projectile.type === "red") {
          this.emitEventNear(projectile.x, projectile.y, {
            type: "redExplosion",
            x: projectile.x,
            y: projectile.y,
            radius: projectile.meta ? projectile.meta.explosionRadius : GOJO.red.explosionRadius,
          });
        }
        this.projectiles.delete(projectile.id);
        return;
      }

      if (projectile.type === "blue") {
        this.updateBlueProjectile(projectile, dt);
        return;
      }

      if (projectile.type === "purple") {
        this.updatePurpleProjectile(projectile, dt);
        return;
      }

      this.updateLinearProjectile(projectile, dt);
    });
  }

  updateBlueProjectile(projectile, dt) {
    const owner = this.players.get(projectile.ownerId);
    if (owner && owner.alive) {
      const dx = owner.aimX - projectile.x;
      const dy = owner.aimY - projectile.y;
      const targetDir = normalize(dx, dy);
      if (targetDir.len > 0.0001) {
        const dotVal = projectile.vx * targetDir.x + projectile.vy * targetDir.y;
        const angle = Math.acos(clamp(dotVal, -1, 1));
        const turnRate = 1.2;
        const turnAngle = Math.min(angle, turnRate * dt);
        const cross = projectile.vx * targetDir.y - projectile.vy * targetDir.x;
        const sign = cross >= 0 ? 1 : -1;
        const cos = Math.cos(turnAngle);
        const sin = Math.sin(turnAngle) * sign;
        const newVx = projectile.vx * cos - projectile.vy * sin;
        const newVy = projectile.vx * sin + projectile.vy * cos;
        projectile.vx = newVx;
        projectile.vy = newVy;
      }
    }

    const baseSpeed = projectile.speed;
    const passiveFactor = this.getPassiveProjectileFactor(projectile);
    const domainFactor = this.domainSystem.getProjectileSlow(projectile);
    const speed = baseSpeed * passiveFactor * domainFactor;

    projectile.x += projectile.vx * speed * dt;
    projectile.y += projectile.vy * speed * dt;

    if (this.isCollidingAnyObstacle(projectile.x, projectile.y, projectile.radius)) {
      this.projectiles.delete(projectile.id);
      return;
    }

    projectile.tickTimer += dt;
    while (projectile.tickTimer >= projectile.tickRate) {
      projectile.tickTimer -= projectile.tickRate;
      this.applyBluePulse(projectile);
    }
  }

  applyBluePulse(projectile) {
    const owner = this.players.get(projectile.ownerId);
    const targets = [];

    this.players.forEach((player) => {
      if (!player.alive || player.id === projectile.ownerId) {
        return;
      }
      const d = distance(player.x, player.y, projectile.x, projectile.y);
      if (d <= projectile.pullRadius + player.radius) {
        targets.push(player);
      }
    });

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      const d = distance(enemy.x, enemy.y, projectile.x, projectile.y);
      if (d <= projectile.pullRadius + enemy.radius) {
        targets.push(enemy);
      }
    });

    targets.forEach((target) => {
      const dir = normalize(projectile.x - target.x, projectile.y - target.y);
      const pullDistance = projectile.pullStrength * 0.085;
      this.moveEntityWithCollisions(target, dir.x * pullDistance, dir.y * pullDistance, true);
      target.vx += dir.x * projectile.pullStrength * 0.22;
      target.vy += dir.y * projectile.pullStrength * 0.22;
      this.combat.applyDamage({
        target,
        source: owner || null,
        amount: projectile.damage,
        kind: "blueTick",
        fromX: projectile.x,
        fromY: projectile.y,
      });
    });
  }

  updatePurpleProjectile(projectile, dt) {
    const baseSpeed = projectile.speed;
    const passiveFactor = this.getPassiveProjectileFactor(projectile);
    const domainFactor = this.domainSystem.getProjectileSlow(projectile);
    const speed = baseSpeed * passiveFactor * domainFactor;

    const prevTravel = projectile.traveled;
    projectile.traveled = Math.min(projectile.length, projectile.traveled + speed * dt);

    const startX = projectile.meta.startX;
    const startY = projectile.meta.startY;
    const fromX = startX + projectile.vx * prevTravel;
    const fromY = startY + projectile.vy * prevTravel;
    const toX = startX + projectile.vx * projectile.traveled;
    const toY = startY + projectile.vy * projectile.traveled;

    projectile.x = toX;
    projectile.y = toY;

    this.players.forEach((target) => {
      if (!target.alive || target.id === projectile.ownerId) {
        return;
      }
      if (projectile.hitTargets.has(target.id)) {
        return;
      }
      const distToSegment = distancePointToSegment(target.x, target.y, fromX, fromY, toX, toY);
      if (distToSegment <= projectile.width * 0.5 + target.radius) {
        projectile.hitTargets.add(target.id);
        const owner = this.players.get(projectile.ownerId);
        this.combat.applyDamage({
          target,
          source: owner,
          amount: projectile.damage,
          kind: "purpleBeam",
          knockback: 280,
          fromX,
          fromY,
        });
      }
    });

    this.enemies.forEach((target) => {
      if (!target.alive) {
        return;
      }
      if (projectile.hitTargets.has(target.id)) {
        return;
      }
      const distToSegment = distancePointToSegment(target.x, target.y, fromX, fromY, toX, toY);
      if (distToSegment <= projectile.width * 0.5 + target.radius) {
        projectile.hitTargets.add(target.id);
        const owner = this.players.get(projectile.ownerId);
        this.combat.applyDamage({
          target,
          source: owner,
          amount: projectile.damage,
          kind: "purpleBeam",
          knockback: 200,
          fromX,
          fromY,
        });
      }
    });

    if (projectile.traveled >= projectile.length) {
      this.projectiles.delete(projectile.id);
    }
  }

  updateLinearProjectile(projectile, dt) {
    const baseSpeed = projectile.speed;
    const passiveFactor = this.getPassiveProjectileFactor(projectile);
    const domainFactor = this.domainSystem.getProjectileSlow(projectile);
    const speed = baseSpeed * passiveFactor * domainFactor;

    projectile.x += projectile.vx * speed * dt;
    projectile.y += projectile.vy * speed * dt;

    if (
      projectile.x < -40 ||
      projectile.y < -40 ||
      projectile.x > this.map.width + 40 ||
      projectile.y > this.map.height + 40
    ) {
      this.projectiles.delete(projectile.id);
      return;
    }

    if (this.isCollidingAnyObstacle(projectile.x, projectile.y, projectile.radius)) {
      if (projectile.type === "red") {
        this.explodeRed(projectile);
      }
      this.projectiles.delete(projectile.id);
      return;
    }

    if (projectile.type === "red" && this.checkBlueRedReaction(projectile)) {
      this.projectiles.delete(projectile.id);
      return;
    }

    if (projectile.ownerKind === "player") {
      if (this.hitPlayersWithProjectile(projectile, this.config.match.friendlyFire)) {
        if (projectile.type === "red") {
          this.explodeRed(projectile);
        }
        this.projectiles.delete(projectile.id);
        return;
      }
      if (this.hitEnemiesWithProjectile(projectile, true)) {
        if (projectile.type === "red") {
          this.explodeRed(projectile);
        }
        this.projectiles.delete(projectile.id);
      }
    } else {
      if (this.hitPlayersWithProjectile(projectile, false)) {
        this.projectiles.delete(projectile.id);
      }
    }
  }

  checkBlueRedReaction(redProjectile) {
    let reaction = null;
    this.projectiles.forEach((candidate) => {
      if (reaction || candidate.type !== "blue") {
        return;
      }
      const d = distance(redProjectile.x, redProjectile.y, candidate.x, candidate.y);
      if (d <= redProjectile.radius + candidate.radius) {
        reaction = candidate;
      }
    });

    if (!reaction) {
      return false;
    }

    this.projectiles.delete(reaction.id);
    this.queueDelayedAction(GOJO.collapse.delay, () => {
      this.spawnSpatialCollapse(reaction.x, reaction.y, redProjectile.ownerId);
    });
    this.emitEventAll({
      type: "blueRedReaction",
      x: reaction.x,
      y: reaction.y,
      ownerId: redProjectile.ownerId,
      delay: GOJO.collapse.delay,
    });
    return true;
  }

  spawnSpatialCollapse(x, y, ownerId) {
    const owner = this.players.get(ownerId) || null;
    this.players.forEach((player) => {
      if (!player.alive || player.id === ownerId) {
        return;
      }
      const d = distance(player.x, player.y, x, y);
      if (d <= GOJO.collapse.radius + player.radius) {
        const distRatio = Math.max(0, d - player.radius) / GOJO.collapse.radius;
        const falloff = Math.max(150 / 700, 1 - distRatio);
        const amount = Math.round(GOJO.collapse.damage * falloff);
        this.combat.applyDamage({
          target: player,
          source: owner,
          amount,
          kind: "spatialCollapse",
          knockback: GOJO.collapse.knockback,
          fromX: x,
          fromY: y,
        });
      }
    });

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      const d = distance(enemy.x, enemy.y, x, y);
      if (d <= GOJO.collapse.radius + enemy.radius) {
        const distRatio = Math.max(0, d - enemy.radius) / GOJO.collapse.radius;
        const falloff = Math.max(150 / 700, 1 - distRatio);
        const amount = Math.round(GOJO.collapse.damage * falloff);
        this.combat.applyDamage({
          target: enemy,
          source: owner,
          amount,
          kind: "spatialCollapse",
          knockback: GOJO.collapse.knockback * 0.8,
          fromX: x,
          fromY: y,
        });
      }
    });

    this.emitEventAll({
      type: "spatialCollapse",
      x,
      y,
      radius: GOJO.collapse.radius,
    });
  }

  explodeRed(projectile) {
    const owner = this.players.get(projectile.ownerId) || null;
    const radius = projectile.meta.explosionRadius || GOJO.red.explosionRadius;
    this.players.forEach((target) => {
      if (!target.alive || target.id === projectile.ownerId) {
        return;
      }
      const d = distance(target.x, target.y, projectile.x, projectile.y);
      if (d <= radius + target.radius) {
        this.combat.applyDamage({
          target,
          source: owner,
          amount: projectile.damage,
          kind: "redExplosion",
          knockback: projectile.knockback,
          fromX: projectile.x,
          fromY: projectile.y,
        });
      }
    });

    this.enemies.forEach((target) => {
      if (!target.alive) {
        return;
      }
      const d = distance(target.x, target.y, projectile.x, projectile.y);
      if (d <= radius + target.radius) {
        this.combat.applyDamage({
          target,
          source: owner,
          amount: projectile.damage,
          kind: "redExplosion",
          knockback: projectile.knockback * 1.1,
          fromX: projectile.x,
          fromY: projectile.y,
        });
      }
    });

    this.emitEventNear(projectile.x, projectile.y, {
      type: "redExplosion",
      x: projectile.x,
      y: projectile.y,
      radius,
    });
  }

  hitPlayersWithProjectile(projectile, allowFriendlyFire) {
    let hit = false;
    const owner = this.players.get(projectile.ownerId) || null;
    this.players.forEach((player) => {
      if (hit || !player.alive || player.id === projectile.ownerId) {
        return;
      }
      if (!allowFriendlyFire && projectile.ownerKind === "player") {
        return;
      }
      const d = distance(player.x, player.y, projectile.x, projectile.y);
      if (d <= projectile.radius + player.radius) {
        this.combat.applyDamage({
          target: player,
          source: owner,
          amount: projectile.damage,
          kind: projectile.type,
          knockback: projectile.knockback,
          fromX: projectile.x,
          fromY: projectile.y,
        });
        hit = true;
      }
    });
    return hit;
  }

  hitEnemiesWithProjectile(projectile) {
    let hit = false;
    const owner = this.players.get(projectile.ownerId) || null;
    this.enemies.forEach((enemy) => {
      if (hit || !enemy.alive) {
        return;
      }
      const d = distance(enemy.x, enemy.y, projectile.x, projectile.y);
      if (d <= projectile.radius + enemy.radius) {
        this.combat.applyDamage({
          target: enemy,
          source: owner,
          amount: projectile.damage,
          kind: projectile.type,
          knockback: projectile.knockback,
          fromX: projectile.x,
          fromY: projectile.y,
        });
        hit = true;
      }
    });
    return hit;
  }

  applyHazards(dt) {
    this.players.forEach((player) => {
      if (!player.alive) {
        return;
      }
      for (let i = 0; i < this.map.hazards.length; i += 1) {
        const hazard = this.map.hazards[i];
        if (distance(player.x, player.y, hazard.x, hazard.y) <= hazard.radius + player.radius) {
          this.combat.applyDamage({
            target: player,
            source: null,
            amount: hazard.dps * dt,
            kind: "hazard",
            fromX: hazard.x,
            fromY: hazard.y,
          });
        }
      }
    });
  }

  updateDelayedActions() {
    if (this.delayedActions.length === 0) {
      return;
    }
    const pending = [];
    for (let i = 0; i < this.delayedActions.length; i += 1) {
      const action = this.delayedActions[i];
      if (this.now >= action.executeAt) {
        action.action();
      } else {
        pending.push(action);
      }
    }
    this.delayedActions = pending;
  }

  getEnemySlowFactor(enemy) {
    let factor = this.domainSystem.getEnemySlowAt(enemy.x, enemy.y, enemy.id);

    this.players.forEach((player) => {
      if (!player.alive) {
        return;
      }
      const d = distance(player.x, player.y, enemy.x, enemy.y);
      if (d <= GOJO.passive.radius + enemy.radius) {
        factor *= 1 - GOJO.passive.dashSlow;
      }
    });
    return clamp(factor, 0.2, 1);
  }

  getPassiveProjectileFactor(projectile) {
    let factor = 1;
    this.players.forEach((player) => {
      if (!player.alive || player.id === projectile.ownerId) {
        return;
      }
      const d = distance(player.x, player.y, projectile.x, projectile.y);
      if (d <= GOJO.passive.radius) {
        factor *= 1 - GOJO.passive.projectileSlow;
      }
    });
    return clamp(factor, 0.2, 1);
  }

  getKit(player) {
    return CHARACTER_REGISTRY[player.character] || GOJO;
  }

  updateRikas(dt) {
    this.rikas.forEach((rika, ownerId) => {
      rika.timer -= dt;
      if (rika.timer <= 0) {
        this.rikas.delete(ownerId);
        const owner = this.players.get(ownerId);
        if (owner) {
          owner.animState = "idle";
        }
        return;
      }

      rika.attackTimer -= dt;
      if (rika.attackTimer <= 0) {
        rika.attackTimer = YUTA.fullRika.attackInterval;
        const owner = this.players.get(ownerId);
        if (!owner || !owner.alive) {
          return;
        }
        const attackType = Math.random() < 0.4 ? "slam" : Math.random() < 0.6 ? "grab" : "swipe";
        const damage = attackType === "slam" ? YUTA.fullRika.slamDamage
          : attackType === "grab" ? YUTA.fullRika.grabDamage
          : YUTA.fullRika.swipeDamage;
        const knockback = attackType === "slam" ? YUTA.fullRika.slamKnockback
          : attackType === "grab" ? YUTA.fullRika.grabThrow
          : YUTA.fullRika.swipeKnockback;

        this.enemies.forEach((enemy) => {
          if (!enemy.alive) return;
          const d = distance(rika.x, rika.y, enemy.x, enemy.y);
          if (d <= YUTA.fullRika.range + enemy.radius) {
            this.combat.applyDamage({
              target: enemy,
              source: owner,
              amount: damage,
              kind: "rika",
              knockback,
              fromX: rika.x,
              fromY: rika.y,
            });
          }
        });

        this.players.forEach((target) => {
          if (!target.alive || target.id === ownerId) return;
          if (!this.config.match.friendlyFire) return;
          const d = distance(rika.x, rika.y, target.x, target.y);
          if (d <= YUTA.fullRika.range + target.radius) {
            this.combat.applyDamage({
              target,
              source: owner,
              amount: damage,
              kind: "rika",
              knockback,
              fromX: rika.x,
              fromY: rika.y,
            });
          }
        });

        this.emitEventNear(rika.x, rika.y, {
          type: "rikaAttack",
          x: rika.x,
          y: rika.y,
          ownerId,
          attackType,
        });
      }
    });
  }

  tryCastRika(player) {
    const kit = this.getKit(player);
    if (!this.canUseSkill(player, kit.rika.energy, "q", kit.rika.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "rika",
      timer: kit.rika.startup,
      dirX: aim.x,
      dirY: aim.y,
    };
    return true;
  }

  fireRika(player, cast) {
    const kit = this.getKit(player);
    const aim = normalize(cast.dirX, cast.dirY);

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const toTarget = normalize(enemy.x - player.x, enemy.y - player.y);
      const dotForward = aim.x * toTarget.x + aim.y * toTarget.y;
      if (dotForward < Math.cos(kit.rika.coneAngle * 0.5)) return;
      const d = distance(player.x, player.y, enemy.x, enemy.y);
      if (d <= kit.rika.range + enemy.radius) {
        this.combat.applyDamage({
          target: enemy,
          source: player,
          amount: kit.rika.damage,
          kind: "rika",
          knockback: kit.rika.knockback,
          fromX: player.x,
          fromY: player.y,
        });
      }
    });

    this.players.forEach((target) => {
      if (target.id === player.id || !target.alive) return;
      if (!this.config.match.friendlyFire) return;
      const toTarget = normalize(target.x - player.x, target.y - player.y);
      const dotForward = aim.x * toTarget.x + aim.y * toTarget.y;
      if (dotForward < Math.cos(kit.rika.coneAngle * 0.5)) return;
      const d = distance(player.x, player.y, target.x, target.y);
      if (d <= kit.rika.range + target.radius) {
        this.combat.applyDamage({
          target,
          source: player,
          amount: kit.rika.damage,
          kind: "rika",
          knockback: kit.rika.knockback,
          fromX: player.x,
          fromY: player.y,
        });
      }
    });

    this.emitEventNear(player.x, player.y, {
      type: "rika",
      x: player.x,
      y: player.y,
      dirX: aim.x,
      dirY: aim.y,
      playerId: player.id,
    });
  }

  tryCastDashSlash(player) {
    const kit = this.getKit(player);
    if (!this.canUseSkill(player, kit.dashSlash.energy, "e", kit.dashSlash.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    if (Math.abs(aim.x) < 0.001 && Math.abs(aim.y) < 0.001) {
      aim.x = 1;
    }
    player.cast = {
      type: "dashSlash",
      timer: kit.dashSlash.startup,
      dirX: aim.x,
      dirY: aim.y,
    };
    return true;
  }

  fireDashSlash(player, cast) {
    const kit = this.getKit(player);
    const dirX = cast.dirX;
    const dirY = cast.dirY;
    const dist = kit.dashSlash.distance;
    const destX = player.x + dirX * dist;
    const destY = player.y + dirY * dist;

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const toTarget = normalize(enemy.x - player.x, enemy.y - player.y);
      const dotForward = dirX * toTarget.x + dirY * toTarget.y;
      if (dotForward < 0.3) return;
      const d = distance(player.x, player.y, enemy.x, enemy.y);
      if (d <= kit.dashSlash.distance + enemy.radius) {
        this.combat.applyDamage({
          target: enemy,
          source: player,
          amount: kit.dashSlash.damage,
          kind: "dashSlash",
          knockback: 120,
          fromX: player.x,
          fromY: player.y,
        });
      }
    });

    this.players.forEach((target) => {
      if (target.id === player.id || !target.alive) return;
      if (!this.config.match.friendlyFire) return;
      const toTarget = normalize(target.x - player.x, target.y - player.y);
      const dotForward = dirX * toTarget.x + dirY * toTarget.y;
      if (dotForward < 0.3) return;
      const d = distance(player.x, player.y, target.x, target.y);
      if (d <= kit.dashSlash.distance + target.radius) {
        this.combat.applyDamage({
          target,
          source: player,
          amount: kit.dashSlash.damage,
          kind: "dashSlash",
          knockback: 120,
          fromX: player.x,
          fromY: player.y,
        });
      }
    });

    this.moveEntityWithCollisions(player, dirX * dist, dirY * dist, true);

    this.emitEventNear(player.x, player.y, {
      type: "dashSlash",
      x: player.x,
      y: player.y,
      playerId: player.id,
      dirX,
      dirY,
    });
  }

  tryCastFullRika(player) {
    const kit = this.getKit(player);
    if (player.character !== "yuta") return false;
    if (this.rikas.has(player.id)) return false;
    if (!this.canUseSkill(player, kit.fullRika.energy, "r", kit.fullRika.cooldown)) {
      return false;
    }
    player.cast = {
      type: "fullRika",
      timer: kit.fullRika.startup,
    };
    return true;
  }

  fireFullRika(player) {
    const kit = this.getKit(player);
    this.rikas.set(player.id, {
      x: player.x,
      y: player.y,
      ownerId: player.id,
      timer: kit.fullRika.duration,
      attackTimer: 0.5,
    });
    this.emitEventNear(player.x, player.y, {
      type: "fullRika",
      x: player.x,
      y: player.y,
      playerId: player.id,
      duration: kit.fullRika.duration,
    });
  }

  tryCastPureLove(player) {
    const kit = this.getKit(player);
    if (!this.canUseSkill(player, kit.pureLove.energy, "f", kit.pureLove.cooldown)) {
      return false;
    }
    player.cast = {
      type: "pureLove",
      timer: kit.pureLove.startup,
    };
    return true;
  }

  firePureLove(player) {
    const kit = this.getKit(player);

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const d = distance(player.x, player.y, enemy.x, enemy.y);
      if (d <= kit.pureLove.radius + enemy.radius) {
        const falloff = Math.max(0.3, 1 - (d - enemy.radius) / kit.pureLove.radius);
        this.combat.applyDamage({
          target: enemy,
          source: player,
          amount: Math.round(kit.pureLove.damage * falloff),
          kind: "pureLove",
          knockback: kit.pureLove.knockback * falloff,
          fromX: player.x,
          fromY: player.y,
        });
      }
    });

    this.players.forEach((target) => {
      if (target.id === player.id || !target.alive) return;
      if (!this.config.match.friendlyFire) return;
      const d = distance(player.x, player.y, target.x, target.y);
      if (d <= kit.pureLove.radius + target.radius) {
        const falloff = Math.max(0.3, 1 - (d - target.radius) / kit.pureLove.radius);
        this.combat.applyDamage({
          target,
          source: player,
          amount: Math.round(kit.pureLove.damage * falloff),
          kind: "pureLove",
          knockback: kit.pureLove.knockback * falloff,
          fromX: player.x,
          fromY: player.y,
        });
      }
    });

    this.emitEventNear(player.x, player.y, {
      type: "pureLove",
      x: player.x,
      y: player.y,
      playerId: player.id,
      radius: kit.pureLove.radius,
    });
  }

  isCollidingAnyObstacle(x, y, radius) {
    for (let i = 0; i < this.map.obstacles.length; i += 1) {
      if (circleIntersectsRect(x, y, radius, this.map.obstacles[i])) {
        return true;
      }
    }
    return false;
  }

  constrainPositionByDomainWalls(entity, fromX, fromY, toX, toY) {
    if (!entity || (entity.kind !== "player" && entity.kind !== "enemy")) {
      return { x: toX, y: toY, blocked: false };
    }
    if (!this.domainSystem || this.domainSystem.domains.size === 0) {
      return { x: toX, y: toY, blocked: false };
    }

    let x = toX;
    let y = toY;
    let blocked = false;

    this.domainSystem.domains.forEach((domain) => {
      const wasInside = distance(fromX, fromY, domain.x, domain.y) <= domain.radius;
      const currentDist = distance(x, y, domain.x, domain.y);

      let dirX = x - domain.x;
      let dirY = y - domain.y;
      let dirLen = Math.hypot(dirX, dirY);
      if (dirLen < 0.0001) {
        dirX = fromX - domain.x;
        dirY = fromY - domain.y;
        dirLen = Math.hypot(dirX, dirY);
      }
      if (dirLen < 0.0001) {
        dirX = 1;
        dirY = 0;
        dirLen = 1;
      }

      const nx = dirX / dirLen;
      const ny = dirY / dirLen;

      if (wasInside) {
        const maxDist = Math.max(0, domain.radius - entity.radius);
        if (currentDist > maxDist) {
          x = domain.x + nx * maxDist;
          y = domain.y + ny * maxDist;
          blocked = true;
        }
        return;
      }

      const minDist = domain.radius + entity.radius;
      const cutDist = distancePointToSegment(domain.x, domain.y, fromX, fromY, x, y);
      if (cutDist < minDist - 0.001) {
        x = fromX;
        y = fromY;
        blocked = true;
        return;
      }

      if (currentDist < minDist) {
        x = domain.x + nx * minDist;
        y = domain.y + ny * minDist;
        blocked = true;
      }
    });

    return { x, y, blocked };
  }

  isBlockedByDomainWalls(entity, fromX, fromY, toX, toY) {
    return this.constrainPositionByDomainWalls(entity, fromX, fromY, toX, toY).blocked;
  }

  moveEntityWithCollisions(entity, moveX, moveY, instant = false) {
    let nx = entity.x + moveX;
    let ny = entity.y + moveY;

    nx = clamp(nx, entity.radius, this.map.width - entity.radius);
    ny = clamp(ny, entity.radius, this.map.height - entity.radius);

    const originalX = entity.x;
    const originalY = entity.y;

    entity.x = nx;
    if (this.isCollidingAnyObstacle(entity.x, entity.y, entity.radius)) {
      entity.x = originalX;
    }

    entity.y = ny;
    if (this.isCollidingAnyObstacle(entity.x, entity.y, entity.radius)) {
      entity.y = originalY;
    }

    const constrained = this.constrainPositionByDomainWalls(
      entity,
      originalX,
      originalY,
      entity.x,
      entity.y
    );
    entity.x = clamp(constrained.x, entity.radius, this.map.width - entity.radius);
    entity.y = clamp(constrained.y, entity.radius, this.map.height - entity.radius);
    if (this.isCollidingAnyObstacle(entity.x, entity.y, entity.radius)) {
      entity.x = originalX;
      entity.y = originalY;
    }

    if (!instant && entity.kind === "player") {
      entity.vx *= 0.94;
      entity.vy *= 0.94;
    }
  }

  validateInputAim(player, input) {
    if (!Number.isFinite(input.aimX) || !Number.isFinite(input.aimY)) {
      return false;
    }
    const d = distance(player.x, player.y, input.aimX, input.aimY);
    return d <= this.config.antiCheat.maxAimDistanceFromPlayer;
  }

  handleClientInput(player, input) {
    if (!player) {
      console.log("[DIAG] handleClientInput: player is null!");
      return;
    }

    if (input.seq % 30 === 0) {
      console.log(`[DIAG] handleClientInput: player=${player.id}, seq=${input.seq}, keys.up=${input.up}, keys.down=${input.down}, keys.left=${input.left}, keys.right=${input.right}`);
    }

    const windowMs = 1000;
    if (this.now - player.inputBurstWindowStart >= windowMs) {
      player.inputBurstWindowStart = this.now;
      player.inputBurstCount = 0;
    }
    player.inputBurstCount += 1;
    if (player.inputBurstCount > this.config.net.maxInputPerSecond) {
      return;
    }

    if (!this.validateInputAim(player, input)) {
      return;
    }

    if (input.seq < player.input.seq) {
      return;
    }

    player.input.up = input.up;
    player.input.down = input.down;
    player.input.left = input.left;
    player.input.right = input.right;
    player.input.m1 = input.m1;
    player.input.q = input.q;
    player.input.e = input.e;
    player.input.r = input.r;
    player.input.space = input.space;
    player.input.f = input.f;
    player.input.dodge = input.dodge;
    player.input.aimX = input.aimX;
    player.input.aimY = input.aimY;
    player.input.seq = input.seq;
    player.lastInputAt = this.now;
  }

  emitEventAll(event) {
    this.players.forEach((player) => {
      if (!player._eventQueue) {
        player._eventQueue = [];
      }
      player._eventQueue.push(event);
    });
  }

  emitEventNear(x, y, event, radius = 1100) {
    this.players.forEach((player) => {
      if (distance(player.x, player.y, x, y) <= radius) {
        if (!player._eventQueue) {
          player._eventQueue = [];
        }
        player._eventQueue.push(event);
      }
    });
  }

  emitEventToPlayer(playerId, event) {
    const player = this.players.get(playerId);
    if (!player) {
      return;
    }
    if (!player._eventQueue) {
      player._eventQueue = [];
    }
    player._eventQueue.push(event);
  }

  buildFullWorldState() {
    const players = [];
    this.players.forEach((player) => {
      players.push({
        id: player.id,
        name: player.name,
        character: player.character || "gojo",
        x: Math.round(player.x),
        y: Math.round(player.y),
        vx: Number(player.vx.toFixed(2)),
        vy: Number(player.vy.toFixed(2)),
        hp: Number(player.hp.toFixed(1)),
        maxHp: player.maxHp,
        energy: Number(player.energy.toFixed(1)),
        maxEnergy: player.maxEnergy,
        alive: player.alive,
        level: player.level,
        kills: player.kills,
        deaths: player.deaths,
        animState: player.animState,
        invuln: player.invulnTimer > 0,
      });
    });

    const enemies = [];
    this.enemies.forEach((enemy) => {
      enemies.push({
        id: enemy.id,
        type: enemy.type,
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        hp: Number(enemy.hp.toFixed(1)),
        maxHp: enemy.maxHp,
        alive: enemy.alive,
        state: enemy.state,
        frozen: enemy.freezeTimer > 0,
        freezeLeft: Number(enemy.freezeTimer.toFixed(2)),
      });
    });

    const projectiles = [];
    this.projectiles.forEach((p) => {
      projectiles.push({
        id: p.id,
        type: p.type,
        ownerId: p.ownerId,
        ownerKind: p.ownerKind,
        x: Math.round(p.x),
        y: Math.round(p.y),
        prevX: Math.round(p.prevX),
        prevY: Math.round(p.prevY),
        radius: p.radius,
        width: p.width,
        length: p.length,
        color: p.color,
        life: Number((p.lifetime - p.age).toFixed(2)),
        traveled: Number(p.traveled.toFixed(1)),
        vx: Number(p.vx.toFixed(3)),
        vy: Number(p.vy.toFixed(3)),
      });
    });

    return {
      players,
      enemies,
      projectiles,
      domains: this.domainSystem.toSnapshot(),
    };
  }

  phaseName() {
    const elapsed = this.elapsedSeconds;
    const timings = this.config.match.phaseTimings;
    if (elapsed < timings.early) return "EARLY";
    if (elapsed < timings.mid) return "MID";
    if (elapsed < timings.late) return "LATE";
    return "FINAL";
  }

  getCacheForPlayer(playerId) {
    if (!this.clientStateCache.has(playerId)) {
      this.clientStateCache.set(playerId, {
        players: new Map(),
        enemies: new Map(),
        projectiles: new Map(),
        domains: new Map(),
      });
    }
    return this.clientStateCache.get(playerId);
  }

  deltaArray(currentArray, cacheMap, keyField = "id") {
    const changed = [];
    const seen = new Set();

    for (let i = 0; i < currentArray.length; i += 1) {
      const item = currentArray[i];
      const key = item[keyField];
      seen.add(key);
      const serialized = JSON.stringify(item);
      if (cacheMap.get(key) !== serialized) {
        cacheMap.set(key, serialized);
        changed.push(item);
      }
    }

    const removed = [];
    Array.from(cacheMap.keys()).forEach((key) => {
      if (!seen.has(key)) {
        cacheMap.delete(key);
        removed.push(key);
      }
    });

    return {
      changed,
      removed,
    };
  }

  broadcastSnapshots() {
    const world = this.buildFullWorldState();

    this.players.forEach((player) => {
      if (!player.socket || player.socket.readyState !== 1) {
        if (player) console.log(`[DIAG] broadcastSnapshots SKIP ${player.id}: socket=${!!player.socket}, readyState=${player.socket ? player.socket.readyState : 'N/A'}`);
        return;
      }

      const cache = this.getCacheForPlayer(player.id);
      const playersDelta = this.deltaArray(world.players, cache.players);
      const enemiesDelta = this.deltaArray(world.enemies, cache.enemies);
      const projectilesDelta = this.deltaArray(world.projectiles, cache.projectiles);
      const domainsDelta = this.deltaArray(world.domains, cache.domains);

      const payload = {
        type: "snapshot",
        serverTime: this.now,
        tick: Math.floor((this.now - this.startedAt) / (1000 / this.config.net.tickRate)),
        phase: this.phaseName(),
        elapsedSec: Number(this.elapsedSeconds.toFixed(1)),
        delta: {
          players: playersDelta.changed,
          enemies: enemiesDelta.changed,
          projectiles: projectilesDelta.changed,
          domains: domainsDelta.changed,
        },
        removed: {
          players: playersDelta.removed,
          enemies: enemiesDelta.removed,
          projectiles: projectilesDelta.removed,
          domains: domainsDelta.removed,
        },
        events: player._eventQueue ? player._eventQueue.splice(0) : [],
        you: {
          id: player.id,
          character: player.character || "gojo",
          x: Math.round(player.x),
          y: Math.round(player.y),
          hp: Number(player.hp.toFixed(1)),
          maxHp: player.maxHp,
          energy: Number(player.energy.toFixed(1)),
          maxEnergy: player.maxEnergy,
          level: player.level,
          xp: Math.floor(player.xp),
          xpToNext: player.xpToNext,
          kills: player.kills,
          deaths: player.deaths,
          cooldowns: {
            q: Number(player.cooldowns.q.toFixed(2)),
            e: Number(player.cooldowns.e.toFixed(2)),
            r: Number(player.cooldowns.r.toFixed(2)),
            space: Number(player.cooldowns.space.toFixed(2)),
            f: Number(player.cooldowns.f.toFixed(2)),
            dodge: Number(player.dodgeCooldown.toFixed(2)),
          },
          alive: player.alive,
          ackSeq: player.lastProcessedInputSeq,
          pendingChoices: player.pendingUpgrades
            ? player.pendingUpgrades.map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                rarity: item.rarity,
              }))
            : null,
          skillLock: this.domainSystem.isSkillLocked(),
        },
      };

      if (payload.you && payload.tick < 3) {
        console.log(`[DIAG] First snapshot to ${player.id}: you.x=${payload.you.x}, you.y=${payload.you.y}, you.alive=${payload.you.alive}, delta.players=${payload.delta.players.length}, you.id=${payload.you.id}, playerId=${player.id}`);
      }

      player.socket.send(JSON.stringify(payload));
    });
  }
}

module.exports = {
  GameServer,
};
