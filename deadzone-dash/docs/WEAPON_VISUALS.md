# Weapon Visual + Muzzle Offset Tuning

This project now supports **data-driven weapon visuals** on the client and **data-driven muzzle origins** on the server.

## Files

- Gameplay muzzle origins: `server/data/weapons.json`
- Visual weapon assets: `client/data/weapon_visuals.json`

## How origin is computed

The server calculates shot origin using:

- `muzzleOffset.forward` (distance from player center toward aim direction)
- `muzzleOffset.right` (distance from player center toward player-right)

Because this lives in weapon JSON, each weapon can have different origin alignment without hardcoding values in combat logic.

## How to tune per weapon

1. Edit `client/data/weapon_visuals.json` to change the weapon model shape.
2. Edit the same weapon's `muzzleOffset` in `server/data/weapons.json`.
3. Reload and test shots while aiming in all directions.
4. Iterate values until tracers visually leave the weapon barrel/edge.

## Weapon visual schema

Each weapon entry supports:

- `muzzleLocal`: local pivot hint for future effects (muzzle flash/projectile spawn)
- `mountOffset` (optional): local `[x, y, z]` offset from the chest pivot (use larger forward values for full orbit-style spacing)
- `parts`: list of primitive meshes
  - `type`: `box` or `cylinder`
  - geometry fields:
    - `box`: `size: [x, y, z]`
    - `cylinder`: `radiusTop`, `radiusBottom`, `height`, optional `radialSegments`
  - transform fields:
    - `position: [x, y, z]`
    - optional `rotation: [x, y, z]` in radians
  - `color`: hex string

This keeps asset generation modular and editable via JSON instead of hard-coded mesh code.


## Chest-centered weapon pivot

Player weapon rotation now pivots from a shared chest anchor (`gunContainer`) and each weapon can apply a small `mountOffset` so aiming remains equidistant around the player body regardless of direction.
