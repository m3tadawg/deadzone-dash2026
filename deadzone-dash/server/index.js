const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const StatusEffectSystem = require("./systems/StatusEffectSystem");
const AISystem = require("./systems/AISystem");
const ZombieCombatSystem = require("./systems/ZombieCombatSystem");
const ZombieRangedAttackSystem = require("./systems/ZombieRangedAttackSystem");
const ZombieProjectileSystem = require("./systems/ZombieProjectileSystem");
const ZombieAbilitySystem = require("./systems/ZombieAbilitySystem");

const CombatSystem = require("./systems/CombatSystem");
const playerConfig = require("./data/player.json");
const weaponsConfig = require("./data/weapons.json");
const weaponLootConfig = require("./data/weapon_loot.json");
const WorldSystem = require("./systems/WorldSystem");
const PlayerStatsSystem = require("./systems/PlayerStatsSystem");
const WeaponLoadoutSystem = require("./systems/WeaponLoadoutSystem");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const combatSystem = new CombatSystem(weaponsConfig);
const weaponLoadoutSystem = new WeaponLoadoutSystem(weaponsConfig, weaponLootConfig);
const gameStartTime = Date.now();

// Cleanly handle Chrome DevTools config probes to prevent CSP console errors
app.get("/.well-known/*", (req, res) => res.status(404).end());

// Serve the statically built client files
app.use(express.static(path.join(__dirname, "../client")));

// ======================
// GAME STATE
// ======================

let players = {};
let zombies = {};
let projectiles = {};
let activeHazards = [];
let activeDamageZones = [];

function createPlayer(id) {
  const loadout = weaponLoadoutSystem.createInitialLoadout("pistol");

  return {
    id,
    x: 0,
    y: 0,
    z: 0,
    aimX: 0,
    aimZ: 0,
    health: playerConfig.maxHealth,
    statusEffects: [],
    dead: false,
    ...PlayerStatsSystem.createInitialStats(),
    weapon: loadout.weapon,
    selectedWeaponSlot: loadout.selectedWeaponSlot,
    lastShotTime: 0,
    inventory: loadout.inventory
  };
}

function createZombie(id) {
  return {
    id,
    x: Math.random() * 20 - 10,
    y: 0,
    z: Math.random() * 20 - 10,
    health: 50,
    statusEffects: [],
    dead: false
  };
}

const AISpawner = require("./systems/AISpawner");

// ======================
// NETWORKING
// ======================

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).substr(2, 9);

  players[id] = createPlayer(id);

  console.log("Player connected:", id);
  ws.send(JSON.stringify({ 
    type: "init", 
    id,
    map: WorldSystem.getMapData()
  }));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "move") {
        const player = players[id];
        if (!player || player.dead) return;

        // Searching logic
        if (player.isSearching && player.searchTarget) {
            const dist = Math.sqrt(Math.pow(player.x - player.searchTarget.x, 2) + Math.pow(player.z - player.searchTarget.z, 2));
            if (dist > 4.0 || data.dx !== 0 || data.dz !== 0) {
                player.isSearching = false;
                player.searchTarget = null;
            }
        }

        // Store the movement direction (velocity) instead of instantly teleporting
        player.vx = data.dx;
        player.vz = data.dz;
      } else if (data.type === "aim") {
        const player = players[id];
        if (!player || player.dead) return;
        player.aimX = data.x;
        player.aimZ = data.z;
      } else if (data.type === "shoot") {
        const player = players[id];
        if (!player || player.dead) return;
        
        if (data.aimX !== undefined && data.aimZ !== undefined) {
            player.aimX = data.aimX;
            player.aimZ = data.aimZ;
        }

        const result = combatSystem.handleShoot(player, zombies);
        if (result) {
            (result.eliminatedZombieIds || []).forEach(() => {
                PlayerStatsSystem.creditKill(player);
            });

            const area = WorldSystem.getAreaAt(player.x, player.z);
            const lootResult = (result.eliminatedZombieIds || []).reduce((latest, _zombieId) => {
              const awarded = weaponLoadoutSystem.tryAwardZombieLoot(
                player,
                Date.now() - gameStartTime,
                area?.lootMultiplier || 1
              );
              return awarded || latest;
            }, null);

            if (lootResult) {
              const weaponName = lootResult.weaponId.replaceAll("_", " ");
              ws.send(JSON.stringify({
                type: "notification",
                text: lootResult.isNew
                  ? `Looted ${weaponName} (slot ${lootResult.slot + 1})`
                  : `Switched to ${weaponName}`
              }));
            }

            if (result.damageZones?.length) {
              const now = Date.now();
              result.damageZones.forEach((zone) => {
                activeDamageZones.push({
                  ...zone,
                  expiresAt: now + (zone.ttlMs || 1000)
                });
              });
            }
            if (result.hazards?.length) {
              activeHazards.push(...result.hazards);
            }

            const tracerMsg = JSON.stringify({ type: "tracer", shooterId: id, ...result });
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(tracerMsg);
                }
            });
        }
      } else if (data.type === "switchWeaponSlot") {
        const player = players[id];
        if (!player || player.dead) return;
        weaponLoadoutSystem.switchToSlot(player, Number(data.slotIndex));
      } else if (data.type === "searchStart") {
        const player = players[id];
        if (!player || player.dead) return;
        player.isSearching = true;
        player.searchTarget = WorldSystem.getNearbySearchable(player.x, player.z, 3.0);
        player.searchStartTime = Date.now();
      } else if (data.type === "searchEnd") {
        const player = players[id];
        if (player) {
            player.isSearching = false;
            player.searchTarget = null;
        }
      }
    } catch (e) {
      console.error("Invalid message:", e);
    }
  });

  ws.on("close", () => {
    delete players[id];
    console.log("Player disconnected:", id);
  });
});

// ======================
// GAME LOOP
// ======================

const TICK_RATE = 50; // ms (20 ticks/sec)

setInterval(() => {
  const deltaTime = TICK_RATE / 1000;
  const currentTime = Date.now();

  // === SPAWNER ===
  AISpawner.update(currentTime, zombies, players);

  // === UPDATE PLAYERS ===
  Object.values(players).forEach(player => {
    if (player.dead) return;

    // Apply continuous movement
    if (player.vx || player.vz) {
      // Normalize to prevent faster diagonal movement
      const length = Math.sqrt(player.vx * player.vx + player.vz * player.vz);
      if (length > 0) {
        const speedMultiplier = WorldSystem.getSpeedMultiplier(player.x, player.z);
        const nextX = player.x + (player.vx / length) * (playerConfig.baseSpeed * speedMultiplier) * deltaTime;
        const nextZ = player.z + (player.vz / length) * (playerConfig.baseSpeed * speedMultiplier) * deltaTime;
        
        // Circular collider check (radius 0.8)
        if (!WorldSystem.isPositionBlocked(nextX, nextZ, 0.8)) {
            player.x = nextX;
            player.z = nextZ;
        } else {
            // Sliding logic: try moving only in X or only in Z
            if (!WorldSystem.isPositionBlocked(nextX, player.z, 0.8)) {
                player.x = nextX;
            } else if (!WorldSystem.isPositionBlocked(player.x, nextZ, 0.8)) {
                player.z = nextZ;
            }
        }
      }
    }

    PlayerStatsSystem.updateStamina(player, deltaTime);

    StatusEffectSystem.update(player, deltaTime);
  });

  // === UPDATE ZOMBIES ===
  Object.values(zombies).forEach(zombie => {
    if (zombie.dead) return;

    // AI movement
    AISystem.update(zombie, players, deltaTime);

    // Zombie melee attacks
    ZombieCombatSystem.update(zombie, players, deltaTime);

    // Zombie ranged attacks
    ZombieRangedAttackSystem.update(zombie, players, projectiles, deltaTime);

    // Boss special abilities
    ZombieAbilitySystem.update(zombies, players, projectiles, deltaTime);

    // Status effects
    StatusEffectSystem.update(zombie, deltaTime);
  });

  // === UPDATE PROJECTILES ===
  ZombieProjectileSystem.update(projectiles, players, deltaTime);

  // === UPDATE PLAYER HAZARDS (e.g. molotov fire pools) ===
  activeHazards.forEach((hazard) => {
    if (hazard.type !== "fire") return;
    Object.values(zombies).forEach((zombie) => {
      if (zombie.dead) return;
      const dx = zombie.x - hazard.x;
      const dz = zombie.z - hazard.z;
      if ((dx * dx + dz * dz) <= hazard.radius * hazard.radius) {
        zombie.health -= hazard.dps * deltaTime;
        if (zombie.health <= 0) {
          zombie.dead = true;
        }
      }
    });
  });
  activeHazards = activeHazards.filter((hazard) => hazard.expiresAt > currentTime);
  activeDamageZones = activeDamageZones.filter((zone) => zone.expiresAt > currentTime);

  // === CLEANUP DEAD ENTITIES ===
  for (let id in zombies) {
    if (zombies[id].dead) {
      delete zombies[id];
    }
  }

  // === SNAPSHOT ===
  const snapshot = JSON.stringify({
    type: "snapshot",
    players,
    zombies,
    projectiles,
    damageZones: activeDamageZones,
    hud: {
      wave: AISpawner.currentWaveNumber || 1,
      maxHealth: playerConfig.maxHealth,
      maxStamina: playerConfig.maxStamina
    }
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(snapshot);
    }
  });

}, TICK_RATE);

// ======================
// START SERVER
// ======================

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
