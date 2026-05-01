/**
 * Character.js  —  DeadZone Dash  |  Character System v4
 *
 * Mutation-based: meshes are built once, updated via property mutation.
 * NO geometry rebuilds at runtime.
 *
 * Public API:
 *   character.setHat('beanie' | 'cap' | 'helmet' | 'hood' | 'none')
 *   character.setHair('short' | 'long' | 'mohawk' | 'bun' | 'none')
 *   character.setBeard('none' | 'stubble' | 'full' | 'moustache')
 *   character.setBackpack('none' | 'small' | 'tactical' | 'duffel')
 *   character.setShoulders('none')
 *   character.setScar(true | false)
 *   character.setSkin(hexColour)
 *   character.setShirt(hexColour)
 *   character.setTrousers(hexColour)
 *   character.setHairColour(hexColour)
 *   character.setHatColour(hexColour)
 *   character.setBackpackColour(hexColour)
 *   character.setHeadScale(0.8–1.4)
 *   character.setBodyWidth(0.7–1.3)
 *   character.randomize()
 *   character.getConfig()          → plain JSON (safe to send over network)
 *   character.applyConfig(obj)     → restore from JSON
 */

import * as THREE from "three";
import {
  getMat,
  makeHead, makeBody, makeNeck,
  makeEyes, makeScar, makeBrows,
  SKIN_TONES, SHIRT_COLOURS, HAIR_COLOURS,
  BEARD_TYPES, HAIR_TYPES, HAT_TYPES, BACKPACK_TYPES, SHOULDER_TYPES,
} from "./CharacterParts.js";

// ─── Default config (matches the C4D silhouette reference) ────────────────────
const DEFAULT_CONFIG = {
  skin:           "#D4956A",
  shirt:          "#6B3A2A",
  trousers:       "#3D2B1F",
  hairColour:     "#3B1F07",
  hatColour:      "#AA3333",
  backpackColour: "#4A3728",
  headScale:      1.0,
  bodyWidth:      1.0,
  hat:            "none",
  hair:           "short",
  beard:          "full",
  scar:           false,
  backpack:       "none",
  shoulders:      "none",
};

// ─── Helper: clear all children from an Object3D ─────────────────────────────
function clearNode(node) {
  while (node.children.length) node.remove(node.children[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
export class Character {
  constructor(config = {}) {
    this.group = new THREE.Group();
    this._config = Object.assign({}, DEFAULT_CONFIG, config);

    // Store live mesh references for mutation
    this._meshes = {};

    // Attach point nodes (never removed from group)
    this._attach = {
      hatNode:      new THREE.Object3D(),   // above head
      hairNode:     new THREE.Object3D(),   // around head
      beardNode:    new THREE.Object3D(),   // front of head
      backpackNode: new THREE.Object3D(),   // behind body
      shoulderNode: new THREE.Object3D(),   // around body
      weaponPivot:  new THREE.Object3D(),   // weapon orbit point (chest height)
      scarNode:     new THREE.Object3D(),   // face details
    };

    this._build();
    this.applyConfig(this._config);
  }

  // ─── Build all base meshes (called once) ───────────────────────────────────
  _build() {
    const cfg = this._config;

    // Body
    this._meshes.body = makeBody(cfg.shirt);

    // Neck
    this._meshes.neck = makeNeck(cfg.skin);
    this._meshes.neck.position.y = 0.72;

    // Head group — everything head-related sits in here
    this._meshes.headGroup = new THREE.Object3D();
    this._meshes.headGroup.position.y = 1.05;

    this._meshes.head = makeHead(cfg.skin);
    this._meshes.eyes = makeEyes();
    this._meshes.brows = makeBrows(cfg.hairColour);

    this._meshes.headGroup.add(
      this._meshes.head,
      this._meshes.eyes,
      this._meshes.brows,
      this._attach.hatNode,
      this._attach.hairNode,
      this._attach.beardNode,
      this._attach.scarNode
    );

    // Position attach nodes relative to head
    this._attach.hatNode.position.y = 0.22;
    this._attach.hairNode.position.y = -0.05;
    this._attach.beardNode.position.y = -0.1;
    this._attach.scarNode.position.y = 0.0;

    // Weapon pivot at chest height
    this._attach.weaponPivot.position.set(0, 0.6, 0);

    // Add everything to group (draw order: body → neck → head → accessories)
    this.group.add(
      this._meshes.body,
      this._meshes.neck,
      this._meshes.headGroup,
      this._attach.backpackNode,
      this._attach.shoulderNode,
      this._attach.weaponPivot,
    );
  }

  // ─── SKIN ──────────────────────────────────────────────────────────────────
  setSkin(hex) {
    this._config.skin = hex;
    [this._meshes.head, this._meshes.neck].forEach(m => m.material.color.set(hex));
    return this;
  }

  // ─── SHIRT ─────────────────────────────────────────────────────────────────
  setShirt(hex) {
    this._config.shirt = hex;
    this._meshes.body.material.color.set(hex);
    return this;
  }

  // ─── TROUSERS ──────────────────────────────────────────────────────────────
  setTrousers(hex) {
    this._config.trousers = hex;
    // (Legs removed, but we keep the config for now if needed for future gear)
    return this;
  }

  // ─── HAIR COLOUR (updates brows, hair, beard shade — no headGroup rebuild) ──
  setHairColour(hex) {
    this._config.hairColour = hex;
    // Swap out brows mesh only (rest of headGroup children untouched)
    this._meshes.headGroup.remove(this._meshes.brows);
    this._meshes.brows = makeBrows(hex);
    this._meshes.headGroup.add(this._meshes.brows);
    // Refresh hair + beard with new colour
    this.setHair(this._config.hair);
    this.setBeard(this._config.beard);
    return this;
  }

  // ─── HEAD SCALE ────────────────────────────────────────────────────────────
  setHeadScale(s) {
    this._config.headScale = s;
    this._meshes.headGroup.scale.setScalar(s);
    return this;
  }

  // ─── BODY WIDTH ────────────────────────────────────────────────────────────
  setBodyWidth(w) {
    this._config.bodyWidth = w;
    this._meshes.body.scale.x = w;
    return this;
  }

  // ─── HAT ───────────────────────────────────────────────────────────────────
  setHat(type) {
    this._config.hat = type;
    clearNode(this._attach.hatNode);
    const factory = HAT_TYPES[type];
    if (factory) this._attach.hatNode.add(factory(this._config.hatColour));
    return this;
  }

  setHatColour(hex) {
    this._config.hatColour = hex;
    this.setHat(this._config.hat); // rebuild hat with new colour (hat geometry is tiny, ok to swap)
    return this;
  }

  // ─── HAIR ──────────────────────────────────────────────────────────────────
  setHair(type) {
    this._config.hair = type;
    clearNode(this._attach.hairNode);
    const factory = HAIR_TYPES[type];
    if (factory) this._attach.hairNode.add(factory(this._config.hairColour));
    return this;
  }

  // ─── BEARD ─────────────────────────────────────────────────────────────────
  setBeard(type) {
    this._config.beard = type;
    clearNode(this._attach.beardNode);
    const factory = BEARD_TYPES[type];
    if (factory) this._attach.beardNode.add(factory(this._config.hairColour));
    return this;
  }

  // ─── SCAR ──────────────────────────────────────────────────────────────────
  setScar(on) {
    this._config.scar = on;
    clearNode(this._attach.scarNode);
    if (on) this._attach.scarNode.add(makeScar());
    return this;
  }

  // ─── BACKPACK ──────────────────────────────────────────────────────────────
  setBackpack(type) {
    this._config.backpack = type;
    clearNode(this._attach.backpackNode);
    const factory = BACKPACK_TYPES[type];
    if (factory) this._attach.backpackNode.add(factory(this._config.backpackColour));
    return this;
  }

  setBackpackColour(hex) {
    this._config.backpackColour = hex;
    this.setBackpack(this._config.backpack);
    return this;
  }

  // ─── SHOULDER GEAR ─────────────────────────────────────────────────────────
  setShoulders(type) {
    this._config.shoulders = "none";
    clearNode(this._attach.shoulderNode);
    const factory = SHOULDER_TYPES.none;
    if (factory) this._attach.shoulderNode.add(factory());
    return this;
  }

  // ─── APPLY FULL CONFIG (e.g. loaded from server / saved preset) ────────────
  applyConfig(cfg = {}) {
    const c = Object.assign({}, DEFAULT_CONFIG, cfg);
    this._config = c;

    this.setSkin(c.skin);
    this.setShirt(c.shirt);
    this.setTrousers(c.trousers);
    // setHairColour also calls setHair + setBeard internally — do those after
    // so we don't double-apply. Set colour first, then override style:
    this._config.hairColour = c.hairColour;
    this._meshes.headGroup.remove(this._meshes.brows);
    this._meshes.brows = makeBrows(c.hairColour);
    this._meshes.headGroup.add(this._meshes.brows);
    this.setHat(c.hat);
    this.setHair(c.hair);
    this.setBeard(c.beard);
    this.setScar(c.scar);
    this.setBackpack(c.backpack);
    this.setShoulders(c.shoulders);
    this.setHeadScale(c.headScale);
    this.setBodyWidth(c.bodyWidth);
    return this;
  }

  // ─── GET CONFIG (network-safe plain JSON) ──────────────────────────────────
  getConfig() {
    return Object.assign({}, this._config);
  }

  // ─── RANDOMIZE ─────────────────────────────────────────────────────────────
  randomize() {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const rf = (min, max, dp = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(dp));

    const cfg = {
      skin:           pick(SKIN_TONES),
      shirt:          pick(SHIRT_COLOURS),
      trousers:       pick(["#3D2B1F", "#2A3020", "#1A1A2A", "#3A3020", "#1C1C1C"]),
      hairColour:     pick(HAIR_COLOURS),
      hatColour:      pick(["#AA3333", "#445533", "#224488", "#222222", "#887722", "#553322"]),
      backpackColour: pick(["#4A3728", "#3D4A2A", "#5C4033", "#3A3A3A", "#2A3530"]),
      headScale:      rf(0.88, 1.18),
      bodyWidth:      rf(0.85, 1.22),
      hat:            pick(["none", "none", "beanie", "beanie", "cap", "helmet", "hood"]),
      hair:           pick(["none", "short", "short", "long", "mohawk", "bun"]),
      beard:          pick(["none", "none", "stubble", "stubble", "full", "moustache"]),
      scar:           Math.random() > 0.65,
      backpack:       pick(["none", "none", "small", "tactical", "duffel"]),
      shoulders:      "none",
    };

    this.applyConfig(cfg);
    return this;
  }
}
