const StatusEffectSystem = require("./StatusEffectSystem");

function applyPerk(entity, perk) {
    StatusEffectSystem.applyEffect(entity, {
        type: perk.type,
        duration: perk.duration,
        modifiers: perk.modifiers
    });
}

module.exports = {
    applyPerk
};