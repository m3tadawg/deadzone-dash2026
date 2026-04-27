class CombatSystem {
    constructor(weaponsConfig, hitCallback = null) {
        this.weaponsConfig = weaponsConfig;
        this.hitCallback = hitCallback;
        this.StatusEffectSystem = require('./StatusEffectSystem');
    }

    handleShoot(player, zombies, isHeadshot = false) {
        const now = Date.now();
        const weapon = this.weaponsConfig.find((w) => w.id === player.weapon);

        if (!weapon || now - player.lastShotTime < weapon.fireRate) return null;
        
        // Ammo Check (if not melee)
        if (weapon.type !== 'melee') {
            const currentAmmo = player.ammo ? player.ammo.current : 0;
            if (currentAmmo <= 0) return null; // No ammo
            
            // Consume ammo
            player.ammo.current--;
            
            // Sync back to inventory
            const invItem = player.inventory[player.selectedWeaponSlot];
            if (invItem) invItem.clip = player.ammo.current;
        }

        player.lastShotTime = now;

        if (weapon.type === 'thrown') {
            return this.handleThrown(player, zombies, weapon);
        }

        return this.handleRaycastWeapon(player, zombies, weapon, isHeadshot);
    }

    handleRaycastWeapon(player, zombies, weapon, isHeadshot) {
        const eliminatedZombieIds = [];
        const rays = [];

        const aimVec = { x: player.aimX - player.x, z: player.aimZ - player.z };
        const aimLength = Math.sqrt(aimVec.x * aimVec.x + aimVec.z * aimVec.z);

        if (aimLength <= 0) {
            return { eliminatedZombieIds, startX: player.x, startZ: player.z, endX: player.x, endZ: player.z };
        }

        const dirX = aimVec.x / aimLength;
        const dirZ = aimVec.z / aimLength;

        const muzzle = weapon.muzzleOffset || { forward: 0.5, right: 0 };
        const startX = player.x + dirX * muzzle.forward - dirZ * muzzle.right;
        const startZ = player.z + dirZ * muzzle.forward + dirX * muzzle.right;

        const numPellets = weapon.pellets || 1;
        const spread = weapon.spread || 0;
        let modifiedDamage = this.StatusEffectSystem.applyModifiers(player, weapon.damage, 'outgoingDamage');
        
        if (isHeadshot) {
            // Apply a 2x damage multiplier for headshots
            modifiedDamage *= 2;
        }

        for (let i = 0; i < numPellets; i++) {
            let bDirX = dirX;
            let bDirZ = dirZ;

            if (spread > 0) {
                const angleOffset = (Math.random() - 0.5) * spread;
                const cos = Math.cos(angleOffset);
                const sin = Math.sin(angleOffset);
                bDirX = dirX * cos - dirZ * sin;
                bDirZ = dirZ * cos + dirX * sin;
            }

            let endX = startX + bDirX * weapon.range;
            let endZ = startZ + bDirZ * weapon.range;

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
                const isKilled = this.applyDamageToZombie(hitZombie, modifiedDamage, weapon.effects);
                if (isKilled) eliminatedZombieIds.push(hitZombie.id);
                
                if (this.hitCallback) {
                    this.hitCallback(hitZombie.x, hitZombie.z, "zombie", isHeadshot);
                }

                endX = hitZombie.x;
                endZ = hitZombie.z;
            }

            rays.push({ startX, startZ, endX, endZ });
        }

        return { eliminatedZombieIds, rays };
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

        const modifiedDamage = this.StatusEffectSystem.applyModifiers(player, weapon.damage, 'outgoingDamage');

        Object.values(zombies).forEach((zombie) => {
            if (zombie.dead) return;
            const dx = zombie.x - impactX;
            const dz = zombie.z - impactZ;
            if ((dx * dx + dz * dz) > radius * radius) return;

            const isKilled = this.applyDamageToZombie(zombie, modifiedDamage, weapon.effects);
            if (isKilled) eliminatedZombieIds.push(zombie.id);
            
            if (this.hitCallback) {
                this.hitCallback(zombie.x, zombie.z, "zombie");
            }
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
                ownerId: player.id,
                sourceWeaponId: weapon.id,
                x: impactX,
                z: impactZ,
                radius: burn.radius || radius,
                dps: this.StatusEffectSystem.applyModifiers(player, burn.dps || 12, 'outgoingDamage'),
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
