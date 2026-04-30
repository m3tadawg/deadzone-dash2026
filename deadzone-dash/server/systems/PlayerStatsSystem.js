const playerConfig = require("../data/player.json");

const PlayerStatsSystem = {
  createInitialStats() {
    return {
      stamina: playerConfig.maxStamina,
      kills: 0,
      score: 0,
      killStreak: 0,
      lastKillAt: 0,
      ammo: {
        current: null,
        reserve: null
      }
    };
  },

  creditKill(player, options = {}) {
    const now = options.now || Date.now();
    const rewardConfig = playerConfig.combatRewards || {};
    const streakWindowMs = rewardConfig.streakWindowMs ?? 4500;
    const streakExpired = !player.lastKillAt || now - player.lastKillAt > streakWindowMs;
    const killStreak = streakExpired ? 1 : (player.killStreak || 0) + 1;
    const baseScore = playerConfig.scorePerKill || 0;
    const headshotBonus = options.isHeadshot ? (rewardConfig.headshotBonus || 0) : 0;
    const activeStreakTier = (rewardConfig.streakTiers || [])
      .filter((tier) => killStreak >= tier.kills)
      .sort((a, b) => b.kills - a.kills)[0];
    const streakBonus = activeStreakTier?.bonus || 0;
    const scoreAdded = baseScore + headshotBonus + streakBonus;

    player.kills = (player.kills || 0) + 1;
    player.score = (player.score || 0) + scoreAdded;
    player.killStreak = killStreak;
    player.lastKillAt = now;

    return {
      scoreAdded,
      baseScore,
      headshotBonus,
      streakBonus,
      killStreak,
      streakLabel: activeStreakTier?.label || null
    };
  },

  updateStamina(player, deltaTime) {
    const isMoving = Boolean(player.vx || player.vz);
    const staminaDrainRate = playerConfig.staminaDrainRate ?? 6;
    const staminaRegenRate = playerConfig.staminaRegenRate ?? 10;

    if (isMoving) {
      player.stamina = Math.max(
        0,
        (player.stamina ?? playerConfig.maxStamina) - deltaTime * staminaDrainRate
      );
      return;
    }

    player.stamina = Math.min(
      playerConfig.maxStamina,
      (player.stamina ?? playerConfig.maxStamina) + deltaTime * staminaRegenRate
    );
  },

  updateCombatState(player, now = Date.now()) {
    const streakWindowMs = playerConfig.combatRewards?.streakWindowMs ?? 4500;
    if (player.lastKillAt && now - player.lastKillAt > streakWindowMs) {
      player.killStreak = 0;
    }
  }
};

module.exports = PlayerStatsSystem;
