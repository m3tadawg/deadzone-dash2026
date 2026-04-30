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
const perksConfig = require("./data/perks.json");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const combatSystem = new CombatSystem(weaponsConfig, broadcastHit);
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
let droppedItems = {};
let playerSockets = {};

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
    ...loadout, // This now includes weapon, selectedWeaponSlot, inventory, AND ammo
    lastShotTime: 0,
    isSearching: false,
    searchTarget: null,
    searchStartTime: 0,
    searchProgress: 0
  };
}

function completeSearch(player) {
  if (!player || !player.searchTarget) return;

  const area = WorldSystem.getAreaAt(player.x, player.z);
  const searchDef = WorldSystem.catalog.prefabs[player.searchTarget.type];
  const lootId = weaponLoadoutSystem.rollSearchLoot(
    (Date.now() - gameStartTime) / 1000,
    searchDef,
    area?.lootMultiplier || 1
  );

  if (lootId) {
    const dropId = Math.random().toString(36).substr(2, 9);
    droppedItems[dropId] = {
      id: dropId,
      weaponId: lootId,
      x: player.x,
      z: player.z,
      createdAt: Date.now()
    };
    notifyPlayer(player.id, "Found something!", "loot");
  } else {
    notifyPlayer(player.id, `${player.searchTarget.type.replaceAll("_", " ")} was picked clean`, "miss");
  }

  player.isSearching = false;
  player.searchTarget = null;
  player.searchProgress = 0;
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
  playerSockets[id] = ws;

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
            // Consumables logic: auto-reload next unit or remove if empty
            const weapon = weaponLoadoutSystem.weaponById.get(player.weapon);
            if (weapon && weapon.type === 'thrown') {
                weaponLoadoutSystem.autoReload(player);
            }
            weaponLoadoutSystem.checkDepletion(player);

            const killedHitEvents = (result.hitEvents || []).filter((event) => event.killed);
            if (killedHitEvents.length > 0) {
              killedHitEvents.forEach((event) => {
                const reward = PlayerStatsSystem.creditKill(player, {
                  isHeadshot: event.isHeadshot,
                  now: Date.now()
                });
                notifyCombatReward(player, reward, event);
              });
            } else {
              (result.eliminatedZombieIds || []).forEach(() => {
                const reward = PlayerStatsSystem.creditKill(player, { now: Date.now() });
                notifyCombatReward(player, reward);
              });
            }

            const area = WorldSystem.getAreaAt(player.x, player.z);
            (result.eliminatedZombieIds || []).forEach((zombieId) => {
              const zombie = zombies[zombieId]; 
              if (!zombie) return;

              let dropMultiplier = area?.lootMultiplier || 1;
              if (zombie.type === 'shambler' || zombie.type === 'runner') {
                dropMultiplier *= 0.25; // Reduce drop rate by 75% for basic zombies
              }

              const weaponId = weaponLoadoutSystem.rollForLoot(
                (Date.now() - gameStartTime) / 1000,
                dropMultiplier
              );
              
              if (weaponId) {
                const dropId = Math.random().toString(36).substr(2, 9);
                droppedItems[dropId] = {
                  id: dropId,
                  weaponId,
                  x: zombie.x,
                  z: zombie.z,
                  createdAt: Date.now()
                };
              }
            });

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
      } else if (data.type === "reload") {
        const player = players[id];
        if (!player || player.dead) return;
        weaponLoadoutSystem.reload(player);
      }
    } catch (e) {
      console.error("Invalid message:", e);
    }
  });

  ws.on("close", () => {
    delete players[id];
    delete playerSockets[id];
    console.log("Player disconnected:", id);
  });
});

function broadcast(msg) {
    const data = JSON.stringify(msg);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

function notifyPlayer(playerId, text, tone = "info") {
    const client = playerSockets[playerId];
    if (client?.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "notification", text, tone }));
    }
}

function notifyCombatReward(player, reward, hitEvent = {}) {
  if (!player || !reward) return;

  if (reward.streakLabel) {
    notifyPlayer(player.id, `${reward.streakLabel} x${reward.killStreak} +${reward.scoreAdded}`, "streak");
    return;
  }

  if (hitEvent.isHeadshot && reward.headshotBonus > 0) {
    notifyPlayer(player.id, `Headshot +${reward.scoreAdded}`, "headshot");
  }
}

function describeWeaponLootResult(result, weapon) {
  const weaponName = weaponLoadoutSystem.getWeaponDisplayName(result.weaponId);
  const slotText = `slot ${result.slot + 1}`;

  if (result.action === "replaced") {
    const oldName = weaponLoadoutSystem.getWeaponDisplayName(result.replacedWeaponId);
    return {
      text: `Replaced ${oldName} with ${weaponName} (${slotText})`,
      tone: "replace"
    };
  }

  if (result.action === "stowed") {
    return {
      text: `Stowed ${weaponName} (${slotText})`,
      tone: "stow"
    };
  }

  if (result.action === "equipped") {
    return {
      text: `Equipped ${weaponName} (${slotText})`,
      tone: "equip"
    };
  }

  if (result.action === "ammo" && weapon?.type !== "melee") {
    return {
      text: `+${result.ammoAdded} reserve for ${weaponName}`,
      tone: "ammo"
    };
  }

  return {
    text: `Already carrying ${weaponName}`,
    tone: "stow"
  };
}

function broadcastHit(x, z, type = "zombie", isHeadshot = false, details = {}) {
    broadcast({
        type: "hit",
        x,
        z,
        hitType: type,
        isHeadshot,
        ...details
    });
}

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
        const terrainSpeed = WorldSystem.getSpeedMultiplier(player.x, player.z);
        const baseSpeed = StatusEffectSystem.applyModifiers(player, playerConfig.baseSpeed, 'movementSpeed');
        const finalSpeed = baseSpeed * terrainSpeed;
        
        const nextX = player.x + (player.vx / length) * finalSpeed * deltaTime;
        const nextZ = player.z + (player.vz / length) * finalSpeed * deltaTime;
        
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
    PlayerStatsSystem.updateCombatState(player, currentTime);

    StatusEffectSystem.update(player, deltaTime);

    // === SEARCH PROGRESS ===
    if (player.isSearching && player.searchTarget) {
      const def = WorldSystem.catalog.prefabs[player.searchTarget.type];
      const searchTime = def?.searchTime ?? 3;

      if (searchTime === 0) {
        completeSearch(player);
      } else {
        const elapsed = (currentTime - player.searchStartTime) / 1000;
        player.searchProgress = Math.min(100, (elapsed / searchTime) * 100);
        if (elapsed >= searchTime) {
          completeSearch(player);
        }
      }
    } else {
      player.searchProgress = 0;
    }

    // === PICKUP CHECK ===
    const PICKUP_RADIUS = 1.5;
    Object.values(droppedItems).forEach((item) => {
      const dx = player.x - item.x;
      const dz = player.z - item.z;
      if ((dx * dx + dz * dz) <= PICKUP_RADIUS * PICKUP_RADIUS) {
          const lootId = item.weaponId;
          let notificationText = "";

          let notificationTone = "info";

          if (lootId === "health_pack") {
            player.health = Math.min(playerConfig.maxHealth, player.health + 25);
            notificationText = "Picked up Health Pack (+25 HP)";
            notificationTone = "heal";
          } else if (lootId === "ammo_pack") {
            const success = weaponLoadoutSystem.refillAmmo(player);
            notificationText = success ? "Refilled Ammo" : "Ammo Pack (No weapon to refill)";
            notificationTone = success ? "ammo" : "miss";
          } else if (lootId.startsWith("perk_")) {
            const perkType = lootId.replace("perk_", "");
            const perk = perksConfig.find(p => p.type === perkType);
            if (perk) {
              StatusEffectSystem.applyEffect(player, { 
                type: perk.type, 
                duration: perk.duration,
                modifiers: perk.modifiers 
              });
              notificationText = `Acquired Perk: ${perkType.replaceAll("_", " ")}`;
              notificationTone = "perk";
            }
          } else {
            // It's a weapon
            const activeSlot = player.inventory?.[player.selectedWeaponSlot || 0];
            const activeWeapon = activeSlot ? weaponLoadoutSystem.weaponById.get(activeSlot.id) : null;
            const activeAmmo = (activeSlot?.clip || 0) + (activeSlot?.reserve || 0);
            const shouldEquip = !activeSlot || !activeWeapon || activeWeapon.type === "melee" || activeAmmo <= 0;
            const lootResult = weaponLoadoutSystem.addWeaponToInventory(player, lootId, { autoEquip: shouldEquip });
            if (lootResult) {
              const weapon = weaponLoadoutSystem.weaponById.get(lootResult.weaponId);
              const description = describeWeaponLootResult(lootResult, weapon);
              notificationText = description.text;
              notificationTone = description.tone;
            }
          }

          if (notificationText) {
            notifyPlayer(player.id, notificationText, notificationTone);
          }
        delete droppedItems[item.id];
      }
    });
  });

  // === UPDATE ZOMBIES ===
  Object.values(zombies).forEach(zombie => {
    if (zombie.dead) return;

    // AI movement
    AISystem.update(zombie, players, deltaTime);

    // Zombie melee attacks
    ZombieCombatSystem.update(zombie, players, deltaTime, broadcastHit);

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
          // Attribute kill to owner
          const owner = players[hazard.ownerId];
          if (owner) {
            const reward = PlayerStatsSystem.creditKill(owner, { now: Date.now() });
            notifyCombatReward(owner, reward);
            const area = WorldSystem.getAreaAt(zombie.x, zombie.z);
            let dropMultiplier = area?.lootMultiplier || 1;
            if (zombie.type === 'shambler' || zombie.type === 'runner') {
              dropMultiplier *= 0.25; // Reduce drop rate by 75% for basic zombies
            }
            const weaponId = weaponLoadoutSystem.rollForLoot(
              (Date.now() - gameStartTime) / 1000,
              dropMultiplier
            );
            if (weaponId) {
              const dropId = Math.random().toString(36).substr(2, 9);
              droppedItems[dropId] = {
                id: dropId,
                weaponId,
                x: zombie.x,
                z: zombie.z,
                createdAt: Date.now()
              };
            }
          }
        }
      }
    });
  });
  activeHazards = activeHazards.filter((hazard) => hazard.expiresAt > currentTime);
  activeDamageZones = activeDamageZones.filter((zone) => zone.expiresAt > currentTime);
  
  // Clean up old loot drops (60 seconds)
  const ITEM_TTL = 60000;
  Object.keys(droppedItems).forEach((id) => {
    if (currentTime - droppedItems[id].createdAt > ITEM_TTL) {
      delete droppedItems[id];
    }
  });

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
    droppedItems,
    damageZones: activeDamageZones,
    hazards: activeHazards,
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
