class CombatSystem {
    constructor(weaponsConfig) {
        this.weaponsConfig = weaponsConfig;
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
            const dirX = aimVec.x / aimLength;
            const dirZ = aimVec.z / aimLength;
            
            // Adjust start somewhat forward offset
            startX += dirX * 0.5;
            startZ += dirZ * 0.5;

            endX = player.x + dirX * weapon.range;
            endZ = player.z + dirZ * weapon.range;

            let hitZombie = null;
            let minTargetDist = weapon.range;
            
            Object.values(zombies).forEach(zombie => {
                if (zombie.dead) return;
                
                const zVec = { x: zombie.x - player.x, z: zombie.z - player.z };
                const distT = (zVec.x * dirX) + (zVec.z * dirZ); // Dot product
                
                if (distT > 0 && distT < minTargetDist) { // In front and within range
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
                
                // Adjust tracer to end at the hit zombie
                endX = hitZombie.x;
                endZ = hitZombie.z;
            }
        }

        return { startX, startZ, endX, endZ };
    }
}

module.exports = CombatSystem;