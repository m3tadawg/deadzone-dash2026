import * as THREE from "three";

// Shared Geometries for optimization
const boxGeos = {
    torso: new THREE.BoxGeometry(1.0, 1.2, 0.6),
    head: new THREE.BoxGeometry(0.6, 0.6, 0.6),
    visor: new THREE.BoxGeometry(0.7, 0.2, 0.15)
};

const materialCache = new Map();

function getMaterial(color = "#555555") {
    if (!materialCache.has(color)) {
        materialCache.set(color, new THREE.MeshStandardMaterial({ color }));
    }
    return materialCache.get(color);
}

function createWeaponPart(part) {
    let mesh = null;

    if (part.type === "box") {
        const [width, height, depth] = part.size;
        mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), getMaterial(part.color));
    } else if (part.type === "cylinder") {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(part.radiusTop, part.radiusBottom, part.height, part.radialSegments || 8), getMaterial(part.color));
    }

    if (!mesh) return null;

    mesh.position.set(...(part.position || [0, 0, 0]));
    mesh.rotation.set(...(part.rotation || [0, 0, 0]));
    return mesh;
}

function createWeaponModel(weaponVisual) {
    const weaponRoot = new THREE.Object3D();
    weaponRoot.name = "weaponModel";
    weaponRoot.userData.muzzleLocal = weaponVisual?.muzzleLocal || { x: 0, y: 0, z: -0.8 };

    const mountOffset = weaponVisual?.mountOffset || [0, -0.15, -1.00];
    weaponRoot.position.set(...mountOffset);

    const parts = weaponVisual?.parts || [];
    parts.forEach((part) => {
        const mesh = createWeaponPart(part);
        if (mesh) weaponRoot.add(mesh);
    });

    return weaponRoot;
}

export function createPlayerMesh() {
    const parent = new THREE.Object3D();

    const bodyContainer = new THREE.Object3D();
    bodyContainer.name = "bodyContainer";

    // Torso
    const torso = new THREE.Mesh(boxGeos.torso, new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
    torso.name = "torso";
    torso.position.y = 0.6;
    bodyContainer.add(torso);

    // Head
    const head = new THREE.Mesh(boxGeos.head, new THREE.MeshStandardMaterial({ color: 0xffdbac }));
    head.name = "head";
    head.position.y = 1.5;
    bodyContainer.add(head);

    // Visor/Eyes
    const visor = new THREE.Mesh(boxGeos.visor, new THREE.MeshStandardMaterial({ color: 0x000000 }));
    visor.position.set(0, 1.5, -0.3); // On the face
    bodyContainer.add(visor);

    parent.add(bodyContainer);

    const gunContainer = new THREE.Object3D();
    gunContainer.name = "gunContainer";
    // Pivot from player center/chest so the weapon can orbit 360 degrees around the body.
    gunContainer.position.set(0, 1.0, 0);

    parent.add(gunContainer);

    return parent;
}


/**
 * Applies visual customization to a player mesh.
 * @param {THREE.Object3D} mesh 
 * @param {Object} config 
 */
export function applyPlayerCustomization(mesh, config) {
    if (!config) return;

    const body = mesh.getObjectByName("bodyContainer");
    if (!body) return;

    if (config.torsoColor) {
        const torso = body.getObjectByName("torso");
        if (torso) torso.material.color.set(config.torsoColor);
    }

    if (config.skinColor) {
        const head = body.getObjectByName("head");
        if (head) head.material.color.set(config.skinColor);
    }
}

export function applyWeaponVisual(mesh, weaponId, weaponVisualCatalog) {
    if (!mesh || !weaponVisualCatalog) return;
    if (mesh.userData.weaponId === weaponId) return;

    const gunContainer = mesh.getObjectByName("gunContainer");
    if (!gunContainer) return;

    const weaponVisual = weaponVisualCatalog[weaponId] || weaponVisualCatalog.default;
    if (!weaponVisual) return;

    const oldWeapon = gunContainer.getObjectByName("weaponModel");
    if (oldWeapon) gunContainer.remove(oldWeapon);

    gunContainer.add(createWeaponModel(weaponVisual));
    mesh.userData.weaponId = weaponId;
}



function buildZombiePart(partDef) {
    if (!partDef) return null;

    let geometry;
    if (partDef.shape === "capsule") {
        geometry = new THREE.CapsuleGeometry(partDef.radius || 0.5, partDef.height || 1.5, 4, 8);
    } else if (partDef.shape === "box") {
        const size = partDef.size || [0.4, 0.4, 0.4];
        geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    } else {
        return null;
    }

    const mesh = new THREE.Mesh(geometry, getMaterial(partDef.color || "#ff4444"));
    const offset = partDef.offset || [0, 0, 0];
    mesh.position.set(offset[0], offset[1], offset[2]);
    return mesh;
}

export function createZombieMesh(type = "default", zombieVisualCatalog = null) {
    const visual = (zombieVisualCatalog && zombieVisualCatalog[type])
        || (zombieVisualCatalog && zombieVisualCatalog.default)
        || {
            base: { shape: "capsule", radius: 0.5, height: 1.5, color: "#ff4444" },
            head: { shape: "box", size: [0.4, 0.4, 0.4], offset: [0, 1.1, 0], color: "#ffd6bf" }
        };

    const root = new THREE.Object3D();
    const base = buildZombiePart(visual.base);
    const head = buildZombiePart(visual.head);
    const accent = buildZombiePart(visual.accent);

    if (base) root.add(base);
    if (head) root.add(head);
    if (accent) root.add(accent);

    return root;
}

export function createBuilding(x, z) {
    const geometry = new THREE.BoxGeometry(6, 4, 6);
    const material = new THREE.MeshStandardMaterial({ color: 0x8b7355 });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 2, z);

    return mesh;
}


export function createProjectileMesh(type = "default", projectileVisualCatalog = null) {
    const visual = (projectileVisualCatalog && projectileVisualCatalog[type])
        || (projectileVisualCatalog && projectileVisualCatalog.default)
        || { radius: 0.2, color: "#88ff88", emissive: "#1c7a1c" };

    const geometry = new THREE.SphereGeometry(visual.radius || 0.2, 10, 10);
    const material = new THREE.MeshStandardMaterial({
        color: visual.color || "#88ff88",
        emissive: visual.emissive || "#1c7a1c",
        emissiveIntensity: 0.55
    });

    return new THREE.Mesh(geometry, material);
}

export function createDroppedItemMesh(lootId, weaponVisualCatalog = null) {
    let color = "#e74c3c"; // Default: Weapon Red
    
    if (lootId === "health_pack") {
        color = "#2ecc71"; // Green
    } else if (lootId === "ammo_pack") {
        color = "#f1c40f"; // Yellow
    } else if (lootId && String(lootId).startsWith("perk_")) {
        color = "#9b59b6"; // Purple
    } else {
        // Weapon-specific color if defined
        const visual = (weaponVisualCatalog && weaponVisualCatalog[lootId]);
        if (visual) {
            color = visual.color || (visual.parts && visual.parts[0] ? visual.parts[0].color : "#e74c3c");
        }
    }
    
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshStandardMaterial({ 
        color: color,
        emissive: color,
        emissiveIntensity: 0.4
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
}
