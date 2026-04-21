import * as THREE from "three";

export function createCamera() {
    const camera = new THREE.PerspectiveCamera(
        60, // FOV
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    // Position: slightly angled top-down
    camera.position.set(0, 30, 30);
    camera.lookAt(0, 0, 0);

    return camera;
}