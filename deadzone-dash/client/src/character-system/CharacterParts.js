/**
 * CharacterParts.js
 * Low-poly geometry + material factories for DeadZone Dash characters.
 * Matches the C4D "faceted dodecahedron head + chamfered box body" silhouette.
 * All geometries are shared/cached — never recreated at runtime.
 */

import * as THREE from "three";

// ─── Geometry Cache ──────────────────────────────────────────────────────────
const _geoCache = new Map();

function geo(key, factory) {
  if (!_geoCache.has(key)) _geoCache.set(key, factory());
  return _geoCache.get(key);
}

// ─── Material Cache (flat-shaded, per colour) ─────────────────────────────────
const _matCache = new Map();

export function getMat(hex, opts = {}) {
  const key = hex + JSON.stringify(opts);
  if (!_matCache.has(key)) {
    _matCache.set(key, new THREE.MeshStandardMaterial({
      color: hex,
      flatShading: true,
      roughness: opts.roughness ?? 0.85,
      metalness: opts.metalness ?? 0.05,
      ...opts
    }));
  }
  return _matCache.get(key);
}

// ─── Skin Tones Palette ───────────────────────────────────────────────────────
export const SKIN_TONES = [
  "#FDDBB4", // Fair
  "#F2C68B", // Light
  "#D4956A", // Medium
  "#B5713E", // Tan
  "#8B4513", // Dark
  "#4A2C0A", // Deep
];

// ─── Curated Shirt Palettes (apocalypse survivor) ─────────────────────────────
export const SHIRT_COLOURS = [
  "#6B3A2A", // Rust
  "#4A5C3E", // Olive drab
  "#2D3B4A", // Slate
  "#8B6914", // Dirty gold
  "#3D2B1F", // Dark brown
  "#5A4035", // Worn leather
  "#7C4E3A", // Terracotta
  "#334E38", // Forest
];

export const HAIR_COLOURS = [
  "#1A0A00", // Black
  "#3B1F07", // Dark brown
  "#7B4412", // Chestnut
  "#B8732A", // Auburn
  "#C8A44A", // Dirty blonde
  "#888888", // Grey
  "#E8E0D0", // White/Old
];

// ─── HEAD ─────────────────────────────────────────────────────────────────────
// Uses a low-segment sphere that's been scaled non-uniformly to look like the
// C4D model: slightly wide, slightly flat — feels like a paper faceted form.
export function makeHead(skinHex) {
  const g = geo("head", () => {
    // OctahedronGeometry subdivided twice gives nice low-poly facets
    const g = new THREE.OctahedronGeometry(0.55, 2);
    // Squash Y slightly so it feels like the C4D reference
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) * 0.88);
      pos.setX(i, pos.getX(i) * 1.05);
    }
    g.computeVertexNormals();
    return g;
  });
  return new THREE.Mesh(g, getMat(skinHex).clone());
}

// ─── BODY (chamfered box look matching C4D sample) ───────────────────────────
export function makeBody(shirtHex) {
  const g = geo("body", () => new THREE.BoxGeometry(1.0, 1.2, 0.65, 1, 1, 1));
  return new THREE.Mesh(g, getMat(shirtHex).clone());
}

// ─── NECK ─────────────────────────────────────────────────────────────────────
export function makeNeck(skinHex) {
  const g = geo("neck", () => new THREE.CylinderGeometry(0.18, 0.22, 0.22, 6));
  return new THREE.Mesh(g, getMat(skinHex).clone());
}

// ─── FACE DETAILS ─────────────────────────────────────────────────────────────
export function makeEyes() {
  const root = new THREE.Object3D();
  const eyeGeo = geo("eye", () => new THREE.BoxGeometry(0.11, 0.11, 0.05));
  const eyeMat = getMat("#111111");

  const left = new THREE.Mesh(eyeGeo, eyeMat);
  left.position.set(-0.15, 0.08, 0.52);

  const right = new THREE.Mesh(eyeGeo, eyeMat);
  right.position.set(0.15, 0.08, 0.52);

  root.add(left, right);
  return root;
}

export function makeScar() {
  const root = new THREE.Object3D();
  const g = geo("scar", () => new THREE.BoxGeometry(0.18, 0.04, 0.04));
  const m = getMat("#8B2222");

  const h = new THREE.Mesh(g, m);
  h.position.set(0.12, -0.04, 0.54);
  h.rotation.z = 0.5;

  const v = new THREE.Mesh(geo("scarV", () => new THREE.BoxGeometry(0.04, 0.18, 0.04)), m);
  v.position.set(0.12, -0.04, 0.54);
  v.rotation.z = -0.5;

  root.add(h, v);
  return root;
}

export function makeBrows(hairHex) {
  const root = new THREE.Object3D();
  const g = geo("brow", () => new THREE.BoxGeometry(0.16, 0.05, 0.04));
  const m = getMat(hairHex);

  const left = new THREE.Mesh(g, m);
  left.position.set(-0.15, 0.22, 0.52);
  left.rotation.z = 0.12;

  const right = new THREE.Mesh(g, m);
  right.position.set(0.15, 0.22, 0.52);
  right.rotation.z = -0.12;

  root.add(left, right);
  return root;
}

// ─── BEARD variants ───────────────────────────────────────────────────────────
export const BEARD_TYPES = {
  none: null,
  stubble: (hairHex) => {
    const m = new THREE.Mesh(
      geo("stubble", () => new THREE.BoxGeometry(0.55, 0.2, 0.3)),
      getMat(hairHex, { roughness: 0.95 }).clone()
    );
    m.position.set(0, -0.2, 0.35);
    return m;
  },
  full: (hairHex) => {
    const root = new THREE.Object3D();
    const main = new THREE.Mesh(
      geo("beardMain", () => new THREE.BoxGeometry(0.6, 0.35, 0.32)),
      getMat(hairHex).clone()
    );
    main.position.set(0, -0.22, 0.34);

    const chin = new THREE.Mesh(
      geo("beardChin", () => new THREE.CylinderGeometry(0.12, 0.08, 0.3, 5)),
      getMat(hairHex).clone()
    );
    chin.position.set(0, -0.42, 0.28);
    root.add(main, chin);
    return root;
  },
  moustache: (hairHex) => {
    const m = new THREE.Mesh(
      geo("moustache", () => new THREE.BoxGeometry(0.38, 0.1, 0.18)),
      getMat(hairHex).clone()
    );
    m.position.set(0, -0.06, 0.48);
    return m;
  },
};

// ─── HAIR variants ────────────────────────────────────────────────────────────
export const HAIR_TYPES = {
  none: null,
  short: (hairHex) => {
    const m = new THREE.Mesh(
      geo("hairShort", () => {
        const g = new THREE.OctahedronGeometry(0.58, 1);
        // Keep only the upper hemisphere by clipping Y positions
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          if (pos.getY(i) < -0.05) pos.setY(i, -0.05);
        }
        g.computeVertexNormals();
        return g;
      }),
      getMat(hairHex, { roughness: 0.9 }).clone()
    );
    m.position.set(0, 0.1, -0.02);
    return m;
  },
  long: (hairHex) => {
    const root = new THREE.Object3D();

    // Top cap
    const cap = new THREE.Mesh(
      geo("hairLongCap", () => new THREE.OctahedronGeometry(0.6, 1)),
      getMat(hairHex).clone()
    );
    cap.position.set(0, 0.05, 0);

    // Back flow
    const flow = new THREE.Mesh(
      geo("hairFlow", () => new THREE.CylinderGeometry(0.35, 0.2, 0.9, 6)),
      getMat(hairHex).clone()
    );
    flow.position.set(0, -0.28, -0.22);

    // Side strands
    const strandL = new THREE.Mesh(
      geo("hairStrand", () => new THREE.CylinderGeometry(0.14, 0.08, 0.6, 5)),
      getMat(hairHex).clone()
    );
    strandL.position.set(-0.42, -0.1, -0.05);
    strandL.rotation.z = 0.3;

    const strandR = strandL.clone();
    strandR.position.x = 0.42;
    strandR.rotation.z = -0.3;

    root.add(cap, flow, strandL, strandR);
    return root;
  },
  mohawk: (hairHex) => {
    const root = new THREE.Object3D();
    const strip = new THREE.Mesh(
      geo("mohawk", () => new THREE.BoxGeometry(0.18, 0.5, 0.85)),
      getMat(hairHex).clone()
    );
    strip.position.set(0, 0.55, -0.02);
    root.add(strip);
    return root;
  },
  bun: (hairHex) => {
    const root = new THREE.Object3D();
    const base = new THREE.Mesh(
      geo("bunBase", () => new THREE.OctahedronGeometry(0.56, 1)),
      getMat(hairHex).clone()
    );
    const knot = new THREE.Mesh(
      geo("bunKnot", () => new THREE.SphereGeometry(0.18, 5, 4)),
      getMat(hairHex).clone()
    );
    knot.position.set(0, 0.62, -0.25);
    root.add(base, knot);
    return root;
  },
};

// ─── HAT variants ─────────────────────────────────────────────────────────────
export const HAT_TYPES = {
  none: null,
  beanie: (hatHex) => {
    const root = new THREE.Object3D();
    const dome = new THREE.Mesh(
      geo("beanieDome", () => new THREE.SphereGeometry(0.6, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.6)),
      getMat(hatHex).clone()
    );
    const brim = new THREE.Mesh(
      geo("beanieBrim", () => new THREE.CylinderGeometry(0.64, 0.64, 0.12, 8)),
      getMat(hatHex, { roughness: 0.9 }).clone()
    );
    brim.position.y = -0.06;
    root.add(dome, brim);
    return root;
  },
  cap: (hatHex) => {
    const root = new THREE.Object3D();
    const crown = new THREE.Mesh(
      geo("capCrown", () => new THREE.CylinderGeometry(0.5, 0.62, 0.42, 8)),
      getMat(hatHex).clone()
    );
    crown.position.y = 0.15;
    const brim = new THREE.Mesh(
      geo("capBrim", () => new THREE.BoxGeometry(1.1, 0.06, 0.65)),
      getMat(hatHex, { roughness: 0.7 }).clone()
    );
    brim.position.set(0, -0.08, -0.35);
    root.add(crown, brim);
    return root;
  },
  helmet: (hatHex) => {
    const root = new THREE.Object3D();
    const shell = new THREE.Mesh(
      geo("helmetShell", () => new THREE.SphereGeometry(0.63, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65)),
      getMat(hatHex, { roughness: 0.4, metalness: 0.6 }).clone()
    );
    const strap = new THREE.Mesh(
      geo("helmetStrap", () => new THREE.BoxGeometry(0.05, 0.25, 0.04)),
      getMat("#222222").clone()
    );
    strap.position.set(0.45, -0.2, 0.3);
    root.add(shell, strap);
    return root;
  },
  hood: (hatHex) => {
    const root = new THREE.Object3D();
    const body = new THREE.Mesh(
      geo("hoodBody", () => new THREE.SphereGeometry(0.68, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.75)),
      getMat(hatHex).clone()
    );
    const frame = new THREE.Mesh(
      geo("hoodFrame", () => new THREE.TorusGeometry(0.6, 0.06, 4, 8, Math.PI)),
      getMat(hatHex, { roughness: 0.9 }).clone()
    );
    frame.position.set(0, -0.08, 0.18);
    frame.rotation.x = -0.4;
    root.add(body, frame);
    return root;
  },
};

// ─── BACKPACK variants ────────────────────────────────────────────────────────
export const BACKPACK_TYPES = {
  none: null,
  small: (colHex = "#4A3728") => {
    const root = new THREE.Object3D();
    const main = new THREE.Mesh(
      geo("bpSmall", () => new THREE.BoxGeometry(0.55, 0.65, 0.28)),
      getMat(colHex).clone()
    );
    const pocket = new THREE.Mesh(
      geo("bpPocket", () => new THREE.BoxGeometry(0.38, 0.3, 0.12)),
      getMat(colHex, { roughness: 0.95 }).clone()
    );
    pocket.position.set(0, -0.12, -0.18);
    root.add(main, pocket);
    root.position.set(0, 0.2, -0.48);  // behind body
    return root;
  },
  tactical: (colHex = "#3D4A2A") => {
    const root = new THREE.Object3D();
    const main = new THREE.Mesh(
      geo("bpTac", () => new THREE.BoxGeometry(0.65, 0.9, 0.34)),
      getMat(colHex).clone()
    );
    const top = new THREE.Mesh(
      geo("bpTacTop", () => new THREE.BoxGeometry(0.55, 0.28, 0.2)),
      getMat(colHex, { roughness: 0.95 }).clone()
    );
    top.position.set(0, 0.6, -0.07);
    const strap = new THREE.Mesh(
      geo("bpStrap", () => new THREE.BoxGeometry(0.08, 0.8, 0.04)),
      getMat("#1A1A1A").clone()
    );
    strap.position.set(-0.28, 0, -0.18);
    const strap2 = strap.clone();
    strap2.position.x = 0.28;
    root.add(main, top, strap, strap2);
    root.position.set(0, 0.2, -0.5);   // behind body
    return root;
  },
  duffel: (colHex = "#5C4033") => {
    const root = new THREE.Object3D();
    const bag = new THREE.Mesh(
      geo("duffel", () => new THREE.CylinderGeometry(0.25, 0.25, 0.7, 7)),
      getMat(colHex).clone()
    );
    bag.rotation.z = Math.PI / 2;
    root.add(bag);
    root.position.set(0, 0, -0.44);    // behind body
    return root;
  },
};

// ─── SHOULDER GEAR (silhouette boosters) ──────────────────────────────────────
export const SHOULDER_TYPES = {
  none: null,
  pads: (colHex = "#3A3A3A") => {
    const root = new THREE.Object3D();
    const padGeo = geo("shoulderPad", () => new THREE.BoxGeometry(0.28, 0.2, 0.32));
    const mat = getMat(colHex, { roughness: 0.5, metalness: 0.4 });

    const left = new THREE.Mesh(padGeo, mat);
    left.position.set(-0.7, 0.6, 0);

    const right = new THREE.Mesh(padGeo, mat);
    right.position.set(0.7, 0.6, 0);

    root.add(left, right);
    return root;
  },
  scraps: (colHex = "#555544") => {
    const root = new THREE.Object3D();
    for (const side of [-1, 1]) {
      const scrap = new THREE.Mesh(
        geo("scrap", () => new THREE.BoxGeometry(0.22, 0.28, 0.16)),
        getMat(colHex, { roughness: 0.95 }).clone()
      );
      scrap.position.set(side * 0.68, 0.55, 0.05);
      scrap.rotation.z = side * 0.2;
      root.add(scrap);
    }
    return root;
  },
};
