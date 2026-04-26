const { loadWorldCatalog } = require('./WorldCatalog');

class WorldSystem {
    constructor() {
        this.catalog = loadWorldCatalog();
        this.chunkSize = this.catalog.chunkSize || 40;
        this.gridSize = this.catalog.gridSize || 10;
        this.grid = new Map();

        this.generate();
    }

    generate() {
        console.log('Generating World...');
        const halfGrid = Math.floor(this.gridSize / 2);
        const biomeIds = Object.keys(this.catalog.biomes);

        for (let cx = -halfGrid; cx < halfGrid; cx++) {
            for (let cz = -halfGrid; cz < halfGrid; cz++) {
                this.grid.set(`${cx},${cz}`, {
                    biome: this.pickBiomeByProbability(),
                    prefabs: [],
                    areas: []
                });
            }
        }

        biomeIds.forEach((biomeId) => {
            const guaranteedCount = this.catalog.biomes[biomeId].guaranteedCount || 0;
            if (guaranteedCount > 0) this.ensureBiome(biomeId, guaranteedCount);
        });

        for (const [key, chunk] of this.grid.entries()) {
            this.populateChunk(chunk, key);
        }

        console.log(`World generated with ${this.grid.size} chunks.`);
    }

    pickBiomeByProbability() {
        const entries = Object.entries(this.catalog.biomes);
        const total = entries.reduce((sum, [, biome]) => sum + (biome.probability || 0), 0);
        if (total <= 0) return this.catalog.defaultBiome || entries[0][0];

        const roll = Math.random() * total;
        let accumulator = 0;
        for (const [id, biome] of entries) {
            accumulator += biome.probability || 0;
            if (roll <= accumulator) return id;
        }
        return entries[entries.length - 1][0];
    }

    ensureBiome(type, count) {
        let placed = 0;
        const keys = Array.from(this.grid.keys());

        while (placed < count) {
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            const chunk = this.grid.get(randomKey);
            if (chunk.biome !== type) {
                chunk.biome = type;
                placed++;
            }
        }
    }

    populateChunk(chunk, key) {
        const [cx, cz] = key.split(',').map(Number);
        const biomeId = chunk.biome;
        const density = this.catalog.biomePrefabDensity[biomeId] || { min: 4, max: 8 };
        const prefabCount = density.min + Math.floor(Math.random() * (density.max - density.min + 1));
        const pool = this.catalog.biomePrefabPools[biomeId] || ['crate'];

        for (let i = 0; i < prefabCount; i++) {
            const type = pool[Math.floor(Math.random() * pool.length)];
            const prefab = {
                type,
                x: cx * this.chunkSize + (Math.random() * 0.8 + 0.1) * this.chunkSize,
                z: cz * this.chunkSize + (Math.random() * 0.8 + 0.1) * this.chunkSize,
                rotation: Math.random() * Math.PI * 2
            };
            chunk.prefabs.push(prefab);
            this.registerRegionFromPrefab(chunk, prefab, biomeId);
        }
    }

    registerRegionFromPrefab(chunk, prefab, biomeId) {
        Object.entries(this.catalog.regions).forEach(([regionId, region]) => {
            if (region.sourceBiomes && !region.sourceBiomes.includes(biomeId)) return;
            if (region.triggerPrefabs && !region.triggerPrefabs.includes(prefab.type)) return;

            chunk.areas.push({
                type: regionId,
                x: prefab.x,
                z: prefab.z,
                radius: region.radius || 10,
                spawnMultiplier: region.spawnMultiplier || 1,
                lootMultiplier: region.lootMultiplier || 1
            });
        });
    }

    isPositionBlocked(x, z, radius) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const chunk = this.grid.get(`${cx + dx},${cz + dz}`);
                if (!chunk) continue;

                for (const p of chunk.prefabs) {
                    const def = this.catalog.prefabs[p.type];
                    if (!def || !def.collision) continue;

                    if (this.checkCircleOBB(x, z, radius, p, def)) return true;
                }
            }
        }
        return false;
    }

    checkCircleOBB(px, pz, radius, prefab, def) {
        const dx = px - prefab.x;
        const dz = pz - prefab.z;
        const cos = Math.cos(-prefab.rotation);
        const sin = Math.sin(-prefab.rotation);
        const localX = dx * cos - dz * sin;
        const localZ = dx * sin + dz * cos;

        const hW = def.width / 2;
        const hD = def.depth / 2;
        const closestX = Math.max(-hW, Math.min(hW, localX));
        const closestZ = Math.max(-hD, Math.min(hD, localZ));

        const distSq = (localX - closestX) ** 2 + (localZ - closestZ) ** 2;
        return distSq < radius * radius;
    }

    checkRayIntersection(startX, startZ, endX, endZ) {
        const dirX = endX - startX;
        const dirZ = endZ - startZ;
        const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
        if (length === 0) return null;

        const unitX = dirX / length;
        const unitZ = dirZ / length;

        let closestHit = null;
        let minDist = length;

        for (const chunk of this.grid.values()) {
            for (const p of chunk.prefabs) {
                const def = this.catalog.prefabs[p.type];
                if (!def || !def.collision) continue;

                const hitDist = this.intersectRayOBB(startX, startZ, unitX, unitZ, minDist, p, def);
                if (hitDist !== null && hitDist < minDist) {
                    minDist = hitDist;
                    closestHit = {
                        x: startX + unitX * hitDist,
                        z: startZ + unitZ * hitDist,
                        dist: hitDist
                    };
                }
            }
        }

        return closestHit;
    }

    intersectRayOBB(sx, sz, dx, dz, maxDist, p, def) {
        const lx = sx - p.x;
        const lz = sz - p.z;
        const cos = Math.cos(-p.rotation);
        const sin = Math.sin(-p.rotation);

        const localSX = lx * cos - lz * sin;
        const localSZ = lx * sin + lz * cos;
        const localDX = dx * cos - dz * sin;
        const localDZ = dx * sin + dz * cos;

        const hW = def.width / 2;
        const hD = def.depth / 2;

        let tMin = -Infinity;
        let tMax = Infinity;

        if (Math.abs(localDX) < 1e-6) {
            if (localSX < -hW || localSX > hW) return null;
        } else {
            const t1 = (-hW - localSX) / localDX;
            const t2 = (hW - localSX) / localDX;
            tMin = Math.max(tMin, Math.min(t1, t2));
            tMax = Math.min(tMax, Math.max(t1, t2));
        }

        if (Math.abs(localDZ) < 1e-6) {
            if (localSZ < -hD || localSZ > hD) return null;
        } else {
            const t1 = (-hD - localSZ) / localDZ;
            const t2 = (hD - localSZ) / localDZ;
            tMin = Math.max(tMin, Math.min(t1, t2));
            tMax = Math.min(tMax, Math.max(t1, t2));
        }

        if (tMax < tMin || tMax < 0 || tMin > maxDist) return null;
        return tMin > 0 ? tMin : null;
    }

    getChunkAt(x, z) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        return this.grid.get(`${cx},${cz}`);
    }

    getAreaAt(x, z) {
        const chunk = this.getChunkAt(x, z);
        if (!chunk || !chunk.areas) return null;

        for (const area of chunk.areas) {
            const dx = x - area.x;
            const dz = z - area.z;
            if ((dx * dx + dz * dz) <= (area.radius * area.radius)) return area;
        }

        return null;
    }

    getAreaTypeAt(x, z) {
        const area = this.getAreaAt(x, z);
        return area ? area.type : null;
    }

    getSpeedMultiplier(x, z) {
        const chunk = this.getChunkAt(x, z);
        if (!chunk) return 1.0;
        const biome = this.catalog.biomes[chunk.biome];
        return biome ? biome.speedMultiplier : 1.0;
    }

    getMapData() {
        return {
            grid: Object.fromEntries(this.grid),
            config: {
                biomes: this.catalog.biomes,
                prefabs: this.catalog.prefabs
            },
            regions: this.catalog.regions,
            chunkSize: this.chunkSize
        };
    }

    getNearbySearchable(x, z, radius) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        
        let closest = null;
        let minDistSq = radius * radius;

        // Check current and neighboring chunks
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const chunk = this.grid.get(`${cx + dx},${cz + dz}`);
                if (!chunk) continue;

                chunk.prefabs.forEach((p) => {
                    const def = this.catalog.prefabs[p.type];
                    if (def && def.searchable) {
                        // Use OBB check logic to find distance to edge
                        const dx_p = x - p.x;
                        const dz_p = z - p.z;
                        const cos = Math.cos(-p.rotation);
                        const sin = Math.sin(-p.rotation);
                        const localX = dx_p * cos - dz_p * sin;
                        const localZ = dx_p * sin + dz_p * cos;

                        const hW = def.width / 2;
                        const hD = def.depth / 2;
                        const closestX = Math.max(-hW, Math.min(hW, localX));
                        const closestZ = Math.max(-hD, Math.min(hD, localZ));

                        const distSq = (localX - closestX) ** 2 + (localZ - closestZ) ** 2;
                        
                        if (distSq < minDistSq) {
                            minDistSq = distSq;
                            closest = p;
                        }
                    }
                });
            }
        }
        return closest;
    }
}

module.exports = new WorldSystem();
