const spawnerConfig = require('../data/spawner.json');

const AISpawner = {
    lastSpawnTime: 0,
    zombieCounter: 0,

    update(currentTime, zombies) {
        const config = spawnerConfig.zombie;
        const currentCount = Object.keys(zombies).length;

        if (currentCount < config.maxCount && currentTime - this.lastSpawnTime > config.spawnRateMs) {
            this.spawnZombie(zombies, config);
            this.lastSpawnTime = currentTime;
        }
    },

    spawnZombie(zombies, config) {
        this.zombieCounter++;
        const id = `z_${this.zombieCounter}`;
        
        // Spawn randomly within spawnRadius
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * config.spawnRadius;
        
        zombies[id] = {
            id: id,
            type: 'basic',
            x: Math.cos(angle) * radius,
            z: Math.sin(angle) * radius,
            health: config.baseHealth,
            dead: false,
            statusEffects: [],
            tags: ['enemy', 'undead']
        };
        
        console.log(`Spawned zombie ${id} at x:${zombies[id].x.toFixed(1)}, z:${zombies[id].z.toFixed(1)}`);
    }
};

module.exports = AISpawner;
