const spawnerConfig = require('../data/spawner.json');
const waveConfig = require('../data/waves.json').zombie;
const zombieTypes = require('../data/zombies.json');
const WorldSystem = require('./WorldSystem');
const AISystem = require('./AISystem');

const zombieTypeByName = zombieTypes.reduce((acc, typeDef) => {
    acc[typeDef.type] = typeDef;
    return acc;
}, {});

function weightedPick(weightByType, fallbackType) {
    const entries = Object.entries(weightByType || {}).filter(([_, weight]) => weight > 0);
    const totalWeight = entries.reduce((sum, [_, weight]) => sum + weight, 0);

    if (totalWeight <= 0) {
        return fallbackType;
    }

    let roll = Math.random() * totalWeight;
    for (const [type, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return type;
    }

    return entries[entries.length - 1][0];
}

function getCurrentWaveState(state, now, waveSystem) {
    const waves = waveConfig.waves || [];
    if (!waves.length) {
        return {
            waveNumber: 1,
            cycle: 0,
            wave: {
                name: 'default',
                spawnRateMs: spawnerConfig.zombie.spawnRateMs,
                maxAlive: spawnerConfig.zombie.maxCount,
                spawnBudget: 1,
                typeWeights: zombieTypes.reduce((acc, z) => {
                    acc[z.type] = z.spawnWeight ?? 1;
                    return acc;
                }, {})
            }
        };
    }

    let elapsedMs = now - state.sessionStartTime;
    const totalCycleDuration = waves.reduce(
        (sum, wave) => sum + (wave.durationMs || waveSystem.defaultWaveDurationMs),
        0
    );

    let cycle = 0;
    if (waveSystem.loop && totalCycleDuration > 0) {
        cycle = Math.floor(elapsedMs / totalCycleDuration);
        elapsedMs %= totalCycleDuration;
    }

    let waveIndex = 0;
    let waveCursor = 0;
    for (let i = 0; i < waves.length; i++) {
        const waveDuration = waves[i].durationMs || waveSystem.defaultWaveDurationMs;
        if (elapsedMs < waveCursor + waveDuration) {
            waveIndex = i;
            break;
        }
        waveCursor += waveDuration;
        waveIndex = i;
    }

    return {
        waveNumber: waveIndex + 1,
        cycle,
        wave: waves[waveIndex]
    };
}

function buildSpawnPlan(waveState, waveSystem) {
    const growth = 1 + waveState.cycle * (waveSystem.difficultyGrowthPerCycle || 0);
    const wave = waveState.wave;
    const spawnRateMs = Math.max(
        waveSystem.spawnRateFloorMs || 500,
        Math.round((wave.spawnRateMs || spawnerConfig.zombie.spawnRateMs) / growth)
    );

    const maxAliveBase = wave.maxAlive || spawnerConfig.zombie.maxCount;
    const maxAlive = Math.round(maxAliveBase + waveState.cycle * (waveSystem.maxAliveGrowthPerCycle || 0));

    const spawnBudget = (wave.spawnBudget || 1) * (1 + waveState.cycle * (waveSystem.spawnBudgetGrowthPerCycle || 0));

    const allowedTypeWeights = {};
    Object.entries(wave.typeWeights || {}).forEach(([type, weight]) => {
        const typeDef = zombieTypeByName[type];
        if (!typeDef) return;
        const unlockWave = typeDef.unlockWave || 1;
        if (unlockWave > waveState.waveNumber) return;
        allowedTypeWeights[type] = weight;
    });

    return {
        spawnRateMs,
        maxAlive,
        spawnBudget,
        healthMultiplier: 1 + waveState.cycle * (waveSystem.healthGrowthPerCycle || 0),
        waveLabel: `${waveSystem.waveCycleLabel || 'wave'} ${waveState.waveNumber}`,
        typeWeights: allowedTypeWeights
    };
}

function computeSpawnCost(typeDef) {
    return typeDef.spawnCost || Math.max(0.75, typeDef.hp / 80);
}

const AISpawner = {
    lastSpawnTime: 0,
    zombieCounter: 0,
    sessionStartTime: null,
    currentWaveNumber: 1,

    update(currentTime, zombies, players) {
        const config = spawnerConfig.zombie;
        const currentCount = Object.keys(zombies).length;

        if (!this.sessionStartTime) this.sessionStartTime = currentTime;

        const waveSystem = config.waveSystem || { enabled: false };
        let activeSpawnRate = config.spawnRateMs;
        let activeMaxAlive = config.maxCount;
        let spawnBudget = 1;
        let typeWeights = zombieTypes.reduce((acc, z) => {
            acc[z.type] = z.spawnWeight ?? 1;
            return acc;
        }, {});
        let healthMultiplier = 1;

        if (waveSystem.enabled) {
            const waveState = getCurrentWaveState(this, currentTime, waveSystem);
            const spawnPlan = buildSpawnPlan(waveState, waveSystem);
            this.currentWaveNumber = waveState.waveNumber;
            activeSpawnRate = spawnPlan.spawnRateMs;
            activeMaxAlive = spawnPlan.maxAlive;
            spawnBudget = spawnPlan.spawnBudget;
            typeWeights = spawnPlan.typeWeights;
            healthMultiplier = spawnPlan.healthMultiplier;
        }

        if (Object.keys(typeWeights).length === 0) return;

        if (currentCount >= activeMaxAlive) return;
        if (currentTime - this.lastSpawnTime <= activeSpawnRate) return;

        const spawnedAny = this.spawnZombieBatch(zombies, config, players, currentCount, activeMaxAlive, spawnBudget, typeWeights, healthMultiplier);

        if (spawnedAny) {
            this.lastSpawnTime = currentTime;
        }
    },

    spawnZombieBatch(zombies, config, players, currentCount, maxAlive, spawnBudget, typeWeights, healthMultiplier) {
        let spentBudget = 0;
        let spawned = 0;

        while (spentBudget < spawnBudget && currentCount + spawned < maxAlive) {
            const typeName = weightedPick(typeWeights, 'shambler');
            const typeDef = zombieTypeByName[typeName] || zombieTypes[0] || { type: 'shambler', hp: 50 };
            const spawnCost = computeSpawnCost(typeDef);

            if (spawned > 0 && spentBudget + spawnCost > spawnBudget) {
                break;
            }

            if (!this.spawnZombie(zombies, config, players, typeDef, healthMultiplier)) {
                break;
            }

            spentBudget += spawnCost;
            spawned += 1;
        }

        return spawned > 0;
    },

    spawnZombie(zombies, config, players, typeDef, healthMultiplier = 1) {
        this.zombieCounter++;
        const id = `z_${this.zombieCounter}`;

        const profile = AISystem.getBehaviorProfile({ type: typeDef.type });

        const playerList = Object.values(players).filter((p) => !p.dead);
        const anchor = playerList.length > 0 ? playerList[Math.floor(Math.random() * playerList.length)] : { x: 0, z: 0 };

        const maxAttempts = 20;
        let spawnX = anchor.x;
        let spawnZ = anchor.z;

        for (let i = 0; i < maxAttempts; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = config.playerAvoidRadius + Math.random() * (config.spawnRadius - config.playerAvoidRadius);
            const candidateX = anchor.x + Math.cos(angle) * radius;
            const candidateZ = anchor.z + Math.sin(angle) * radius;

            if (WorldSystem.isPositionBlocked(candidateX, candidateZ, profile.radius)) continue;

            const chunk = WorldSystem.getChunkAt(candidateX, candidateZ);
            if (!chunk) continue;

            const biomeWeight = (config.biomeSpawnWeight && config.biomeSpawnWeight[chunk.biome]) || 1;
            const area = WorldSystem.getAreaAt(candidateX, candidateZ);
            const areaType = area ? area.type : null;
            const areaConfigMultiplier = (config.hotspotAreaTypeMultiplier && config.hotspotAreaTypeMultiplier[areaType]) || 1;
            const areaMultiplier = area ? (area.spawnMultiplier || 1) * areaConfigMultiplier : 1;
            const roll = Math.random();
            const spawnChance = Math.min(1, 0.35 * biomeWeight * areaMultiplier);

            if (roll <= spawnChance) {
                spawnX = candidateX;
                spawnZ = candidateZ;
                break;
            }
        }

        zombies[id] = {
            id,
            type: typeDef.type,
            x: spawnX,
            z: spawnZ,
            health: Math.round((typeDef.hp || config.baseHealth) * healthMultiplier),
            dead: false,
            statusEffects: [],
            tags: ['enemy', 'undead']
        };

        return true;
    }
};

module.exports = AISpawner;
