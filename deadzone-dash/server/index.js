const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const StatusEffectSystem = require("./systems/StatusEffectSystem");
const AISystem = require("./systems/AISystem");

const CombatSystem = require("./systems/CombatSystem");
const playerConfig = require("./data/player.json");
const weaponsConfig = require("./data/weapons.json");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const combatSystem = new CombatSystem(weaponsConfig);

// Cleanly handle Chrome DevTools config probes to prevent CSP console errors
app.get("/.well-known/*", (req, res) => res.status(404).end());

// Serve the statically built client files
app.use(express.static(path.join(__dirname, "../client")));

// ======================
// GAME STATE
// ======================

let players = {};
let zombies = {};

function createPlayer(id) {
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
    weapon: "pistol",
    lastShotTime: 0
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

// Spawn some test zombies
for (let i = 0; i < 5; i++) {
  const id = "z_" + i;
  zombies[id] = createZombie(id);
}

// ======================
// NETWORKING
// ======================

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).substr(2, 9);

  players[id] = createPlayer(id);

  console.log("Player connected:", id);
  ws.send(JSON.stringify({ type: "init", id }));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "move") {
        const player = players[id];
        if (!player || player.dead) return;

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
        
        const result = combatSystem.handleShoot(player, zombies);
        if (result) {
            const tracerMsg = JSON.stringify({ type: "tracer", ...result });
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(tracerMsg);
                }
            });
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

  // === UPDATE PLAYERS ===
  Object.values(players).forEach(player => {
    if (player.dead) return;

    // Apply continuous movement
    if (player.vx || player.vz) {
      // Normalize to prevent faster diagonal movement
      const length = Math.sqrt(player.vx * player.vx + player.vz * player.vz);
      if (length > 0) {
        player.x += (player.vx / length) * playerConfig.baseSpeed * deltaTime;
        player.z += (player.vz / length) * playerConfig.baseSpeed * deltaTime;
      }
    }

    StatusEffectSystem.update(player, deltaTime);
  });

  // === UPDATE ZOMBIES ===
  Object.values(zombies).forEach(zombie => {
    if (zombie.dead) return;

    // AI movement
    AISystem.update(zombie, players);

    // Status effects
    StatusEffectSystem.update(zombie, deltaTime);
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
    zombies
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