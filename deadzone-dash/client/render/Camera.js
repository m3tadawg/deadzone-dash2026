import * as THREE from "three";

export function createCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 35; // Maintains the 'further out' view

    const camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.1,
        1000
    );

    // Position: angled top-down as before
    camera.position.set(0, 35, 35); // Heightened slightly for better ortho alignment
    camera.lookAt(0, 0, 0);

    return camera;
}