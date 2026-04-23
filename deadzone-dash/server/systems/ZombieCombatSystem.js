const StatusEffectSystem = require('./StatusEffectSystem');
const zombieTypes = require('../data/zombies.json');

const zombieTypeByName = zombieTypes.reduce((acc, def) => {
    acc[def.type] = def;
    return acc;
}, {});

const defaultAttackProfile = {
    damage: 6,
    range: 1.1,
    cooldownMs: 1000,
    effects: []
};

function getAttackProfile(zombie) {
    const typeDef = zombieTypeByName[zombie.type] || {};
    const attack = typeDef.attack || {};

    return {
        damage: attack.damage ?? defaultAttackProfile.damage,
        range: attack.range ?? defaultAttackProfile.range,
        cooldownMs: attack.cooldownMs ?? defaultAttackProfile.cooldownMs,
        effects: attack.effects ?? defaultAttackProfile.effects
    };
}

function pickClosestTargetInRange(zombie, players, range) {
    const rangeSq = range * range;
    let closest = null;
    let minDistSq = Infinity;

    Object.values(players).forEach((player) => {
        if (player.dead) return;

        const dx = player.x - zombie.x;
        const dz = player.z - zombie.z;
        const distSq = dx * dx + dz * dz;

        if (distSq > rangeSq || distSq >= minDistSq) return;

        closest = player;
        minDistSq = distSq;
    });

    return closest;
}

function applyAttackEffects(target, effects) {
    effects.forEach((effectDef) => {
        StatusEffectSystem.applyEffect(target, effectDef);
    });
}

module.exports = {
    update(zombie, players, deltaTime) {
        if (!zombie || zombie.dead) return;

        const attackProfile = getAttackProfile(zombie);
        zombie.attackState = zombie.attackState || { cooldownRemainingMs: 0 };
        zombie.attackState.cooldownRemainingMs = Math.max(
            0,
            zombie.attackState.cooldownRemainingMs - deltaTime * 1000
        );

        if (zombie.attackState.cooldownRemainingMs > 0) return;

        const target = pickClosestTargetInRange(zombie, players, attackProfile.range);
        if (!target) return;

        target.health -= attackProfile.damage;
        if (target.health <= 0) {
            target.health = 0;
            target.dead = true;
        }

        if (attackProfile.effects.length > 0) {
            applyAttackEffects(target, attackProfile.effects);
        }

        zombie.attackState.cooldownRemainingMs = attackProfile.cooldownMs;
    }
};
