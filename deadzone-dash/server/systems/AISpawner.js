const spawnerConfig = require('../data/spawner.json');
const WorldSystem = require('./WorldSystem');

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

            if (WorldSystem.isPositionBlocked(candidateX, candidateZ, 0.75)) continue;

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
            type: 'shambler',
            x: spawnX,
            z: spawnZ,
            health: config.baseHealth,
            dead: false,
            statusEffects: [],
            tags: ['enemy', 'undead']
        };
    }
};

module.exports = AISpawner;
