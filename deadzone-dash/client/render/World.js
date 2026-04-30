import * as THREE from "three";

const materialCache = new Map();
const geometryCache = new Map();

function getMaterial(key, options) {
    if (!materialCache.has(key)) {
        materialCache.set(key, new THREE.MeshStandardMaterial({
            roughness: 0.82,
            metalness: 0.05,
            flatShading: true,
            ...options
        }));
    }
    return materialCache.get(key);
}

function getGeometry(key, factory) {
    if (!geometryCache.has(key)) geometryCache.set(key, factory());
    return geometryCache.get(key);
}

function colorToThree(color) {
    return new THREE.Color(color || "#777777");
}

function mixColor(a, b, amount = 0.5) {
    return colorToThree(a).lerp(colorToThree(b), amount);
}

function rand(seed) {
    const value = Math.sin(seed * 127.1) * 43758.5453123;
    return value - Math.floor(value);
}

function coordSeed(cx, cz, salt = 0) {
    return (cx + 97.13) * 31.7 + (cz - 11.41) * 19.3 + salt;
}

function markShadow(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function addBox(group, name, size, position, material, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(
        getGeometry(`box:${size.join(",")}`, () => new THREE.BoxGeometry(size[0], size[1], size[2])),
        material
    );
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    markShadow(mesh);
    group.add(mesh);
    return mesh;
}

function addCylinder(group, name, radius, height, segments, position, material, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(
        getGeometry(`cyl:${radius}:${height}:${segments}`, () => new THREE.CylinderGeometry(radius, radius, height, segments)),
        material
    );
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    markShadow(mesh);
    group.add(mesh);
    return mesh;
}

function addPlane(group, name, size, position, material, rotation = [-Math.PI / 2, 0, 0]) {
    const mesh = new THREE.Mesh(
        getGeometry(`plane:${size[0]}:${size[1]}`, () => new THREE.PlaneGeometry(size[0], size[1])),
        material
    );
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
}

export function createWorld(scene, mapData) {
    if (!mapData) return;

    const { grid, config, chunkSize } = mapData;

    Object.entries(grid).forEach(([coord, data]) => {
        const [cx, cz] = coord.split(",").map(Number);
        const biome = config.biomes[data.biome];
        const originX = cx * chunkSize;
        const originZ = cz * chunkSize;

        renderChunkGround(scene, grid, config, chunkSize, cx, cz, data.biome, biome);

        data.prefabs.forEach((p, index) => {
            const prefabDef = config.prefabs[p.type];
            if (!prefabDef) return;

            const seed = p.x * 0.73 + p.z * 1.37 + index * 11.1;
            const model = buildPrefab(p.type, prefabDef, seed);
            model.position.set(p.x, 0, p.z);
            model.rotation.y = p.rotation;
            scene.add(model);
        });
    });

    scene.fog = new THREE.Fog(config.biomes.desert.fogColor, 48, 170);
}

function renderChunkGround(scene, grid, config, chunkSize, cx, cz, biomeId, biome) {
    const centerX = cx * chunkSize + chunkSize / 2;
    const centerZ = cz * chunkSize + chunkSize / 2;
    const groundColor = colorToThree(biome.groundColor);
    const groundMat = getMaterial(`ground:${biome.groundColor}`, {
        color: groundColor,
        roughness: 0.96,
        metalness: 0
    });

    const ground = new THREE.Mesh(
        getGeometry(`ground:${chunkSize}`, () => new THREE.PlaneGeometry(chunkSize, chunkSize, 3, 3)),
        groundMat
    );
    ground.position.set(centerX, 0, centerZ);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    addBiomeBlend(scene, grid, config, chunkSize, cx, cz, biomeId, biome, centerX, centerZ);
    addTerrainDetail(scene, chunkSize, cx, cz, biomeId, biome, centerX, centerZ);
}

function addBiomeBlend(scene, grid, config, chunkSize, cx, cz, biomeId, biome, centerX, centerZ) {
    const blendWidth = 8;
    const neighbors = [
        { key: `${cx - 1},${cz}`, offset: [-chunkSize / 2, 0], size: [blendWidth, chunkSize], rot: 0 },
        { key: `${cx + 1},${cz}`, offset: [chunkSize / 2, 0], size: [blendWidth, chunkSize], rot: 0 },
        { key: `${cx},${cz - 1}`, offset: [0, -chunkSize / 2], size: [chunkSize, blendWidth], rot: 0 },
        { key: `${cx},${cz + 1}`, offset: [0, chunkSize / 2], size: [chunkSize, blendWidth], rot: 0 }
    ];

    neighbors.forEach((neighbor) => {
        const neighborChunk = grid[neighbor.key];
        if (!neighborChunk || neighborChunk.biome === biomeId) return;

        const neighborBiome = config.biomes[neighborChunk.biome];
        const color = mixColor(biome.groundColor, neighborBiome.groundColor, 0.52);
        const mat = getMaterial(`blend:${biome.groundColor}:${neighborBiome.groundColor}`, {
            color,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
            roughness: 1,
            metalness: 0
        });

        const strip = new THREE.Mesh(
            getGeometry(`blend:${neighbor.size.join(",")}`, () => new THREE.PlaneGeometry(neighbor.size[0], neighbor.size[1])),
            mat
        );
        strip.position.set(centerX + neighbor.offset[0], 0.018, centerZ + neighbor.offset[1]);
        strip.rotation.x = -Math.PI / 2;
        scene.add(strip);
    });
}

function addTerrainDetail(scene, chunkSize, cx, cz, biomeId, biome, centerX, centerZ) {
    const patchCount = 5;
    for (let i = 0; i < patchCount; i += 1) {
        const seed = coordSeed(cx, cz, i);
        const patchColor = colorToThree(biome.groundColor).multiplyScalar(0.82 + rand(seed) * 0.26);
        const mat = getMaterial(`patch:${biomeId}:${i}:${Math.round(patchColor.r * 100)}`, {
            color: patchColor,
            transparent: true,
            opacity: 0.24,
            depthWrite: false,
            roughness: 1
        });
        const sizeX = 4 + rand(seed + 1) * 11;
        const sizeZ = 3 + rand(seed + 2) * 9;
        const patch = new THREE.Mesh(
            getGeometry(`patch:${Math.round(sizeX)}:${Math.round(sizeZ)}`, () => new THREE.PlaneGeometry(sizeX, sizeZ)),
            mat
        );
        patch.position.set(
            centerX + (rand(seed + 3) - 0.5) * chunkSize * 0.8,
            0.022 + i * 0.001,
            centerZ + (rand(seed + 4) - 0.5) * chunkSize * 0.8
        );
        patch.rotation.set(-Math.PI / 2, 0, rand(seed + 5) * Math.PI);
        scene.add(patch);
    }
}

function buildPrefab(type, def, seed) {
    switch (type) {
        case "car": return buildCar(def, seed);
        case "vending": return buildVendingMachine(def);
        case "wall": return buildWall(def);
        case "grave": return buildGrave(def);
        case "barrel": return buildBarrel(def);
        case "rubble": return buildRubble(def, seed);
        case "tree": return buildTree(def, seed);
        case "building_shell": return buildBuildingShell(def, seed);
        case "building_door": return buildBuildingDoor(def);
        case "mausoleum": return buildMausoleum(def);
        default: return buildCrate(def);
    }
}

function buildCar(def, seed) {
    const group = new THREE.Group();
    const paint = ["#243a56", "#335240", "#5a332d", "#4c4f55"][Math.floor(rand(seed) * 4)];
    const bodyMat = getMaterial(`car:${paint}`, { color: paint, roughness: 0.68, metalness: 0.35 });
    const glassMat = getMaterial("car:glass", { color: "#0b1117", roughness: 0.25, metalness: 0.45 });
    const trimMat = getMaterial("car:trim", { color: "#111111", roughness: 0.6, metalness: 0.25 });
    const lightMat = getMaterial("car:light", { color: "#f1d98b", emissive: "#c88d2a", emissiveIntensity: 0.25 });

    addBox(group, "body", [def.width, def.height * 0.48, def.depth], [0, def.height * 0.38, 0], bodyMat);
    addBox(group, "hood", [def.width * 0.34, def.height * 0.18, def.depth * 0.92], [def.width * 0.34, def.height * 0.7, 0], bodyMat, [0, 0, -0.08]);
    addBox(group, "trunk", [def.width * 0.26, def.height * 0.12, def.depth * 0.88], [-def.width * 0.39, def.height * 0.67, 0], bodyMat, [0, 0, 0.08]);
    addBox(group, "cabin", [def.width * 0.38, def.height * 0.46, def.depth * 0.72], [-def.width * 0.04, def.height * 0.82, 0], glassMat);
    addBox(group, "frontBumper", [0.18, 0.18, def.depth * 0.9], [def.width * 0.53, def.height * 0.33, 0], trimMat);
    addBox(group, "rearBumper", [0.18, 0.16, def.depth * 0.84], [-def.width * 0.53, def.height * 0.32, 0], trimMat);
    addBox(group, "headlightL", [0.08, 0.09, 0.34], [def.width * 0.56, def.height * 0.48, -def.depth * 0.28], lightMat);
    addBox(group, "headlightR", [0.08, 0.09, 0.34], [def.width * 0.56, def.height * 0.48, def.depth * 0.28], lightMat);

    const wheelMat = getMaterial("wheel", { color: "#0d0d0d", roughness: 0.7 });
    [[0.32, 0.42], [0.32, -0.42], [-0.34, 0.42], [-0.34, -0.42]].forEach(([x, z]) => {
        addCylinder(group, "wheel", 0.46, 0.34, 10, [def.width * x, 0.45, def.depth * z], wheelMat, [0, 0, Math.PI / 2]);
    });

    return group;
}

function buildVendingMachine(def) {
    const group = new THREE.Group();
    const bodyMat = getMaterial("vending:body", { color: def.color, roughness: 0.54, metalness: 0.22 });
    const sideMat = getMaterial("vending:side", { color: "#3d0c0c", roughness: 0.65, metalness: 0.18 });
    const screenMat = getMaterial("vending:screen", { color: "#10f4ff", emissive: "#10f4ff", emissiveIntensity: 1.7 });
    const slotMat = getMaterial("vending:slot", { color: "#111111", roughness: 0.5, metalness: 0.5 });

    addBox(group, "body", [def.width, def.height, def.depth], [0, def.height / 2, 0], bodyMat);
    addBox(group, "leftRail", [0.12, def.height * 0.96, def.depth * 1.04], [-def.width * 0.52, def.height * 0.5, 0], sideMat);
    addBox(group, "topCap", [def.width * 1.08, 0.16, def.depth * 1.08], [0, def.height + 0.08, 0], sideMat);
    addBox(group, "screen", [0.05, def.height * 0.42, def.depth * 0.62], [def.width / 2 + 0.04, def.height * 0.62, 0], screenMat);
    addBox(group, "coinSlot", [0.055, def.height * 0.16, def.depth * 0.18], [def.width / 2 + 0.06, def.height * 0.36, -def.depth * 0.27], slotMat);
    addBox(group, "pickupTray", [0.06, def.height * 0.12, def.depth * 0.58], [def.width / 2 + 0.06, def.height * 0.18, 0], slotMat);
    return group;
}

function buildWall(def) {
    const group = new THREE.Group();
    const wallMat = getMaterial("wall:concrete", { color: def.color, roughness: 0.95 });
    const capMat = getMaterial("wall:cap", { color: "#2f3130", roughness: 0.9 });
    addBox(group, "wall", [def.width, def.height, def.depth], [0, def.height / 2, 0], wallMat);
    addBox(group, "cap", [def.width * 1.02, def.height * 0.08, def.depth * 1.08], [0, def.height + def.height * 0.04, 0], capMat);
    addBox(group, "crack", [def.width * 0.05, def.height * 0.72, 0.04], [def.width * 0.18, def.height * 0.52, -def.depth * 0.52], capMat, [0.2, 0, 0.35]);
    return group;
}

function buildCrate(def) {
    const group = new THREE.Group();
    const woodMat = getMaterial("crate:wood", { color: def.color, roughness: 0.88 });
    const strapMat = getMaterial("crate:strap", { color: "#27211b", roughness: 0.72, metalness: 0.15 });
    addBox(group, "crate", [def.width, def.height, def.depth], [0, def.height / 2, 0], woodMat);
    addBox(group, "strapX", [def.width * 1.04, def.height * 0.12, def.depth * 0.16], [0, def.height * 0.65, 0], strapMat);
    addBox(group, "strapZ", [def.width * 0.16, def.height * 0.13, def.depth * 1.04], [0, def.height * 0.42, 0], strapMat);
    addBox(group, "lid", [def.width * 1.05, def.height * 0.1, def.depth * 1.05], [0, def.height + def.height * 0.05, 0], woodMat);
    return group;
}

function buildGrave(def) {
    const group = new THREE.Group();
    const stoneMat = getMaterial("grave:stone", { color: def.color, roughness: 1 });
    const darkMat = getMaterial("grave:mark", { color: "#333333", roughness: 1 });
    addBox(group, "stone", [def.width, def.height, def.depth], [0, def.height / 2, 0], stoneMat);
    addBox(group, "crossVertical", [def.width * 0.14, def.height * 0.46, def.depth * 0.16], [0, def.height * 0.7, -def.depth * 0.55], darkMat);
    addBox(group, "crossBar", [def.width * 0.46, def.height * 0.1, def.depth * 0.18], [0, def.height * 0.78, -def.depth * 0.57], darkMat);
    return group;
}

function buildBarrel(def) {
    const group = new THREE.Group();
    const barrelMat = getMaterial("barrel:green", { color: def.color, roughness: 0.5, metalness: 0.45 });
    const bandMat = getMaterial("barrel:band", { color: "#151a15", roughness: 0.5, metalness: 0.5 });
    addCylinder(group, "barrel", def.width / 2, def.height, 12, [0, def.height / 2, 0], barrelMat);
    addCylinder(group, "topBand", def.width * 0.53, 0.12, 12, [0, def.height * 0.8, 0], bandMat);
    addCylinder(group, "bottomBand", def.width * 0.53, 0.12, 12, [0, def.height * 0.2, 0], bandMat);
    return group;
}

function buildRubble(def, seed) {
    const group = new THREE.Group();
    const rubbleMat = getMaterial("rubble:stone", { color: def.color, roughness: 1 });
    const count = 4 + Math.floor(rand(seed) * 4);
    for (let i = 0; i < count; i += 1) {
        const size = 0.45 + rand(seed + i) * 1.05;
        addBox(
            group,
            "shard",
            [size, size * (0.45 + rand(seed + i + 4) * 0.55), size * (0.6 + rand(seed + i + 8) * 0.8)],
            [(rand(seed + i + 1) - 0.5) * def.width, size * 0.28, (rand(seed + i + 2) - 0.5) * def.depth],
            rubbleMat,
            [rand(seed + i + 3), rand(seed + i + 5), rand(seed + i + 6)]
        );
    }
    return group;
}

function buildTree(def, seed) {
    const group = new THREE.Group();
    const trunkMat = getMaterial("tree:trunk", { color: "#5a3d23", roughness: 0.96 });
    const canopyMat = getMaterial(`tree:canopy:${def.color}`, { color: def.color, roughness: 0.9 });
    addCylinder(group, "trunk", def.width * 0.2, def.height * 0.45, 8, [0, def.height * 0.22, 0], trunkMat, [0.04, 0, rand(seed) * 0.12]);
    addCylinder(group, "canopyLow", def.width * 0.78, def.height * 0.55, 7, [0, def.height * 0.62, 0], canopyMat);
    addCylinder(group, "canopyTop", def.width * 0.55, def.height * 0.42, 7, [0, def.height * 0.92, 0], canopyMat);
    return group;
}

function buildBuildingShell(def, seed) {
    const group = new THREE.Group();
    const wallMat = getMaterial("building:wall", { color: def.color, roughness: 0.9 });
    const roofMat = getMaterial("building:roof", { color: "#3e3b37", roughness: 0.82 });
    const darkMat = getMaterial("building:window", { color: "#111517", roughness: 0.5, metalness: 0.1 });
    addBox(group, "shell", [def.width, def.height, def.depth], [0, def.height / 2, 0], wallMat);
    addBox(group, "roof", [def.width * 1.06, def.height * 0.2, def.depth * 1.06], [0, def.height + def.height * 0.1, 0], roofMat);
    addBox(group, "awning", [def.width * 0.45, 0.18, def.depth * 0.16], [def.width * 0.12, def.height * 0.62, -def.depth * 0.54], roofMat, [0.18, 0, 0]);
    for (let i = -1; i <= 1; i += 1) {
        addBox(group, "window", [def.width * 0.12, def.height * 0.22, 0.08], [i * def.width * 0.24, def.height * (0.42 + rand(seed + i) * 0.24), -def.depth * 0.53], darkMat);
    }
    return group;
}

function buildBuildingDoor(def) {
    const group = new THREE.Group();
    const doorMat = getMaterial("door:wood", { color: def.color, roughness: 0.72, metalness: 0.08 });
    const trimMat = getMaterial("door:trim", { color: "#2b1b12", roughness: 0.8 });
    addBox(group, "door", [def.width, def.height, def.depth], [0, def.height / 2, 0], doorMat);
    addBox(group, "lintel", [def.width * 1.1, def.height * 0.12, def.depth * 1.1], [0, def.height + def.height * 0.06, 0], trimMat);
    addBox(group, "handle", [0.12, 0.12, def.depth * 0.18], [def.width * 0.32, def.height * 0.5, -def.depth * 0.55], trimMat);
    return group;
}

function buildMausoleum(def) {
    const group = new THREE.Group();
    const stoneMat = getMaterial("mausoleum:stone", { color: def.color, roughness: 0.95 });
    const darkMat = getMaterial("mausoleum:dark", { color: "#242320", roughness: 0.9 });
    addBox(group, "base", [def.width, def.height, def.depth], [0, def.height / 2, 0], stoneMat);
    addCylinder(group, "pillarL", def.width * 0.06, def.height * 0.86, 8, [-def.width * 0.36, def.height * 0.43, -def.depth * 0.52], stoneMat);
    addCylinder(group, "pillarR", def.width * 0.06, def.height * 0.86, 8, [def.width * 0.36, def.height * 0.43, -def.depth * 0.52], stoneMat);
    addBox(group, "doorway", [def.width * 0.42, def.height * 0.62, 0.12], [0, def.height * 0.37, -def.depth * 0.54], darkMat);
    const pediment = new THREE.Mesh(
        getGeometry(`mausoleum:pediment:${def.width}`, () => new THREE.ConeGeometry(def.width * 0.42, def.height * 0.45, 4)),
        stoneMat
    );
    pediment.position.y = def.height + def.height * 0.2;
    pediment.rotation.y = Math.PI / 4;
    markShadow(pediment);
    group.add(pediment);
    return group;
}
