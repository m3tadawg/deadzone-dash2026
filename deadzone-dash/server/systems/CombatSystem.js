class CombatSystem {
    constructor(weaponsConfig) {
        this.weaponsConfig = weaponsConfig;
        this.StatusEffectSystem = require('./StatusEffectSystem');
    }

    handleShoot(player, zombies) {
        const now = Date.now();
        const weapon = this.weaponsConfig.find((w) => w.id === player.weapon);

        if (!weapon || now - player.lastShotTime < weapon.fireRate) return null;
        player.lastShotTime = now;
        let didKill = false;

        const aimVec = { x: player.aimX - player.x, z: player.aimZ - player.z };
        const aimLength = Math.sqrt(aimVec.x * aimVec.x + aimVec.z * aimVec.z);

        let startX = player.x;
        let startZ = player.z;
        let endX = player.x;
        let endZ = player.z;

        if (aimLength > 0) {
            const dirX = aimVec.x / aimLength;
            const dirZ = aimVec.z / aimLength;

            const muzzle = weapon.muzzleOffset || { forward: 0.5, right: 0 };
            startX += dirX * muzzle.forward - dirZ * muzzle.right;
            startZ += dirZ * muzzle.forward + dirX * muzzle.right;

            const bulletVecX = player.aimX - startX;
            const bulletVecZ = player.aimZ - startZ;
            const bulletLen = Math.sqrt(bulletVecX * bulletVecX + bulletVecZ * bulletVecZ);

            if (bulletLen > 0) {
                const bDirX = bulletVecX / bulletLen;
                const bDirZ = bulletVecZ / bulletLen;

                endX = startX + bDirX * weapon.range;
                endZ = startZ + bDirZ * weapon.range;

                let hitZombie = null;
                let minTargetDist = weapon.range;

                const WorldSystem = require('./WorldSystem');
                const worldHit = WorldSystem.checkRayIntersection(startX, startZ, endX, endZ);
                if (worldHit) {
                    minTargetDist = worldHit.dist;
                    endX = worldHit.x;
                    endZ = worldHit.z;
                }

                Object.values(zombies).forEach((zombie) => {
                    if (zombie.dead) return;

                    const zVec = { x: zombie.x - startX, z: zombie.z - startZ };
                    const distT = zVec.x * bDirX + zVec.z * bDirZ;

                    if (distT > 0 && distT < minTargetDist) {
                        const distToRaySq = (zVec.x * zVec.x + zVec.z * zVec.z) - distT * distT;
                        if (distToRaySq < 1.0) {
                            hitZombie = zombie;
                            minTargetDist = distT;
                        }
                    }
                });

                if (hitZombie) {
                    hitZombie.health -= weapon.damage;
                    if (hitZombie.health <= 0) {
                        hitZombie.dead = true;
                        didKill = true;
                    }

                    if (weapon.effects) {
                        weapon.effects.forEach((effectName) => {
                            this.StatusEffectSystem.applyEffect(hitZombie, { type: effectName, duration: 3 });
                        });
                    }

                    endX = hitZombie.x;
                    endZ = hitZombie.z;
                }
            }
        }

        return { startX, startZ, endX, endZ, didKill };
    }
}

module.exports = CombatSystem;
