const WorldSystem = require('./WorldSystem');
const aiConfig = require('../data/ai.json').zombie;
const zombieTypes = require('../data/zombies.json');

const zombieSpeedByType = zombieTypes.reduce((acc, def) => {
  acc[def.type] = def.speed;
  return acc;
}, {});

function pickClosestTarget(zombie, players) {
  let target = null;
  let minDistSq = Infinity;

  Object.values(players).forEach((player) => {
    if (player.dead) return;
    const dx = player.x - zombie.x;
    const dz = player.z - zombie.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      target = player;
    }
  });

  return target;
}

function rotate2D(x, z, radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return {
    x: x * c - z * s,
    z: x * s + z * c
  };
}

module.exports = {
  update(zombie, players, deltaTime) {
    const target = pickClosestTarget(zombie, players);
    if (!target) return;

    const dx = target.x - zombie.x;
    const dz = target.z - zombie.z;
    const distSq = dx * dx + dz * dz;

    if (distSq <= aiConfig.arrivalDistance * aiConfig.arrivalDistance) {
      zombie.vx = 0;
      zombie.vz = 0;
      return;
    }

    const dist = Math.sqrt(distSq);
    const desiredDirX = dx / dist;
    const desiredDirZ = dz / dist;
    const baseSpeed = aiConfig.baseChaseSpeed * (zombieSpeedByType[zombie.type] || 1);
    const step = baseSpeed * deltaTime;

    let chosenDir = null;

    for (const angleDeg of aiConfig.steerAnglesDeg) {
      const rotated = rotate2D(desiredDirX, desiredDirZ, (angleDeg * Math.PI) / 180);
      const probeX = zombie.x + rotated.x * aiConfig.steerProbeDistance;
      const probeZ = zombie.z + rotated.z * aiConfig.steerProbeDistance;

      if (!WorldSystem.isPositionBlocked(probeX, probeZ, aiConfig.radius)) {
        chosenDir = rotated;
        break;
      }
    }

    if (!chosenDir) {
      zombie.blockedUntil = Date.now() + aiConfig.blockedCooldownMs;
      return;
    }

    if (zombie.blockedUntil && Date.now() < zombie.blockedUntil) {
      return;
    }

    const nextX = zombie.x + chosenDir.x * step;
    const nextZ = zombie.z + chosenDir.z * step;

    if (!WorldSystem.isPositionBlocked(nextX, nextZ, aiConfig.radius)) {
      zombie.x = nextX;
      zombie.z = nextZ;
      zombie.vx = chosenDir.x * baseSpeed;
      zombie.vz = chosenDir.z * baseSpeed;
    }
  }
};
