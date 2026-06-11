"use strict";

const UPGRADE_POOL = [
  {
    id: "blue_radius",
    name: "Azul Expandido",
    description: "+30% raio do Azul",
    rarity: "rare",
    maxStacks: 2,
    apply(player) {
      player.modifiers.blueRadiusMul *= 1.3;
    },
  },
  {
    id: "blue_pull",
    name: "Compressao Violenta",
    description: "Pull do Azul mais forte",
    rarity: "uncommon",
    maxStacks: 2,
    apply(player) {
      player.modifiers.bluePullMul *= 1.22;
    },
  },
  {
    id: "blue_duration",
    name: "Orbita Prolongada",
    description: "Azul dura mais tempo",
    rarity: "uncommon",
    maxStacks: 2,
    apply(player) {
      player.modifiers.blueDurationMul *= 1.2;
    },
  },
  {
    id: "blue_tick",
    name: "Atrito Espacial",
    description: "+dano por tick do Azul",
    rarity: "rare",
    maxStacks: 3,
    apply(player) {
      player.modifiers.blueTickDamageMul *= 1.2;
    },
  },
  {
    id: "red_knockback",
    name: "Repulsao Brutal",
    description: "+20% knockback do Vermelho",
    rarity: "uncommon",
    maxStacks: 2,
    apply(player) {
      player.modifiers.redKnockbackMul *= 1.2;
    },
  },
  {
    id: "red_blast",
    name: "Impacto Expandido",
    description: "Explosao do Vermelho maior",
    rarity: "rare",
    maxStacks: 2,
    apply(player) {
      player.modifiers.redExplosionMul *= 1.24;
    },
  },
  {
    id: "red_damage",
    name: "Nucleo Rubro",
    description: "+dano do Vermelho",
    rarity: "rare",
    maxStacks: 3,
    apply(player) {
      player.modifiers.redDamageMul *= 1.15;
    },
  },
  {
    id: "purple_width",
    name: "Fenda Infinita",
    description: "+50% largura do Vazio Roxo",
    rarity: "epic",
    maxStacks: 1,
    apply(player) {
      player.modifiers.purpleWidthMul *= 1.5;
    },
  },
  {
    id: "purple_length",
    name: "Corredor Absoluto",
    description: "Vazio Roxo mais longo",
    rarity: "epic",
    maxStacks: 2,
    apply(player) {
      player.modifiers.purpleLengthMul *= 1.25;
    },
  },
  {
    id: "purple_damage",
    name: "Aniquilacao",
    description: "+dano do Vazio Roxo",
    rarity: "epic",
    maxStacks: 2,
    apply(player) {
      player.modifiers.purpleDamageMul *= 1.18;
    },
  },
  {
    id: "teleport_cdr",
    name: "Passo Fraturado",
    description: "Menor cooldown do Teleporte",
    rarity: "uncommon",
    maxStacks: 3,
    apply(player) {
      player.modifiers.teleportCooldownMul *= 0.88;
    },
  },
  {
    id: "teleport_range",
    name: "Salto Abissal",
    description: "Maior distancia de Teleporte",
    rarity: "rare",
    maxStacks: 2,
    apply(player) {
      player.modifiers.teleportDistanceMul *= 1.2;
    },
  },
  {
    id: "teleport_recovery",
    name: "Retorno Limpo",
    description: "Menor recuperacao do Teleporte",
    rarity: "uncommon",
    maxStacks: 2,
    apply(player) {
      player.modifiers.teleportRecoveryMul *= 0.82;
    },
  },
  {
    id: "domain_drain",
    name: "Calma do Vazio",
    description: "Drain do Dominio reduzido",
    rarity: "epic",
    maxStacks: 2,
    apply(player) {
      player.modifiers.domainDrainMul *= 0.82;
    },
  },
  {
    id: "domain_radius",
    name: "Trono Expandido",
    description: "Raio do Dominio maior",
    rarity: "epic",
    maxStacks: 2,
    apply(player) {
      player.modifiers.domainRadiusMul *= 1.18;
    },
  },
  {
    id: "domain_slow",
    name: "Paralisia Cognitiva",
    description: "Slow do Dominio mais forte",
    rarity: "epic",
    maxStacks: 2,
    apply(player) {
      player.modifiers.domainSlowMul *= 1.16;
    },
  },
  {
    id: "domain_power",
    name: "Nucleo Soberano",
    description: "Vantagem em conflito de dominio",
    rarity: "legendary",
    maxStacks: 1,
    apply(player) {
      player.modifiers.domainPowerMul *= 1.25;
    },
  },
  {
    id: "generic_damage",
    name: "Refino Amaldicoado",
    description: "+10% dano geral",
    rarity: "common",
    maxStacks: 5,
    apply(player) {
      player.modifiers.damageMul *= 1.1;
    },
  },
  {
    id: "generic_cdr",
    name: "Fluxo Preciso",
    description: "Reduz cooldowns",
    rarity: "common",
    maxStacks: 5,
    apply(player) {
      player.modifiers.cooldownMul *= 0.94;
    },
  },
  {
    id: "generic_speed",
    name: "Passos de Guerra",
    description: "+movimento",
    rarity: "common",
    maxStacks: 4,
    apply(player) {
      player.modifiers.speedMul *= 1.06;
    },
  },
  {
    id: "generic_energy",
    name: "Circuito Estavel",
    description: "+regen de energia",
    rarity: "common",
    maxStacks: 4,
    apply(player) {
      player.modifiers.energyRegenMul *= 1.1;
    },
  },
  {
    id: "generic_sustain",
    name: "Roubo de Essencia",
    description: "Cura ao eliminar",
    rarity: "rare",
    maxStacks: 3,
    apply(player) {
      player.modifiers.sustainOnKill += 18;
    },
  },
  {
    id: "rika_damage",
    name: "Presenca Monstruosa",
    description: "+15% dano da Rika",
    rarity: "rare",
    maxStacks: 2,
    apply(player) {
      player.modifiers.rikaDamageMul *= 1.15;
    },
  },
  {
    id: "rika_cooldown",
    name: "Vinculo Acelerado",
    description: "-15% cooldown da Rika",
    rarity: "uncommon",
    maxStacks: 2,
    apply(player) {
      player.modifiers.rikaCooldownMul *= 0.85;
    },
  },
  {
    id: "dashSlash_damage",
    name: "Corte Preciso",
    description: "+20% dano do Dash Slash",
    rarity: "rare",
    maxStacks: 2,
    apply(player) {
      player.modifiers.dashSlashDamageMul *= 1.2;
    },
  },
  {
    id: "dashSlash_range",
    name: "Investida Fantasma",
    description: "+15% alcance do Dash Slash",
    rarity: "uncommon",
    maxStacks: 2,
    apply(player) {
      player.modifiers.dashSlashRangeMul *= 1.15;
    },
  },
  {
    id: "fullRika_duration",
    name: "Ligacao Eterna",
    description: "+25% duracao da Rika",
    rarity: "epic",
    maxStacks: 2,
    apply(player) {
      player.modifiers.fullRikaDurationMul *= 1.25;
    },
  },
  {
    id: "fullRika_power",
    name: "Furia Contida",
    description: "+15% dano dos ataques da Rika",
    rarity: "epic",
    maxStacks: 2,
    apply(player) {
      player.modifiers.fullRikaPowerMul *= 1.15;
    },
  },
  {
    id: "pureLove_damage",
    name: "Amor Puro",
    description: "+20% dano do Pure Love",
    rarity: "epic",
    maxStacks: 2,
    apply(player) {
      player.modifiers.pureLoveDamageMul *= 1.2;
    },
  },
  {
    id: "pureLove_radius",
    name: "Explosao do Afeto",
    description: "+15% raio do Pure Love",
    rarity: "rare",
    maxStacks: 2,
    apply(player) {
      player.modifiers.pureLoveRadiusMul *= 1.15;
    },
  },
  {
    id: "domainKatana_damage",
    name: "Laminas Infinitas",
    description: "+20% dano das katanas do dominio",
    rarity: "epic",
    maxStacks: 2,
    apply(player) {
      player.modifiers.domainKatanaDamageMul *= 1.2;
    },
  },
];

const RARITY_WEIGHT = {
  common: 50,
  uncommon: 28,
  rare: 14,
  epic: 6,
  legendary: 2,
};

function pickLevelUpChoices(rng, player, count = 3) {
  const available = UPGRADE_POOL.filter((upg) => {
    const stacks = player.appliedUpgrades[upg.id] || 0;
    return stacks < upg.maxStacks;
  });

  const choices = [];
  let pool = available.slice();

  for (let i = 0; i < count && pool.length; i += 1) {
    const totalWeight = pool.reduce((acc, item) => acc + RARITY_WEIGHT[item.rarity], 0);
    let roll = rng.range(0, totalWeight);
    let pickedIndex = 0;
    for (let j = 0; j < pool.length; j += 1) {
      roll -= RARITY_WEIGHT[pool[j].rarity];
      if (roll <= 0) {
        pickedIndex = j;
        break;
      }
    }
    choices.push(pool[pickedIndex]);
    pool.splice(pickedIndex, 1);
  }

  return choices;
}

function applyUpgrade(player, upgrade) {
  if (!upgrade) {
    return false;
  }
  const stacks = player.appliedUpgrades[upgrade.id] || 0;
  if (stacks >= upgrade.maxStacks) {
    return false;
  }
  upgrade.apply(player);
  player.appliedUpgrades[upgrade.id] = stacks + 1;
  return true;
}

module.exports = {
  UPGRADE_POOL,
  pickLevelUpChoices,
  applyUpgrade,
};
