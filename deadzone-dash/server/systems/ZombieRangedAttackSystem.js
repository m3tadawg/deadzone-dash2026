const zombieTypes = require('../data/zombies.json');
const ZombieProjectileSystem = require('./ZombieProjectileSystem');

const zombieTypeByName = zombieTypes.reduce((acc, def) => {
    acc[def.type] = def;
    return acc;
}, {});

function getRangedProfile(zombie) {
    const typeDef = zombieTypeByName[zombie.type] || {};
    return typeDef.rangedAttack || null;
}

function pickRangedTarget(zombie, players, minRange, maxRange) {
    const minRangeSq = minRange * minRange;
    const maxRangeSq = maxRange * maxRange;

    let chosen = null;
    let chosenDistSq = Infinity;

    Object.values(players).forEach((player) => {
        if (player.dead) return;

        const dx = player.x - zombie.x;
        const dz = player.z - zombie.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < minRangeSq || distSq > maxRangeSq) return;
        if (distSq >= chosenDistSq) return;

        chosen = player;
        chosenDistSq = distSq;
    });

    return chosen;
}

module.exports = {
    update(zombie, players, projectiles, deltaTime) {
        if (!zombie || zombie.dead) return;

        const profile = getRangedProfile(zombie);
        if (!profile) {
            zombie.castCueRemainingMs = 0;
            return;
        }

        zombie.rangedState = zombie.rangedState || {
            cooldownRemainingMs: 0,
            windupRemainingMs: 0,
            lockedTargetPos: null
        };

        const state = zombie.rangedState;
        state.cooldownRemainingMs = Math.max(0, state.cooldownRemainingMs - deltaTime * 1000);

        if (state.windupRemainingMs > 0) {
            state.windupRemainingMs = Math.max(0, state.windupRemainingMs - deltaTime * 1000);
            zombie.castCueRemainingMs = state.windupRemainingMs;

            if (state.windupRemainingMs <= 0 && state.lockedTargetPos) {
                const dirX = state.lockedTargetPos.x - zombie.x;
                const dirZ = state.lockedTargetPos.z - zombie.z;

                ZombieProjectileSystem.spawn(projectiles, {
                    type: profile.projectileId,
                    ownerId: zombie.id,
                    x: zombie.x,
                    z: zombie.z,
                    dirX,
                    dirZ
                });

                state.cooldownRemainingMs = profile.cooldownMs || 2500;
                state.lockedTargetPos = null;
                zombie.castCueRemainingMs = 0;
            }

            return;
        }

        zombie.castCueRemainingMs = 0;

        if (state.cooldownRemainingMs > 0) return;

        const target = pickRangedTarget(
            zombie,
            players,
            profile.minRange ?? 2.5,
            profile.maxRange ?? 10
        );

        if (!target) return;

        state.windupRemainingMs = profile.windupMs || 500;
        state.lockedTargetPos = { x: target.x, z: target.z };
        zombie.castCueRemainingMs = state.windupRemainingMs;
    }
};
