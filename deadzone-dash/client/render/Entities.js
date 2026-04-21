import * as THREE from "three";

export function createPlayerMesh() {
    const parent = new THREE.Object3D();

    const bodyContainer = new THREE.Object3D();
    bodyContainer.name = "bodyContainer";

    const geometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const body = new THREE.Mesh(geometry, material);
    bodyContainer.add(body);

    // Front visor to clearly show which way the player body is facing (-Z is front)
    const visorGeo = new THREE.BoxGeometry(0.6, 0.2, 0.3);
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.4, -0.4);
    bodyContainer.add(visor);

    parent.add(bodyContainer);

    const gunContainer = new THREE.Object3D();
    gunContainer.name = "gunContainer";

    // Weapon barrel representation (added to right side, pointing forward -z is front)
    const gunGeo = new THREE.BoxGeometry(0.2, 0.2, 1.2);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.6, 0.2, -0.5); // Offset to the right and slightly forward
    gunContainer.add(gun);

    parent.add(gunContainer);

    return parent;
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