import * as THREE from "three";
import { createCamera } from "./Camera.js";
import { createWorld } from "./World.js";
import { createPlayerMesh, createZombieMesh, createProjectileMesh, applyPlayerCustomization, applyWeaponVisual } from "./Entities.js";

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

        const gameCanvas = document.getElementById("game");
        this.renderer = new THREE.WebGLRenderer({
            canvas: gameCanvas || undefined,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        if (!gameCanvas) {
            document.body.appendChild(this.renderer.domElement);
        }

        // Lighting
        const hemiLight = new THREE.HemisphereLight(0x443333, 0x222222, 0.6);
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(40, 80, 40);
        dirLight.castShadow = true;
        
        // Shadow config
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -100;
        dirLight.shadow.camera.right = 100;
        dirLight.shadow.camera.top = 100;
        dirLight.shadow.camera.bottom = -100;
        dirLight.shadow.bias = -0.0005;
        this.scene.add(dirLight);

        // World
        createWorld(this.scene);

        // Entity storage
        this.playerMeshes = {};
        this.zombieMeshes = {};
        this.projectileMeshes = {};
        
        // Target data for interpolation
        this.targets = new Map();
        this.localPlayerId = null;
        this.weaponVisualCatalog = null;
        this.zombieVisualCatalog = null;
        this.projectileVisualCatalog = null;
        this.weaponsCatalog = null;
        this.weaponVisualsLoaded = this.loadWeaponVisuals();
        this.zombieVisualsLoaded = this.loadZombieVisuals();
        this.projectileVisualsLoaded = this.loadProjectileVisuals();
        this.weaponsLoaded = this.loadWeapons();
        this.damageZoneMeshes = {};
        this.throwPreview = this.createThrowPreview();

        window.addEventListener("resize", () => this.handleResize());
    }

    async loadWeaponVisuals() {
        try {
            const response = await fetch("./data/weapon_visuals.json");
            if (!response.ok) throw new Error(`Failed to load weapon visuals (${response.status})`);
            this.weaponVisualCatalog = await response.json();
        } catch (err) {
            console.warn("Unable to load weapon visual catalog, using fallback visuals.", err);
            this.weaponVisualCatalog = {
                default: {
                    muzzleLocal: { x: 0, y: 0, z: -0.75 },
                    parts: [
                        { type: "box", size: [0.24, 0.2, 1.4], position: [0, 0, -0.7], color: "#3f3f3f" },
                        { type: "box", size: [0.22, 0.25, 0.35], position: [0, -0.2, -0.15], color: "#2c2c2c" }
                    ]
                }
            };
        }
    }


    async loadZombieVisuals() {
        try {
            const response = await fetch("./data/zombie_visuals.json");
            if (!response.ok) throw new Error(`Failed to load zombie visuals (${response.status})`);
            this.zombieVisualCatalog = await response.json();
        } catch (err) {
            console.warn("Unable to load zombie visual catalog, using fallback visuals.", err);
            this.zombieVisualCatalog = { default: { base: { shape: "capsule", radius: 0.5, height: 1.5, color: "#ff4444" } } };
        }
    }


    async loadProjectileVisuals() {
        try {
            const response = await fetch("./data/projectile_visuals.json");
            if (!response.ok) throw new Error(`Failed to load projectile visuals (${response.status})`);
            this.projectileVisualCatalog = await response.json();
        } catch (err) {
            console.warn("Unable to load projectile visual catalog, using fallback visuals.", err);
            this.projectileVisualCatalog = { default: { radius: 0.2, color: "#88ff88", emissive: "#1c7a1c" } };
        }
    }

    async loadWeapons() {
        try {
            const response = await fetch("./data/weapons.json");
            if (!response.ok) throw new Error(`Failed to load weapons (${response.status})`);
            const weaponList = await response.json();
            this.weaponsCatalog = Object.fromEntries(weaponList.map((weapon) => [weapon.id, weapon]));
        } catch (err) {
            console.warn("Unable to load weapon catalog for throw previews.", err);
            this.weaponsCatalog = {};
        }
    }

    createThrowPreview() {
        const group = new THREE.Group();
        group.visible = false;

        const rangeMat = new THREE.LineDashedMaterial({ color: 0xffc266, dashSize: 0.6, gapSize: 0.35 });
        const rangeGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 1.05, 0),
            new THREE.Vector3(0, 1.05, 0)
        ]);
        const rangeLine = new THREE.Line(rangeGeo, rangeMat);
        rangeLine.computeLineDistances();
        group.add(rangeLine);

        const areaGeo = new THREE.RingGeometry(0.95, 1, 48);
        const areaMat = new THREE.MeshBasicMaterial({ color: 0xff7a18, transparent: true, opacity: 0.32, side: THREE.DoubleSide });
        const areaRing = new THREE.Mesh(areaGeo, areaMat);
        areaRing.rotation.x = -Math.PI / 2;
        areaRing.position.y = 1.02;
        group.add(areaRing);

        group.userData.rangeLine = rangeLine;
        group.userData.areaRing = areaRing;
        this.scene.add(group);
        return group;
    }

    applyZombieCastCue(mesh, isCasting) {
        mesh.traverse((node) => {
            if (!node.material || !node.material.emissive) return;
            node.material.emissive.set(isCasting ? 0x50aa33 : 0x000000);
            node.material.emissiveIntensity = isCasting ? 0.6 : 0.0;
        });
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

    initWorld(mapData) {
        this.mapData = mapData;
        import("./World.js").then(module => {
            module.createWorld(this.scene, this.mapData);
        });
    }

    /**
     * Updates target positions and compute target rotations based on server snapshots.
     */
    sync(snapshot) {
        const processEntity = (id, data, category, createMeshFn, isPlayer) => {
            let mesh = category[id];
            if (!mesh) {
                mesh = createMeshFn(data);
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

            if (isPlayer && this.weaponVisualCatalog) {
                applyWeaponVisual(mesh, data.weapon, this.weaponVisualCatalog);
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
                this.applyZombieCastCue(mesh, (data.castCueRemainingMs || 0) > 0);

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
        Object.entries(snapshot.zombies).forEach(([id, z]) => processEntity(id, z, this.zombieMeshes, (zombieData) => createZombieMesh(zombieData.type, this.zombieVisualCatalog), false));

        const projectileMap = snapshot.projectiles || {};
        Object.entries(projectileMap).forEach(([id, proj]) => {
            let mesh = this.projectileMeshes[id];
            if (!mesh) {
                mesh = createProjectileMesh(proj.type, this.projectileVisualCatalog);
                this.projectileMeshes[id] = mesh;
                this.scene.add(mesh);
            }

            mesh.position.set(proj.x, 1.05, proj.z);
        });

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

        Object.keys(this.projectileMeshes).forEach(id => {
            if (!projectileMap[id]) {
                this.scene.remove(this.projectileMeshes[id]);
                delete this.projectileMeshes[id];
            }
        });

        const snapshotZones = snapshot.damageZones || [];
        const activeZoneIds = new Set(snapshotZones.map((zone) => zone.id));
        snapshotZones.forEach((zone) => {
            let zoneMesh = this.damageZoneMeshes[zone.id];
            if (!zoneMesh) {
                if (!this._sharedZoneGeo) {
                    this._sharedZoneGeo = new THREE.RingGeometry(0.96, 1, 48);
                }
                const ringMat = new THREE.MeshBasicMaterial({
                    color: zone.color || "#ff7a18",
                    transparent: true,
                    opacity: 0.35,
                    side: THREE.DoubleSide
                });
                zoneMesh = new THREE.Mesh(this._sharedZoneGeo, ringMat);
                zoneMesh.rotation.x = -Math.PI / 2;
                this.damageZoneMeshes[zone.id] = zoneMesh;
                this.scene.add(zoneMesh);
            }
            zoneMesh.scale.set(zone.radius, zone.radius, 1);
            zoneMesh.position.set(zone.x, 1.02, zone.z);
        });

        Object.keys(this.damageZoneMeshes).forEach((zoneId) => {
            if (activeZoneIds.has(zoneId)) return;
            this.scene.remove(this.damageZoneMeshes[zoneId]);
            this.damageZoneMeshes[zoneId].material.dispose();
            delete this.damageZoneMeshes[zoneId];
        });
        
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

        Object.values(this.projectileMeshes).forEach((mesh) => {
            mesh.rotation.y += dt * 8;
        });

        // Elastic Camera Follow & Biome Effects
        if (this.localPlayerId) {
            const localMesh = this.playerMeshes[this.localPlayerId];
            if (localMesh) {
                // Fixed overhead isometric-style offset
                const CAMERA_OFFSET = new THREE.Vector3(0, 35, 35);
                const targetCamPos = localMesh.position.clone().add(CAMERA_OFFSET);
                
                // Lerp the camera position directly to give that elastic floating effect
                const CAM_LERP_SPEED = 3.5; 
                this.camera.position.lerp(targetCamPos, CAM_LERP_SPEED * dt);

                // Biome Fog Update
                if (this.mapData) {
                    const cx = Math.floor(localMesh.position.x / this.mapData.chunkSize);
                    const cz = Math.floor(localMesh.position.z / this.mapData.chunkSize);
                    const chunk = this.mapData.grid[`${cx},${cz}`];
                    if (chunk) {
                        const biome = this.mapData.config.biomes[chunk.biome];
                        const targetColor = new THREE.Color(biome.fogColor);
                        if (this.scene.fog) {
                            this.scene.fog.color.lerp(targetColor, 0.05); // Smooth transition
                        }
                    }
                }
            }
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    getAimCoordinates(clientX, clientY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
        const target = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, target)) {
            return target;
        }
        return null;
    }

    getWeaponMuzzleWorldPosition(playerId) {
        if (!playerId) return null;

        const playerMesh = this.playerMeshes[playerId];
        if (!playerMesh) return null;

        const gunContainer = playerMesh.getObjectByName("gunContainer");
        const weaponModel = gunContainer?.getObjectByName("weaponModel");
        if (!weaponModel) return null;

        const muzzle = weaponModel.userData?.muzzleLocal || { x: 0, y: 0, z: -0.8 };
        return weaponModel.localToWorld(new THREE.Vector3(muzzle.x, muzzle.y, muzzle.z));
    }

    addTracer(startX, startZ, endX, endZ, shooterId = null) {
        const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
        const muzzleWorld = this.getWeaponMuzzleWorldPosition(shooterId);
        const startY = muzzleWorld?.y ?? 1.3;
        const startPoint = muzzleWorld || new THREE.Vector3(startX, startY, startZ);
        const points = [
            startPoint,
            new THREE.Vector3(endX, startY, endZ)
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

    updateThrowPreview(snapshot, localPlayerId, aimTarget) {
        if (!this.throwPreview) return;
        if (!snapshot || !aimTarget || !localPlayerId) {
            this.throwPreview.visible = false;
            return;
        }

        const localPlayer = snapshot.players?.[localPlayerId];
        const weapon = localPlayer ? this.weaponsCatalog?.[localPlayer.weapon] : null;
        if (!weapon || weapon.type !== "thrown") {
            this.throwPreview.visible = false;
            return;
        }

        const dx = aimTarget.x - localPlayer.x;
        const dz = aimTarget.z - localPlayer.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        if (length < 0.0001) {
            this.throwPreview.visible = false;
            return;
        }

        const maxRange = weapon.range || 10;
        const clampedDistance = Math.min(maxRange, length);
        const targetX = localPlayer.x + (dx / length) * clampedDistance;
        const targetZ = localPlayer.z + (dz / length) * clampedDistance;

        const zoneRadius = weapon.damageRadius || 4;
        const color = weapon.zoneStyle?.color || "#ff7a18";
        const rangeLine = this.throwPreview.userData.rangeLine;
        const areaRing = this.throwPreview.userData.areaRing;

        rangeLine.geometry.setFromPoints([
            new THREE.Vector3(localPlayer.x, 1.05, localPlayer.z),
            new THREE.Vector3(targetX, 1.05, targetZ)
        ]);
        rangeLine.computeLineDistances();
        areaRing.material.color.set(color);
        areaRing.scale.set(zoneRadius, zoneRadius, 1);
        areaRing.position.set(targetX, 1.02, targetZ);
        this.throwPreview.visible = true;
    }

    checkNearbySearchable(x, z, radius) {
        if (!this.mapData) return false;
        
        // Find the current chunk
        const cx = Math.floor(x / this.mapData.chunkSize);
        const cz = Math.floor(z / this.mapData.chunkSize);
        const chunk = this.mapData.grid[`${cx},${cz}`];
        if (!chunk) return false;

        const prefabDefs = this.mapData.config.prefabs;
        return chunk.prefabs.some(p => {
            const def = prefabDefs[p.type];
            if (def && def.searchable) {
                const dist = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(z - p.z, 2));
                return dist < radius;
            }
            return false;
        });
    }
}
