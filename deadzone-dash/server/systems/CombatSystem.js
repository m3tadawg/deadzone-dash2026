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

        if (weapon.type === 'thrown') {
            return this.handleThrown(player, zombies, weapon);
        }

        return this.handleRaycastWeapon(player, zombies, weapon);
    }

    handleRaycastWeapon(player, zombies, weapon) {
        const eliminatedZombieIds = [];

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
                    const isKilled = this.applyDamageToZombie(hitZombie, weapon.damage, weapon.effects);
                    if (isKilled) eliminatedZombieIds.push(hitZombie.id);

                    endX = hitZombie.x;
                    endZ = hitZombie.z;
                }
            }
        }

        return { startX, startZ, endX, endZ, eliminatedZombieIds, damageZones: [], hazards: [] };
    }

    handleThrown(player, zombies, weapon) {
        const aimVecX = player.aimX - player.x;
        const aimVecZ = player.aimZ - player.z;
        const aimLength = Math.sqrt(aimVecX * aimVecX + aimVecZ * aimVecZ);
        if (aimLength <= 0.0001) return null;

        const dirX = aimVecX / aimLength;
        const dirZ = aimVecZ / aimLength;
        const maxRange = weapon.range || 12;
        const travelDistance = Math.min(maxRange, aimLength);

        const impactX = player.x + dirX * travelDistance;
        const impactZ = player.z + dirZ * travelDistance;

        const radius = weapon.damageRadius || 4;
        const eliminatedZombieIds = [];

        Object.values(zombies).forEach((zombie) => {
            if (zombie.dead) return;
            const dx = zombie.x - impactX;
            const dz = zombie.z - impactZ;
            if ((dx * dx + dz * dz) > radius * radius) return;

            const isKilled = this.applyDamageToZombie(zombie, weapon.damage, weapon.effects);
            if (isKilled) eliminatedZombieIds.push(zombie.id);
        });

        const zoneStyle = weapon.zoneStyle || {};
        const damageZones = [{
            id: `${weapon.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: weapon.id,
            x: impactX,
            z: impactZ,
            radius,
            color: zoneStyle.color || (weapon.id === 'molotov' ? '#ff7a18' : '#7bd0ff'),
            ttlMs: zoneStyle.ttlMs || 900
        }];

        const hazards = [];
        if (weapon.id === 'molotov') {
            const burn = weapon.burn || {};
            hazards.push({
                id: `hazard-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: 'fire',
                sourceWeaponId: weapon.id,
                x: impactX,
                z: impactZ,
                radius: burn.radius || radius,
                dps: burn.dps || 12,
                expiresAt: Date.now() + (burn.durationMs || 5000)
            });
        }

        return {
            startX: player.x,
            startZ: player.z,
            endX: impactX,
            endZ: impactZ,
            eliminatedZombieIds,
            damageZones,
            hazards
        };
    }

    applyDamageToZombie(zombie, damage, effects = []) {
        zombie.health -= damage;
        if (zombie.health <= 0) {
            zombie.dead = true;
        }

        effects.forEach((effectName) => {
            this.StatusEffectSystem.applyEffect(zombie, { type: effectName, duration: 3 });
        });

        return zombie.dead;
    }
}

module.exports = CombatSystem;
