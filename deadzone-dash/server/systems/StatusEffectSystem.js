const activeEffects = new Map(); // entityId → effects[]

function applyEffect(entity, effect) {
    if (!entity.statusEffects) entity.statusEffects = [];

    entity.statusEffects.push({
        ...effect,
        elapsed: 0
    });
}

function update(entity, deltaTime) {
    if (!entity.statusEffects) return;

    entity.statusEffects = entity.statusEffects.filter(effect => {
        effect.elapsed += deltaTime;

        // Apply tick effect
        if (effect.tickRate) {
            const ticks = Math.floor(effect.elapsed / effect.tickRate);
            if (ticks > 0) {
                effect.elapsed -= ticks * effect.tickRate;

                if (effect.effect.damagePerTick) {
                    entity.health -= effect.effect.damagePerTick * ticks;
                }

                if (effect.effect.healPerTick) {
                    entity.health += effect.effect.healPerTick * ticks;
                }
            }
        }

        return effect.elapsed < effect.duration;
    });
}

function applyModifiers(entity, baseValue, type) {
    let modified = baseValue;

    if (!entity.statusEffects) return modified;

    entity.statusEffects.forEach(effect => {
        if (effect.modifiers && effect.modifiers[type]) {
            modified *= effect.modifiers[type];
        }
    });

    return modified;
}

module.exports = {
    applyEffect,
    update,
    applyModifiers
};