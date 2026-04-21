# DeadZone Dash: Modular Game Blueprint for 3D Rewrite

This document serves as the architectural and functional blueprint for rewriting DeadZone Dash. It is designed to be engine-agnostic, supporting a transition from a flat 2D system to a modular 3D environment (e.g., Three.js), emphasizing separation of concerns and data-driven design away from massive monolithic files.

---

## 1. Game Identity & 3D Perspective Shift
- **Genre**: Multiplayer 3D Top-Down / Birds Eye View Zombie Survival (Action Arcade).
- **Core Loop**: Spawn → Survive Waves → Loot & Upgrade → Compete/Cooperate → Extract or Die.
- **Visual Style Shift**: Transitioning from flat 2D tiles to true 3D geometry. This allows for verticality (stairs, drops), true line-of-sight mechanics, and volumetric particle effects (fog, explosions, acid pools).
- **Tempo**: High-intensity. Difficulty scales linearly with time and wave count.

---

## 2. World & Environmental Systems
The world is constructed procedurally, but must be designed to support tense, logical combat flow.

### Map Generation Structure (3D Recommendation)
The original 2D game used a raw tile-by-tile generator, which often results in messy, unreadable combat spaces. For a playable 3D game, **do not strictly generate block-by-block**. Instead, use a **Chunk-based Prefab System**:
*   **The Prefab Approach**: Create 20-30 hand-designed 3D chunks (e.g., `City_Intersection_A`, `Suburban_House_B`, `Graveyard_Center`). Each chunk contains hardcoded collision meshes, cover placements, and enemy spawn nodes designed by a human to ensure fun chokepoints and sightlines.
*   **The Generator**: The server simply stitches these chunks together on a grid (using an algorithm like Wave Function Collapse or basic weighted arrays) to form the overall map.
*   **Biomes**: Group chunks by tags so the map flows logically (Rural chunks naturally bleed into Suburban chunks, which transition into high-density Urban chunks at the center).
*   **Graveyard Modifiers**: A specific chunk/biome where difficulty drastically increases (originally 2x spawn rate, early elite un-locks) but loot chances soar.
*   **Navigation**: By using prefabs, you can pre-bake **NavMeshes** for zombie AI pathfinding, allowing them to traverse stairs and jump over specific obstacles, drastically improving performance compared to dynamic tile pathing.

### Weather System (Dynamic & Impactful)
The weather acts as a global modifier on gameplay, utilizing a markov-chain probability transition matrix.
*   **Weather States**: Clear, Rain, Heavy Rain, Fog, and Storm.
*   **Mechanics**: Weather shifts dynamically every 15-60 seconds. Visibility in 3D should utilize volumetric fog/clipping planes and lighting dimming, significantly ramping up horror and tension while penalizing movement speed.

---

## 3. Combat, Enemies, & AI
Combat remains server-authoritative to ensure multiplayer integrity.

*   **The Horde**: Wave-based difficulty scaling (Shamblers → Runners → Tanks → Spitters → Elites/Bosses).
*   **Weaponry**:
    *   **Hitscan / Projectile Mix**: E.g., Rifles (instant), Rocket Launchers/Acid (physical travel time using 3D vectors).
    *   **Melee**: High risk/reward. Includes directional backstab multipliers.
    *   **Deployables**: Auto-targeting Turrets that require line-of-sight checks.

---

## 4. Map Events: Airdrops & Extractions
These server-driven macros dictate player movement across the map by creating high-value friction points.

### Strategic Airdrops
Airdrops pull players out of safe zones and into highly contested areas.
*   **Timers**: Scheduled every 1-2 minutes dynamically.
*   **The Drop Phase**: Airdrops have a 15-second "incoming ETA" phase (marked on the map/skybox), followed by a 5-second unlock timer once landed.
*   **The Horde Trap**: Upon landing, the Drop instantly spawns a "Threat Ring" of 4-7 biome-specific zombies around the crate to punish unprepared players.
*   **Reward**: Heavy Ammo, Health, Fuel, and a high probability (20-45% chance) of explosive ordnance (Grenades, Rockets, Molotovs) which are otherwise extremely rare.

### Extraction Windows
The only way to "Win" the game and lock in high scores.
*   **Mechanic**: Periodic zones (radiuses) activate. Any player standing in the zone at the end of the 25-second window extracts, gaining massive score bonuses and saving their stats to the persistent DB.
*   **Pressure**: Extraction zones also spawn Threat Rings, triggering a massive PvE assault during the countdown.

---

## 5. Player Progression: Perks & Challenges
Progression combines temporary gameplay adrenaline spikes (Perks) bounded by high-octane tasks (Challenges).

### The Challenge System
Timed mini-objectives dispatched by the server to players.
*   **Types**: *Blood Rush* (Speed Kills), *No Time To Die* (Survival), *Last Slash* (Backstabs), *Molotov Mayhem* (Fire tick kills), *Dead Drop* (Scavenging).
*   **Reward**: Completing a Challenge grants a high-tier Perk.

### The Perk System (Status Effects)
Perks grant drastic temporary buffs (default ~30 duration).
*   **Combat**: *Damage Boost, Speed Boost, Health Regen, Backstab Bonus*.
*   **Utility & AoE**: *Blast Radius, Fire Frenzy, Stealth Mode, Deadly Dash, Loot Magnet,* and *Ammo Finder*.

---

## 6. Target Modular Architecture for Rewrite
To avoid the "messy" state of the current project, the new LLM-assisted build should strictly adhere to:
1.  **State Server / Dumb Client**: The Node.js server maintains true X,Y,Z positions. The Three.js client only renders what the server dictates and sends intent.
2.  **Data-Driven Catalogs**: Weapons, Zombie Stats, and Loot Tables MUST be defined in JSON/Config files.
3.  **Decoupled ECS or Manager Architecture**: Separating `CombatManager`, `UIManager`, and `NetworkManager` so a bug in the HUD doesn't freeze the physics engine.
