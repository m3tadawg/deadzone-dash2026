import * as THREE from "three";
import { createCamera } from "./Camera.js";
import { createWorld } from "./World.js";
import { createPlayerMesh, createZombieMesh, applyPlayerCustomization } from "./Entities.js";

const PLAYER_COLORS = [
    0x3498db, // Blue
    0xe74c3c, // Red
    0x2ecc71, // Green
    0xf1c40f, // Yellow
    0x9b59b6, // Purple
    0xe67e22, // Orange
    0x1abc9c, // Teal
    0xecf0f1  // White
];

export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();

        this.camera = createCamera();

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Lighting
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(20, 50, 20);
        this.scene.add(light);

        const ambient = new THREE.AmbientLight(0x888888);
        this.scene.add(ambient);

        // World
        createWorld(this.scene);

        // Entity storage
        this.playerMeshes = {};
        this.zombieMeshes = {};
        
        // Target data for interpolation
        this.targets = new Map();
        this.localPlayerId = null;

        window.addEventListener("resize", () => this.handleResize());
    }

    handleResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 35;
        this.camera.left = -frustumSize * aspect / 2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    setLocalPlayer(id) {
        this.localPlayerId = id;
    }

    /**
     * Updates target positions and compute target rotations based on server snapshots.
     */
    sync(snapshot) {
        const processEntity = (id, data, category, createMeshFn, isPlayer) => {
            let mesh = category[id];
            if (!mesh) {
                mesh = createMeshFn();
                category[id] = mesh;
                this.scene.add(mesh);
                // Initial jump to position
                mesh.position.set(data.x, 1, data.z);

                if (isPlayer) {
                    // Assign deterministic color based on ID
                    const colorIndex = Math.abs(id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)) % PLAYER_COLORS.length;
                    applyPlayerCustomization(mesh, {
                        torsoColor: PLAYER_COLORS[colorIndex],
                        skinColor: 0xffdbac
                    });
                }
            }

            const targetPos = new THREE.Vector3(data.x, 1, data.z);
            let targetData = { position: targetPos, active: true, isPlayer };

            if (isPlayer) {
                let gunQuat = mesh.getObjectByName("gunContainer").quaternion.clone();
                if (data.aimX !== undefined && data.aimZ !== undefined) {
                    const aimPos = new THREE.Vector3(data.aimX, 1, data.aimZ);
                    if (aimPos.distanceToSquared(targetPos) > 0.001) {
                        const lookAtMatrix = new THREE.Matrix4();
                        lookAtMatrix.lookAt(targetPos, aimPos, new THREE.Vector3(0, 1, 0));
                        gunQuat.setFromRotationMatrix(lookAtMatrix);
                    }
                }
                targetData.gunQuat = gunQuat;

                let bodyQuat = mesh.getObjectByName("bodyContainer").quaternion.clone();
                if (data.vx !== undefined && data.vz !== undefined && (data.vx !== 0 || data.vz !== 0)) {
                    const movePos = new THREE.Vector3(data.x + data.vx, 1, data.z + data.vz);
                    const lookAtMatrix = new THREE.Matrix4();
                    lookAtMatrix.lookAt(targetPos, movePos, new THREE.Vector3(0, 1, 0));
                    bodyQuat.setFromRotationMatrix(lookAtMatrix);
                }
                targetData.bodyQuat = bodyQuat;
            } else {
                let targetQuat = mesh.quaternion.clone();
                const direction = new THREE.Vector3().subVectors(targetPos, mesh.position);
                direction.y = 0; // Keep horizontal

                if (direction.lengthSq() > 0.001) {
                    const lookAtMatrix = new THREE.Matrix4();
                    const futurePos = mesh.position.clone().add(direction);
                    lookAtMatrix.lookAt(mesh.position, futurePos, new THREE.Vector3(0, 1, 0));
                    targetQuat.setFromRotationMatrix(lookAtMatrix);
                }
                targetData.quaternion = targetQuat;
            }

            this.targets.set(id, targetData);
        };

        // Reset active status to cleanup disconnected players
        this.targets.forEach(t => t.active = false);

        Object.entries(snapshot.players).forEach(([id, p]) => processEntity(id, p, this.playerMeshes, createPlayerMesh, true));
        Object.entries(snapshot.zombies).forEach(([id, z]) => processEntity(id, z, this.zombieMeshes, createZombieMesh, false));

        // Cleanup stale meshes
        const cleanup = (meshes) => {
            Object.keys(meshes).forEach(id => {
                if (!this.targets.has(id)) {
                    this.scene.remove(meshes[id]);
                    delete meshes[id];
                }
            });
        };
        cleanup(this.playerMeshes);
        cleanup(this.zombieMeshes);
        
        // Remove inactive targets
        for (const [id, target] of this.targets.entries()) {
            if (!target.active) this.targets.delete(id);
        }
    }

    /**
     * Interpolates entities towards their target positions and rotations.
     * @param {number} dt Delta time in seconds
     */
    update(dt) {
        const LERP_SPEED = 10; // Speed of the catch-up

        this.targets.forEach((target, id) => {
            const isPlayer = target.isPlayer;
            const mesh = isPlayer ? this.playerMeshes[id] : this.zombieMeshes[id];
            if (!mesh) return;

            // Interpolate Position
            mesh.position.lerp(target.position, LERP_SPEED * dt);

            // Interpolate Rotation
            if (isPlayer) {
                if (target.gunQuat) {
                    mesh.getObjectByName("gunContainer").quaternion.slerp(target.gunQuat, LERP_SPEED * dt);
                }
                if (target.bodyQuat) {
                    mesh.getObjectByName("bodyContainer").quaternion.slerp(target.bodyQuat, LERP_SPEED * dt);
                }
            } else {
                if (target.quaternion) {
                    mesh.quaternion.slerp(target.quaternion, LERP_SPEED * dt);
                }
            }
        });

        // Elastic Camera Follow
        if (this.localPlayerId) {
            const localMesh = this.playerMeshes[this.localPlayerId];
            if (localMesh) {
                // Fixed overhead isometric-style offset
                const CAMERA_OFFSET = new THREE.Vector3(0, 35, 35);
                const targetCamPos = localMesh.position.clone().add(CAMERA_OFFSET);
                
                // Lerp the camera position directly to give that elastic floating effect
                const CAM_LERP_SPEED = 3.5; 
                this.camera.position.lerp(targetCamPos, CAM_LERP_SPEED * dt);
            }
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    getAimCoordinates(clientX, clientY) {
        const mouse = new THREE.Vector2();
        mouse.x = (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // Plane at the height of the gun barrel (y = 1.3) to fix isometric aiming parallax
        // Player ground is y=1, gun is +0.3 above ground
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.3); 
        const target = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, target)) {
            return target;
        }
        return null;
    }

    addTracer(startX, startZ, endX, endZ) {
        const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
        const points = [
            new THREE.Vector3(startX, 1.3, startZ),
            new THREE.Vector3(endX, 1.3, endZ)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        // Remove tracer after 100ms
        setTimeout(() => {
            this.scene.remove(line);
            geometry.dispose();
            material.dispose();
        }, 100);
    }
}