const playerConfig = require("../data/player.json");

const PlayerStatsSystem = {
  createInitialStats() {
    return {
      stamina: playerConfig.maxStamina,
      kills: 0,
      score: 0,
      ammo: {
        current: null,
        reserve: null
      },
      inventory: playerConfig.startingInventory || [null, null, null, null, null]
    };
  },

  creditKill(player) {
    player.kills = (player.kills || 0) + 1;
    player.score = (player.score || 0) + (playerConfig.scorePerKill || 0);
  },

  updateStamina(player, deltaTime) {
    const isMoving = Boolean(player.vx || player.vz);
    if (isMoving) {
      player.stamina = Math.max(0, (player.stamina ?? playerConfig.maxStamina) - deltaTime * 6);
      return;
    }

    player.stamina = Math.min(
      playerConfig.maxStamina,
      (player.stamina ?? playerConfig.maxStamina) + deltaTime * 10
    );
  }
};

module.exports = PlayerStatsSystem;
