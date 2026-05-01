import * as THREE from "three";

// Shared Geometries for optimization
const boxGeos = {
    torso: new THREE.BoxGeometry(1.0, 1.2, 0.6),
    visor: new THREE.BoxGeometry(0.7, 0.2, 0.15)
};

const materialCache = new Map();
const geometryCache = new Map();

function getMaterial(color = "#555555") {
    if (!materialCache.has(color)) {
        materialCache.set(color, new THREE.MeshStandardMaterial({
            color,
            roughness: 0.78,
            metalness: 0.03,
            flatShading: true
        }));
    }
    return materialCache.get(color);
}

function getEmissiveMaterial(color = "#ffffff", intensity = 0.7) {
    const key = `${color}:emissive:${intensity}`;
    if (!materialCache.has(key)) {
        materialCache.set(key, new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: intensity,
            roughness: 0.5,
            flatShading: true
        }));
    }
    return materialCache.get(key);
}

function getGeometry(key, factory) {
    if (!geometryCache.has(key)) geometryCache.set(key, factory());
    return geometryCache.get(key);
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

const PLAYER_VISUAL_DEFAULTS = {
    skinColor: "#d4956a",
    torsoColor: "#334e38",
    trousersColor: "#2b2f2b",
    hairColor: "#241206",
    gearColor: "#3b3329",
    accentColor: "#13d7ff",
    bodyWidth: 1,
    headScale: 1,
    hair: "short",
    facialHair: "stubble",
    backpack: "small"
};

function hexColor(value, fallback) {
    if (typeof value === "number") return `#${value.toString(16).padStart(6, "0")}`;
    return value || fallback;
}

function hashValue(value) {
    return Math.abs(String(value || "player").split("").reduce((acc, char) => {
        acc = ((acc << 5) - acc) + char.charCodeAt(0);
        return acc & acc;
    }, 0));
}

function pickVariant(list, hash, offset = 0) {
    return list[(hash + offset) % list.length];
}

function createPlayerVariation(playerData = {}) {
    const hash = hashValue(playerData.id);
    return {
        bodyWidth: pickVariant([0.9, 0.96, 1, 1.08, 1.15], hash, 1),
        headScale: pickVariant([0.92, 0.98, 1, 1.04, 1.08], hash, 2),
        hair: pickVariant(["short", "long", "bun", "mohawk", "none"], hash, 3),
        facialHair: pickVariant(["none", "none", "stubble", "beard"], hash, 4),
        backpack: pickVariant(["none", "small", "large"], hash, 6)
    };
}

function createPlayerHead(root, cfg) {
    const headGroup = new THREE.Object3D();
    headGroup.name = "headGroup";
    headGroup.position.y = 1.54;
    headGroup.scale.setScalar(cfg.headScale || 1);

    meshSphere(headGroup, "head", [0.33, 0.39, 0.32], [0, 0, -0.02], cfg.skinColor);
    meshBox(headGroup, "nose", [0.08, 0.11, 0.08], [0, -0.02, -0.34], cfg.skinColor, [0.1, 0, 0]);
    meshBox(headGroup, "leftEye", [0.08, 0.055, 0.04], [-0.12, 0.07, -0.35], "#101010");
    meshBox(headGroup, "rightEye", [0.08, 0.055, 0.04], [0.12, 0.07, -0.35], "#101010");
    meshBox(headGroup, "leftBrow", [0.13, 0.035, 0.04], [-0.12, 0.16, -0.35], cfg.hairColor, [0, 0, 0.12]);
    meshBox(headGroup, "rightBrow", [0.13, 0.035, 0.04], [0.12, 0.16, -0.35], cfg.hairColor, [0, 0, -0.12]);

    if (cfg.hair !== "none") {
        meshSphere(headGroup, "hairCap", [0.35, 0.19, 0.33], [0, 0.22, -0.01], cfg.hairColor);
    }
    if (cfg.hair === "long" || cfg.hair === "bun") {
        meshSphere(headGroup, "backHair", [0.24, 0.38, 0.16], [0, -0.08, 0.24], cfg.hairColor);
    }
    if (cfg.hair === "mohawk") {
        meshBox(headGroup, "mohawk", [0.12, 0.42, 0.48], [0, 0.39, 0.02], cfg.hairColor, [0.1, 0, 0]);
    }
    if (cfg.hair === "bun") {
        meshSphere(headGroup, "hairBun", [0.16, 0.16, 0.16], [0, 0.14, 0.36], cfg.hairColor);
    }
    if (cfg.facialHair === "stubble") {
        meshBox(headGroup, "stubble", [0.28, 0.13, 0.04], [0, -0.18, -0.34], cfg.hairColor);
    } else if (cfg.facialHair === "beard") {
        meshBox(headGroup, "beard", [0.32, 0.24, 0.07], [0, -0.22, -0.32], cfg.hairColor, [0.08, 0, 0]);
    }

    root.add(headGroup);
    return headGroup;
}

function createPlayerGear(root, cfg) {
    meshBox(root, "chestRig", [0.64, 0.34, 0.08], [0, 0.86, -0.32], cfg.gearColor, [0.1, 0, 0]);
    meshBox(root, "strapLeft", [0.08, 0.78, 0.06], [-0.22, 0.91, -0.34], cfg.gearColor, [0, 0, -0.34]);
    meshBox(root, "strapRight", [0.08, 0.78, 0.06], [0.22, 0.91, -0.34], cfg.gearColor, [0, 0, 0.34]);
    meshBox(root, "accentPatch", [0.18, 0.12, 0.04], [0.23, 0.96, -0.38], cfg.accentColor);

    if (cfg.backpack !== "none") {
        const packHeight = cfg.backpack === "large" ? 0.88 : 0.62;
        meshBox(root, "backpack", [0.58, packHeight, 0.24], [0, 0.74, 0.36], cfg.gearColor);
        meshBox(root, "backpackPocket", [0.38, 0.22, 0.08], [0, 0.5, 0.52], cfg.gearColor);
    }
}

export function createPlayerMesh(playerData = {}) {
    const parent = new THREE.Object3D();
    const cfg = {
        ...PLAYER_VISUAL_DEFAULTS,
        ...createPlayerVariation(playerData),
        ...(playerData.character || playerData.visual || {})
    };

    const bodyContainer = new THREE.Object3D();
    bodyContainer.name = "bodyContainer";

    meshSphere(bodyContainer, "torso", [0.4 * cfg.bodyWidth, 0.62, 0.3], [0, 0.75, 0], cfg.torsoColor);
    meshBox(bodyContainer, "waist", [0.54 * cfg.bodyWidth, 0.18, 0.34], [0, 0.24, 0], cfg.trousersColor);
    meshBox(bodyContainer, "neck", [0.16, 0.18, 0.16], [0, 1.28, -0.02], cfg.skinColor);
    createPlayerHead(bodyContainer, cfg);
    createPlayerGear(bodyContainer, cfg);

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

    const torsoColor = hexColor(config.torsoColor || config.shirt, null);
    const skinColor = hexColor(config.skinColor || config.skin, null);
    const trousersColor = hexColor(config.trousersColor || config.trousers, null);
    const hairColor = hexColor(config.hairColor || config.hairColour, null);
    const gearColor = hexColor(config.gearColor || config.backpackColour, null);
    const accentColor = hexColor(config.accentColor, null);

    body.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        const nextColor =
            (torsoColor && node.name === "torso" && torsoColor)
            || (skinColor && ["head", "neck", "nose"].includes(node.name) && skinColor)
            || (trousersColor && node.name === "waist" && trousersColor)
            || (hairColor && ["hairCap", "backHair", "mohawk", "hairBun", "leftBrow", "rightBrow", "stubble", "beard"].includes(node.name) && hairColor)
            || (gearColor && ["chestRig", "strapLeft", "strapRight", "backpack", "backpackPocket"].includes(node.name) && gearColor)
            || (accentColor && node.name === "accentPatch" && accentColor);

        if (!nextColor) return;
        if (!node.userData.hasCustomMaterial) {
            node.material = node.material.clone();
            node.userData.hasCustomMaterial = true;
        }
        node.material.color.set(nextColor);
    });
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



const ZOMBIE_PALETTES = {
    default: { skin: "#b9a081", cloth: "#4f4c3e", dark: "#171714", wound: "#6b1612", glow: "#e8f0b0", metal: "#4a4d50", acid: "#9cff33" },
    shambler: { skin: "#b9a081", cloth: "#7a4f2e", dark: "#211712", wound: "#7c1712", glow: "#f2e8a0", metal: "#5b5148", acid: "#9fbf39" },
    runner: { skin: "#c69a82", cloth: "#34373a", dark: "#141316", wound: "#8c1f16", glow: "#f5e7b5", metal: "#4b4f55", acid: "#b4ff3c" },
    brute: { skin: "#877c75", cloth: "#2f3438", dark: "#151619", wound: "#7b1710", glow: "#d9efe8", metal: "#65676a", acid: "#9ecb39" },
    crawler: { skin: "#ad9b83", cloth: "#3b3329", dark: "#15120f", wound: "#6d1511", glow: "#eadf9b", metal: "#594a3d", acid: "#92d94c" },
    spitter: { skin: "#aebd74", cloth: "#415133", dark: "#151d12", wound: "#6d1714", glow: "#caff62", metal: "#536050", acid: "#b7ff22" },
    screamer: { skin: "#d5c4b9", cloth: "#333842", dark: "#161820", wound: "#7f1d18", glow: "#fff2c8", metal: "#56525c", acid: "#d9ff77" },
    plague_lord: { skin: "#7d8d55", cloth: "#2d351f", dark: "#10150d", wound: "#5d1410", glow: "#b9ff2d", metal: "#383f36", acid: "#93ff20" },
    colossus: { skin: "#5d5a55", cloth: "#272624", dark: "#0f0f0f", wound: "#671510", glow: "#d6ff55", metal: "#56595a", acid: "#a8d442" }
};

const ZOMBIE_SCALE = {
    default: 1,
    shambler: 1.12,
    runner: 0.92,
    brute: 1.28,
    crawler: 0.9,
    spitter: 1.02,
    screamer: 1.08,
    plague_lord: 1.42,
    colossus: 1.95
};

function meshBox(root, name, size, position, color, rotation = [0, 0, 0]) {
    const key = `box:${size.join(",")}`;
    const mesh = new THREE.Mesh(
        getGeometry(key, () => new THREE.BoxGeometry(size[0], size[1], size[2])),
        getMaterial(color)
    );
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    root.add(mesh);
    return mesh;
}

function meshSphere(root, name, scale, position, color, emissive = false) {
    const geometry = getGeometry("sphere:low:8:6", () => new THREE.SphereGeometry(1, 8, 6));
    const mesh = new THREE.Mesh(geometry, emissive ? getEmissiveMaterial(color, 0.9) : getMaterial(color));
    mesh.name = name;
    mesh.scale.set(...scale);
    mesh.position.set(...position);
    root.add(mesh);
    return mesh;
}

function meshCone(root, name, radius, height, position, color, rotation = [0, 0, 0]) {
    const key = `cone:${radius}:${height}`;
    const mesh = new THREE.Mesh(
        getGeometry(key, () => new THREE.ConeGeometry(radius, height, 5)),
        getMaterial(color)
    );
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    root.add(mesh);
    return mesh;
}

function addFace(root, palette, y = 1.42, options = {}) {
    const headScale = options.headScale || [0.34, 0.4, 0.34];
    meshSphere(root, "head", headScale, [0, y, -0.05], palette.skin);

    const eyeY = y + (options.eyeY || 0.05);
    const eyeX = options.eyeX || 0.13;
    const eyeZ = options.eyeZ || -0.34;
    meshSphere(root, "leftEye", [0.045, 0.045, 0.035], [-eyeX, eyeY, eyeZ], palette.glow, true);
    meshSphere(root, "rightEye", [0.045, 0.045, 0.035], [eyeX, eyeY, eyeZ], palette.glow, true);

    const jawSize = options.jawSize || [0.3, 0.12, 0.12];
    meshBox(root, "jaw", jawSize, [0, y - 0.22, -0.31], palette.dark, [0.16, 0, 0]);
    meshBox(root, "mouth", [jawSize[0] * 0.72, 0.04, 0.045], [0, y - 0.17, -0.39], "#050505");

    for (let i = -1; i <= 1; i += 1) {
        meshCone(root, "tooth", 0.018, 0.07, [i * 0.07, y - 0.12, -0.42], "#e8dcc2", [Math.PI / 2, 0, 0]);
    }
}

function addRags(root, palette, count = 4, y = 0.72, width = 0.72) {
    for (let i = 0; i < count; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * (0.18 + (i % 3) * 0.08);
        const z = -0.26 - (i % 2) * 0.03;
        meshBox(root, "rag", [0.18, 0.42, 0.05], [x, y - i * 0.035, z], palette.cloth, [0, 0, side * (0.2 + i * 0.05)]);
    }

    meshBox(root, "frontRag", [width, 0.2, 0.06], [0, y + 0.2, -0.3], palette.dark, [0.08, 0, 0]);
}

function addHairSpikes(root, palette, count = 7, y = 1.78, sweep = 0.3) {
    for (let i = 0; i < count; i += 1) {
        const t = count === 1 ? 0 : i / (count - 1);
        const x = (t - 0.5) * 0.42;
        const z = -0.05 + (t - 0.5) * sweep;
        meshCone(root, "hairSpike", 0.09, 0.34, [x, y + Math.sin(t * Math.PI) * 0.08, z], palette.dark, [0.55 + t * 0.45, 0, (t - 0.5) * -0.9]);
    }
}

function addShoulders(root, palette, width = 0.9, y = 1.05, armor = false) {
    meshBox(root, "leftShoulder", [0.32, 0.18, 0.42], [-width / 2, y, -0.02], armor ? palette.metal : palette.cloth, [0, 0, -0.25]);
    meshBox(root, "rightShoulder", [0.32, 0.18, 0.42], [width / 2, y, -0.02], armor ? palette.metal : palette.cloth, [0, 0, 0.25]);
}

function addWounds(root, palette, count = 5, yMin = 0.72, yMax = 1.55) {
    for (let i = 0; i < count; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        meshBox(root, "wound", [0.055, 0.14, 0.025], [side * (0.08 + i * 0.035), yMin + ((i * 0.17) % (yMax - yMin)), -0.39], palette.wound, [0, 0, side * 0.4]);
    }
}

function addArmorPlates(root, palette, rows = 3, width = 0.8, y = 1.06) {
    addShoulders(root, palette, width + 0.35, y + 0.18, true);
    for (let i = 0; i < rows; i += 1) {
        meshBox(root, "armorPlate", [width - i * 0.08, 0.14, 0.12], [0, y - i * 0.17, -0.36], palette.metal, [0.1, 0, 0]);
    }
}

function createShambler(root, palette) {
    meshSphere(root, "torso", [0.42, 0.64, 0.34], [0, 0.78, 0], palette.cloth);
    addShoulders(root, palette, 0.9, 1.1);
    addFace(root, palette, 1.45, { headScale: [0.32, 0.38, 0.32] });
    addRags(root, palette, 5, 0.75, 0.62);
    addHairSpikes(root, palette, 6, 1.82, 0.08);
    addWounds(root, palette, 7);
}

function createRunner(root, palette) {
    meshSphere(root, "torso", [0.32, 0.58, 0.26], [0, 0.78, 0.02], palette.cloth);
    root.rotation.x = -0.08;
    addShoulders(root, palette, 0.74, 1.08);
    addFace(root, palette, 1.38, { headScale: [0.28, 0.34, 0.28], jawSize: [0.28, 0.16, 0.12] });
    addHairSpikes(root, palette, 9, 1.72, 0.5);
    meshBox(root, "chestStrap", [0.12, 0.78, 0.06], [-0.12, 0.86, -0.29], palette.dark, [0, 0, -0.55]);
    addWounds(root, palette, 5, 0.75, 1.35);
}

function createBrute(root, palette) {
    meshSphere(root, "torso", [0.62, 0.78, 0.48], [0, 0.88, 0], palette.dark);
    addArmorPlates(root, palette, 4, 0.95, 1.18);
    addFace(root, palette, 1.62, { headScale: [0.38, 0.42, 0.36], eyeY: 0.02 });
    meshBox(root, "helmetBand", [0.78, 0.16, 0.18], [0, 1.72, -0.2], palette.metal);
    meshBox(root, "faceBar", [0.09, 0.58, 0.12], [0, 1.5, -0.42], palette.metal);
    for (let i = -2; i <= 2; i += 1) {
        meshCone(root, "shoulderSpike", 0.055, 0.18, [i * 0.24, 1.32, -0.23], palette.metal, [-Math.PI / 2, 0, 0]);
    }
    addWounds(root, palette, 8, 0.8, 1.65);
}

function createCrawler(root, palette) {
    meshBox(root, "sled", [1.1, 0.14, 1.15], [0, 0.28, 0.08], palette.metal, [0.08, 0, 0]);
    meshSphere(root, "hunchedBody", [0.46, 0.38, 0.62], [0, 0.64, -0.02], palette.cloth);
    addFace(root, palette, 0.98, { headScale: [0.33, 0.34, 0.33], jawSize: [0.32, 0.16, 0.13] });
    for (let i = -1; i <= 1; i += 2) {
        meshBox(root, "clawArm", [0.22, 0.12, 0.64], [i * 0.48, 0.42, -0.24], palette.skin, [0, i * 0.28, i * 0.25]);
        meshCone(root, "claw", 0.045, 0.18, [i * 0.56, 0.38, -0.58], palette.dark, [Math.PI / 2, 0, 0]);
    }
    addRags(root, palette, 4, 0.48, 0.54);
    addWounds(root, palette, 5, 0.5, 1.1);
}

function createSpitter(root, palette) {
    meshSphere(root, "torso", [0.42, 0.62, 0.36], [0, 0.78, 0], palette.cloth);
    addShoulders(root, palette, 0.82, 1.08);
    addFace(root, palette, 1.42, { headScale: [0.34, 0.4, 0.34], jawSize: [0.34, 0.18, 0.16] });
    meshSphere(root, "acidThroat", [0.12, 0.18, 0.08], [0, 1.23, -0.36], palette.acid, true);
    meshCone(root, "acidSpray", 0.035, 0.42, [0, 1.15, -0.55], palette.acid, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 7; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        meshSphere(root, "acidPustule", [0.055, 0.055, 0.055], [side * (0.16 + i * 0.025), 0.85 + i * 0.09, -0.29], palette.acid, true);
    }
    addRags(root, palette, 5, 0.72, 0.66);
}

function createScreamer(root, palette) {
    meshSphere(root, "torso", [0.38, 0.72, 0.32], [0, 0.86, 0], palette.cloth);
    addShoulders(root, palette, 0.86, 1.16);
    addFace(root, palette, 1.62, { headScale: [0.32, 0.5, 0.32], jawSize: [0.34, 0.34, 0.16], eyeY: 0.13 });
    meshBox(root, "openMouth", [0.21, 0.33, 0.055], [0, 1.42, -0.45], "#020202");
    meshBox(root, "coatCollarLeft", [0.24, 0.62, 0.08], [-0.28, 1.05, -0.28], palette.dark, [0, 0, -0.45]);
    meshBox(root, "coatCollarRight", [0.24, 0.62, 0.08], [0.28, 1.05, -0.28], palette.dark, [0, 0, 0.45]);
    addWounds(root, palette, 6, 0.9, 1.7);
}

function createPlagueLord(root, palette) {
    meshSphere(root, "cloak", [0.72, 0.92, 0.62], [0, 0.94, 0.05], palette.cloth);
    meshSphere(root, "hood", [0.48, 0.5, 0.42], [0, 1.58, -0.02], palette.dark);
    addFace(root, palette, 1.52, { headScale: [0.28, 0.32, 0.26], eyeX: 0.12, eyeZ: -0.38 });
    meshSphere(root, "leftGoggle", [0.09, 0.09, 0.04], [-0.13, 1.58, -0.43], palette.glow, true);
    meshSphere(root, "rightGoggle", [0.09, 0.09, 0.04], [0.13, 1.58, -0.43], palette.glow, true);
    meshBox(root, "mask", [0.3, 0.22, 0.1], [0, 1.42, -0.43], palette.metal);
    for (let i = 0; i < 10; i += 1) {
        const angle = i * 0.63;
        meshSphere(root, "plagueBubble", [0.055, 0.055, 0.055], [Math.cos(angle) * 0.42, 0.72 + (i % 5) * 0.19, -0.28 + Math.sin(angle) * 0.08], palette.acid, true);
    }
    meshBox(root, "amulet", [0.16, 0.18, 0.06], [0, 1.03, -0.47], palette.metal);
}

function createColossus(root, palette) {
    meshSphere(root, "torso", [0.86, 1.05, 0.68], [0, 1.05, 0], palette.dark);
    addArmorPlates(root, palette, 5, 1.35, 1.42);
    addFace(root, palette, 2.02, { headScale: [0.44, 0.46, 0.42], jawSize: [0.48, 0.2, 0.16] });
    addShoulders(root, palette, 1.7, 1.62, true);
    meshBox(root, "chestEmblem", [0.48, 0.32, 0.09], [0, 1.36, -0.58], palette.wound, [0.1, 0, 0]);
    for (let i = -3; i <= 3; i += 1) {
        meshCone(root, "backSpike", 0.08, 0.28, [i * 0.22, 1.72 - Math.abs(i) * 0.06, 0.02], palette.metal, [Math.PI * 0.65, 0, 0]);
    }
    addWounds(root, palette, 10, 0.9, 2.05);
}

export function createZombieMesh(type = "default", zombieVisualCatalog = null) {
    const root = new THREE.Object3D();
    const palette = ZOMBIE_PALETTES[type] || ZOMBIE_PALETTES.default;

    switch (type) {
        case "runner":
            createRunner(root, palette);
            break;
        case "brute":
            createBrute(root, palette);
            break;
        case "crawler":
            createCrawler(root, palette);
            break;
        case "spitter":
            createSpitter(root, palette);
            break;
        case "screamer":
            createScreamer(root, palette);
            break;
        case "plague_lord":
            createPlagueLord(root, palette);
            break;
        case "colossus":
            createColossus(root, palette);
            break;
        case "shambler":
        default:
            createShambler(root, palette);
            break;
    }

    const visualScale = zombieVisualCatalog?.[type]?.scale || ZOMBIE_SCALE[type] || 1;
    const wrapper = new THREE.Object3D();
    root.position.y = -0.95 / visualScale;
    wrapper.scale.setScalar(visualScale);
    wrapper.add(root);
    wrapper.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = false;
            node.receiveShadow = false;
        }
    });

    return wrapper;
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
