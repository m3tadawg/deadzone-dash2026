const fs = require('fs');
const path = require('path');

class WorldSystem {
    constructor() {
        this.config = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/world.json'), 'utf8'));
        this.chunkSize = 40;
        this.gridSize = 10; // 10x10 chunks = 400x400 map
        this.grid = new Map();
        
        this.generate();
    }

    generate() {
        console.log("Generating World...");
        const halfGrid = Math.floor(this.gridSize / 2);

        // 1. Fill with default (mostly desert)
        for (let cx = -halfGrid; cx < halfGrid; cx++) {
            for (let cz = -halfGrid; cz < halfGrid; cz++) {
                this.grid.set(`${cx},${cz}`, {
                    biome: "desert",
                    prefabs: []
                });
            }
        }

        // 2. Guarantee biomes
        this.ensureBiome("graveyard", this.config.biomes.graveyard.guaranteedCount);
        this.ensureBiome("ruins", this.config.biomes.ruins.guaranteedCount);

        // 3. Populate chunks with prefabs
        for (const [key, chunk] of this.grid.entries()) {
            this.populateChunk(chunk, key);
        }
        
        console.log(`World generated with ${this.grid.size} chunks.`);
    }

    ensureBiome(type, count) {
        let placed = 0;
        const keys = Array.from(this.grid.keys());
        
        while (placed < count) {
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            const chunk = this.grid.get(randomKey);
            if (chunk.biome === "desert") {
                chunk.biome = type;
                placed++;
            }
        }
    }

    populateChunk(chunk, key) {
        const [cx, cz] = key.split(',').map(Number);
        const biomeId = chunk.biome;

        let prefabCount = 4 + Math.floor(Math.random() * 5);
        let types = ['crate', 'barrel', 'rubble'];

        if (biomeId === 'graveyard') {
            prefabCount = 10 + Math.floor(Math.random() * 8);
            types = ['grave', 'grave', 'rubble', 'crate'];
        } else if (biomeId === 'ruins') {
            prefabCount = 12 + Math.floor(Math.random() * 10);
            types = ['wall', 'car', 'vending', 'barrel', 'crate', 'rubble'];
        }

        for (let i = 0; i < prefabCount; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            chunk.prefabs.push({
                type: type,
                x: cx * this.chunkSize + (Math.random() * 0.8 + 0.1) * this.chunkSize,
                z: cz * this.chunkSize + (Math.random() * 0.8 + 0.1) * this.chunkSize,
                rotation: Math.random() * Math.PI * 2
            });
        }
    }

    // ==========================================
    // COLLISION LOGIC (OBB using SAT)
    // ==========================================

    /**
     * Checks if a circular entity overlaps any physical prefab in its vicinity.
     */
    isPositionBlocked(x, z, radius) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);

        // Check local and 8 neighboring chunks to be safe near boundaries
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const chunk = this.grid.get(`${cx + dx},${cz + dz}`);
                if (!chunk) continue;

                for (const p of chunk.prefabs) {
                    const def = this.config.prefabs[p.type];
                    if (!def.collision) continue;

                    if (this.checkCircleOBB(x, z, radius, p, def)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Circle-OBB Intersection test
     */
    checkCircleOBB(px, pz, radius, prefab, def) {
        // Transform player into local space of the OBB
        const dx = px - prefab.x;
        const dz = pz - prefab.z;

        // Rotate point by -prefab.rotation
        const cos = Math.cos(-prefab.rotation);
        const sin = Math.sin(-prefab.rotation);
        const localX = dx * cos - dz * sin;
        const localZ = dx * sin + dz * cos;

        // Find closest point in AABB (half-extents)
        const hW = def.width / 2;
        const hD = def.depth / 2;

        const closestX = Math.max(-hW, Math.min(hW, localX));
        const closestZ = Math.max(-hD, Math.min(hD, localZ));

        // Distance from local circle center to closest point
        const distSq = (localX - closestX) ** 2 + (localZ - closestZ) ** 2;
        return distSq < radius * radius;
    }

    /**
     * Checks for the first intersection between a ray and physical obstacles.
     */
    checkRayIntersection(startX, startZ, endX, endZ) {
        const dirX = endX - startX;
        const dirZ = endZ - startZ;
        const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
        if (length === 0) return null;

        const unitX = dirX / length;
        const unitZ = dirZ / length;

        let closestHit = null;
        let minDist = length;

        // Scan all relevant chunks along the ray
        // For simplicity in a 10x10 map, we check all chunks for now, 
        // but typically you'd traverse the grid.
        for (const chunk of this.grid.values()) {
            for (const p of chunk.prefabs) {
                const def = this.config.prefabs[p.type];
                if (!def.collision) continue;

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
        // Ray to local space
        const lx = sx - p.x;
        const lz = sz - p.z;

        const cos = Math.cos(-p.rotation);
        const sin = Math.sin(-p.rotation);
        
        const localSX = lx * cos - lz * sin;
        const localSZ = lx * sin + lz * cos;
        const localDX = dx * cos - dz * sin;
        const localDZ = dx * sin + dz * cos;

        // AABB Ray Test
        const hW = def.width / 2;
        const hD = def.depth / 2;

        let tMin = -Infinity;
        let tMax = Infinity;

        // Check X axis
        if (Math.abs(localDX) < 1e-6) {
            if (localSX < -hW || localSX > hW) return null;
        } else {
            const t1 = (-hW - localSX) / localDX;
            const t2 = (hW - localSX) / localDX;
            tMin = Math.max(tMin, Math.min(t1, t2));
            tMax = Math.min(tMax, Math.max(t1, t2));
        }

        // Check Z axis
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

    getSpeedMultiplier(x, z) {
        const chunk = this.getChunkAt(x, z);
        if (!chunk) return 1.0;
        const biome = this.config.biomes[chunk.biome];
        if (chunk.biome === 'ruins') return 0.8;
        return biome ? biome.speedMultiplier : 1.0;
    }

    getMapData() {
        return {
            grid: Object.fromEntries(this.grid),
            config: this.config,
            chunkSize: this.chunkSize
        };
    }

    getNearbySearchable(x, z, radius) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        const chunk = this.grid.get(`${cx},${cz}`);
        if (!chunk) return null;

        let closest = null;
        let minDist = radius;

        chunk.prefabs.forEach(p => {
            const def = this.config.prefabs[p.type];
            if (def && def.searchable) {
                const dist = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(z - p.z, 2));
                if (dist < minDist) {
                    minDist = dist;
                    closest = p;
                }
            }
        });
        return closest;
    }
}

module.exports = new WorldSystem();
