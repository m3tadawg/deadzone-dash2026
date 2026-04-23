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

    const mountOffset = weaponVisual?.mountOffset || [0, -0.15, -1.35];
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



export function createZombieMesh() {
    const geometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xff4444 });
    return new THREE.Mesh(geometry, material);
}

export function createBuilding(x, z) {
    const geometry = new THREE.BoxGeometry(6, 4, 6);
    const material = new THREE.MeshStandardMaterial({ color: 0x8b7355 });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 2, z);

    return mesh;
}
