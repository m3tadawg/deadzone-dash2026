1. World Objects (Crates, Barrels, Searchable Items)
These are the physical containers spawned across the map.

Data File: server/data/world/settings.json
Look for the biomePrefabDensity section. It defines the min and max number of objects spawned per map chunk for each biome (e.g., "desert", "town").
Look for biomePrefabPools to see what types of objects are in each area.
Logic File: server/systems/WorldSystem.js
The populateChunk method (around line 68) uses those settings to generate the objects when the world is initialized.
2. Loot Quantities (What’s inside the crates)
If you want to change how often items actually drop when a player searches a crate:

Data File: server/data/weapon_loot.json
dropChance: Global chance for a searched item to drop something.
searchLootChance: Specific chance for searchable containers.
tiers: Defines how the loot pool changes as the game progresses (using weights for specific items like ammo, health, or weapons).
3. Enemy Quantities (Zombies)
If you meant the number of zombies roaming the map:

Data File: server/data/spawner.json
maxCount: The maximum number of zombies allowed alive at once.
spawnRateMs: How quickly new ones spawn.
Wave Settings: server/data/waves.json
If the wave system is enabled (it usually is), this file overrides the base spawner settings to increase quantities as you survive longer.
Logic File: server/systems/AISpawner.js
Handles the actual spawning loops and difficulty scaling.