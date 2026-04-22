const spawnerConfig = require('../data/spawner.json');
const aiConfig = require('../data/ai.json').zombie;
const zombieTypes = require('../data/zombies.json');
const WorldSystem = require('./WorldSystem');

function pickZombieType() {
    const totalWeight = zombieTypes.reduce((sum, typeDef) => sum + (typeDef.spawnWeight || 1), 0);

    if (totalWeight <= 0) {
        return zombieTypes[0] || { type: 'shambler', hp: 50 };
    }

    let roll = Math.random() * totalWeight;

    for (const typeDef of zombieTypes) {
        roll -= (typeDef.spawnWeight || 1);
        if (roll <= 0) {
            return typeDef;
        }
    }

    return zombieTypes[zombieTypes.length - 1] || { type: 'shambler', hp: 50 };
}

const AISpawner = {
    lastSpawnTime: 0,
    zombieCounter: 0,

    update(currentTime, zombies, players) {
        const config = spawnerConfig.zombie;
        const currentCount = Object.keys(zombies).length;

        if (currentCount < config.maxCount && currentTime - this.lastSpawnTime > config.spawnRateMs) {
            this.spawnZombie(zombies, config, players);
            this.lastSpawnTime = currentTime;
        }
    },

    spawnZombie(zombies, config, players) {
        this.zombieCounter++;
        const id = `z_${this.zombieCounter}`;

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

            if (WorldSystem.isPositionBlocked(candidateX, candidateZ, aiConfig.radius)) continue;

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

        const typeDef = pickZombieType();

        zombies[id] = {
            id,
            type: typeDef.type,
            x: spawnX,
            z: spawnZ,
            health: typeDef.hp,
            dead: false,
            statusEffects: [],
            tags: ['enemy', 'undead']
        };
    }
};

module.exports = AISpawner;
