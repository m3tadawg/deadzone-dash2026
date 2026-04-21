import * as THREE from "three";

export function createWorld(scene) {
    // Ground
    const geometry = new THREE.PlaneGeometry(200, 200);
    const material = new THREE.MeshStandardMaterial({
        color: 0xc2a36b
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Fog
    scene.fog = new THREE.Fog(0xc2a36b, 30, 120);
}