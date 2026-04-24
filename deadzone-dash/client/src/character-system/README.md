# Character System v4 — DeadZone Dash

## Overview
Low-poly mutation-based character creator that matches the C4D paper-faceted silhouette.
Designed for multiplayer: only plain JSON config ever goes over the network.

## Files

| File | Purpose |
|------|---------|
| `CharacterParts.js` | Geometry + material factories (all cached — zero runtime allocations) |
| `Character.js` | Main class with clean mutation API |
| `index.html` | Full standalone Character Creator UI |
| `preview.js` | Three.js scene + all UI event wiring (imports OrbitControls from CDN) |

## Running the Previewer

Start the game server first:

```
npm start
```

Then open: **http://localhost:3000/src/character-system/index.html**

> ⚠️ Must be served — ES modules don't work from `file://` paths due to CORS.

## Character API

```js
import { Character } from './client/src/character-system/Character.js';

const char = new Character();
scene.add(char.group);

// Mutation — no rebuilds:
char.setHat('beanie');
char.setHair('long');
char.setBeard('full');
char.setScar(true);
char.setBackpack('tactical');
char.setShoulders('pads');
char.setSkin('#B5713E');
char.setShirt('#334E38');
char.setHairColour('#3B1F07');
char.setHeadScale(1.05);
char.setBodyWidth(1.15);

char.randomize();             // NPC generation

const json = char.getConfig();   // → plain JSON for network sync
char.applyConfig(json);          // → restore from saved config
```

## Weapon attach point

```js
// Plug your weapon rotation into the pre-built pivot:
char.attach.weaponPivot.rotation.y = aimAngle;
gunContainer.parent = char.attach.weaponPivot; // or just add to it
```

## Available Options

| Property | Values |
|----------|--------|
| hat | none, beanie, cap, helmet, hood |
| hair | none, short, long, mohawk, bun |
| beard | none, stubble, full, moustache |
| backpack | none, small, tactical, duffel |
| shoulders | none, pads, scraps |
| scar | true / false |

## Server Integration

Server only ever sends/receives config JSON:

```json
{
  "skin": "#D4956A",
  "shirt": "#334E38",
  "trousers": "#2A3020",
  "hairColour": "#1A0A00",
  "hatColour": "#222222",
  "hat": "cap",
  "hair": "short",
  "beard": "stubble",
  "scar": false,
  "backpack": "small",
  "shoulders": "none",
  "headScale": 0.98,
  "bodyWidth": 0.95
}
```

Never send meshes over the network.
