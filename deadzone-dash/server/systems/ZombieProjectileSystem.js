const projectileDefs = require('../data/projectiles.json');
const StatusEffectSystem = require('./StatusEffectSystem');
const WorldSystem = require('./WorldSystem');

const PLAYER_HIT_RADIUS = 0.8;

function getProjectileDef(projectileType) {
    return projectileDefs[projectileType] || null;
}

function applyProjectileImpact(projectile, players) {
    const def = getProjectileDef(projectile.type);
    if (!def) return;

    const impactRadiusSq = (def.impactRadius || def.radius || 0.2) ** 2;

    Object.values(players).forEach((player) => {
        if (player.dead) return;

        const dx = player.x - projectile.x;
        const dz = player.z - projectile.z;
        const distSq = dx * dx + dz * dz;

        if (distSq > impactRadiusSq) return;

        player.health -= def.damage || 0;
        if (player.health <= 0) {
            player.health = 0;
            player.dead = true;
        }

        (def.effects || []).forEach((effect) => {
            StatusEffectSystem.applyEffect(player, effect);
        });
    });
}

module.exports = {
    projectileDefs,
    spawn(projectiles, spawnData) {
        const def = getProjectileDef(spawnData.type);
        if (!def) return null;

        const dirLength = Math.hypot(spawnData.dirX, spawnData.dirZ);
        if (dirLength <= 0.0001) return null;

        const dirX = spawnData.dirX / dirLength;
        const dirZ = spawnData.dirZ / dirLength;

        const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        projectiles[id] = {
            id,
            type: spawnData.type,
            ownerId: spawnData.ownerId,
            x: spawnData.x,
            z: spawnData.z,
            vx: dirX * def.speed,
            vz: dirZ * def.speed,
            radius: def.radius,
            ageMs: 0,
            dead: false
        };

        return projectiles[id];
    },

    update(projectiles, players, deltaTime) {
        Object.values(projectiles).forEach((projectile) => {
            if (projectile.dead) return;

            const def = getProjectileDef(projectile.type);
            if (!def) {
                projectile.dead = true;
                return;
            }

            projectile.ageMs += deltaTime * 1000;
            if (projectile.ageMs >= def.maxLifetimeMs) {
                projectile.dead = true;
                return;
            }

            projectile.x += projectile.vx * deltaTime;
            projectile.z += projectile.vz * deltaTime;

            if (WorldSystem.isPositionBlocked(projectile.x, projectile.z, projectile.radius || 0.2)) {
                applyProjectileImpact(projectile, players);
                projectile.dead = true;
                return;
            }

            const hitPlayer = Object.values(players).find((player) => {
                if (player.dead) return false;
                const dx = player.x - projectile.x;
                const dz = player.z - projectile.z;
                const distSq = dx * dx + dz * dz;
                const totalRadius = PLAYER_HIT_RADIUS + (projectile.radius || 0.2);
                return distSq <= totalRadius * totalRadius;
            });

            if (hitPlayer) {
                applyProjectileImpact(projectile, players);
                projectile.dead = true;
            }
        });

        Object.keys(projectiles).forEach((id) => {
            if (projectiles[id].dead) {
                delete projectiles[id];
            }
        });
    }
};
