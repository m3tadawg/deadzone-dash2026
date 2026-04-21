import * as THREE from "three";

export function createWorld(scene, mapData) {
    if (!mapData) return;

    const { grid, config, chunkSize } = mapData;

    // Ground & Prefab rendering
    Object.entries(grid).forEach(([coord, data]) => {
        const [cx, cz] = coord.split(',').map(Number);
        const biome = config.biomes[data.biome];

        // 1. Render Chunk Ground
        const groundGeo = new THREE.PlaneGeometry(chunkSize, chunkSize);
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: biome.groundColor,
            roughness: 0.9,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.position.set(cx * chunkSize + chunkSize / 2, 0, cz * chunkSize + chunkSize / 2);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // 2. Render Prefabs
        data.prefabs.forEach(p => {
            const prefabDef = config.prefabs[p.type];
            if (!prefabDef) return;

            let model;
            switch(p.type) {
                case 'car':
                    model = buildCar(prefabDef);
                    break;
                case 'vending':
                    model = buildVendingMachine(prefabDef);
                    break;
                case 'wall':
                    model = buildWall(prefabDef);
                    break;
                case 'grave':
                    model = buildGrave(prefabDef);
                    break;
                case 'barrel':
                    model = buildBarrel(prefabDef);
                    break;
                case 'rubble':
                    model = buildRubble(prefabDef);
                    break;
                default:
                    model = buildCrate(prefabDef);
                    break;
            }

            model.position.set(p.x, 0, p.z);
            model.rotation.y = p.rotation;
            scene.add(model);
        });
    });

    // Dynamic Fog based on biome
    scene.fog = new THREE.Fog(config.biomes.desert.fogColor, 40, 150);
}

// ==========================================
// PREFAB BUILDERS
// ==========================================

function buildCar(def) {
    const group = new THREE.Group();
    
    // Body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(def.width, def.height * 0.6, def.depth),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7, metalness: 0.4 })
    );
    body.position.y = def.height * 0.4;
    body.castShadow = body.receiveShadow = true;
    group.add(body);

    // Cabin
    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(def.width * 0.6, def.height * 0.5, def.depth * 0.8),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 })
    );
    cabin.position.y = def.height * 0.8;
    cabin.position.x = -def.width * 0.1;
    cabin.castShadow = true;
    group.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const positions = [
        [def.width * 0.3, 0.5, def.depth * 0.4],
        [def.width * 0.3, 0.5, -def.depth * 0.4],
        [-def.width * 0.3, 0.5, def.depth * 0.4],
        [-def.width * 0.3, 0.5, -def.depth * 0.4]
    ];
    positions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(...pos);
        wheel.rotation.z = Math.PI / 2;
        group.add(wheel);
    });

    return group;
}

function buildVendingMachine(def) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(def.width, def.height, def.depth),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.2 })
    );
    body.position.y = def.height / 2;
    body.castShadow = body.receiveShadow = true;
    group.add(body);

    // Glowing screen
    const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(def.width * 0.7, def.height * 0.4),
        new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2 })
    );
    screen.position.set(def.width / 2 + 0.05, def.height * 0.6, 0);
    screen.rotation.y = Math.PI / 2;
    group.add(screen);

    return group;
}

function buildWall(def) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(def.width, def.height, def.depth),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.9 })
    );
    mesh.position.y = def.height / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
}

function buildCrate(def) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(def.width, def.height, def.depth),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.8, metalness: 0.1 })
    );
    mesh.position.y = def.height / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
}

function buildGrave(def) {
    const group = new THREE.Group();
    const stone = new THREE.Mesh(
        new THREE.BoxGeometry(def.width, def.height, def.depth),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 1.0 })
    );
    stone.position.y = def.height / 2;
    stone.castShadow = true;
    group.add(stone);
    return group;
}

function buildBarrel(def) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(def.width / 2, def.width / 2, def.height, 12),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.4, metalness: 0.7 })
    );
    mesh.position.y = def.height / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
}

function buildRubble(def) {
    const group = new THREE.Group();
    const count = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
        const size = (0.5 + Math.random() * 1.5);
        const shard = new THREE.Mesh(
            new THREE.BoxGeometry(size, size, size),
            new THREE.MeshStandardMaterial({ color: def.color, roughness: 1.0 })
        );
        shard.position.set(
            (Math.random() - 0.5) * def.width,
            size / 2,
            (Math.random() - 0.5) * def.depth
        );
        shard.rotation.set(Math.random(), Math.random(), Math.random());
        shard.castShadow = shard.receiveShadow = true;
        group.add(shard);
    }
    return group;
}