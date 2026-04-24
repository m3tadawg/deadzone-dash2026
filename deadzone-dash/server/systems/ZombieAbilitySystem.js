const StatusEffectSystem = require('./StatusEffectSystem');
const ZombieProjectileSystem = require('./ZombieProjectileSystem');
const zombieTypes = require('../data/zombies.json');

const zombieTypeByName = zombieTypes.reduce((acc, def) => {
    acc[def.type] = def;
    return acc;
}, {});

module.exports = {
    update(zombies, players, projectiles, deltaTime) {
        Object.values(zombies).forEach(zombie => {
            if (zombie.dead) return;

            // Re-fetch type def in case of dynamic changes
            const typeDef = zombieTypeByName[zombie.type];
            if (!typeDef || !typeDef.abilities) return;

            zombie.abilityState = zombie.abilityState || {};

            typeDef.abilities.forEach(ability => {
                const state = zombie.abilityState[ability.id] = zombie.abilityState[ability.id] || {
                    cooldownRemainingMs: 0,
                    windupRemainingMs: 0
                };

                if (ability.type === 'aura') {
                    this.processAura(zombie, ability, players, zombies);
                } else if (ability.type === 'periodic') {
                    this.processPeriodic(zombie, ability, state, players, projectiles, deltaTime);
                }
            });
        });
    },

    processAura(zombie, ability, players, zombies) {
        const targets = ability.targetType === 'player' ? Object.values(players) : Object.values(zombies);
        const radiusSq = ability.radius * ability.radius;

        targets.forEach(target => {
            if (target.dead || target.id === zombie.id) return;

            const dx = target.x - zombie.x;
            const dz = target.z - zombie.z;
            const distSq = dx * dx + dz * dz;

            if (distSq <= radiusSq) {
                StatusEffectSystem.applyEffect(target, ability.effect);
            }
        });
    },

    processPeriodic(zombie, ability, state, players, projectiles, deltaTime) {
        state.cooldownRemainingMs = Math.max(0, state.cooldownRemainingMs - deltaTime * 1000);

        // Handle Windup (Visual Cue)
        if (state.windupRemainingMs > 0) {
            state.windupRemainingMs = Math.max(0, state.windupRemainingMs - deltaTime * 1000);
            
            // Set the cue for the client to see
            zombie.abilityCue = {
                id: ability.id,
                progress: 1 - (state.windupRemainingMs / ability.windupMs),
                type: ability.id
            };

            if (state.windupRemainingMs <= 0) {
                this.executeAbility(zombie, ability, players, projectiles);
                state.cooldownRemainingMs = ability.cooldownMs;
                zombie.abilityCue = null;
            }
            return;
        }

        if (state.cooldownRemainingMs <= 0) {
            // Check if any target is in range before starting windup
            const targets = ability.targetType === 'player' ? Object.values(players) : Object.values(zombies);
            const radiusSq = ability.radius * ability.radius;
            const anyInRange = targets.some(t => {
                if (t.dead || t.id === zombie.id) return false;
                const dx = t.x - zombie.x;
                const dz = t.z - zombie.z;
                return (dx * dx + dz * dz) <= radiusSq;
            });

            if (anyInRange) {
                state.windupRemainingMs = ability.windupMs;
            }
        }
    },

    executeAbility(zombie, ability, players, projectiles) {
        const targets = ability.targetType === 'player' ? Object.values(players) : Object.values(zombies);
        const radiusSq = ability.radius * ability.radius;

        targets.forEach(target => {
            if (target.dead || target.id === zombie.id) return;

            const dx = target.x - zombie.x;
            const dz = target.z - zombie.z;
            const distSq = dx * dx + dz * dz;

            if (distSq <= radiusSq) {
                if (ability.damage) {
                    target.health -= ability.damage;
                    if (target.health <= 0) {
                        target.health = 0;
                        target.dead = true;
                    }
                }
                if (ability.effect) {
                    StatusEffectSystem.applyEffect(target, ability.effect);
                }
            }
        });

        // Special handling for projectile bursts (Plague Lord)
        if (ability.projectileId) {
            for (let i = 0; i < (ability.projectileCount || 1); i++) {
                const angle = (Math.PI * 2 / ability.projectileCount) * i;
                ZombieProjectileSystem.spawn(projectiles, {
                    type: ability.projectileId,
                    ownerId: zombie.id,
                    x: zombie.x,
                    z: zombie.z,
                    dirX: Math.cos(angle),
                    dirZ: Math.sin(angle)
                });
            }
        }
    }
};
