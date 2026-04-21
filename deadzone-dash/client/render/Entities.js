import * as THREE from "three";

// Shared Geometries for optimization
const boxGeos = {
    torso: new THREE.BoxGeometry(1.0, 1.2, 0.6),
    head: new THREE.BoxGeometry(0.6, 0.6, 0.6),
    visor: new THREE.BoxGeometry(0.7, 0.2, 0.15),
    gun: new THREE.BoxGeometry(0.25, 0.25, 1.5) // Slightly longer/beefier weapon
};

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

    // Weapon
    const gun = new THREE.Mesh(boxGeos.gun, new THREE.MeshStandardMaterial({ color: 0x333333 }));
    gun.position.set(0.8, 0.3, -0.5); // Scaled out to match beefier body
    gunContainer.add(gun);

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