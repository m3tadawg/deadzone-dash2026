class CombatSystem {
    constructor(weaponsConfig) {
        this.weaponsConfig = weaponsConfig;
        this.StatusEffectSystem = require("./StatusEffectSystem");
    }

    handleShoot(player, zombies) {
        const now = Date.now();
        const weapon = this.weaponsConfig.find(w => w.id === player.weapon);
        
        if (!weapon || now - player.lastShotTime < weapon.fireRate) return null;
        player.lastShotTime = now;
        
        // Calculate hitscan
        let aimVec = { x: player.aimX - player.x, z: player.aimZ - player.z };
        const aimLength = Math.sqrt(aimVec.x * aimVec.x + aimVec.z * aimVec.z);
        
        let startX = player.x; 
        let startZ = player.z;
        let endX = player.x;
        let endZ = player.z;

        if (aimLength > 0) {
            const centerDirX = aimVec.x / aimLength;
            const centerDirZ = aimVec.z / aimLength;
            
            // Adjust start to match the weapon barrel offset (forward and to the right)
            // Local forward is (centerDirX, centerDirZ). Local right is (-centerDirZ, centerDirX).
            startX += centerDirX * 0.5 - centerDirZ * 0.8;
            startZ += centerDirZ * 0.5 + centerDirX * 0.8;

            // Compute exact trajectory from the physical barrel through the mouse cursor
            const bulletVecX = player.aimX - startX;
            const bulletVecZ = player.aimZ - startZ;
            const bulletLen = Math.sqrt(bulletVecX*bulletVecX + bulletVecZ*bulletVecZ);

        if (bulletLen > 0) {
                const bDirX = bulletVecX / bulletLen;
                const bDirZ = bulletVecZ / bulletLen;

                endX = startX + bDirX * weapon.range;
                endZ = startZ + bDirZ * weapon.range;

                let hitZombie = null;
                let minTargetDist = weapon.range;

                // 1. Check World Obstacle Collisions first
                const WorldSystem = require("./WorldSystem");
                const worldHit = WorldSystem.checkRayIntersection(startX, startZ, endX, endZ);
                if (worldHit) {
                    minTargetDist = worldHit.dist;
                    endX = worldHit.x;
                    endZ = worldHit.z;
                }
                
                // 2. Check Zombie Hist
                Object.values(zombies).forEach(zombie => {
                    if (zombie.dead) return;
                    
                    const zVec = { x: zombie.x - startX, z: zombie.z - startZ };
                    const distT = (zVec.x * bDirX) + (zVec.z * bDirZ); // Dot product along the actual bullet path
                    
                    if (distT > 0 && distT < minTargetDist) { // In front of gun and within range (or blocked by wall)
                        const distToRaySq = (zVec.x * zVec.x + zVec.z * zVec.z) - (distT * distT);
                        if (distToRaySq < 1.0) { // Hit cylinder radius squared
                            hitZombie = zombie;
                            minTargetDist = distT;
                        }
                    }
                });
                
                if (hitZombie) {
                    hitZombie.health -= weapon.damage;
                    if (hitZombie.health <= 0) hitZombie.dead = true;
                    
                    if (weapon.effects) {
                        weapon.effects.forEach(effectName => {
                            this.StatusEffectSystem.applyEffect(hitZombie, { type: effectName, duration: 3 });
                        });
                    }
                    
                    // Cap tracer at zombie
                    endX = hitZombie.x;
                    endZ = hitZombie.z;
                }
            }
        }

        return { startX, startZ, endX, endZ };
    }
}

module.exports = CombatSystem;