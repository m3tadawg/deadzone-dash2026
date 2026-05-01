/**
 * preview.js  —  Character Creator standalone previewer
 *
 * Uses Three.js via CDN (matches the rest of the project's import style).
 * Wires ALL UI controls → Character API.
 * OrbitControls for the viewport.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { Character } from './Character.js';
import {
  SKIN_TONES, SHIRT_COLOURS, HAIR_COLOURS,
} from './CharacterParts.js';

// ─── Scene Setup ─────────────────────────────────────────────────────────────
const container = document.getElementById('viewport');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0b);
scene.fog = new THREE.Fog(0x0b0b0b, 14, 24);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
camera.position.set(0, 1.4, 5.0);

// ─── Controls ────────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.4, 0);
controls.minDistance = 1.2;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI * 1.0; // Allow looking from below now that floor is gone
controls.update();

// ─── Lights ──────────────────────────────────────────────────────────────────
// Key light (warm)
const key = new THREE.DirectionalLight(0xffe4c8, 2.2);
key.position.set(4, 7, 4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 20;
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 4;
key.shadow.camera.bottom = -4;
scene.add(key);

// Fill light (cool blue — apocalyptic rim)
const fill = new THREE.DirectionalLight(0x8ab4d4, 0.7);
fill.position.set(-5, 3, -3);
scene.add(fill);

// Ground bounce (very subtle warm)
const bounce = new THREE.HemisphereLight(0x664422, 0x111111, 0.5);
scene.add(bounce);

// Rim (back)
const rim = new THREE.DirectionalLight(0xff4400, 0.35);
rim.position.set(0, 2, -5);
scene.add(rim);

// ─── Environment ─────────────────────────────────────────────────────────────
// (No ground or grid — floating character in the void)

// ─── Character ───────────────────────────────────────────────────────────────
const char = new Character();
char.group.position.y = -0.4; // Center the torso roughly at world 0
scene.add(char.group);

// Enable shadows on all character meshes
char.group.traverse(obj => {
  if (obj.isMesh) {
    obj.castShadow = true;
    obj.receiveShadow = false;
  }
});

// ─── Gentle auto-rotate until user interacts ──────────────────────────────────
let autoRotate = true;
controls.addEventListener('start', () => { autoRotate = false; });

// ─── Resize handler ──────────────────────────────────────────────────────────
function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// ─── Render loop ─────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  if (autoRotate) char.group.rotation.y += 0.004;
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ═══════════════════════════════════════════════════════════════════════════════
// UI WIRING
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Palette data ─────────────────────────────────────────────────────────────
const TROUSER_COLS = ["#3D2B1F", "#2A3020", "#1A1A2A", "#3A3020", "#1C1C1C", "#4A3A28", "#2A2A38"];
const HAT_COLS     = ["#AA3333", "#445533", "#224488", "#222222", "#887722", "#553322", "#7a6030", "#55aa55"];
const SHIRT_EXTRA  = ["#7C4E3A", "#334E38", "#2D3B4A", "#8B6914", "#3D2B1F", "#5A4035", "#6B3A2A", "#4A5C3E", "#aa5500", "#445577"];

// ─── Helper: build swatch row ─────────────────────────────────────────────────
function buildSwatches(containerId, colours, onPick, initialActive) {
  const el = document.getElementById(containerId);
  colours.forEach((hex, i) => {
    const s = document.createElement('div');
    s.className = 'swatch' + (hex === initialActive || i === 0 && !initialActive ? ' active' : '');
    s.style.background = hex;
    s.title = hex;
    s.addEventListener('click', () => {
      el.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
      s.classList.add('active');
      onPick(hex);
    });
    el.appendChild(s);
  });
}

// ─── Helper: build chip row ───────────────────────────────────────────────────
function buildChips(containerId, options, onPick, activeVal) {
  const el = document.getElementById(containerId);
  options.forEach(opt => {
    const c = document.createElement('button');
    c.className = 'chip' + (opt === activeVal ? ' active' : '');
    c.textContent = opt === 'none' ? '—' : opt.charAt(0).toUpperCase() + opt.slice(1);
    c.dataset.val = opt;
    c.addEventListener('click', () => {
      el.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      onPick(opt);
    });
    el.appendChild(c);
  });
}

// ─── Helper: set active chip in a row ─────────────────────────────────────────
function setActiveChip(containerId, val) {
  document.getElementById(containerId).querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.val === val);
  });
}

function setActiveSwatch(containerId, hex) {
  document.getElementById(containerId).querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('active', s.title.toLowerCase() === hex.toLowerCase());
  });
}

// ─── Skin ─────────────────────────────────────────────────────────────────────
buildSwatches('skin-swatches', SKIN_TONES, hex => char.setSkin(hex), char._config.skin);

// ─── Hair colour ──────────────────────────────────────────────────────────────
buildSwatches('hair-col-swatches', HAIR_COLOURS, hex => char.setHairColour(hex), char._config.hairColour);

// ─── Hair style ───────────────────────────────────────────────────────────────
buildChips('hair-chips', ['none','short','long','mohawk','bun'], val => char.setHair(val), char._config.hair);

// ─── Beard ────────────────────────────────────────────────────────────────────
buildChips('beard-chips', ['none','stubble','full','moustache'], val => char.setBeard(val), char._config.beard);

// ─── Scar ─────────────────────────────────────────────────────────────────────
document.getElementById('toggle-scar').addEventListener('change', e => char.setScar(e.target.checked));

// ─── Shirt ────────────────────────────────────────────────────────────────────
buildSwatches('shirt-swatches', SHIRT_EXTRA, hex => char.setShirt(hex), char._config.shirt);

// ─── Trousers ─────────────────────────────────────────────────────────────────
buildSwatches('trouser-swatches', TROUSER_COLS, hex => char.setTrousers(hex), char._config.trousers);

// ─── Hat ──────────────────────────────────────────────────────────────────────
buildChips('hat-chips', ['none','beanie','cap','helmet','hood'], val => char.setHat(val), char._config.hat);
buildSwatches('hat-col-swatches', HAT_COLS, hex => char.setHatColour(hex), char._config.hatColour);

// ─── Backpack ─────────────────────────────────────────────────────────────────
buildChips('bp-chips', ['none','small','tactical','duffel'], val => char.setBackpack(val), char._config.backpack);

// ─── Shoulders ────────────────────────────────────────────────────────────────
buildChips('shoulder-chips', ['none'], val => char.setShoulders(val), char._config.shoulders);

// ─── Sliders ──────────────────────────────────────────────────────────────────
const slHead = document.getElementById('sl-head');
const slHeadVal = document.getElementById('sl-head-val');
slHead.addEventListener('input', () => {
  const v = parseFloat(slHead.value);
  slHeadVal.textContent = v.toFixed(2);
  char.setHeadScale(v);
});

const slBody = document.getElementById('sl-body');
const slBodyVal = document.getElementById('sl-body-val');
slBody.addEventListener('input', () => {
  const v = parseFloat(slBody.value);
  slBodyVal.textContent = v.toFixed(2);
  char.setBodyWidth(v);
});

// ─── Footer buttons ───────────────────────────────────────────────────────────
document.getElementById('btn-random').addEventListener('click', () => {
  char.randomize();
  syncUIToConfig(char._config);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  char.applyConfig({});
  syncUIToConfig(char._config);
});

document.getElementById('btn-export').addEventListener('click', () => {
  const json = JSON.stringify(char.getConfig(), null, 2);
  navigator.clipboard.writeText(json).then(() => {
    const btn = document.getElementById('btn-export');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
});

const configOut = document.getElementById('config-out');
document.getElementById('btn-json').addEventListener('click', () => {
  configOut.textContent = JSON.stringify(char.getConfig(), null, 2);
  configOut.classList.toggle('visible');
});

// ─── Presets ──────────────────────────────────────────────────────────────────
const PRESETS = {
  scout: {
    skin: "#D4956A", shirt: "#334E38", trousers: "#2A3020",
    hairColour: "#1A0A00", hatColour: "#222222",
    hat: "cap", hair: "short", beard: "stubble", scar: false,
    backpack: "small", shoulders: "none", headScale: 0.98, bodyWidth: 0.95,
  },
  raider: {
    skin: "#B5713E", shirt: "#6B3A2A", trousers: "#1C1C1C",
    hairColour: "#3B1F07", hatColour: "#AA3333",
    hat: "beanie", hair: "none", beard: "full", scar: true,
    backpack: "tactical", shoulders: "none", headScale: 1.05, bodyWidth: 1.15,
  },
  survivor: {
    skin: "#FDDBB4", shirt: "#8B6914", trousers: "#3D2B1F",
    hairColour: "#B8732A", hatColour: "#553322",
    hat: "none", hair: "long", beard: "moustache", scar: true,
    backpack: "duffel", shoulders: "none", headScale: 1.0, bodyWidth: 1.0,
  },
  militia: {
    skin: "#8B4513", shirt: "#4A5C3E", trousers: "#2A3020",
    hairColour: "#888888", hatColour: "#3A3A3A",
    hat: "helmet", hair: "short", beard: "none", scar: false,
    backpack: "tactical", shoulders: "none", headScale: 0.95, bodyWidth: 1.2,
  },
  nomad: {
    skin: "#4A2C0A", shirt: "#7C4E3A", trousers: "#4A3A28",
    hairColour: "#E8E0D0", hatColour: "#7a6030",
    hat: "hood", hair: "long", beard: "full", scar: false,
    backpack: "duffel", shoulders: "none", headScale: 1.02, bodyWidth: 0.92,
  },
  shadow: {
    skin: "#4A2C0A", shirt: "#1C1C1C", trousers: "#1A1A2A",
    hairColour: "#1A0A00", hatColour: "#222222",
    hat: "hood", hair: "none", beard: "none", scar: true,
    backpack: "small", shoulders: "none", headScale: 0.92, bodyWidth: 1.05,
  },
};

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = PRESETS[btn.dataset.preset];
    if (preset) {
      char.applyConfig(preset);
      syncUIToConfig(char._config);
    }
  });
});

// ─── Sync UI to current config (after randomize / preset) ─────────────────────
function syncUIToConfig(cfg) {
  // Sliders
  slHead.value = cfg.headScale;
  slHeadVal.textContent = parseFloat(cfg.headScale).toFixed(2);
  slBody.value = cfg.bodyWidth;
  slBodyVal.textContent = parseFloat(cfg.bodyWidth).toFixed(2);

  // Toggle
  document.getElementById('toggle-scar').checked = cfg.scar;

  // Chips
  setActiveChip('hair-chips', cfg.hair);
  setActiveChip('beard-chips', cfg.beard);
  setActiveChip('hat-chips', cfg.hat);
  setActiveChip('bp-chips', cfg.backpack);
  setActiveChip('shoulder-chips', cfg.shoulders);

  // Swatches (best-effort — only marks exact matches)
  setActiveSwatch('skin-swatches', cfg.skin);
  setActiveSwatch('hair-col-swatches', cfg.hairColour);
  setActiveSwatch('shirt-swatches', cfg.shirt);
  setActiveSwatch('trouser-swatches', cfg.trousers);
  setActiveSwatch('hat-col-swatches', cfg.hatColour);

  // Refresh JSON if visible
  if (configOut.classList.contains('visible')) {
    configOut.textContent = JSON.stringify(cfg, null, 2);
  }
}
