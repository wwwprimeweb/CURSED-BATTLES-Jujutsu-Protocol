"use strict";

const { generateMap } = require("./mapGenerator");
const { createPlayer, BASE_STATS } = require("../entities/player");
const { createProjectile } = require("../entities/projectile");
const { CombatSystem } = require("../systems/combatSystem");
const { EnemySystem } = require("../systems/enemySystem");
const { ProgressionSystem } = require("../systems/progressionSystem");
const { DomainSystem } = require("../systems/domainSystem");
const { O_HONRADO } = require("../gameplay/oHonradoKit");
const { PORTADOR_DO_VINCULO } = require("../gameplay/portadorDoVinculoKit");
const { PUNHO_INDOMAVEL } = require("../gameplay/punhoIndomavelKit");
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

const YUJI_OWN_DOMAIN_BLACK_FLASH_BONUS = 0.10;
const YUJI_OWN_DOMAIN_SPEED_MULTIPLIER = 1.30;
const YUJI_OWN_DOMAIN_ENERGY_REGEN_MULTIPLIER = 1.15;
const DOMAIN_OPENING_DURATION = 2.5;

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
    const radius = BASE_STATS["o-honrado"].radius;
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
    console.log(`[DIAG] addPlayer called: name="${name}", character="${character || 'o-honrado'}", sessionToken="${sessionToken.slice(0,8)}..."`);

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

    const { getAllDefs } = require("../entities/enemyRegistry");
    const { createEnemy } = require("../entities/enemy");
    this.queueDelayedAction(0.5, () => {
      for (const def of getAllDefs()) {
        const count = def.grade === 3 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 120 + Math.random() * 160;
          const x = Math.max(30, Math.min(this.map.width - 30, player.x + Math.cos(angle) * dist));
          const y = Math.max(30, Math.min(this.map.height - 30, player.y + Math.sin(angle) * dist));
          const id = `e${this.nextEnemyId++}`;
          const enemy = createEnemy(id, def.type, x, y, 1);
          this.enemies.set(id, enemy);
        }
      }
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
      const base = BASE_STATS[player.character] || BASE_STATS["o-honrado"];
      player.maxHp = base.maxHp;
      player.baseMaxHp = base.maxHp;
      player.maxEnergy = base.maxEnergy;
      player.baseMaxEnergy = base.maxEnergy;
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
      player.dashSlash = null;
      player.flyingKnee = null;
      player.invulnTimer = 0;
      player.stunTimer = 0;
      player.hitFlash = 0;
      player.staringStacks = 0;
      player.staringAccumTimer = 0;
      player.staringDecayTimer = 0;
      player.comboStep = 0;
      player.comboResetTimer = 0;
      player.m1Timer = 0;
      player.m1AnimTimer = 0;
      player.taidoBeatdownAnimState = null;
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

  isYujiInsideOwnDomain(player) {
    if (!player || !player.alive || player.character !== "punho-indomavel") {
      return false;
    }
    const ownDomain = this.domainSystem.domains.get(player.id);
    if (!ownDomain) {
      return false;
    }
    return distance(player.x, player.y, ownDomain.x, ownDomain.y) <= ownDomain.radius;
  }

  updatePlayers(dt) {
    this.players.forEach((player) => {
      player.hitFlash = Math.max(0, player.hitFlash - dt);
      player.invulnTimer = Math.max(0, player.invulnTimer - dt);
      player.stunTimer = Math.max(0, player.stunTimer - dt);
      player.stunFxTimer = Math.max(0, (player.stunFxTimer || 0) - dt);
      player.stunVisualTimer = Math.max(0, (player.stunVisualTimer || 0) - dt);
      player.comboResetTimer = Math.max(0, player.comboResetTimer - dt);
      player.m1Timer = Math.max(0, player.m1Timer - dt);
      player.m1AnimTimer = Math.max(0, player.m1AnimTimer - dt);
      player.animLockTimer = Math.max(0, player.animLockTimer - dt);
      player.domainRevealTimer = Math.max(0, (player.domainRevealTimer || 0) - dt);
      player.dodgeTimer = Math.max(0, player.dodgeTimer - dt);
      if (player.rikaBuffTime > 0) {
        player.rikaBuffTime = Math.max(0, player.rikaBuffTime - dt);
      }
      if (player.almaAbaladaTimer > 0) {
        player.almaAbaladaTimer = Math.max(0, player.almaAbaladaTimer - dt);
        if (player.almaAbaladaTimer <= 0) {
          player.modifiers.energyRegenMul = 1;
        }
      }

      if (!player.alive) {
        player.respawnTimer = -1;
        return;
      }

      if (player.stunVisualTimer > 0 && player.stunFxTimer <= 0) {
        player.stunFxTimer = 0.12 + this.rng.range(0, 0.06);
        this.emitEventNear(player.x, player.y, {
          type: "stunTick",
          x: player.x,
          y: player.y,
          targetKind: "player",
          targetId: player.id,
        });
      }

      const yujiOwnDomainRegenMul = this.isYujiInsideOwnDomain(player)
        ? YUJI_OWN_DOMAIN_ENERGY_REGEN_MULTIPLIER
        : 1;

      const canRecover = !(player.cast && player.cast.type === "domain")
        && !this.domainSystem.hasActiveDomain(player.id)
        && player.domainExhaustionTimer <= 0;
      const recoveryActive = canRecover && (this.now - (player.lastAttackAt || 0)) > 5000;
      const recoveryMul = recoveryActive ? 2 : 1;

      player.modifiers.damageReductionMul = recoveryActive ? 0.85 : 1.0;

      player.energy = Math.min(
        player.maxEnergy,
        player.energy + player.energyRegen * player.modifiers.energyRegenMul * yujiOwnDomainRegenMul * recoveryMul * dt
      );

      if (player.alive) {
        const hpRegenDelay = 8000;
        const timeSinceDamage = this.now - (player.lastDamageTaken || -Infinity);
        if (timeSinceDamage > hpRegenDelay) {
          const regenAmount = player.maxHp * 0.01 * dt;
          player.hp = Math.min(player.maxHp, player.hp + regenAmount);
        }
      }

      Object.keys(player.cooldowns).forEach((key) => {
        player.cooldowns[key] = Math.max(0, player.cooldowns[key] - dt);
      });
      player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt);
      player.domainExhaustionTimer = Math.max(0, player.domainExhaustionTimer - dt);

      this.resolveCasting(player, dt);
      const skillLockedAtTickStart = this.domainSystem.isSkillLockedForPlayer(player);
      this.resolveInput(player, dt, skillLockedAtTickStart);

      if (this.domainSystem.hasActiveDomain(player.id)) {
        if (player.domainRevealTimer <= 0 && player.input.f) {
          player.domainCancelTimer = Math.min(3, player.domainCancelTimer + dt);
          if (player.domainCancelTimer >= 3) {
            this.domainSystem.collapseDomain(player.id, null, false);
            player.domainCancelTimer = 0;
          }
        } else {
          player.domainCancelTimer = 0;
        }
      } else {
        player.domainCancelTimer = 0;
      }

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
    if (player.character === "portador-do-vinculo") {
      this.rikas.delete(player.id);
      this.pureLoveBeams.delete(player.id);
    }
    player.dashSlash = null;
    player.flyingKnee = null;
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
    if (player.cast.type === "red" && player.cast.timer > 0) {
      const aim = normalize(player.aimX - player.x, player.aimY - player.y);
      if (aim.len > 0.001) {
        player.cast.dirX = aim.x;
        player.cast.dirY = aim.y;
      }
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
    } else if (cast.type === "domainCopy") {
      this.fireDomainCopy(player, cast);
    } else if (cast.type === "domainCopyFire") {
      this.fireDomainCopyFire(player, cast);
    } else if (cast.type === "divergentFist") {
      this.fireDivergentFist(player, cast);
    } else if (cast.type === "flyingKnee") {
      this.fireFlyingKnee(player, cast);
    } else if (cast.type === "soulImpact") {
      this.fireSoulImpact(player, cast);
    } else if (cast.type === "taidoBeatdown") {
      this.fireTaidoBeatdown(player, cast);
    }
  }

  resolveInput(player, dt, skillLockedAtTickStart) {
    const input = player.input;
    const isBeatdownCasting = player.cast && (player.cast.type === "taidoBeatdown" || player.cast.type === "taidoBeatdownAttack");

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
      const staringSlow = 1 - (player.staringStacks || 0) * 0.10;
      const slideSpeed = kit.dashSlash.slideSpeed * Math.max(0.2, staringSlow);
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

    if (player.flyingKnee) {
      player.aimX = input.aimX;
      player.aimY = input.aimY;
      const moveAmount = Math.min(player.flyingKnee.remainingDist, player.flyingKnee.speed * dt);
      this.moveEntityWithCollisions(player, player.flyingKnee.dirX * moveAmount, player.flyingKnee.dirY * moveAmount);
      player.flyingKnee.remainingDist -= moveAmount;

      const kit = this.getKit(player);
      const radius = kit.flyingKnee.radius;
      const damage = kit.flyingKnee.damage * player.modifiers.damageMul;
      let hitTarget = null;
      this.players.forEach((target) => {
        if (hitTarget || target.id === player.id || !target.alive) return;
        if (!this.config.match.friendlyFire && target.kind === "player") return;
        if (distance(player.x, player.y, target.x, target.y) <= radius + target.radius) {
          hitTarget = target;
        }
      });
      if (!hitTarget) {
        this.enemies.forEach((enemy) => {
          if (hitTarget || !enemy.alive) return;
          if (distance(player.x, player.y, enemy.x, enemy.y) <= radius + enemy.radius) {
            hitTarget = enemy;
          }
        });
      }

      if (hitTarget) {
        this.combat.applyDamage({
          target: hitTarget,
          source: player,
          amount: damage,
          kind: "flyingKnee",
          knockback: 400,
          fromX: player.flyingKnee.startX,
          fromY: player.flyingKnee.startY,
        });
        hitTarget.stunTimer = Math.max(hitTarget.stunTimer || 0, kit.flyingKnee.stunDuration);
        this.emitEventNear(player.x, player.y, {
          type: "flyingKnee",
          x: player.x,
          y: player.y,
          playerId: player.id,
          hit: true,
        });
        player.flyingKnee = null;
      } else if (player.flyingKnee.remainingDist <= 0) {
        this.emitEventNear(player.x, player.y, {
          type: "flyingKnee",
          x: player.x,
          y: player.y,
          playerId: player.id,
          hit: false,
        });
        player.flyingKnee = null;
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
    const isDomainPreparing = isDomainCasting || player.domainRevealTimer > 0;
    const isCharging = player.cast && (player.cast.type === "purple");
    const isPureLoveCharging = player.cast && (player.cast.type === "pureLove" || player.cast.type === "domainCopyFire");
    if (isPureLoveCharging) {
      const curAim = normalize(player.aimX - player.x, player.aimY - player.y);
      player.cast.dirX = curAim.x;
      player.cast.dirY = curAim.y;
    }
    const castSlow = isBeatdownCasting ? 0 : isPureLoveCharging ? 0 : isCharging ? 0.72 : isDomainPreparing ? 0 : 1;
    const domainSlow = this.domainSystem.getPlayerSlowFactor(player);
    const yujiOwnDomainSpeedMul = this.isYujiInsideOwnDomain(player)
      ? YUJI_OWN_DOMAIN_SPEED_MULTIPLIER
      : 1;
    const yutaDomainSpeedMul = this.domainSystem.getOwnerDomainSpeedMul(player);
    const staringSlow = 1 - (player.staringStacks || 0) * 0.10;
    const moveSpeed = player.moveSpeed * player.modifiers.speedMul * yutaDomainSpeedMul * yujiOwnDomainSpeedMul * castSlow * domainSlow * staringSlow;
    if (isBeatdownCasting) {
      player.vx = 0;
      player.vy = 0;
    } else {
      player.vx = moveNorm.x * moveSpeed;
      player.vy = moveNorm.y * moveSpeed;
    }

    if (!isDomainPreparing && !isBeatdownCasting) {
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

    if (!isDomainPreparing && !player.cast && !skillLockedAtTickStart && player.domainExhaustionTimer <= 0) {
      const chara = player.character || "o-honrado";
      const domainActive = this.domainSystem.hasActiveDomain(player.id);
      if (chara === "portador-do-vinculo" || chara === "invocador-de-sombras") {
        if (qPressed) {
          this.tryCastRika(player);
        } else if (ePressed) {
          this.tryCastFullRika(player);
        } else if (rPressed) {
          this.tryCastPureLove(player);
        } else if (spacePressed) {
          this.tryCastDashSlash(player);
        } else if (fPressed && domainActive) {
          this.tryCastDomainCopy(player);
        } else if (fPressed && !domainActive) {
          this.tryCastDomain(player);
        }
      } else if (chara === "punho-indomavel") {
        if (qPressed) {
          this.tryCastDivergentFist(player);
        } else if (ePressed) {
          this.tryCastSoulImpact(player);
        } else if (rPressed) {
          this.tryCastTaidoBeatdown(player);
        } else if (spacePressed) {
          this.tryCastFlyingKnee(player);
        } else if (fPressed && !domainActive) {
          this.tryCastDomain(player);
        }
      } else {
        if (qPressed) {
          this.tryCastBlue(player);
        } else if (ePressed) {
          this.tryCastRed(player);
        } else if (rPressed) {
          this.tryCastPurple(player);
        } else if (spacePressed) {
          this.tryCastTeleport(player);
        } else if (fPressed && !domainActive) {
          this.tryCastDomain(player);
        }
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

    if ((player.cast && player.cast.type === "domain") || player.domainRevealTimer > 0) {
      player.animState = "domain_prepare";
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
    if (player.cast && player.cast.type === "soulImpact") {
      player.animState = "skill2";
      player.statePriority = 4;
      return;
    }
    if (player.cast && player.cast.type === "taidoBeatdown") {
      player.animState = "skill3_prepare";
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
    if (player.cast && player.cast.type === "divergentFist") {
      player.animState = "q";
      player.statePriority = 5;
      return;
    }
    if (player.cast && player.cast.type === "taidoBeatdownAttack") {
      player.animState = player.taidoBeatdownAnimState || "taido_1";
      player.statePriority = 3;
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
    if (player.cast && player.cast.type === "flyingKnee") {
      player.animState = "teleport";
      player.statePriority = 6;
      return;
    }
    if (player.flyingKnee) {
      player.animState = "teleport";
      player.statePriority = 6;
      return;
    }
    if (player.dodgeTimer > 0) {
      player.animState = "dodge";
      player.statePriority = 6;
      return;
    }
    if (player.animLockTimer > 0) {
      return;
    }
    if (player.m1AnimTimer > 0) {
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
    const dodgeSlow = Math.max(0.2, 1 - (player.staringStacks || 0) * 0.10);
    this.moveEntityWithCollisions(player, dirX * player.dodgeDistance * dodgeSlow, dirY * player.dodgeDistance * dodgeSlow, true);

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
    if (player.m1Timer > 0 || player.m1AnimTimer > 0 || !player.alive) {
      return false;
    }
    const kit = this.getKit(player);
    const isYutaSlash = player.character === "portador-do-vinculo";
    const stepDurations = kit.m1.stepDurations || [kit.m1.animDuration || kit.m1.cooldown];
    const nextStep = (player.comboStep % 3) + 1;
    const m1AnimDuration = stepDurations[nextStep - 1] ?? (kit.m1.animDuration || kit.m1.cooldown);

    const baseM1Damage = kit.m1.damage * player.modifiers.m1DamageMul;
    const baseBlackFlashChance = player.character === "o-honrado" ? 0.01 : player.character === "punho-indomavel" ? 0.05 : 0.01;
    const blackFlashChance = this.isYujiInsideOwnDomain(player)
      ? Math.min(1, baseBlackFlashChance + YUJI_OWN_DOMAIN_BLACK_FLASH_BONUS)
      : baseBlackFlashChance;

    player.m1Timer = kit.m1.cooldown;
    player.m1AnimTimer = m1AnimDuration;
    player.comboStep = nextStep;
    player.comboResetTimer = 0.9;
    player.lastAttackAt = this.now;

    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    const m1DirX = Number.isFinite(aim.x) ? aim.x : 0;
    const m1DirY = Number.isFinite(aim.y) ? aim.y : 0;

    const slashDirX = isYutaSlash && Math.abs(m1DirX) < 0.001 && Math.abs(m1DirY) < 0.001 ? 1 : m1DirX;
    const slashDirY = isYutaSlash && Math.abs(m1DirX) < 0.001 && Math.abs(m1DirY) < 0.001 ? 0 : m1DirY;
    let slashRange = kit.m1.range;
    const coneAngle = isYutaSlash ? (kit.m1.coneAngle || 1.4) : 0;

    let coneThreshold = 0.2;
    if (player.character === "o-honrado") {
      coneThreshold = 0.1;
    }
    if (player.character === "punho-indomavel") {
      const step = (player.comboStep - 1) % 4;
      slashRange = (kit.m1.stepRanges || [])[step] ?? kit.m1.range;
      coneThreshold = (kit.m1.stepCones || [])[step] ?? 0.2;
    }

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

      if (player.character === "punho-indomavel") {
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const isHeavy = player.comboStep >= 3;
        const rectLength = isHeavy ? 112 : 96;
        const rectWidth = isHeavy ? 75 : 65;
        const forwardDist = dx * m1DirX + dy * m1DirY;
        const sideDist = dx * (-m1DirY) + dy * m1DirX;
        return forwardDist >= -target.radius
          && forwardDist <= rectLength + target.radius
          && Math.abs(sideDist) <= (rectWidth / 2) + target.radius;
      }

      const toTarget = normalize(target.x - player.x, target.y - player.y);
      const inRange = distance(player.x, player.y, target.x, target.y) <= slashRange + target.radius;
      const facing = dot(m1DirX, m1DirY, toTarget.x, toTarget.y) > coneThreshold;
      return inRange && facing;
    };

    const playerTargets = [];
    this.players.forEach((target) => {
      if (target.id === player.id || !target.alive) {
        return;
      }
      if (!this.config.match.friendlyFire && target.kind === "player") {
        return;
      }
      if (canM1HitTarget(target)) {
        playerTargets.push(target);
      }
    });

    const enemyTargets = [];
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      if (canM1HitTarget(enemy)) {
        enemyTargets.push(enemy);
      }
    });

    const hitEnemy = enemyTargets.length > 0;
    const isBlackFlash = hitEnemy && Math.random() < blackFlashChance;
    const m1Damage = baseM1Damage * (isBlackFlash ? 8 : 1);

    playerTargets.forEach((target) => {
      const knockbackVal = isBlackFlash ? 1200 : (player.comboStep === 3 ? (isYutaSlash ? 210 : 180) : (isYutaSlash ? 120 : 85));
      const knockbackCap = isBlackFlash ? 350 : 170;
      this.combat.applyDamage({
        target,
        source: player,
        amount: m1Damage,
        kind: "m1",
        knockback: knockbackVal,
        knockbackDistanceCap: knockbackCap,
        fromX: player.x,
        fromY: player.y,
        stunDuration: isBlackFlash ? 1.5 : 0,
        stunVisualDuration: isBlackFlash ? 1.5 : 0,
        sourceBlackFlash: isBlackFlash,
      });
    });

    enemyTargets.forEach((enemy) => {
      const knockbackVal = isBlackFlash ? 1200 : (player.comboStep === 3 ? (isYutaSlash ? 190 : 150) : (isYutaSlash ? 110 : 80));
      const knockbackCap = isBlackFlash ? 350 : 170;
      this.combat.applyDamage({
        target: enemy,
        source: player,
        amount: m1Damage,
        kind: "m1",
        knockback: knockbackVal,
        knockbackDistanceCap: knockbackCap,
        fromX: player.x,
        fromY: player.y,
        stunDuration: isBlackFlash ? 1.5 : 0,
        stunVisualDuration: isBlackFlash ? 1.5 : 0,
        sourceBlackFlash: isBlackFlash,
      });
    });

    this.emitEventNear(player.x, player.y, {
      type: "m1",
      x: player.x,
      y: player.y,
      dirX: slashDirX,
      dirY: slashDirY,
      combo: player.comboStep,
      playerId: player.id,
      character: player.character || "o-honrado",
      slashRange: isYutaSlash ? slashRange : undefined,
      coneAngle: isYutaSlash ? coneAngle : undefined,
      blackFlash: isBlackFlash || undefined,
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
    player.lastAttackAt = this.now;
    return true;
  }

  tryCastBlue(player) {
    if (!this.canUseSkill(player, O_HONRADO.blue.energy, "q", O_HONRADO.blue.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "blue",
      timer: O_HONRADO.blue.startup,
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
      speed: O_HONRADO.blue.speed,
      radius: O_HONRADO.blue.radius,
      lifetime: O_HONRADO.blue.lifetime * player.modifiers.blueDurationMul,
      damage: O_HONRADO.blue.tickDamage * player.modifiers.blueTickDamageMul,
      tickRate: O_HONRADO.blue.tickRate,
      pullRadius: O_HONRADO.blue.pullRadius * player.modifiers.blueRadiusMul,
      pullStrength: O_HONRADO.blue.pullStrength * player.modifiers.bluePullMul,
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
      dirX: cast.dirX,
      dirY: cast.dirY,
    });
  }

  tryCastRed(player) {
    if (!this.canUseSkill(player, O_HONRADO.red.energy, "e", O_HONRADO.red.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "red",
      timer: O_HONRADO.red.chargeTime,
      dirX: aim.x,
      dirY: aim.y,
    };
    this.emitEventNear(player.x, player.y, {
      type: "redChargeStart",
      ownerId: player.id,
      x: player.x + aim.x * 30,
      y: player.y + aim.y * 30,
      dirX: aim.x,
      dirY: aim.y,
    });
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
      speed: O_HONRADO.red.speed,
      radius: O_HONRADO.red.radius,
      lifetime: O_HONRADO.red.lifetime,
      damage: O_HONRADO.red.damage * player.modifiers.redDamageMul,
      knockback: O_HONRADO.red.knockback * player.modifiers.redKnockbackMul,
      color: "#ff4d6d",
      penetration: true,
      meta: {
        explosionRadius: O_HONRADO.red.explosionRadius * player.modifiers.redExplosionMul,
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
      dirX: cast.dirX,
      dirY: cast.dirY,
    });
  }

  tryCastPurple(player) {
    if (!this.canUseSkill(player, O_HONRADO.purple.energy, "r", O_HONRADO.purple.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "purple",
      timer: O_HONRADO.purple.charge,
      dirX: aim.x,
      dirY: aim.y,
    };
    this.emitEventNear(player.x, player.y, {
      type: "purpleCharge",
      x: player.x,
      y: player.y,
      ownerId: player.id,
      delay: O_HONRADO.purple.charge,
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
      speed: O_HONRADO.purple.speed,
      radius: 0,
      lifetime: O_HONRADO.purple.length / O_HONRADO.purple.speed + 0.08,
      damage: O_HONRADO.purple.damage * player.modifiers.purpleDamageMul,
      penetration: true,
      width: O_HONRADO.purple.width * player.modifiers.purpleWidthMul,
      length: O_HONRADO.purple.length * player.modifiers.purpleLengthMul,
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
    const cooldown = O_HONRADO.teleport.cooldown * player.modifiers.teleportCooldownMul;
    if (!this.canUseSkill(player, O_HONRADO.teleport.energy, "space", cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "teleport",
      timer: O_HONRADO.teleport.startup,
      dirX: aim.x,
      dirY: aim.y,
    };
    return true;
  }

  fireTeleport(player, cast) {
    const distanceValue = O_HONRADO.teleport.distance * player.modifiers.teleportDistanceMul;
    const dest = this.findTeleportDestination(player, cast.dirX, cast.dirY, distanceValue);

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
      O_HONRADO.teleport.recovery * player.modifiers.teleportRecoveryMul
    );

    this.emitEventNear(player.x, player.y, {
      type: "teleportEnd",
      x: player.x,
      y: player.y,
      ownerId: player.id,
    });
  }

  tryCastDivergentFist(player) {
    const kit = this.getKit(player);
    if (!this.canUseSkill(player, kit.divergentFist.energy, "q", kit.divergentFist.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "divergentFist",
      timer: kit.divergentFist.startup,
      dirX: aim.x,
      dirY: aim.y,
    };
    this.emitEventNear(player.x, player.y, {
      type: "divergentFistStart",
      x: player.x,
      y: player.y,
      playerId: player.id,
      dirX: aim.x,
      dirY: aim.y,
    });
    return true;
  }

  fireDivergentFist(player, cast) {
    const kit = this.getKit(player);
    const { damage, delayedDamage, delay, stunDuration, knockback, delayedKnockback, range, width } = kit.divergentFist;
    const { dirX, dirY } = cast;
    const hitTargets = [];

    const closeX = player.x + dirX * 35;
    const closeY = player.y + dirY * 35;
    const cursorX = player.x + dirX * 80;
    const cursorY = player.y + dirY * 80;

    const canHit = (target) => {
      const dx1 = target.x - closeX;
      const dy1 = target.y - closeY;
      if (Math.hypot(dx1, dy1) <= 45 + target.radius) return true;

      const dx2 = target.x - cursorX;
      const dy2 = target.y - cursorY;
      if (Math.hypot(dx2, dy2) <= 50 + target.radius) return true;

      return false;
    };

    const processTarget = (target) => {
      if (!target.alive) return;
      if (target.id === player.id) return;
      if (!this.config.match.friendlyFire && target.kind === "player") return;
      if (!canHit(target)) return;
      this.combat.applyDamage({
        target,
        source: player,
        amount: damage * player.modifiers.damageMul,
        kind: "divergentFist",
        knockback: kit.divergentFist.knockback,
        fromX: player.x,
        fromY: player.y,
      });
      hitTargets.push(target);
    };

    this.players.forEach(processTarget);
    this.enemies.forEach(processTarget);

    player.animLockTimer = 0.35;

    if (hitTargets.length > 0) {
      hitTargets.forEach((target) => {
        this.emitEventNear(target.x, target.y, {
          type: "punhoIndomavelSocoDefasado",
          x: target.x,
          y: target.y,
          playerId: player.id,
          dirX,
          dirY,
          range,
          width,
        });
      });

      this.queueDelayedAction(delay, () => {
        hitTargets.forEach((target) => {
          if (!target.alive) return;
          this.combat.applyDamage({
            target,
            source: player,
            amount: delayedDamage * player.modifiers.damageMul,
            kind: "divergentFistDelayed",
            knockback: delayedKnockback,
            fromX: player.x,
            fromY: player.y,
          });
          target.stunTimer = Math.max(target.stunTimer || 0, stunDuration);
          this.emitEventNear(target.x, target.y, {
            type: "divergentFistDelayed",
            x: target.x,
            y: target.y,
            playerId: player.id,
          });
        });
      });
    }
  }

  tryCastFlyingKnee(player) {
    const kit = this.getKit(player);
    if (!this.canUseSkill(player, kit.flyingKnee.energy, "space", kit.flyingKnee.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "flyingKnee",
      timer: kit.flyingKnee.startup,
      dirX: aim.x,
      dirY: aim.y,
    };
    return true;
  }

  fireFlyingKnee(player, cast) {
    const kit = this.getKit(player);
    const { distance, speed, radius, damage } = kit.flyingKnee;
    const { dirX, dirY } = cast;
    player.flyingKnee = {
      dirX,
      dirY,
      remainingDist: distance,
      speed,
      startX: player.x,
      startY: player.y,
    };
    player.aimX = player.x + dirX * 100;
    player.aimY = player.y + dirY * 100;

    this.emitEventNear(player.x, player.y, {
      type: "flyingKneeStart",
      x: player.x,
      y: player.y,
      playerId: player.id,
      dirX,
      dirY,
    });
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
            ownerId: projectile.ownerId,
            radius: projectile.meta ? projectile.meta.explosionRadius : O_HONRADO.red.explosionRadius,
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

      if (projectile.type === "red") {
        this.updateRedProjectile(projectile, dt);
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

  updateRedProjectile(projectile, dt) {
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
      projectile.x < -40 || projectile.y < -40 ||
      projectile.x > this.map.width + 40 || projectile.y > this.map.height + 40
    ) {
      this.projectiles.delete(projectile.id);
      return;
    }

    if (this.handleProjectileDomainBarrier(projectile, projectile.prevX, projectile.prevY, projectile.x, projectile.y)) {
      return;
    }

    if (this.isCollidingAnyObstacle(projectile.x, projectile.y, projectile.radius)) {
      this.projectiles.delete(projectile.id);
      return;
    }

    if (this.checkBlueRedReaction(projectile)) {
      this.projectiles.delete(projectile.id);
      return;
    }

    const owner = this.players.get(projectile.ownerId) || null;
    this.players.forEach((player) => {
      if (!player.alive || player.id === projectile.ownerId) return;
      if (projectile.hitTargets.has(player.id)) return;
      const d = distance(player.x, player.y, projectile.x, projectile.y);
      if (d <= projectile.radius + player.radius) {
        projectile.hitTargets.add(player.id);
        this.combat.applyDamage({
          target: player,
          source: owner,
          amount: projectile.damage,
          kind: "redExplosion",
          knockback: projectile.knockback,
          fromX: projectile.x,
          fromY: projectile.y,
        });
      }
    });
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      if (projectile.hitTargets.has(enemy.id)) return;
      const d = distance(enemy.x, enemy.y, projectile.x, projectile.y);
      if (d <= projectile.radius + enemy.radius) {
        projectile.hitTargets.add(enemy.id);
        this.combat.applyDamage({
          target: enemy,
          source: owner,
          amount: projectile.damage,
          kind: "redExplosion",
          knockback: projectile.knockback * 1.1,
          fromX: projectile.x,
          fromY: projectile.y,
        });
        this.emitEventNear(projectile.x, projectile.y, {
          type: "redHit",
          x: projectile.x,
          y: projectile.y,
        });
      }
    });
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
      projectileId: projectile.id,
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
    this.queueDelayedAction(O_HONRADO.collapse.delay, () => {
      this.spawnSpatialCollapse(reaction.x, reaction.y, redProjectile.ownerId);
    });
    this.emitEventAll({
      type: "blueRedReaction",
      x: reaction.x,
      y: reaction.y,
      ownerId: redProjectile.ownerId,
      delay: O_HONRADO.collapse.delay,
    });
    return true;
  }

  spawnSpatialCollapse(x, y, ownerId) {
    const owner = this.players.get(ownerId) || null;
    this.players.forEach((player) => {
      if (!player.alive) return;
      const d = distance(player.x, player.y, x, y);
      if (d <= O_HONRADO.collapse.radius + player.radius) {
        const distRatio = Math.max(0, d - player.radius) / O_HONRADO.collapse.radius;
        const falloff = Math.max(150 / 700, 1 - distRatio);
        const isOwner = player.id === ownerId;
        let amount = Math.round(O_HONRADO.collapse.damage * falloff);
        let kb = O_HONRADO.collapse.knockback;
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
      if (d <= O_HONRADO.collapse.radius + enemy.radius) {
        const distRatio = Math.max(0, d - enemy.radius) / O_HONRADO.collapse.radius;
        const falloff = Math.max(150 / 700, 1 - distRatio);
        const amount = Math.round(O_HONRADO.collapse.damage * falloff);
        this.combat.applyDamage({
          target: enemy,
          source: owner,
          amount,
          kind: "spatialCollapse",
          knockback: O_HONRADO.collapse.knockback * 0.8,
          fromX: x,
          fromY: y,
        });
      }
    });

    this.emitEventAll({
      type: "spatialCollapse",
      x,
      y,
      radius: O_HONRADO.collapse.radius,
    });
  }

  explodeRed(projectile) {
    const owner = this.players.get(projectile.ownerId) || null;
    const radius = projectile.meta.explosionRadius || O_HONRADO.red.explosionRadius;
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
      if (!player.alive || player.character !== "o-honrado") {
        return;
      }
      const d = distance(player.x, player.y, enemy.x, enemy.y);
      if (d <= O_HONRADO.passive.radius + enemy.radius) {
        factor *= 1 - O_HONRADO.passive.dashSlow;
      }
    });
    return clamp(factor, 0.2, 1);
  }

  getPassiveProjectileFactor(projectile) {
    let factor = 1;
    this.players.forEach((player) => {
      if (!player.alive || player.id === projectile.ownerId || player.character !== "o-honrado") {
        return;
      }
      if (this.domainSystem.hasActiveDomain(player.id)) {
        return;
      }
      const d = distance(player.x, player.y, projectile.x, projectile.y);
      if (d <= O_HONRADO.passive.radius) {
        factor *= 1 - O_HONRADO.passive.projectileSlow;
      }
    });
    return clamp(factor, 0.2, 1);
  }

  getKit(player) {
    return CHARACTER_REGISTRY[player.character] || O_HONRADO;
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

      const companion = PORTADOR_DO_VINCULO.rikaCompanion;

      // Pure Love retreat: Rika goes behind Yuta during R ability
      const isPureLoveCharging = owner.cast && owner.cast.type === "pureLove";
      const isPureLoveFiring = this.pureLoveBeams.has(ownerId);
      if (isPureLoveCharging || isPureLoveFiring) {
        let dirX, dirY;
        if (isPureLoveFiring) {
          const beam = this.pureLoveBeams.get(ownerId);
          dirX = beam.dirX;
          dirY = beam.dirY;
        } else {
          dirX = owner.cast.dirX;
          dirY = owner.cast.dirY;
        }
        const retreatDistance = companion.followDistance * 0.6;
        const targetX = owner.x - dirX * retreatDistance;
        const targetY = owner.y - dirY * retreatDistance;
        const retreatLerp = 0.12;
        rika.x += (targetX - rika.x) * retreatLerp;
        rika.y += (targetY - rika.y) * retreatLerp;
        rika.state = "retreat";
        rika.facing = dirX < 0 ? -1 : 1;
        return;
      }

      if (rika.state === "retreat") {
        rika.state = "follow";
      }

      rika.attackTimer = Math.max(0, (Number.isFinite(rika.attackTimer) ? rika.attackTimer : 0) - dt);

      // Full Rika timer-based auto-attack (enemies and players in range)
      if (rika.timer !== Infinity && rika.attackTimer <= 0) {
        let hasTarget = false;
        this.enemies.forEach((enemy) => {
          if (!enemy.alive) return;
          const d = distance(rika.x, rika.y, enemy.x, enemy.y);
          if (d <= PORTADOR_DO_VINCULO.fullRika.range + enemy.radius) hasTarget = true;
        });
        this.players.forEach((p) => {
          if (!p.alive || p.id === ownerId) return;
          if (!this.config.match.friendlyFire) return;
          const d = distance(rika.x, rika.y, p.x, p.y);
          if (d <= PORTADOR_DO_VINCULO.fullRika.range + p.radius) hasTarget = true;
        });
        if (!hasTarget) {
          rika.attackTimer = 0;
        } else {
          rika.attackTimer = PORTADOR_DO_VINCULO.fullRika.attackInterval;
          rika.attackCounter = (Number.isFinite(rika.attackCounter) ? rika.attackCounter : 0) + 1;
          const isHeavy = rika.attackCounter % 10 === 0;

          const attackType = Math.random() < 0.4 ? "slam" : Math.random() < 0.6 ? "grab" : "swipe";
          const baseDamage = attackType === "slam" ? PORTADOR_DO_VINCULO.fullRika.slamDamage
            : attackType === "grab" ? PORTADOR_DO_VINCULO.fullRika.grabDamage
            : PORTADOR_DO_VINCULO.fullRika.swipeDamage;
          const damage = (isHeavy ? baseDamage * 2 : baseDamage) * owner.modifiers.fullRikaPowerMul;
          const knockback = isHeavy
            ? (attackType === "slam" ? PORTADOR_DO_VINCULO.fullRika.slamKnockback * 2
              : attackType === "grab" ? PORTADOR_DO_VINCULO.fullRika.grabThrow * 2
              : PORTADOR_DO_VINCULO.fullRika.swipeKnockback * 2)
            : (attackType === "slam" ? PORTADOR_DO_VINCULO.fullRika.slamKnockback
              : attackType === "grab" ? PORTADOR_DO_VINCULO.fullRika.grabThrow
              : PORTADOR_DO_VINCULO.fullRika.swipeKnockback);
          const range = isHeavy ? PORTADOR_DO_VINCULO.fullRika.range * 0.75 : PORTADOR_DO_VINCULO.fullRika.range;

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
            dirX: rika.facing,
            dirY: 0,
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
      if (this.pureLoveBeams.has(owner.id)) {
        const beam = this.pureLoveBeams.get(owner.id);
        rika.facing = beam.dirX < 0 ? -1 : 1;
      } else {
        rika.facing = rika.anchorSide < 0 ? 1 : -1;
      }

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
    if (this.rikas.has(player.id)) {
      const rika = this.rikas.get(player.id);
      const aim = normalize(player.aimX - player.x, player.aimY - player.y);
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
        const dx = nearestEnemy.x - rika.x;
        const dy = nearestEnemy.y - rika.y;
        const toTarget = normalize(dx, dy);
        player.cast = {
          type: "rikaImpulse",
          timer: kit.rika.startup,
          dirX: toTarget.x,
          dirY: toTarget.y,
          targetId: nearestEnemy.id,
          targetX: nearestEnemy.x,
          targetY: nearestEnemy.y,
        };
      } else {
const aim = normalize(input.aimX - player.x, input.aimY - player.y);
        const dashDist = kit.rika.dashDistance;
        player.cast = {
          type: "rikaImpulse",
          timer: kit.rika.startup,
          dirX: aim.x,
          dirY: aim.y,
          targetX: rika.x + aim.x * dashDist,
          targetY: rika.y + aim.y * dashDist,
        };
      }
    } else {
      // Incomplete Rika: goes toward cursor (up to max range)
      const dx = player.aimX - player.x;
      const dy = player.aimY - player.y;
      const cursorDist = Math.hypot(dx, dy);
      const maxRange = kit.rika.range;
      const actualRange = Math.min(cursorDist, maxRange);
      const nx = cursorDist > 0.001 ? dx / cursorDist : 1;
      const ny = cursorDist > 0.001 ? dy / cursorDist : 0;
      const targetX = player.x + nx * actualRange;
      const targetY = player.y + ny * actualRange;
      player.rikaBuffTime = kit.cursedWave ? kit.cursedWave.comboWindow : 3;
      player.cast = {
        type: "rika",
        timer: kit.rika.startup,
        dirX: nx,
        dirY: ny,
        targetX,
        targetY,
        incomplete: true,
      };
      this.emitEventNear(player.x, player.y, {
        type: "rika",
        x: player.x,
        y: player.y,
        dirX: nx,
        dirY: ny,
        playerId: player.id,
        targetX,
        targetY,
        incomplete: true,
      });
    }
    return true;
  }

  fireRika(player, cast) {
    const kit = this.getKit(player);
    const damage = kit.rika.damage * player.modifiers.rikaDamageMul;
    const radius = kit.rika.radius;
    const knockback = kit.rika.knockback * player.modifiers.rikaDamageMul;
    const targetX = cast.targetX;
    const targetY = cast.targetY;

    // Rika: 360° area centered at explosion point
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const d = distance(targetX, targetY, enemy.x, enemy.y);
      if (d <= radius + enemy.radius) {
        this.combat.applyDamage({
          target: enemy,
          source: player,
          amount: damage,
          kind: "rika",
          knockback,
          fromX: targetX,
          fromY: targetY,
        });
      }
    });
    this.players.forEach((target) => {
      if (target.id === player.id || !target.alive) return;
      if (!this.config.match.friendlyFire) return;
      const d = distance(targetX, targetY, target.x, target.y);
      if (d <= radius + target.radius) {
        this.combat.applyDamage({
          target,
          source: player,
          amount: damage,
          kind: "rika",
          knockback,
          fromX: targetX,
          fromY: targetY,
        });
      }
    });

  }

  fireRikaImpulse(player, cast) {
    const kit = this.getKit(player);
    const rika = this.rikas.get(player.id);
    if (!rika) return;
    const damage = kit.rika.impulseDamage * player.modifiers.rikaDamageMul;

    const startX = rika.x;
    const startY = rika.y;

    if (cast.targetX !== undefined && cast.targetY !== undefined) {
      const dx = cast.targetX - rika.x;
      const dy = cast.targetY - rika.y;
      const dirX = cast.dirX || 1;
      const dirY = cast.dirY || 0;
      const dist = Math.hypot(dx, dy);
      const maxDash = kit.rika.dashDistance;
      const dashDist = Math.min(dist, maxDash);
      rika.x += dirX * dashDist;
      rika.y += dirY * dashDist;
      rika.x = Math.max(0, Math.min(this.map ? this.map.width || 4000 : 4000, rika.x));
      rika.y = Math.max(0, Math.min(this.map ? this.map.height || 3000 : 3000, rika.y));
    }

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
      startX,
      startY,
      endX: rika.x,
      endY: rika.y,
      x: rika.x,
      y: rika.y,
      radius: kit.rika.impulseRadius,
      playerId: player.id,
    });
  }

  tryCastDashSlash(player) {
    const kit = this.getKit(player);
    const comboActive = player.rikaBuffTime > 0 && player.character === "portador-do-vinculo";
    const energyCost = comboActive ? PORTADOR_DO_VINCULO.cursedWave.energy : kit.dashSlash.energy;
    const cd = comboActive ? PORTADOR_DO_VINCULO.cursedWave.cooldown : kit.dashSlash.cooldown;
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
        timer: PORTADOR_DO_VINCULO.cursedWave.startup,
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
    if (player.character !== "portador-do-vinculo") return false;
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
      attackTimer: 1.5,
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
    if (player.character !== "portador-do-vinculo") return false;
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
        if (beam._tempRika) {
          const rika = this.rikas.get(ownerId);
          if (rika) {
            this.emitEventNear(rika.x, rika.y, {
              type: "rikaDisappear",
              x: rika.x,
              y: rika.y,
            });
          }
          this.rikas.delete(ownerId);
        }
        this.pureLoveBeams.delete(ownerId);
        return;
      }
      if (!beam._domainCopy && !this.rikas.has(ownerId)) {
        this.pureLoveBeams.delete(ownerId);
        return;
      }

      beam.lifetime -= dt;
      if (beam.lifetime <= 0) {
        if (beam._tempRika) {
          const rika = this.rikas.get(ownerId);
          if (rika) {
            this.emitEventNear(rika.x, rika.y, {
              type: "rikaDisappear",
              x: rika.x,
              y: rika.y,
            });
          }
          this.rikas.delete(ownerId);
        }
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
      const knockbackPerTick = kit.pureLove.knockback * dt * 5.0;
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

    if (constrained.blocked) {
      entity.vx = 0;
      entity.vy = 0;
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
        character: player.character || "o-honrado",
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
        recoveryActive: !(player.cast && player.cast.type === "domain")
          && !this.domainSystem.hasActiveDomain(player.id)
          && player.domainExhaustionTimer <= 0
          && (this.now - (player.lastAttackAt || 0)) > 5000,
        invuln: player.invulnTimer > 0,
        stunned: player.stunTimer > 0,
        stunVisual: (player.stunVisualTimer || 0) > 0,
        frozen: player.domainFrozen || false,
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
        aimX: Math.round(player.aimX),
        aimY: Math.round(player.aimY),
        staringStacks: player.staringStacks || 0,
      });
    });

    const enemies = [];
    this.enemies.forEach((enemy) => {
      let svx = Math.round(enemy.vx * 100) / 100;
      let svy = Math.round(enemy.vy * 100) / 100;
      if (enemy.state === "frozen" || enemy.state === "pressureBarrier" || enemy.state === "stunned" || enemy.state === "windup") {
        svx = 0;
        svy = 0;
      }
      if (enemy.type === "staring_beast" && Math.abs(svx) < 5 && Math.abs(svy) > Math.abs(svx) * 6) {
        svx = 0;
      }
      enemies.push({
        id: enemy.id,
        type: enemy.type,
        grade: enemy.grade,
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        vx: svx,
        vy: svy,
        attackDirX: enemy.attackDirX || 0,
        attackDirY: enemy.attackDirY || 0,
        hp: Math.round(enemy.hp * 10) / 10,
        maxHp: enemy.maxHp,
        alive: enemy.alive,
        state: enemy.state,
        windupTimer: Math.round(enemy.windupTimer * 100) / 100,
        attackWindup: enemy.attackWindup,
        frozen: enemy.freezeTimer > 0,
        freezeLeft: Math.round(enemy.freezeTimer * 100) / 100,
        stunned: (enemy.stunTimer || 0) > 0,
        stunLeft: Math.round((enemy.stunTimer || 0) * 100) / 100,
        stunVisual: (enemy.stunVisualTimer || 0) > 0,
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
        pullRadius: p.pullRadius,
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

  tryCastDomain(player) {
    const kit = this.getKit(player);
    if (!this.canUseSkill(player, kit.domain.energyInitial, "f", kit.domain.cooldown)) {
      return false;
    }
    player.cast = {
      type: "domain",
      timer: kit.domain.startup,
    };
    return true;
  }

  fireDomain(player) {
    if (this.domainSystem.activateDomain(player)) {
      player.domainRevealTimer = DOMAIN_OPENING_DURATION;
    }
  }

  findTeleportDestination(player, dirX, dirY, distance) {
    const baseSpeed = 1;
    const stepSize = 6;
    const steps = Math.ceil(distance / stepSize);
    let lastPassable = { x: player.x, y: player.y };

    for (let i = 1; i <= steps; i += 1) {
      const dist = i * stepSize;
      const nx = player.x + dirX * dist;
      const ny = player.y + dirY * dist;

      if (nx < player.radius || nx > this.map.width - player.radius) break;
      if (ny < player.radius || ny > this.map.height - player.radius) break;

      if (this.isCollidingAnyObstacle(nx, ny, player.radius)) break;

      lastPassable = { x: nx, y: ny };
    }

    return lastPassable;
  }

  handleProjectileDomainBarrier(projectile, fromX, fromY, toX, toY) {
    const hit = this.findFirstDomainBarrierIntersection(fromX, fromY, toX, toY);
    if (hit) {
      this.breakProjectileOnBarrier(projectile, hit);
      return true;
    }
    return false;
  }

  findFirstDomainBarrierIntersection(fromX, fromY, toX, toY) {
    if (!this.domainSystem || this.domainSystem.domains.size === 0) {
      return null;
    }
    let closest = null;
    let closestDist = Infinity;

    const lineLen = distance(fromX, fromY, toX, toY);
    if (lineLen < 0.0001) return null;
    const dirX = (toX - fromX) / lineLen;
    const dirY = (toY - fromY) / lineLen;

    this.domainSystem.domains.forEach((domain) => {
      const ox = fromX - domain.x;
      const oy = fromY - domain.y;
      const b = 2 * (ox * dirX + oy * dirY);
      const c = ox * ox + oy * oy - domain.radius * domain.radius;
      const disc = b * b - 4 * c;
      if (disc < 0) return;

      const sqrtDisc = Math.sqrt(disc);
      const t1 = (-b - sqrtDisc) / 2;
      const t2 = (-b + sqrtDisc) / 2;
      let t = -1;
      if (c < 0) {
        if (t2 >= 0 && t2 <= lineLen) t = t2;
      } else {
        if (t1 >= 0 && t1 <= lineLen) t = t1;
        else if (t2 >= 0 && t2 <= lineLen) t = t2;
      }
      if (t < 0) return;

      const hitX = fromX + dirX * t;
      const hitY = fromY + dirY * t;
      if (t < closestDist) {
        closestDist = t;
        closest = { x: hitX, y: hitY, domain };
      }
    });

    return closest;
  }

  breakProjectileOnBarrier(projectile, hit) {
    if (projectile.type === "purple") {
      this.domainSystem.damageBarrier(hit.domain.ownerId, projectile.damage, projectile.ownerId);
    }
    this.projectiles.delete(projectile.id);
  }

  fireCopiedPureLove(player, cast) {
    const playerKit = this.getKit(player);
    const kit = PORTADOR_DO_VINCULO.pureLove;
    const dir = normalize(cast.dirX, cast.dirY);
    const width = kit.radius;
    const offset = 60;

    const needsRika = cast.needsRika === true;

    this.pureLoveBeams.set(player.id, {
      x: player.x + dir.x * offset,
      y: player.y + dir.y * offset,
      dirX: dir.x,
      dirY: dir.y,
      width: width,
      beamLength: kit.beamLength,
      lifetime: 4.0,
      totalLifetime: 4.0,
      ownerId: player.id,
      hitTimes: new Map(),
      _domainCopy: true,
      _tempRika: needsRika,
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

  fireCopiedPurple(player, cast) {
    const aim = normalize(cast.dirX, cast.dirY);
    const kit = { damage: O_HONRADO.purple.damage * 0.7, speed: O_HONRADO.purple.speed, length: O_HONRADO.purple.length, width: O_HONRADO.purple.width };
    this.projectiles.set(crypto.randomUUID(), {
      id: crypto.randomUUID(),
      type: "purple",
      x: player.x,
      y: player.y,
      prevX: player.x,
      prevY: player.y,
      ownerId: player.id,
      ownerKind: "player",
      vx: aim.x,
      vy: aim.y,
      speed: kit.speed,
      damage: kit.damage,
      radius: 10,
      width: kit.width,
      length: kit.length,
      lifetime: kit.length / kit.speed + 0.2,
      age: 0,
      traveled: 0,
      tickTimer: 0,
      hitTargets: new Set(),
      pullRadius: 0,
      pullStrength: 0,
      tickRate: 999,
      sureHit: true,
      homingStrength: 4.0,
      meta: {
        startX: player.x,
        startY: player.y,
      },
    });
  }

  spawnEnemyProjectile(owner, type, x, y, dirX, dirY) {
    this.projectiles.set(crypto.randomUUID(), {
      id: crypto.randomUUID(),
      type,
      x,
      y,
      prevX: x,
      prevY: y,
      ownerId: owner ? owner.id : null,
      ownerKind: "enemy",
      vx: dirX,
      vy: dirY,
      speed: 140,
      damage: 18,
      radius: 8,
      width: 8,
      length: Infinity,
      lifetime: 8,
      age: 0,
      traveled: 0,
      tickTimer: 0,
      hitTargets: new Set(),
      pullRadius: 0,
      pullStrength: 0,
      tickRate: 999,
      sureHit: false,
      homingStrength: 0,
      meta: {},
    });
  }

  fireDomainCopy(player, cast) {
    const domain = this.domainSystem.domains.get(player.id);
    const copiedChar = domain ? domain.copiedCharacter : null;

    if (copiedChar === "punho-indomavel") {
      const { range } = PUNHO_INDOMAVEL.taidoBeatdown;
      let hasTarget = false;
      const canHit = (t) => {
        if (!t.alive || t.id === player.id) return false;
        if (!this.config.match.friendlyFire && t.kind === "player") return false;
        return distance(player.x, player.y, t.x, t.y) <= range + t.radius;
      };
      this.players.forEach((t) => { if (!hasTarget && canHit(t)) hasTarget = true; });
      this.enemies.forEach((t) => { if (!hasTarget && canHit(t)) hasTarget = true; });

      if (!hasTarget) {
        this.emitEventToPlayer(player.id, {
          type: "skillNoTarget",
          skill: "Taido Beatdown (cÃ³pia)",
        });
        return;
      }

      if (domain) domain.copyUsed = true;
      const originalChar = player.character;
      player.character = "punho-indomavel";
      this.fireTaidoBeatdown(player, cast);
      player.character = originalChar;
      return;
    }

    if (domain) domain.copyUsed = true;

    if (copiedChar === "o-honrado" || copiedChar === "rei-amaldicoado" || copiedChar === "lutador-de-sorte") {
      this.firePurple(player, cast);
      return;
    }

    this.fireCopiedPureLove(player, cast);
  }

  fireDomainCopyFire(player, cast) {
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
      _domainCopy: true,
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

  tryCastSoulImpact(player) {
    const kit = this.getKit(player);
    if (!this.canUseSkill(player, kit.soulImpact.energy, "e", kit.soulImpact.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    this.emitEventNear(player.x, player.y, {
      type: "soulImpactStart",
      x: player.x,
      y: player.y,
      playerId: player.id,
      dirX: aim.x,
      dirY: aim.y,
    });
    player.cast = {
      type: "soulImpact",
      timer: kit.soulImpact.startup,
      dirX: aim.x,
      dirY: aim.y,
    };
    return true;
  }

  fireSoulImpact(player, cast) {
    const kit = this.getKit(player);
    const { damage, range, knockback, debuffDuration, debuffPenalty, stunDuration } = kit.soulImpact;
    const dirX = cast.dirX;
    const dirY = cast.dirY;

    const hitX = player.x + dirX * 75;
    const hitY = player.y - 90;
    const closeX = player.x + dirX * 30;
    const closeY = player.y - 50;
    const hitTargets = [];

    const canHit = (target) => {
      const distMain = distance(hitX, hitY, target.x, target.y);
      if (distMain <= range + target.radius) {
        const toTarget = normalize(target.x - hitX, target.y - hitY);
        if (dot(dirX, dirY, toTarget.x, toTarget.y) > 0.2) return true;
      }
      const distClose = distance(closeX, closeY, target.x, target.y);
      if (distClose <= 60 + target.radius) return true;
      return false;
    };

    this.players.forEach((target) => {
      if (target.id === player.id || !target.alive) return;
      if (!this.config.match.friendlyFire && target.kind === "player") return;
      if (canHit(target)) {
        hitTargets.push(target);
      }
    });

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      if (canHit(enemy)) {
        hitTargets.push(enemy);
      }
    });

    hitTargets.forEach((target) => {
      this.combat.applyDamage({
        target,
        source: player,
        amount: damage * player.modifiers.damageMul,
        kind: "soulImpact",
        knockback,
        fromX: player.x,
        fromY: player.y,
        stunDuration: stunDuration || 0,
        stunVisualDuration: stunDuration || 0,
      });
      if (target.kind === "player") {
        target.almaAbaladaTimer = Math.max(target.almaAbaladaTimer || 0, debuffDuration);
        target.modifiers.energyRegenMul = 1 - debuffPenalty;
      }
    });

    this.emitEventNear(player.x, player.y, {
      type: "soulImpact",
      x: player.x,
      y: player.y,
      playerId: player.id,
      miss: hitTargets.length === 0,
      dirX,
      dirY,
    });
  }

  tryCastTaidoBeatdown(player) {
    const kit = this.getKit(player);
    const range = kit.taidoBeatdown.range;

    let hasTarget = false;
    const canHit = (t) => {
      if (!t.alive || t.id === player.id) return false;
      if (!this.config.match.friendlyFire && t.kind === "player") return false;
      return distance(player.x, player.y, t.x, t.y) <= range + t.radius;
    };
    this.players.forEach((t) => { if (!hasTarget && canHit(t)) hasTarget = true; });
    this.enemies.forEach((t) => { if (!hasTarget && canHit(t)) hasTarget = true; });

    if (!hasTarget) {
      this.emitEventToPlayer(player.id, {
        type: "skillNoTarget",
        skill: "Sequência Brutal",
      });
      return false;
    }

    if (!this.canUseSkill(player, kit.taidoBeatdown.energy, "r", kit.taidoBeatdown.cooldown)) {
      return false;
    }
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    player.cast = {
      type: "taidoBeatdown",
      timer: kit.taidoBeatdown.startup,
      dirX: aim.x,
      dirY: aim.y,
    };
    return true;
  }

  fireTaidoBeatdown(player, cast) {
    const kit = this.getKit(player);
    const { hits, damagePerHit, finalDamage, finalKnockback, range, stunDuration, finalStunDuration, hitDelay } = kit.taidoBeatdown;
    const dirX = cast.dirX;
    const dirY = cast.dirY;
    const taidoStates = ["taido_1", "taido_2", "taido_3", "taido_4", "taido_1"];

    const canHit = (target) => {
      if (!target.alive) return false;
      if (target.id === player.id) return false;
      if (!this.config.match.friendlyFire && target.kind === "player") return false;
      return distance(player.x, player.y, target.x, target.y) <= range + target.radius;
    };

    const hitTargets = [];
    this.players.forEach((target) => { if (canHit(target)) hitTargets.push(target); });
    this.enemies.forEach((target) => { if (canHit(target)) hitTargets.push(target); });

    player.taidoBeatdownAnimState = "skill3_prepare";

    for (let i = 0; i < hits; i += 1) {
      this.queueDelayedAction(i * hitDelay, () => {
        const state = taidoStates[i % taidoStates.length];
        player.taidoBeatdownAnimState = state;
        player.animState = state;
        player.animLockTimer = hitDelay + 0.05;
        hitTargets.forEach((target) => {
          if (!target.alive || !canHit(target)) return;
          this.combat.applyDamage({
            target,
            source: player,
            amount: damagePerHit * player.modifiers.damageMul,
            kind: "taidoBeatdown",
            knockback: 30,
            fromX: player.x,
            fromY: player.y,
            stunDuration: stunDuration,
          });
          this.emitEventNear(target.x, target.y, {
            type: "taidoBeatdownHit",
            x: target.x,
            y: target.y,
            playerId: player.id,
            hitNum: i,
          });
        });
      });
    }

    this.queueDelayedAction(hits * hitDelay, () => {
      player.taidoBeatdownAnimState = "taido_4";
      player.animState = "taido_4";
      player.animLockTimer = hitDelay + 0.15;
      hitTargets.forEach((target) => {
        if (!target.alive || !canHit(target)) return;
        this.combat.applyDamage({
          target,
          source: player,
          amount: finalDamage * player.modifiers.damageMul,
          kind: "taidoBeatdown",
          knockback: finalKnockback,
          fromX: player.x,
          fromY: player.y,
          stunDuration: finalStunDuration || stunDuration,
        });
        this.emitEventNear(target.x, target.y, {
          type: "taidoBeatdownFinal",
          x: target.x,
          y: target.y,
          playerId: player.id,
          hitNum: hits,
          dirX,
          dirY,
          shakeIntensity: 10,
          shakeDuration: 0.16,
        });
      });
    });

    this.emitEventNear(player.x, player.y, {
      type: "taidoBeatdown",
      x: player.x,
      y: player.y,
      playerId: player.id,
      dirX,
      dirY,
      hitCount: hitTargets.length,
    });

    // Keep attack animation active during the hit sequence
    const attackDuration = hits * hitDelay + hitDelay;
    player.cast = { type: "taidoBeatdownAttack", timer: attackDuration };
  }

  tryCastDomainCopy(player) {
    if (!player.alive) return false;
    const domain = this.domainSystem.domains.get(player.id);
    if (domain && domain.copyUsed) {
      this.emitEventToPlayer(player.id, { type: "domainCopyUsed" });
      return false;
    }
    const kit = this.getKit(player);
    const aim = normalize(player.aimX - player.x, player.aimY - player.y);
    const copiedChar = domain ? domain.copiedCharacter : null;

    if (domain && !copiedChar) {
      const needsRika = !this.rikas.has(player.id);
      const startup = kit.pureLove.startup;
      if (needsRika) {
        this.rikas.set(player.id, {
          x: player.x - aim.x * 60,
          y: player.y - aim.y * 60,
          ownerId: player.id,
          timer: Infinity,
          anchorSide: -1,
          facing: 1,
          state: "follow",
          targetId: null,
          attackCounter: 0,
        });
        this.emitEventNear(player.x, player.y, {
          type: "rikaAppear",
          x: player.x - aim.x * 60,
          y: player.y - aim.y * 60,
          playerId: player.id,
        });
      }
      player.cast = {
        type: "domainCopy",
        timer: startup,
        dirX: aim.x,
        dirY: aim.y,
        needsRika,
      };
      const chargeOffset = 150;
      this.emitEventNear(player.x, player.y, {
        type: "pureLoveCharge",
        x: player.x + aim.x * chargeOffset,
        y: player.y + aim.y * chargeOffset,
        playerId: player.id,
        dirX: aim.x,
        dirY: aim.y,
        duration: startup,
      });
    } else {
      let startup;
      if (copiedChar === "punho-indomavel") {
        startup = PUNHO_INDOMAVEL.taidoBeatdown.startup;
      } else if (copiedChar === "o-honrado" || copiedChar === "rei-amaldicoado" || copiedChar === "lutador-de-sorte") {
        startup = O_HONRADO.purple.charge;
      } else {
        startup = kit.pureLove.startup;
      }
      player.cast = {
        type: "domainCopy",
        timer: startup,
        dirX: aim.x,
        dirY: aim.y,
      };
    }
    return true;
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
          character: player.character || "o-honrado",
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
          hasActiveDomain: this.domainSystem.hasActiveDomain(player.id),
          domainCancelTime: Number(player.domainCancelTimer.toFixed(2)),
          status: {
            stunTimer: Number((player.stunTimer || 0).toFixed(1)),
            invulnTimer: Number((player.invulnTimer || 0).toFixed(1)),
            almaAbaladaTimer: Number((player.almaAbaladaTimer || 0).toFixed(1)),
            rikaBuffTime: Number((player.rikaBuffTime || 0).toFixed(1)),
            domainExhaustionTimer: Number((player.domainExhaustionTimer || 0).toFixed(1)),
            staringStacks: player.staringStacks || 0,
            energyRecoveryTime: (() => {
              if (player.cast && player.cast.type === "domain") return 0;
              if (this.domainSystem.hasActiveDomain(player.id)) return 0;
              if (player.domainExhaustionTimer > 0) return 0;
              const t = Math.max(0, this.now - (player.lastAttackAt || 0));
              const sec = t / 1000;
              return sec > 5 ? Number(Math.min(999, sec - 5).toFixed(1)) : 0;
            })(),
            healthRegenTime: (() => {
              const t = Math.max(0, this.now - (player.lastDamageTaken || -Infinity));
              const sec = t / 1000;
              return sec > 8 ? Number(Math.min(999, sec - 8).toFixed(1)) : 0;
            })(),
          },
        },
      };

      if (payload.you && payload.tick < 3) {
        console.log(`[DIAG] First snapshot to ${player.id}: you.x=${payload.you.x}, you.y=${payload.you.y}, you.alive=${payload.you.alive}, delta.players=${payload.delta.players.length}, you.id=${payload.you.id}, playerId=${player.id}`);
      }

      player.socket.send(JSON.stringify(payload));
    });
  }

  buildSnapshot(player) {
    const playersDelta = this.collectPlayersDelta();
    const enemiesDelta = this.collectEnemiesDelta();
    const projectilesDelta = this.collectProjectilesDelta();
    const domainsDelta = this.collectDomainsDelta();
    const payload = {
      removed: {
        players: playersDelta.removed,
        enemies: enemiesDelta.removed,
        projectiles: projectilesDelta.removed,
        domains: domainsDelta.removed,
      },
        events: player._eventQueue ? player._eventQueue.splice(0) : [],
        you: {
          id: player.id,
          character: player.character || "o-honrado",
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
          hasActiveDomain: this.domainSystem.hasActiveDomain(player.id),
          domainCancelTime: Number(player.domainCancelTimer.toFixed(2)),
          status: {
            stunTimer: Number((player.stunTimer || 0).toFixed(1)),
            invulnTimer: Number((player.invulnTimer || 0).toFixed(1)),
            almaAbaladaTimer: Number((player.almaAbaladaTimer || 0).toFixed(1)),
            rikaBuffTime: Number((player.rikaBuffTime || 0).toFixed(1)),
            domainExhaustionTimer: Number((player.domainExhaustionTimer || 0).toFixed(1)),
            staringStacks: player.staringStacks || 0,
            energyRecoveryTime: (() => {
              if (player.cast && player.cast.type === "domain") return 0;
              if (this.domainSystem.hasActiveDomain(player.id)) return 0;
              if (player.domainExhaustionTimer > 0) return 0;
              const t = Math.max(0, this.now - (player.lastAttackAt || 0));
              const sec = t / 1000;
              return sec > 5 ? Number(Math.min(999, sec - 5).toFixed(1)) : 0;
            })(),
            healthRegenTime: (() => {
              const t = Math.max(0, this.now - (player.lastDamageTaken || -Infinity));
              const sec = t / 1000;
              return sec > 8 ? Number(Math.min(999, sec - 8).toFixed(1)) : 0;
            })(),
          },
        },
      };
      return payload;
  }
}

module.exports = {
  GameServer,
};
