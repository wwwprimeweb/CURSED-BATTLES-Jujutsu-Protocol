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
    this.pureLoveBeams = new Map();

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
        const previousSocket = existing.socket;
        if (previousSocket && previousSocket !== socket) {
          this.wsToPlayer.delete(previousSocket);
          try {
            previousSocket.close();
          } catch (_err) {
          }
        }

        existing.socket = socket;
        existing.offline = false;
        existing.disconnectedAt = 0;
        if (!existing.alive) {
          existing.alive = true;
          existing.hp = existing.maxHp;
          existing.respawnTimer = 0;
        }
        if (name) {
          existing.name = name;
        }

        if (!existing._eventQueue) {
          existing._eventQueue = [];
        }

        this.wsToPlayer.set(socket, existing.id);
        this.clientStateCache.delete(existing.id);
        return { player: existing, reconnected: true };
      }

      this.sessionToPlayer.delete(sessionToken);
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
    player.offline = false;
    player.disconnectedAt = 0;
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
    player.cast = null;
    player.vx = 0;
    player.vy = 0;

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

    player.prevInput.m1 = false;
    player.prevInput.q = false;
    player.prevInput.e = false;
    player.prevInput.r = false;
    player.prevInput.space = false;
    player.prevInput.f = false;
    player.prevInput.dodge = false;

    player.deaths = (player.deaths || 0) + 1;
    player.alive = false;
    player.respawnTimer = -1;

    this.emitEventAll({
      type: "kill",
      x: player.x,
      y: player.y,
      victimId: player.id,
      killerId: null,
    });

    if (this.players.size === 1) {
      this.removePlayer(player.id);
      return;
    }
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) {
      return;
    }

    this.rikas.delete(playerId);
    this.pureLoveBeams.delete(playerId);
    this.players.delete(playerId);
    this.sessionToPlayer.delete(player.sessionToken);
    this.clientStateCache.delete(playerId);
    this.emitEventAll({ type: "playerLeft", id: playerId });
    if (this.players.size === 0) {
      this.resetEmptyLobby();
    }
  }

  resetEmptyLobby() {
    if (this._matchResetTimer) {
      clearTimeout(this._matchResetTimer);
      this._matchResetTimer = null;
    }

    this.enemies.clear();
    this.projectiles.clear();
    this.rikas.clear();
    this.pureLoveBeams.clear();
    this.domainSystem.domains.clear();
    this.delayedActions = [];
    this.clientStateCache.clear();
    this.sessionToPlayer.clear();
    this.wsToPlayer.clear();

    this.enemySystem.spawnTimer = 0;
    this.enemySystem.bossSpawned = false;

    this.nextPlayerId = 1;
    this.nextEnemyId = 1;
    this.nextProjectileId = 1;
    this.map = generateMap(this.config.map.width, this.config.map.height, this.rng.int(1, 99999999));

    this.startedAt = Date.now();
    this._gameOver = false;
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
    this.updatePureLoveBeams(dt);
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
    this._gameOver = true;
    this.resetMatch();
  }

  resetMatch() {
    if (this._matchResetTimer) {
      clearTimeout(this._matchResetTimer);
      this._matchResetTimer = null;
    }

    this.enemies.clear();
    this.projectiles.clear();
    this.rikas.clear();
    this.pureLoveBeams.clear();
    this.domainSystem.domains.clear();
    this.delayedActions = [];
    this.clientStateCache.clear();
    this.enemySystem.spawnTimer = 0;
    this.enemySystem.bossSpawned = false;

    this.players.forEach((player) => {
      const base = BASE_STATS[player.character] || BASE_STATS.gojo;
      player.maxHp = base.maxHp;
      player.maxEnergy = base.maxEnergy;
      player.energyRegen = base.energyRegen;
      player.moveSpeed = base.moveSpeed;
      player.dodgeCooldownBase = base.dodgeCooldown;
      player.dodgeDistance = base.dodgeDistance;
      player.radius = base.radius;
      player.armor = base.armor;

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
      player.offline = false;
      player.disconnectedAt = 0;

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
        rikaDamageMul: 1,
        rikaCooldownMul: 1,
        dashSlashDamageMul: 1,
        dashSlashRangeMul: 1,
        fullRikaDurationMul: 1,
        fullRikaPowerMul: 1,
        pureLoveDamageMul: 1,
        pureLoveRadiusMul: 1,
        domainKatanaDamageMul: 1,
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
    this.players.forEach((player) => {
      player.hitFlash = Math.max(0, player.hitFlash - dt);
      player.invulnTimer = Math.max(0, player.invulnTimer - dt);
      player.stunTimer = Math.max(0, player.stunTimer - dt);
      player.comboResetTimer = Math.max(0, player.comboResetTimer - dt);
      player.m1Timer = Math.max(0, player.m1Timer - dt);
      player.dodgeTimer = Math.max(0, player.dodgeTimer - dt);
      if (player.rikaBuffTime > 0) {
        player.rikaBuffTime = Math.max(0, player.rikaBuffTime - dt);
      }

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
      player.domainExhaustionTimer = Math.max(0, player.domainExhaustionTimer - dt);

      this.resolveCasting(player, dt);
      const skillLockedAtTickStart = this.domainSystem.isSkillLockedForPlayer(player);
      this.resolveInput(player, dt, skillLockedAtTickStart);

      if (player.comboResetTimer <= 0) {
        player.comboStep = 0;
      }

      this.updateAnimationState(player);
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
    player.domainExhaustionTimer = 0;
    if (player.character === "yuta") {
      this.rikas.delete(player.id);
      this.pureLoveBeams.delete(player.id);
    }
    player.dashSlash = null;
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
      this.firePureLove(player, cast);
    } else if (cast.type === "cursedWave") {
      this.fireCursedWave(player, cast);
    } else if (cast.type === "rikaImpulse") {
      this.fireRikaImpulse(player, cast);
    } else if (cast.type === "rikaDash") {
      this.fireRikaDash(player, cast);
    } else if (cast.type === "domainCopy") {
      this.fireDomainCopy(player, cast);
    } else if (cast.type === "domainCopyFire") {
      this.fireDomainCopyFire(player, cast);
    }
  }

  resolveInput(player, dt, skillLockedAtTickStart) {
    const input = player.input;

    if (player.stunTimer > 0) {
      player.vx *= 0.8;
      player.vy *= 0.8;
      this.moveEntityWithCollisions(player, player.vx * dt, player.vy * dt);
      return;
    }

    if (this.pureLoveBeams.has(player.id)) {
      player.aimX = input.aimX;
      player.aimY = input.aimY;
      player.vx = 0;
      player.vy = 0;
      player.prevInput.m1 = input.m1;
      player.prevInput.q = input.q;
      player.prevInput.e = input.e;
      player.prevInput.r = input.r;
      player.prevInput.space = input.space;
      player.prevInput.f = input.f;
      player.prevInput.dodge = input.dodge;
      player.lastProcessedInputSeq = input.seq;
      return;
    }

    if (player.dashSlash) {
      player.aimX = input.aimX;
      player.aimY = input.aimY;
      const kit = this.getKit(player);
      const slideSpeed = kit.dashSlash.slideSpeed;
      const moveAmount = Math.min(player.dashSlash.remainingDist, slideSpeed * dt);
      this.moveEntityWithCollisions(player, player.dashSlash.dirX * moveAmount, player.dashSlash.dirY * moveAmount);
      player.dashSlash.remainingDist -= moveAmount;
      if (player.dashSlash.remainingDist <= 0) {
        const endX = player.x;
        const endY = player.y;
        const startX = player.dashSlash.startX;
        const startY = player.dashSlash.startY;
        const kit = this.getKit(player);
        const firstDamage = kit.dashSlash.damage * player.modifiers.dashSlashDamageMul;
        const delayedRadius = kit.dashSlash.delayedRadius;

        // First AoE hit at end position
        this.applyDashSlashAoE(player, endX, endY, firstDamage, delayedRadius, 120);

        // Emit dash slash trail event
        this.emitEventNear(endX, endY, {
          type: "dashSlash",
          x: endX,
          y: endY,
          startX,
          startY,
          playerId: player.id,
          radius: delayedRadius,
        });

        // Queue delayed second hit
        const savedX = endX;
        const savedY = endY;
        this.queueDelayedAction(kit.dashSlash.delayedDelay, () => {
          const delayedDamage = kit.dashSlash.delayedDamage * (this.getKitByPlayerId ? this.getKitByPlayerId(player.id) : kit).dashSlash.delayedDamage * (player.modifiers ? player.modifiers.dashSlashDamageMul : 1);
          // Actually, let me use saved kit values
        });

        // For the delayed action, use a closure with captured values
        const capturedKit = kit;
        const capturedPlayerId = player.id;
        this.queueDelayedAction(kit.dashSlash.delayedDelay, () => {
          const p = this.players.get(capturedPlayerId);
          if (!p || !p.alive) return;
          const kitNow = this.getKit(p);
          const delayedDmg = kitNow.dashSlash.delayedDamage * p.modifiers.dashSlashDamageMul;
          const delayedKb = kitNow.dashSlash.delayedKnockback;
          this.applyDashSlashAoE(p, savedX, savedY, delayedDmg, kitNow.dashSlash.delayedRadius, delayedKb);
          this.emitEventNear(savedX, savedY, {
            type: "dashSlashDelayed",
            x: savedX,
            y: savedY,
            playerId: p.id,
          });
        });

        player.dashSlash = null;
      }
      player.prevInput.m1 = input.m1;
      player.prevInput.q = input.q;
      player.prevInput.e = input.e;
      player.prevInput.r = input.r;
      player.prevInput.space = input.space;
      player.prevInput.f = input.f;
      player.prevInput.dodge = input.dodge;
      player.lastProcessedInputSeq = input.seq;
      return;
    }

    player.aimX = input.aimX;
    player.aimY = input.aimY;

    const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const moveNorm = normalize(moveX, moveY);
    const isDomainCasting = player.cast && player.cast.type === "domain";
    const isCharging = player.cast && (player.cast.type === "purple");
    const isPureLoveCharging = player.cast && (player.cast.type === "pureLove" || player.cast.type === "domainCopyFire");
    if (isPureLoveCharging) {
      const curAim = normalize(player.aimX - player.x, player.aimY - player.y);
      player.cast.dirX = curAim.x;
      player.cast.dirY = curAim.y;
    }
    const castSlow = isPureLoveCharging ? 0 : isCharging ? 0.72 : isDomainCasting ? 0 : 1;
    const domainSlow = this.domainSystem.getPlayerSlowFactor(player);
    const moveSpeed = player.moveSpeed * player.modifiers.speedMul * castSlow * domainSlow;
    player.vx = moveNorm.x * moveSpeed;
    player.vy = moveNorm.y * moveSpeed;

    if (!isDomainCasting) {
      const dodgePressed = input.dodge && !player.prevInput.dodge;
      if (dodgePressed && !skillLockedAtTickStart) {
        this.tryDodge(player, moveNorm);
      }

      const m1Held = input.m1;
      if (m1Held && !skillLockedAtTickStart) {
        this.tryM1(player);
      }
    }

    const qPressed = input.q && !player.prevInput.q;
    const ePressed = input.e && !player.prevInput.e;
    const rPressed = input.r && !player.prevInput.r;
    const spacePressed = input.space && !player.prevInput.space;
    const fPressed = input.f && !player.prevInput.f;

    if (!player.cast && !skillLockedAtTickStart && player.domainExhaustionTimer <= 0) {
      const chara = player.character || "gojo";
      if (chara === "yuta" || chara === "megumi") {
        if (qPressed) this.tryCastRika(player);
        if (ePressed) this.tryCastFullRika(player);
        if (rPressed) this.tryCastPureLove(player);
        if (spacePressed) this.tryCastDashSlash(player);
        if (fPressed) this.tryCastDomain(player);
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

    if (player.cast && player.cast.type === "domain") {
      player.animState = "domain_prepare";
      player.statePriority = 2;
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
    if (this.pureLoveBeams.has(player.id)) {
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
    if (player.dashSlash) {
      player.animState = "teleport";
      player.statePriority = 6;
      return;
    }
    if (player.cast && player.cast.type === "teleport") {
      player.animState = "teleport";
      player.statePriority = 6;
      return;
    }
    if (player.dodgeTimer > 0) {
      player.animState = "dodge";
      player.statePriority = 6;
      return;
    }
    if (player.m1Timer > 0) {
      player.animState = "m1_" + player.comboStep;
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
    player.dodgeTimer = 0.2;
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
    const isYutaSlash = player.character === "yuta";

    player.m1Timer = kit.m1.cooldown;
    player.comboStep = (player.comboStep % 4) + 1;
    player.comboResetTimer = 0.9;

    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    const m1DirX = Number.isFinite(aim.x) ? aim.x : 0;
    const m1DirY = Number.isFinite(aim.y) ? aim.y : 0;

    const slashDirX = isYutaSlash && Math.abs(m1DirX) < 0.001 && Math.abs(m1DirY) < 0.001 ? 1 : m1DirX;
    const slashDirY = isYutaSlash && Math.abs(m1DirX) < 0.001 && Math.abs(m1DirY) < 0.001 ? 0 : m1DirY;
    const slashRange = kit.m1.range;
    const coneAngle = isYutaSlash ? (kit.m1.coneAngle || 1.4) : 0;

    const canM1HitTarget = (target) => {
      if (isYutaSlash) {
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > slashRange + target.radius) {
          return false;
        }
        const toTarget = dist > 0.01 ? { x: dx / dist, y: dy / dist } : { x: 0, y: 0 };
        const facing = toTarget.x * slashDirX + toTarget.y * slashDirY;
        const coneCos = Math.cos(coneAngle * 0.5);
        return facing > coneCos;
      }

      const toTarget = normalize(target.x - player.x, target.y - player.y);
      const inRange = distance(player.x, player.y, target.x, target.y) <= slashRange + target.radius;
      const facing = dot(m1DirX, m1DirY, toTarget.x, toTarget.y) > 0.2;
      return inRange && facing;
    };

    this.players.forEach((target) => {
      if (target.id === player.id || !target.alive) {
        return;
      }
      if (!this.config.match.friendlyFire && target.kind === "player") {
        return;
      }
      if (canM1HitTarget(target)) {
        this.combat.applyDamage({
          target,
          source: player,
          amount: kit.m1.damage * player.modifiers.m1DamageMul,
          kind: "m1",
          knockback: player.comboStep === 3 ? (isYutaSlash ? 210 : 180) : (isYutaSlash ? 120 : 85),
          fromX: player.x,
          fromY: player.y,
        });
      }
    });

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      if (canM1HitTarget(enemy)) {
        this.combat.applyDamage({
          target: enemy,
          source: player,
          amount: kit.m1.damage * player.modifiers.m1DamageMul,
          kind: "m1",
          knockback: player.comboStep === 3 ? (isYutaSlash ? 190 : 150) : (isYutaSlash ? 110 : 80),
          fromX: player.x,
          fromY: player.y,
        });
      }
    });

    this.emitEventNear(player.x, player.y, {
      type: "m1",
      x: player.x,
      y: player.y,
      dirX: slashDirX,
      dirY: slashDirY,
      combo: player.comboStep,
      playerId: player.id,
      character: player.character || "gojo",
      slashRange: isYutaSlash ? slashRange : undefined,
      coneAngle: isYutaSlash ? coneAngle : undefined,
    });
    return true;
  }

  canUseSkill(player, energyCost, cooldownKey, baseCooldown) {
    if (!player.alive) {
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
    if (this.domainSystem.hasActiveDomain(player.id)) {
      p.sureHit = true;
      p.homingStrength = 3.0;
    }
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
    if (this.domainSystem.hasActiveDomain(player.id)) {
      projectile.sureHit = true;
      projectile.homingStrength = 3.0;
    }
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
    if (this.domainSystem.hasActiveDomain(player.id)) {
      beam.sureHit = true;
      beam.homingStrength = 3.0;
    }
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

    if (player.character === "yuta") {
      const domain = this.domainSystem.domains.get(player.id);
      if (domain && distance(player.x, player.y, domain.x, domain.y) <= domain.radius) {
        const kit = this.getKit(player);
        player.cast = {
          type: "domainCopy",
          timer: (kit.domainCopy || {}).startup || 0.2,
        };
        return true;
      }
    }

    const kit = this.getKit(player);
    const cooldownKey = "f";
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

  fireDomainCopy(player, cast) {
    const domain = this.domainSystem.domains.get(player.id);
    if (!domain) return;

    const aim = normalize(player.aimX - player.x, player.aimY - player.y);

    let copyType = null;
    let sourceKit = null;
    let sourceChar = domain.copiedCharacter;

    if (sourceChar) {
      sourceKit = CHARACTER_REGISTRY[sourceChar];
      if (sourceKit) {
        const isStandard = sourceChar !== "yuta" && sourceChar !== "megumi";
        copyType = isStandard ? "purple" : "pureLove";
      }
    }
    if (!copyType) {
      sourceKit = CHARACTER_REGISTRY.yuta;
      sourceChar = "yuta";
      copyType = "pureLove";
    }

    const startup = copyType === "purple"
      ? (sourceKit.purple?.charge || 0.5)
      : (sourceKit.pureLove?.startup || 2.0);

    player.cast = {
      type: "domainCopyFire",
      timer: startup,
      copyType,
      dirX: aim.x,
      dirY: aim.y,
      _sourceChar: sourceChar,
    };

    if (copyType === "pureLove") {
      const offset = 30;
      this.emitEventNear(player.x, player.y, {
        type: "pureLoveCharge",
        x: player.x + aim.x * offset,
        y: player.y + aim.y * offset,
        playerId: player.id,
        dirX: aim.x,
        dirY: aim.y,
        duration: startup,
      });
    } else {
      this.emitEventNear(player.x, player.y, {
        type: "purpleCharge",
        x: player.x,
        y: player.y,
        ownerId: player.id,
        delay: startup,
      });
    }
  }

  fireDomainCopyFire(player, cast) {
    const sourceKit = CHARACTER_REGISTRY[cast._sourceChar] || CHARACTER_REGISTRY.yuta;
    const aim = { x: cast.dirX, y: cast.dirY };

    if (cast.copyType === "purple") {
      this.fireCopiedPurple(player, aim, sourceKit);
    } else {
      this.fireCopiedPureLove(player, aim, sourceKit);
    }
  }

  fireCopiedPurple(player, aim, sourceKit) {
    const p = sourceKit.purple;
    const beam = createProjectile({
      id: `cp${this.nextProjectileId++}`,
      type: "purple",
      ownerId: player.id,
      ownerKind: "player",
      x: player.x,
      y: player.y,
      vx: aim.x,
      vy: aim.y,
      speed: p.speed,
      radius: 0,
      lifetime: p.length / p.speed + 0.08,
      damage: p.damage * (player.modifiers.purpleDamageMul || 1),
      penetration: true,
      width: p.width * (player.modifiers.purpleWidthMul || 1),
      length: p.length * (player.modifiers.purpleLengthMul || 1),
      color: "#9b5cff",
      meta: { startX: player.x, startY: player.y },
    });
    if (this.domainSystem.hasActiveDomain(player.id)) {
      beam.sureHit = true;
      beam.homingStrength = 3.0;
    }
    this.projectiles.set(beam.id, beam);
    this.emitEventNear(player.x, player.y, {
      type: "skillPurple",
      x: player.x,
      y: player.y,
      ownerId: player.id,
      dirX: aim.x,
      dirY: aim.y,
      width: beam.width,
      length: beam.length,
    });
  }

  fireCopiedPureLove(player, aim, sourceKit) {
    const pl = sourceKit.pureLove;
    const dir = normalize(aim.x, aim.y);
    const width = pl.radius * (player.modifiers.pureLoveRadiusMul || 1);
    const offset = pl.beamOffset || 60;

    this.pureLoveBeams.set(player.id, {
      x: player.x + dir.x * offset,
      y: player.y + dir.y * offset,
      dirX: dir.x,
      dirY: dir.y,
      width,
      lifetime: pl.duration || 4,
      totalLifetime: pl.duration || 4,
      beamLength: pl.beamLength || 960,
      ownerId: player.id,
      hitTimes: new Map(),
      redirectSpeed: pl.redirectSpeed || 0,
      damage: pl.damage * (player.modifiers.pureLoveDamageMul || 1),
      knockback: (pl.knockback || 600) * (player.modifiers.pureLoveKnockbackMul || 1),
      _domainCopy: true,
    });
    this.emitEventNear(player.x, player.y, {
      type: "pureLoveBeam",
      x: player.x + dir.x * offset,
      y: player.y + dir.y * offset,
      playerId: player.id,
      dirX: dir.x,
      dirY: dir.y,
      width,
      lifetime: pl.duration || 4,
      beamLength: pl.beamLength || 960,
    });
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

  findFirstDomainBarrierIntersection(fromX, fromY, toX, toY, padding = 0) {
    if (!this.domainSystem || this.domainSystem.domains.size === 0) {
      return null;
    }

    const vx = toX - fromX;
    const vy = toY - fromY;
    const a = vx * vx + vy * vy;
    if (a < 0.000001) {
      return null;
    }

    let best = null;
    const epsilon = 0.0001;

    this.domainSystem.domains.forEach((domain) => {
      const r = Math.max(1, domain.radius + padding);
      const fx = fromX - domain.x;
      const fy = fromY - domain.y;

      const b = 2 * (fx * vx + fy * vy);
      const c = fx * fx + fy * fy - r * r;
      const disc = b * b - 4 * a * c;
      if (disc < 0) {
        return;
      }

      const sqrtDisc = Math.sqrt(disc);
      const inv2a = 1 / (2 * a);
      const t1 = (-b - sqrtDisc) * inv2a;
      const t2 = (-b + sqrtDisc) * inv2a;
      const candidates = [t1, t2];

      for (let i = 0; i < candidates.length; i += 1) {
        const t = candidates[i];
        if (!Number.isFinite(t) || t <= epsilon || t > 1 + epsilon) {
          continue;
        }
        const clampedT = clamp(t, 0, 1);
        const x = fromX + vx * clampedT;
        const y = fromY + vy * clampedT;

        if (!best || clampedT < best.t) {
          best = {
            domain,
            t: clampedT,
            x,
            y,
          };
        }
      }
    });

    return best;
  }

  breakProjectileOnBarrier(projectile, barrierHit) {
    if (!projectile || !barrierHit || !barrierHit.domain) {
      return false;
    }

    projectile.x = barrierHit.x;
    projectile.y = barrierHit.y;

    const baseDamage = Number.isFinite(projectile.damage) ? projectile.damage : 10;
    let barrierDamage = baseDamage * 0.45;
    if (projectile.type === "red") {
      barrierDamage = baseDamage * 0.55;
    } else if (projectile.type === "purple") {
      barrierDamage = baseDamage * 0.75;
    }
    barrierDamage = Math.max(4, barrierDamage);
    this.domainSystem.damageBarrier(barrierHit.domain.ownerId, barrierDamage, projectile.ownerId);

    this.emitEventNear(barrierHit.x, barrierHit.y, {
      type: "domainBarrierHit",
      x: barrierHit.x,
      y: barrierHit.y,
      ownerId: barrierHit.domain.ownerId,
      projectileType: projectile.type,
      attackerKind: projectile.ownerKind,
    });

    this.projectiles.delete(projectile.id);
    return true;
  }

  handleProjectileDomainBarrier(projectile, fromX, fromY, toX, toY, padding = 0) {
    const hit = this.findFirstDomainBarrierIntersection(fromX, fromY, toX, toY, padding);
    if (!hit) {
      return false;
    }
    return this.breakProjectileOnBarrier(projectile, hit);
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
        } else if (projectile.type === "blue") {
          this.triggerBlueExplosion(projectile);
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

    if (this.handleProjectileDomainBarrier(projectile, projectile.prevX, projectile.prevY, projectile.x, projectile.y)) {
      return;
    }

    if (this.isCollidingAnyObstacle(projectile.x, projectile.y, projectile.radius)) {
      this.triggerBlueExplosion(projectile);
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

  triggerBlueExplosion(projectile) {
    const owner = this.players.get(projectile.ownerId) || null;
    const radius = projectile.pullRadius * 1.5;
    const strength = projectile.pullStrength * 2;
    const targets = [];

    this.players.forEach((target) => {
      if (!target.alive || target.id === projectile.ownerId) return;
      const d = distance(target.x, target.y, projectile.x, projectile.y);
      if (d <= radius + target.radius) targets.push(target);
    });
    this.enemies.forEach((target) => {
      if (!target.alive) return;
      const d = distance(target.x, target.y, projectile.x, projectile.y);
      if (d <= radius + target.radius) targets.push(target);
    });

    targets.forEach((target) => {
      const dir = normalize(projectile.x - target.x, projectile.y - target.y);
      const pullDist = strength * 0.15;
      this.moveEntityWithCollisions(target, dir.x * pullDist, dir.y * pullDist, true);
      target.vx += dir.x * strength * 0.4;
      target.vy += dir.y * strength * 0.4;
      this.combat.applyDamage({
        target,
        source: owner,
        amount: projectile.damage * 2,
        kind: "blueExplosion",
        fromX: projectile.x,
        fromY: projectile.y,
      });
    });

    this.emitEventNear(projectile.x, projectile.y, {
      type: "blueExplosion",
      x: projectile.x,
      y: projectile.y,
      radius,
    });
  }

  updatePurpleProjectile(projectile, dt) {
    if (projectile.sureHit && projectile.homingStrength > 0) {
      const target = this.findNearestEnemyInDomain(projectile.ownerId, projectile.x, projectile.y);
      if (target) {
        const dir = normalize(target.x - projectile.x, target.y - projectile.y);
        if (dir.len > 0.001) {
          const currentAngle = Math.atan2(projectile.vy, projectile.vx);
          const targetAngle = Math.atan2(dir.y, dir.x);
          let diff = targetAngle - currentAngle;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          const maxRot = projectile.homingStrength * dt;
          const rot = Math.sign(diff) * Math.min(Math.abs(diff), maxRot);
          const c = Math.cos(rot);
          const s = Math.sin(rot);
          const nvx = projectile.vx * c - projectile.vy * s;
          const nvy = projectile.vx * s + projectile.vy * c;
          projectile.vx = nvx;
          projectile.vy = nvy;
          if (projectile.meta) {
            projectile.meta.startX = projectile.x;
            projectile.meta.startY = projectile.y;
          }
        }
      }
    }

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
    let toX = startX + projectile.vx * projectile.traveled;
    let toY = startY + projectile.vy * projectile.traveled;

    const barrierHit = this.findFirstDomainBarrierIntersection(fromX, fromY, toX, toY);
    if (barrierHit) {
      toX = barrierHit.x;
      toY = barrierHit.y;
    }

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

    if (barrierHit) {
      this.breakProjectileOnBarrier(projectile, barrierHit);
      return;
    }

    if (projectile.traveled >= projectile.length) {
      this.projectiles.delete(projectile.id);
    }
  }

  updateLinearProjectile(projectile, dt) {
    if (projectile.sureHit && projectile.homingStrength > 0) {
      const target = this.findNearestEnemyInDomain(projectile.ownerId, projectile.x, projectile.y);
      if (target) {
        const dir = normalize(target.x - projectile.x, target.y - projectile.y);
        if (dir.len > 0.001) {
          const currentAngle = Math.atan2(projectile.vy, projectile.vx);
          const targetAngle = Math.atan2(dir.y, dir.x);
          let diff = targetAngle - currentAngle;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          const maxRot = projectile.homingStrength * dt;
          const rot = Math.sign(diff) * Math.min(Math.abs(diff), maxRot);
          const c = Math.cos(rot);
          const s = Math.sin(rot);
          const nvx = projectile.vx * c - projectile.vy * s;
          const nvy = projectile.vx * s + projectile.vy * c;
          projectile.vx = nvx;
          projectile.vy = nvy;
        }
      }
    }

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

    if (this.handleProjectileDomainBarrier(projectile, projectile.prevX, projectile.prevY, projectile.x, projectile.y)) {
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
      if (!player.alive) return;
      const d = distance(player.x, player.y, x, y);
      if (d <= GOJO.collapse.radius + player.radius) {
        const distRatio = Math.max(0, d - player.radius) / GOJO.collapse.radius;
        const falloff = Math.max(150 / 700, 1 - distRatio);
        const isOwner = player.id === ownerId;
        let amount = Math.round(GOJO.collapse.damage * falloff);
        let kb = GOJO.collapse.knockback;
        if (isOwner) {
          amount = Math.round(amount * 0.35);
          kb = kb * 0.4;
        }
        this.combat.applyDamage({
          target: player,
          source: owner,
          amount,
          kind: "spatialCollapse",
          knockback: kb,
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
      if (!player.alive || player.character !== "gojo") {
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
      if (!player.alive || player.id === projectile.ownerId || player.character !== "gojo") {
        return;
      }
      if (this.domainSystem.hasActiveDomain(player.id)) {
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
      if (rika.timer !== Infinity) {
        rika.timer -= dt;
        if (rika.timer <= 0) {
          this.rikas.delete(ownerId);
          const owner = this.players.get(ownerId);
          if (owner) {
            owner.animState = "idle";
          }
          return;
        }
      }

      const owner = this.players.get(ownerId);
      if (!owner || !owner.alive) return;

      if (this.domainSystem.isSkillLockedForPlayer(owner)) {
        return;
      }

      const companion = YUTA.rikaCompanion;
      rika.attackTimer = Math.max(0, (Number.isFinite(rika.attackTimer) ? rika.attackTimer : 0) - dt);

      // Full Rika timer-based auto-attack (enemies and players in range)
      if (rika.timer !== Infinity && rika.attackTimer <= 0) {
        let hasTarget = false;
        this.enemies.forEach((enemy) => {
          if (!enemy.alive) return;
          const d = distance(rika.x, rika.y, enemy.x, enemy.y);
          if (d <= YUTA.fullRika.range + enemy.radius) hasTarget = true;
        });
        this.players.forEach((p) => {
          if (!p.alive || p.id === ownerId) return;
          if (!this.config.match.friendlyFire) return;
          const d = distance(rika.x, rika.y, p.x, p.y);
          if (d <= YUTA.fullRika.range + p.radius) hasTarget = true;
        });
        if (!hasTarget) {
          rika.attackTimer = 0;
        } else {
          rika.attackTimer = YUTA.fullRika.attackInterval;
          rika.attackCounter = (Number.isFinite(rika.attackCounter) ? rika.attackCounter : 0) + 1;
          const isHeavy = rika.attackCounter % 10 === 0;

          const attackType = Math.random() < 0.4 ? "slam" : Math.random() < 0.6 ? "grab" : "swipe";
          const baseDamage = attackType === "slam" ? YUTA.fullRika.slamDamage
            : attackType === "grab" ? YUTA.fullRika.grabDamage
            : YUTA.fullRika.swipeDamage;
          const damage = (isHeavy ? baseDamage * 2 : baseDamage) * owner.modifiers.fullRikaPowerMul;
          const knockback = isHeavy
            ? (attackType === "slam" ? YUTA.fullRika.slamKnockback * 2
              : attackType === "grab" ? YUTA.fullRika.grabThrow * 2
              : YUTA.fullRika.swipeKnockback * 2)
            : (attackType === "slam" ? YUTA.fullRika.slamKnockback
              : attackType === "grab" ? YUTA.fullRika.grabThrow
              : YUTA.fullRika.swipeKnockback);
          const range = isHeavy ? YUTA.fullRika.range * 0.75 : YUTA.fullRika.range;

          this.enemies.forEach((enemy) => {
            if (!enemy.alive) return;
            const d = distance(rika.x, rika.y, enemy.x, enemy.y);
            if (d <= range + enemy.radius) {
              this.combat.applyDamage({
                target: enemy,
                source: owner,
                amount: damage,
                kind: isHeavy ? "rikaHeavy" : "rika",
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
            if (d <= range + target.radius) {
              this.combat.applyDamage({
                target,
                source: owner,
                amount: damage,
                kind: isHeavy ? "rikaHeavy" : "rika",
                knockback,
                fromX: rika.x,
                fromY: rika.y,
              });
            }
          });

          this.emitEventNear(rika.x, rika.y, {
            type: isHeavy ? "rikaCompanionAttack" : "rikaAttack",
            x: rika.x,
            y: rika.y,
            ownerId,
            attackType: isHeavy ? "heavy" : attackType,
            radius: isHeavy ? range : undefined,
          });
        }
      }

      const sideDeadzone = 8;
      if (rika.anchorSide !== -1 && rika.anchorSide !== 1) {
        rika.anchorSide = rika.x <= owner.x ? -1 : 1;
      }
      const relX = rika.x - owner.x;
      if (relX < -sideDeadzone) {
        rika.anchorSide = -1;
      } else if (relX > sideDeadzone) {
        rika.anchorSide = 1;
      }
      rika.facing = rika.anchorSide < 0 ? 1 : -1;

      if (rika.state === "follow") {
        const offsetX = rika.anchorSide * companion.followDistance;
        const targetX = owner.x + offsetX;
        const targetY = owner.y;
        const followLerp = 0.24;

        rika.targetId = null;

        const dx = targetX - rika.x;
        const dy = targetY - rika.y;
        rika.x += dx * followLerp;
        rika.y += dy * followLerp;

        let closestTarget = null;
        let closestDist = companion.detectRange;
        this.enemies.forEach((enemy) => {
          if (!enemy.alive) return;
          const d = distance(owner.x, owner.y, enemy.x, enemy.y);
          if (d < closestDist) {
            closestDist = d;
            closestTarget = enemy;
          }
        });
        this.players.forEach((p) => {
          if (!p.alive || p.id === ownerId) return;
          if (!this.config.match.friendlyFire) return;
          const d = distance(owner.x, owner.y, p.x, p.y);
          if (d < closestDist) {
            closestDist = d;
            closestTarget = p;
          }
        });

        if (closestTarget) {
          rika.state = "advance";
          rika.targetId = closestTarget.id;
        }
      }

      if (rika.state === "advance") {
        const target = this.findRikaTarget(rika.targetId);
        if (!target || !target.alive) {
          rika.state = "follow";
          rika.targetId = null;
        } else {
          const d = distance(rika.x, rika.y, target.x, target.y);
          if (d > companion.detectRange * 1.5) {
            rika.state = "follow";
            rika.targetId = null;
          } else {
            const inAttackRange = d <= companion.attackRange + target.radius + 6;
            if (inAttackRange) {
              rika.state = "attack";
            } else {
              const toTarget = normalize(target.x - rika.x, target.y - rika.y);
              rika.x += toTarget.x * companion.moveSpeed * dt;
              rika.y += toTarget.y * companion.moveSpeed * dt;
            }
          }
        }
      }

      if (rika.state === "attack") {
        const target = this.findRikaTarget(rika.targetId);
        if (!target || !target.alive) {
          rika.state = "follow";
          rika.targetId = null;
        } else {
          const d = distance(rika.x, rika.y, target.x, target.y);
          if (d > companion.detectRange * 1.5) {
            rika.state = "follow";
            rika.targetId = null;
          } else if (d > companion.attackRange + target.radius + 10) {
            rika.state = "advance";
          } else if (rika.timer === Infinity && rika.attackTimer <= 0) {
            rika.attackCounter = (Number.isFinite(rika.attackCounter) ? rika.attackCounter : 0) + 1;
            const heavyEvery = Math.max(1, Math.floor(companion.heavyEvery || 10));
            const isHeavy = rika.attackCounter % heavyEvery === 0;
            const toTarget = normalize(target.x - rika.x, target.y - rika.y);
            if (isHeavy) {
              rika.attackTimer = companion.heavyCooldown;
              const impactX = target.x;
              const impactY = target.y;
              const heavyRadius = companion.heavyRadius;
              const heavyDamage = companion.heavyDamage * owner.modifiers.rikaDamageMul;
              this.enemies.forEach((enemy) => {
                if (!enemy.alive) return;
                const distToImpact = distance(enemy.x, enemy.y, impactX, impactY);
                if (distToImpact > heavyRadius + enemy.radius) return;
                this.combat.applyDamage({
                  target: enemy,
                  source: owner,
                  amount: heavyDamage,
                  kind: "rikaHeavy",
                  knockback: companion.heavyKnockback,
                  knockbackDistanceCap: companion.heavyKnockbackDistance,
                  fromX: impactX,
                  fromY: impactY,
                });
              });
              this.players.forEach((p) => {
                if (!p.alive || p.id === ownerId) return;
                if (!this.config.match.friendlyFire) return;
                const distToImpact = distance(p.x, p.y, impactX, impactY);
                if (distToImpact > heavyRadius + p.radius) return;
                this.combat.applyDamage({
                  target: p,
                  source: owner,
                  amount: heavyDamage,
                  kind: "rikaHeavy",
                  knockback: companion.heavyKnockback,
                  knockbackDistanceCap: companion.heavyKnockbackDistance,
                  fromX: impactX,
                  fromY: impactY,
                });
              });
              this.emitEventNear(rika.x, rika.y, {
                type: "rikaCompanionAttack",
                x: impactX,
                y: impactY,
                ownerId,
                dirX: toTarget.x,
                dirY: toTarget.y,
                attackType: "heavy",
                radius: heavyRadius,
              });
            } else {
              const isPlayerTarget = target.kind === "player";
              if (isPlayerTarget && !this.config.match.friendlyFire) {
                rika.attackTimer = 0;
              } else {
                rika.attackTimer = companion.cooldown;
                this.combat.applyDamage({
                  target,
                  source: owner,
                  amount: companion.damage * owner.modifiers.rikaDamageMul,
                  kind: "rika",
                  knockback: companion.knockback,
                  fromX: rika.x,
                  fromY: rika.y,
                });
                this.emitEventNear(rika.x, rika.y, {
                  type: "rikaCompanionAttack",
                  x: rika.x,
                  y: rika.y,
                  ownerId,
                  dirX: toTarget.x,
                  dirY: toTarget.y,
                  attackType: "normal",
                });
              }
            }
          }
        }
      }
    });
  }

  tryCastRika(player) {
    const kit = this.getKit(player);
    const cooldown = kit.rika.cooldown * player.modifiers.rikaCooldownMul;
    if (!this.canUseSkill(player, kit.rika.energy, "q", cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);

    if (this.rikas.has(player.id)) {
      const rika = this.rikas.get(player.id);
      let nearestEnemy = null;
      let nearestDist = Infinity;
      this.enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        const d = distance(rika.x, rika.y, enemy.x, enemy.y);
        if (d < nearestDist && d <= kit.rika.impulseDetectRange) {
          nearestDist = d;
          nearestEnemy = enemy;
        }
      });
      if (nearestEnemy) {
        player.cast = {
          type: "rikaImpulse",
          timer: kit.rika.startup,
          dirX: aim.x,
          dirY: aim.y,
          targetId: nearestEnemy.id,
        };
      } else {
        player.cast = {
          type: "rikaDash",
          timer: kit.rika.startup,
          dirX: aim.x,
          dirY: aim.y,
        };
      }
    } else {
      player.rikaBuffTime = kit.cursedWave ? kit.cursedWave.comboWindow : 3;
      player.cast = {
        type: "rika",
        timer: kit.rika.startup,
        dirX: aim.x,
        dirY: aim.y,
      };
    }
    return true;
  }

  fireRika(player, cast) {
    const kit = this.getKit(player);
    const aim = normalize(cast.dirX, cast.dirY);
    const damage = kit.rika.damage * player.modifiers.rikaDamageMul;

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
          amount: damage,
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
          amount: damage,
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

  fireRikaImpulse(player, cast) {
    const kit = this.getKit(player);
    const rika = this.rikas.get(player.id);
    if (!rika) return;
    const damage = kit.rika.impulseDamage * player.modifiers.rikaDamageMul;

    let targetEnemy = null;
    this.enemies.forEach((enemy) => {
      if (enemy.id === cast.targetId && enemy.alive) {
        targetEnemy = enemy;
      }
    });

    if (targetEnemy) {
      this.combat.applyDamage({
        target: targetEnemy,
        source: player,
        amount: damage,
        kind: "rikaImpulse",
        knockback: kit.rika.impulseKnockback,
        fromX: rika.x,
        fromY: rika.y,
      });
    }

    this.enemies.forEach((enemy) => {
      if (!enemy.alive || enemy.id === cast.targetId) return;
      const d = distance(rika.x, rika.y, enemy.x, enemy.y);
      if (d <= kit.rika.impulseRadius + enemy.radius) {
        this.combat.applyDamage({
          target: enemy,
          source: player,
          amount: damage * 0.5,
          kind: "rikaImpulse",
          knockback: kit.rika.impulseKnockback * 0.6,
          fromX: rika.x,
          fromY: rika.y,
        });
      }
    });

    this.players.forEach((other) => {
      if (other.id === player.id || !other.alive) return;
      if (!this.config.match.friendlyFire) return;
      const d = distance(rika.x, rika.y, other.x, other.y);
      if (d <= kit.rika.impulseRadius + other.radius) {
        this.combat.applyDamage({
          target: other,
          source: player,
          amount: damage * 0.5,
          kind: "rikaImpulse",
          knockback: kit.rika.impulseKnockback * 0.6,
          fromX: rika.x,
          fromY: rika.y,
        });
      }
    });

    this.emitEventNear(rika.x, rika.y, {
      type: "rikaImpulse",
      x: rika.x,
      y: rika.y,
      radius: kit.rika.impulseRadius,
      playerId: player.id,
    });
  }

  fireRikaDash(player, cast) {
    const kit = this.getKit(player);
    const rika = this.rikas.get(player.id);
    if (!rika) return;
    const startX = rika.x;
    const startY = rika.y;
    const dist = kit.rika.dashDistance;
    rika.x += cast.dirX * dist;
    rika.y += cast.dirY * dist;

    rika.x = Math.max(0, Math.min(this.map ? this.map.width || 4000 : 4000, rika.x));
    rika.y = Math.max(0, Math.min(this.map ? this.map.height || 3000 : 3000, rika.y));

    this.emitEventNear(startX, startY, {
      type: "rikaDash",
      startX,
      startY,
      endX: rika.x,
      endY: rika.y,
      playerId: player.id,
    });
  }

  tryCastDashSlash(player) {
    const kit = this.getKit(player);
    const comboActive = player.rikaBuffTime > 0 && player.character === "yuta";
    const energyCost = comboActive ? YUTA.cursedWave.energy : kit.dashSlash.energy;
    const cd = comboActive ? YUTA.cursedWave.cooldown : kit.dashSlash.cooldown;
    if (!this.canUseSkill(player, energyCost, "space", cd)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    if (Math.abs(aim.x) < 0.001 && Math.abs(aim.y) < 0.001) {
      aim.x = 1;
    }
    if (comboActive) {
      player.rikaBuffTime = 0;
      player.cast = {
        type: "cursedWave",
        timer: YUTA.cursedWave.startup,
        dirX: aim.x,
        dirY: aim.y,
      };
    } else {
      player.cast = {
        type: "dashSlash",
        timer: kit.dashSlash.startup,
        dirX: aim.x,
        dirY: aim.y,
      };
    }
    return true;
  }

  fireDashSlash(player, cast) {
    const kit = this.getKit(player);
    const dirX = cast.dirX;
    const dirY = cast.dirY;
    const dist = kit.dashSlash.distance * player.modifiers.dashSlashRangeMul;

    // Start sliding dash (no damage at cast time)
    player.dashSlash = {
      dirX,
      dirY,
      remainingDist: dist,
      startX: player.x,
      startY: player.y,
    };

    this.emitEventNear(player.x, player.y, {
      type: "dashSlashStart",
      x: player.x,
      y: player.y,
      playerId: player.id,
      dirX,
      dirY,
    });
  }

  applyDashSlashAoE(source, x, y, damage, radius, knockback) {
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const d = distance(x, y, enemy.x, enemy.y);
      if (d <= radius + enemy.radius) {
        this.combat.applyDamage({
          target: enemy,
          source,
          amount: damage,
          kind: "dashSlash",
          knockback,
          fromX: x,
          fromY: y,
        });
      }
    });
    this.players.forEach((target) => {
      if (target.id === source.id || !target.alive) return;
      if (!this.config.match.friendlyFire) return;
      const d = distance(x, y, target.x, target.y);
      if (d <= radius + target.radius) {
        this.combat.applyDamage({
          target,
          source,
          amount: damage,
          kind: "dashSlash",
          knockback,
          fromX: x,
          fromY: y,
        });
      }
    });
  }

  tryCastFullRika(player) {
    const kit = this.getKit(player);
    if (player.character !== "yuta") return false;
    if (this.rikas.has(player.id)) return false;
    if (!this.canUseSkill(player, kit.fullRika.energy, "e", kit.fullRika.cooldown)) {
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
    const duration = kit.fullRika.duration * player.modifiers.fullRikaDurationMul;
    const existing = this.rikas.get(player.id);
    const wasPermanent = existing && existing.timer === Infinity;
    const anchorSide = existing && (existing.anchorSide === 1 || existing.anchorSide === -1)
      ? existing.anchorSide
      : -1;
    this.rikas.set(player.id, {
      x: player.x,
      y: player.y,
      ownerId: player.id,
      timer: duration,
      attackTimer: 0.5,
      facing: anchorSide < 0 ? 1 : -1,
      anchorSide,
      state: "follow",
      targetId: null,
      attackCounter: 0,
      _restorePermanent: wasPermanent,
    });
    this.emitEventNear(player.x, player.y, {
      type: "fullRika",
      x: player.x,
      y: player.y,
      playerId: player.id,
      duration,
    });
  }

  tryCastPureLove(player) {
    const kit = this.getKit(player);
    if (player.character !== "yuta") return false;
    if (!this.rikas.has(player.id)) return false;
    if (!this.canUseSkill(player, kit.pureLove.energy, "r", kit.pureLove.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "pureLove",
      timer: kit.pureLove.startup,
      dirX: aim.x,
      dirY: aim.y,
    };
    const chargeOffset = 150;
    this.emitEventNear(player.x, player.y, {
      type: "pureLoveCharge",
      x: player.x + aim.x * chargeOffset,
      y: player.y + aim.y * chargeOffset,
      playerId: player.id,
      dirX: aim.x,
      dirY: aim.y,
      duration: kit.pureLove.startup,
    });
    return true;
  }

  firePureLove(player, cast) {
    const kit = this.getKit(player);
    const dir = normalize(cast.dirX, cast.dirY);
    const width = kit.pureLove.radius * player.modifiers.pureLoveRadiusMul;
    const offset = kit.pureLove.beamOffset || 60;

    this.pureLoveBeams.set(player.id, {
      x: player.x + dir.x * offset,
      y: player.y + dir.y * offset,
      dirX: dir.x,
      dirY: dir.y,
      width: width,
      beamLength: kit.pureLove.beamLength,
      lifetime: 4.0,
      totalLifetime: 4.0,
      ownerId: player.id,
      hitTimes: new Map(),
    });

    this.emitEventNear(player.x, player.y, {
      type: "pureLoveBeam",
      playerId: player.id,
      x: player.x + dir.x * offset,
      y: player.y + dir.y * offset,
      dirX: dir.x,
      dirY: dir.y,
      width: width,
      lifetime: 4.0,
    });
  }

  updatePureLoveBeams(dt) {
    this.pureLoveBeams.forEach((beam, ownerId) => {
      const owner = this.players.get(ownerId);
      if (!owner || !owner.alive) {
        this.pureLoveBeams.delete(ownerId);
        return;
      }
      if (!beam._domainCopy && !this.rikas.has(ownerId)) {
        this.pureLoveBeams.delete(ownerId);
        return;
      }

      beam.lifetime -= dt;
      if (beam.lifetime <= 0) {
        this.pureLoveBeams.delete(ownerId);
        return;
      }

      const kit = this.getKit(owner);

      // Slow redirection toward player aim (or nearest enemy in domain)
      let targetDir;
      if (this.domainSystem.hasActiveDomain(ownerId)) {
        const t = this.findNearestEnemyInDomain(ownerId, beam.x, beam.y);
        if (t) {
          targetDir = normalize(t.x - beam.x, t.y - beam.y);
        }
      }
      if (!targetDir) {
        targetDir = normalize(owner.aimX - owner.x, owner.aimY - owner.y);
      }
      const currentAngle = Math.atan2(beam.dirY, beam.dirX);
      const targetAngle = Math.atan2(targetDir.y, targetDir.x);
      let angleDiff = targetAngle - currentAngle;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      const maxRotation = kit.pureLove.redirectSpeed * dt;
      const rotation = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxRotation);
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const newDirX = beam.dirX * cos - beam.dirY * sin;
      const newDirY = beam.dirX * sin + beam.dirY * cos;
      beam.dirX = newDirX;
      beam.dirY = newDirY;

      // Update beam origin position
      const offset = kit.pureLove.beamOffset || 60;
      beam.x = owner.x + beam.dirX * offset;
      beam.y = owner.y + beam.dirY * offset;

      // Continuous damage
      const beamLength = kit.pureLove.beamLength;
      let endX = beam.x + beam.dirX * beamLength;
      let endY = beam.y + beam.dirY * beamLength;
      const totalDamage = kit.pureLove.damage * owner.modifiers.pureLoveDamageMul;
      const damagePerTick = totalDamage * dt / 4.0;
      const knockbackPerTick = kit.pureLove.knockback * dt / 4.0;
      const hitInterval = 0.15;
      const now = this.elapsedSeconds;

      if (beam._fullLength == null) {
        beam._fullLength = beam.beamLength;
      }

      const barrierHit = this.findFirstDomainBarrierIntersection(beam.x, beam.y, endX, endY);
      if (barrierHit) {
        endX = barrierHit.x;
        endY = barrierHit.y;
        const dx = endX - beam.x;
        const dy = endY - beam.y;
        beam.beamLength = Math.sqrt(dx * dx + dy * dy);
        this.domainSystem.damageBarrier(barrierHit.domain.ownerId, damagePerTick * 0.45, ownerId);
      } else {
        if (beam.beamLength !== beam._fullLength) {
          beam.beamLength = beam._fullLength;
        }
      }

      this.enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        const distToSegment = distancePointToSegment(enemy.x, enemy.y, beam.x, beam.y, endX, endY);
        if (distToSegment > beam.width / 2 + enemy.radius) return;

        const lastHit = beam.hitTimes.get(enemy.id) || -Infinity;
        if (now - lastHit < hitInterval) return;
        beam.hitTimes.set(enemy.id, now);

        this.combat.applyDamage({
          target: enemy,
          source: owner,
          amount: damagePerTick,
          kind: "pureLove",
          knockback: knockbackPerTick,
          fromX: beam.x,
          fromY: beam.y,
        });
      });

      this.players.forEach((target) => {
        if (target.id === ownerId || !target.alive) return;
        if (!this.config.match.friendlyFire) return;
        const distToSegment = distancePointToSegment(target.x, target.y, beam.x, beam.y, endX, endY);
        if (distToSegment > beam.width / 2 + target.radius) return;

        const lastHit = beam.hitTimes.get(target.id) || -Infinity;
        if (now - lastHit < hitInterval) return;
        beam.hitTimes.set(target.id, now);

        this.combat.applyDamage({
          target,
          source: owner,
          amount: damagePerTick,
          kind: "pureLove",
          knockback: knockbackPerTick,
          fromX: beam.x,
          fromY: beam.y,
        });
      });
    });
  }

  fireCursedWave(player, cast) {
    const kit = this.getKit(player);
    const dirX = cast.dirX;
    const dirY = cast.dirY;
    const waveRange = kit.cursedWave.range;
    const waveWidth = kit.cursedWave.width;
    const damage = kit.cursedWave.damage * player.modifiers.pureLoveDamageMul;
    const knockback = kit.cursedWave.knockback;
    const toX = player.x + dirX * waveRange;
    const toY = player.y + dirY * waveRange;

    const canHit = (target) => {
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > waveRange + target.radius + waveWidth * 0.5) {
        return false;
      }
      const forward = dx * dirX + dy * dirY;
      if (forward < -target.radius || forward > waveRange + target.radius + waveWidth * 0.5) {
        return false;
      }
      const cutDist = distancePointToSegment(target.x, target.y, player.x, player.y, toX, toY);
      return cutDist <= target.radius + waveWidth * 0.5;
    };

    const processTarget = (target) => {
      if (!target.alive) return;
      if (target.kind === "player" && target.id === player.id) {
        this.combat.applyDamage({
          target,
          source: player,
          amount: Math.round(damage * 0.35),
          kind: "cursedWave",
          knockback: knockback * 0.4,
          fromX: player.x,
          fromY: player.y,
        });
        return;
      }
      if (!canHit(target)) return;
      this.combat.applyDamage({
        target,
        source: player,
        amount: damage,
        kind: "cursedWave",
        knockback,
        fromX: player.x,
        fromY: player.y,
      });
    };

    this.players.forEach(processTarget);
    this.enemies.forEach(processTarget);

    this.emitEventNear(player.x, player.y, {
      type: "cursedWave",
      x: player.x,
      y: player.y,
      playerId: player.id,
      dirX,
      dirY,
      range: waveRange,
      width: waveWidth,
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

  findEnemyById(id) {
    let found = null;
    this.enemies.forEach((enemy) => {
      if (enemy.id === id) found = enemy;
    });
    return found;
  }

  findNearestEnemy(x, y) {
    let nearest = null;
    let bestDist = Infinity;
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const d = distance(x, y, enemy.x, enemy.y);
      if (d < bestDist) {
        bestDist = d;
        nearest = enemy;
      }
    });
    return nearest;
  }

  findNearestEnemyInDomain(ownerId, x, y) {
    const domain = this.domainSystem.domains.get(ownerId);
    if (!domain) return null;
    let nearest = null;
    let bestDist = Infinity;
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const d = distance(x, y, enemy.x, enemy.y);
      if (d >= bestDist) return;
      if (distance(enemy.x, enemy.y, domain.x, domain.y) <= domain.radius + enemy.radius) {
        bestDist = d;
        nearest = enemy;
      }
    });
    return nearest;
  }

  findRikaTarget(id) {
    if (!id) return null;
    if (id.startsWith("p")) {
      return this.players.get(id) || null;
    }
    return this.findEnemyById(id);
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
        vx: Math.round(player.vx * 100) / 100,
        vy: Math.round(player.vy * 100) / 100,
        hp: Math.round(player.hp * 10) / 10,
        maxHp: player.maxHp,
        energy: Math.round(player.energy * 10) / 10,
        maxEnergy: player.maxEnergy,
        alive: player.alive,
        level: player.level,
        kills: player.kills,
        deaths: player.deaths,
        animState: player.animState,
        invuln: player.invulnTimer > 0,
        rikaActive: this.rikas.has(player.id),
        rikaX: (() => { const r = this.rikas.get(player.id); return r ? Math.round(r.x * 10) / 10 : undefined; })(),
        rikaY: (() => { const r = this.rikas.get(player.id); return r ? Math.round(r.y * 10) / 10 : undefined; })(),
        rikaFacing: (() => { const r = this.rikas.get(player.id); return r ? r.facing : undefined; })(),
        rikaState: (() => { const r = this.rikas.get(player.id); return r ? r.state : undefined; })(),
        pureLoveActive: this.pureLoveBeams.has(player.id),
        pureLoveX: (() => { const b = this.pureLoveBeams.get(player.id); return b ? Math.round(b.x * 10) / 10 : undefined; })(),
        pureLoveY: (() => { const b = this.pureLoveBeams.get(player.id); return b ? Math.round(b.y * 10) / 10 : undefined; })(),
        pureLoveDirX: (() => { const b = this.pureLoveBeams.get(player.id); return b ? Math.round(b.dirX * 100) / 100 : undefined; })(),
        pureLoveDirY: (() => { const b = this.pureLoveBeams.get(player.id); return b ? Math.round(b.dirY * 100) / 100 : undefined; })(),
        pureLoveWidth: (() => { const b = this.pureLoveBeams.get(player.id); return b ? Math.round(b.width * 10) / 10 : undefined; })(),
        pureLoveBeamLength: (() => { const b = this.pureLoveBeams.get(player.id); return b ? b.beamLength : undefined; })(),
        pureLoveLifetime: (() => { const b = this.pureLoveBeams.get(player.id); return b ? Math.round(b.lifetime * 10) / 10 : undefined; })(),
        pureLoveTotalLifetime: (() => { const b = this.pureLoveBeams.get(player.id); return b ? b.totalLifetime : undefined; })(),
      });
    });

    const enemies = [];
    this.enemies.forEach((enemy) => {
      enemies.push({
        id: enemy.id,
        type: enemy.type,
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        hp: Math.round(enemy.hp * 10) / 10,
        maxHp: enemy.maxHp,
        alive: enemy.alive,
        state: enemy.state,
        frozen: enemy.freezeTimer > 0,
        freezeLeft: Math.round(enemy.freezeTimer * 100) / 100,
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
        life: Math.round((p.lifetime - p.age) * 100) / 100,
        traveled: Math.round(p.traveled * 10) / 10,
        vx: Math.round(p.vx * 1000) / 1000,
        vy: Math.round(p.vy * 1000) / 1000,
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
      const hash = this._fastHash(item);
      if (cacheMap.get(key) !== hash) {
        cacheMap.set(key, hash);
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

    return { changed, removed };
  }

  _fastHash(obj) {
    let h = 5381;
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const val = obj[keys[i]];
      if (val === null || val === undefined || typeof val === "object") continue;
      const str = keys[i] + ":" + String(val);
      for (let j = 0; j < str.length; j++) {
        h = ((h << 5) + h) + str.charCodeAt(j);
        h |= 0;
      }
    }
    return h;
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
        elapsedSec: Math.round(this.elapsedSeconds * 10) / 10,
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
            q: Math.round(player.cooldowns.q * 100) / 100,
            e: Math.round(player.cooldowns.e * 100) / 100,
            r: Math.round(player.cooldowns.r * 100) / 100,
            space: Math.round(player.cooldowns.space * 100) / 100,
            f: Math.round(player.cooldowns.f * 100) / 100,
            dodge: Math.round(player.dodgeCooldown * 100) / 100,
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
          skillLock: this.domainSystem.isSkillLockedForPlayer(player),
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
