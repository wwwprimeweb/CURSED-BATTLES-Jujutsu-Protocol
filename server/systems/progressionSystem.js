"use strict";

const { pickLevelUpChoices, applyUpgrade } = require("../gameplay/upgrades");

const MAX_PLAYER_LEVEL = 20;
const HP_PER_LEVEL_PCT = 0.04;
const ENERGY_PER_LEVEL_PCT = 0.03;
const DAMAGE_PER_LEVEL_PCT = 0.03;

class ProgressionSystem {
  constructor(server) {
    this.server = server;
  }

  grantXp(player, amount) {
    if (!player || !player.alive || player.level >= MAX_PLAYER_LEVEL) {
      return;
    }
    player.xp += amount;
    while (player.xp >= player.xpToNext) {
      if (player.level >= MAX_PLAYER_LEVEL) {
        break;
      }
      player.xp -= player.xpToNext;
      player.level += 1;
      player.xpToNext = this.nextXp(player.level);

      const newMaxHp = Math.floor(player.baseMaxHp * (1 + HP_PER_LEVEL_PCT * (player.level - 1)));
      const newMaxEnergy = Math.floor(player.baseMaxEnergy * (1 + ENERGY_PER_LEVEL_PCT * (player.level - 1)));
      player.hp += Math.max(0, newMaxHp - player.maxHp);
      player.energy += Math.max(0, newMaxEnergy - player.maxEnergy);
      player.maxHp = newMaxHp;
      player.maxEnergy = newMaxEnergy;
      player.modifiers.damageMul *= (1 + DAMAGE_PER_LEVEL_PCT);

      this.openLevelChoices(player);
      this.server.emitEventToPlayer(player.id, {
        type: "levelUp",
        level: player.level,
      });
    }
  }

  nextXp(level) {
    return Math.floor(100 + level * 50 + level * level * 5);
  }

  openLevelChoices(player) {
    const choices = pickLevelUpChoices(this.server.rng, player, 3);
    player.pendingUpgrades = choices;
    player.pendingUpgradeExpiresAt = this.server.now + 9000;

    this.server.emitEventToPlayer(player.id, {
      type: "levelChoices",
      choices: choices.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        rarity: item.rarity,
      })),
    });
  }

  resolvePendingChoices() {
    this.server.players.forEach((player) => {
      if (!player.pendingUpgrades || player.pendingUpgrades.length === 0) {
        return;
      }
      if (this.server.now >= player.pendingUpgradeExpiresAt) {
        this.applyChoice(player, player.pendingUpgrades[0].id, true);
      }
    });
  }

  applyChoice(player, upgradeId, timedOut = false) {
    if (!player.pendingUpgrades || player.pendingUpgrades.length === 0) {
      return false;
    }

    const found = player.pendingUpgrades.find((item) => item.id === upgradeId) || player.pendingUpgrades[0];
    const ok = applyUpgrade(player, found);
    player.pendingUpgrades = null;
    player.pendingUpgradeExpiresAt = 0;

    if (ok) {
      this.server.emitEventToPlayer(player.id, {
        type: "upgradeApplied",
        id: found.id,
        name: found.name,
        timedOut,
      });
    }
    return ok;
  }
}

module.exports = {
  ProgressionSystem,
};
