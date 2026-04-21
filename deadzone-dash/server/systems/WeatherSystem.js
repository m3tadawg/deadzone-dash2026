const StatusEffectSystem = require("./StatusEffectSystem");

let currentWeather = "clear";

const weatherEffects = {
    rain: {
        type: "wet",
        duration: 9999,
        modifiers: {
            fireResistance: 0.5
        }
    },
    fog: {
        type: "fog",
        duration: 9999,
        modifiers: {
            visibility: 0.6
        }
    }
};

function setWeather(type, players) {
    currentWeather = type;

    const effect = weatherEffects[type];
    if (!effect) return;

    players.forEach(player => {
        StatusEffectSystem.applyEffect(player, effect);
    });
}

module.exports = {
    setWeather
};