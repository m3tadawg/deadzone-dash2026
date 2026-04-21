# World Content Pipeline

The world catalog is now file-based so you can add content without changing generation code.

## Folder layout

- `server/data/world/settings.json`
  - Global world settings (`chunkSize`, `gridSize`, default biome)
  - Biome prefab pools and density ranges
- `server/data/world/biomes/*.json`
  - One biome per file
- `server/data/world/prefabs/*.json`
  - One prefab per file
- `server/data/world/regions/*.json`
  - Optional area templates that get instantiated from biome + prefab triggers

## Add a new biome

1. Create `server/data/world/biomes/<biome-id>.json` with:
   - `id`, `groundColor`, `fogColor`, `speedMultiplier`, `probability`, `guaranteedCount`
2. Add `<biome-id>` entries in `settings.json`:
   - `biomePrefabPools`
   - `biomePrefabDensity`

## Add a new world item (prefab)

1. Create `server/data/world/prefabs/<prefab-id>.json`.
2. Add the prefab id to one or more biome pools in `settings.json`.
3. Add a renderer case in `client/render/World.js` if the item needs a custom mesh.

## Add a high-risk/high-loot region

1. Create `server/data/world/regions/<region-id>.json` with:
   - `sourceBiomes`, `triggerPrefabs`, `radius`, `spawnMultiplier`, `lootMultiplier`
2. `WorldSystem` will create chunk `areas` automatically when matching prefabs are placed.
3. Systems (spawner, loot, events) can consume area metadata via `WorldSystem.getAreaAt(x, z)`.
