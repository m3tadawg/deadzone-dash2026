class CombatSystem {
    constructor(weaponsConfig, hitCallback = null) {
        this.weaponsConfig = weaponsConfig;
        this.hitCallback = hitCallback;
        this.StatusEffectSystem = require('./StatusEffectSystem');
        this.zombieTypes = require('../data/zombies.json').reduce((acc, def) => {
            acc[def.type] = def;
            return acc;
        }, {});
    }

    handleShoot(player, zombies) {
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

        return this.handleRaycastWeapon(player, zombies, weapon);
    }

    getHitProfile(zombie) {
        const typeDef = this.zombieTypes[zombie.type] || {};
        const aiRadius = typeDef.aiProfile?.radius;
        const hitProfile = typeDef.hitProfile || {};
        const bodyRadius = hitProfile.bodyRadius ?? aiRadius ?? 0.75;

        return {
            bodyRadius,
            headRadius: hitProfile.headRadius ?? Math.max(0.28, bodyRadius * 0.48),
            headshotMultiplier: hitProfile.headshotMultiplier ?? 2,
            headshotInstantKill: Boolean(hitProfile.headshotInstantKill)
        };
    }

    getRayCircleHit(startX, startZ, dirX, dirZ, centerX, centerZ, radius, maxDist) {
        const toCenterX = centerX - startX;
        const toCenterZ = centerZ - startZ;
        const projection = toCenterX * dirX + toCenterZ * dirZ;
        if (projection < 0 || projection > maxDist + radius) return null;

        const centerDistSq = toCenterX * toCenterX + toCenterZ * toCenterZ;
        const perpendicularSq = centerDistSq - projection * projection;
        const radiusSq = radius * radius;
        if (perpendicularSq > radiusSq) return null;

        const halfChord = Math.sqrt(Math.max(0, radiusSq - perpendicularSq));
        const entryDist = Math.max(0, projection - halfChord);
        if (entryDist > maxDist) return null;

        return {
            entryDist,
            centerDist: projection,
            perpendicularSq
        };
    }

    findFirstZombieHit(zombies, startX, startZ, dirX, dirZ, maxDist) {
        let hit = null;
        let minEntryDist = maxDist;

        Object.values(zombies).forEach((zombie) => {
            if (zombie.dead) return;

            const profile = this.getHitProfile(zombie);
            const bodyHit = this.getRayCircleHit(
                startX,
                startZ,
                dirX,
                dirZ,
                zombie.x,
                zombie.z,
                profile.bodyRadius,
                minEntryDist
            );
            if (!bodyHit) return;

            const headHit = this.getRayCircleHit(
                startX,
                startZ,
                dirX,
                dirZ,
                zombie.x,
                zombie.z,
                profile.headRadius,
                minEntryDist
            );

            hit = {
                zombie,
                profile,
                isHeadshot: Boolean(headHit),
                dist: bodyHit.entryDist,
                x: startX + dirX * bodyHit.entryDist,
                z: startZ + dirZ * bodyHit.entryDist
            };
            minEntryDist = bodyHit.entryDist;
        });

        return hit;
    }

    handleRaycastWeapon(player, zombies, weapon) {
        const eliminatedZombieIds = [];
        const hitEvents = [];
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
        const baseDamage = this.StatusEffectSystem.applyModifiers(player, weapon.damage, 'outgoingDamage');

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

            let minTargetDist = weapon.range;

            const WorldSystem = require('./WorldSystem');
            const worldHit = WorldSystem.checkRayIntersection(startX, startZ, endX, endZ);
            if (worldHit) {
                minTargetDist = worldHit.dist;
                endX = worldHit.x;
                endZ = worldHit.z;
            }

            const hit = this.findFirstZombieHit(zombies, startX, startZ, bDirX, bDirZ, minTargetDist);

            if (hit) {
                const damage = hit.isHeadshot
                    ? (hit.profile.headshotInstantKill ? hit.zombie.health : baseDamage * hit.profile.headshotMultiplier)
                    : baseDamage;
                const isKilled = this.applyDamageToZombie(hit.zombie, damage, weapon.effects);
                if (isKilled) eliminatedZombieIds.push(hit.zombie.id);
                hitEvents.push({
                    zombieId: hit.zombie.id,
                    zombieType: hit.zombie.type,
                    isHeadshot: hit.isHeadshot,
                    killed: isKilled,
                    damage
                });
                
                if (this.hitCallback) {
                    this.hitCallback(hit.zombie.x, hit.zombie.z, "zombie", hit.isHeadshot, {
                        killed: isKilled,
                        damage,
                        zombieId: hit.zombie.id,
                        zombieType: hit.zombie.type
                    });
                }

                endX = hit.x;
                endZ = hit.z;
            }

            rays.push({ startX, startZ, endX, endZ });
        }

        return { eliminatedZombieIds, hitEvents, rays };
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
        const hitEvents = [];

        const modifiedDamage = this.StatusEffectSystem.applyModifiers(player, weapon.damage, 'outgoingDamage');

        Object.values(zombies).forEach((zombie) => {
            if (zombie.dead) return;
            const dx = zombie.x - impactX;
            const dz = zombie.z - impactZ;
            if ((dx * dx + dz * dz) > radius * radius) return;

            const isKilled = this.applyDamageToZombie(zombie, modifiedDamage, weapon.effects);
            if (isKilled) eliminatedZombieIds.push(zombie.id);
            hitEvents.push({
                zombieId: zombie.id,
                zombieType: zombie.type,
                isHeadshot: false,
                killed: isKilled,
                damage: modifiedDamage
            });
            
            if (this.hitCallback) {
                this.hitCallback(zombie.x, zombie.z, "zombie", false, {
                    killed: isKilled,
                    damage: modifiedDamage,
                    zombieId: zombie.id,
                    zombieType: zombie.type
                });
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
            hitEvents,
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
