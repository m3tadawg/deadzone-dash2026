const WorldSystem = require('./WorldSystem');
const aiConfig = require('../data/ai.json').zombie;
const zombieTypes = require('../data/zombies.json');

const zombieTypeByName = zombieTypes.reduce((acc, def) => {
  acc[def.type] = def;
  return acc;
}, {});

const profileCache = {};

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

function getBehaviorProfile(zombie) {
  if (profileCache[zombie.type]) return profileCache[zombie.type];

  const defaultProfile = aiConfig.defaultProfile || {};
  const typeDef = zombieTypeByName[zombie.type] || {};
  const typeProfile = typeDef.aiProfile || {};

  const profile = {
    radius: typeProfile.radius ?? defaultProfile.radius ?? aiConfig.radius,
    arrivalDistance: typeProfile.arrivalDistance ?? defaultProfile.arrivalDistance ?? aiConfig.arrivalDistance,
    steerAnglesDeg: typeProfile.steerAnglesDeg ?? defaultProfile.steerAnglesDeg ?? aiConfig.steerAnglesDeg,
    steerProbeDistance: typeProfile.steerProbeDistance ?? defaultProfile.steerProbeDistance ?? aiConfig.steerProbeDistance,
    blockedCooldownMs: typeProfile.blockedCooldownMs ?? defaultProfile.blockedCooldownMs ?? aiConfig.blockedCooldownMs,
    sidestepProbeDistance: typeProfile.sidestepProbeDistance ?? defaultProfile.sidestepProbeDistance ?? aiConfig.sidestepProbeDistance,
    sidestepAnglesDeg: typeProfile.sidestepAnglesDeg ?? defaultProfile.sidestepAnglesDeg ?? aiConfig.sidestepAnglesDeg,
    maxStuckTimeMs: typeProfile.maxStuckTimeMs ?? defaultProfile.maxStuckTimeMs ?? aiConfig.maxStuckTimeMs,
    speedMultiplier: typeProfile.speedMultiplier ?? defaultProfile.speedMultiplier ?? 1
  };

  profileCache[zombie.type] = profile;
  return profile;
}

function pickSteeringDirection(zombie, desiredDirX, desiredDirZ, profile, probeDistance) {
  for (const angleDeg of profile.steerAnglesDeg) {
    const rotated = rotate2D(desiredDirX, desiredDirZ, (angleDeg * Math.PI) / 180);
    const probeX = zombie.x + rotated.x * probeDistance;
    const probeZ = zombie.z + rotated.z * probeDistance;

    if (!WorldSystem.isPositionBlocked(probeX, probeZ, profile.radius)) {
      return rotated;
    }
  }

  return null;
}

function updateStuckTimer(zombie, deltaTime, moving) {
  zombie.aiState = zombie.aiState || { stuckTimeMs: 0 };

  if (moving) {
    zombie.aiState.stuckTimeMs = 0;
    return;
  }

  zombie.aiState.stuckTimeMs += deltaTime * 1000;
}

function applyMovementWithSlide(zombie, direction, speed, deltaTime, radius) {
  const step = speed * deltaTime;
  const nextX = zombie.x + direction.x * step;
  const nextZ = zombie.z + direction.z * step;

  if (!WorldSystem.isPositionBlocked(nextX, nextZ, radius)) {
    zombie.x = nextX;
    zombie.z = nextZ;
    zombie.vx = direction.x * speed;
    zombie.vz = direction.z * speed;
    return true;
  }

  if (!WorldSystem.isPositionBlocked(nextX, zombie.z, radius)) {
    zombie.x = nextX;
    zombie.vx = direction.x * speed;
    zombie.vz = 0;
    return true;
  }

  if (!WorldSystem.isPositionBlocked(zombie.x, nextZ, radius)) {
    zombie.z = nextZ;
    zombie.vx = 0;
    zombie.vz = direction.z * speed;
    return true;
  }

  zombie.vx = 0;
  zombie.vz = 0;
  return false;
}

module.exports = {
  getBehaviorProfile,
  update(zombie, players, deltaTime) {
    const target = pickClosestTarget(zombie, players);
    if (!target) {
      zombie.vx = 0;
      zombie.vz = 0;
      return;
    }

    const profile = getBehaviorProfile(zombie);

    if (zombie.blockedCooldownRemaining > 0) {
      zombie.blockedCooldownRemaining -= deltaTime * 1000;
      zombie.vx = 0;
      zombie.vz = 0;
      updateStuckTimer(zombie, deltaTime, false);
      return;
    }

    const dx = target.x - zombie.x;
    const dz = target.z - zombie.z;
    const distSq = dx * dx + dz * dz;

    if (distSq <= profile.arrivalDistance * profile.arrivalDistance) {
      zombie.vx = 0;
      zombie.vz = 0;
      updateStuckTimer(zombie, deltaTime, true);
      return;
    }

    const dist = Math.sqrt(distSq);
    const desiredDirX = dx / dist;
    const desiredDirZ = dz / dist;

    const typeSpeed = (zombieTypeByName[zombie.type] && zombieTypeByName[zombie.type].speed) || 1;
    const baseSpeed = aiConfig.baseChaseSpeed * typeSpeed * profile.speedMultiplier;

    let chosenDir = pickSteeringDirection(zombie, desiredDirX, desiredDirZ, profile, profile.steerProbeDistance);

    if (!chosenDir && zombie.aiState && zombie.aiState.stuckTimeMs >= profile.maxStuckTimeMs) {
      for (const sidestepAngle of profile.sidestepAnglesDeg) {
        const sidestepDir = rotate2D(desiredDirX, desiredDirZ, (sidestepAngle * Math.PI) / 180);
        chosenDir = pickSteeringDirection(zombie, sidestepDir.x, sidestepDir.z, profile, profile.sidestepProbeDistance);
        if (chosenDir) {
          break;
        }
      }
    }

    if (!chosenDir) {
      zombie.blockedCooldownRemaining = profile.blockedCooldownMs;
      zombie.vx = 0;
      zombie.vz = 0;
      updateStuckTimer(zombie, deltaTime, false);
      return;
    }

    const moved = applyMovementWithSlide(zombie, chosenDir, baseSpeed, deltaTime, profile.radius);
    updateStuckTimer(zombie, deltaTime, moved);
  }
};
