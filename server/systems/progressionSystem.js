"use strict";

const { pickLevelUpChoices, applyUpgrade } = require("../gameplay/upgrades");

class ProgressionSystem {
  constructor(server) {
    this.server = server;
  }

  grantXp(player, amount) {
    if (!player || !player.alive) {
      return;
    }
    player.xp += amount;
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level += 1;
      player.xpToNext = this.nextXp(player.level);
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
