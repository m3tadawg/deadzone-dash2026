const fs = require("fs");
const path = require("path");

const root = "deadzone-dash";

function write(filePath, content) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

// ROOT FILES
write("package.json", JSON.stringify({
  name: "deadzone-dash",
  version: "1.0.0",
  main: "server/index.js",
  scripts: {
    start: "node server/index.js"
  },
  dependencies: {
    express: "^4.18.2",
    ws: "^8.13.0"
  }
}, null, 2));

write("README.md", `# DeadZone Dash
Modular 3D multiplayer zombie survival game.
Run: npm install && npm start
`);

write("AGENTS.md", `# DeadZone Dash Agent Rules

- Server is authoritative
- Client handles rendering + prediction
- No hardcoded gameplay values
- Use JSON configs
- Modular systems only
`);

// SERVER CORE
write("server/index.js", `
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {};

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).substr(2, 9);
  players[id] = { x: 0, y: 0, z: 0 };

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    if (data.type === "move") {
      players[id].x += data.dx;
      players[id].z += data.dz;
    }
  });

  ws.on("close", () => {
    delete players[id];
  });
});

setInterval(() => {
  const snapshot = JSON.stringify({ type: "snapshot", players });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(snapshot);
    }
  });
}, 50);

server.listen(3000, () => console.log("Server running on 3000"));
`);

// SERVER SYSTEMS
write("server/systems/CombatSystem.js", `
module.exports = {
  applyDamage(target, amount) {
    target.hp -= amount;
    if (target.hp <= 0) target.dead = true;
  }
};
`);

write("server/systems/AISystem.js", `
module.exports = {
  update(zombie, players) {
    // simple chase logic
    const target = Object.values(players)[0];
    if (!target) return;
    zombie.x += (target.x - zombie.x) * 0.01;
    zombie.z += (target.z - zombie.z) * 0.01;
  }
};
`);

// SERVER DATA
write("server/data/zombies.json", JSON.stringify([
  { "type": "shambler", "hp": 50, "speed": 0.5 },
  { "type": "runner", "hp": 30, "speed": 1.2 }
], null, 2));

write("server/data/weapons.json", JSON.stringify([
  { "name": "rifle", "damage": 10, "type": "hitscan" },
  { "name": "rocket", "damage": 50, "type": "projectile" }
], null, 2));

// CLIENT
write("client/index.html", `
<!DOCTYPE html>
<html>
<head><title>DeadZone Dash</title></head>
<body>
<canvas id="game"></canvas>
<script src="main.js"></script>
</body>
</html>
`);

write("client/main.js", `
const socket = new WebSocket("ws://localhost:3000");

let players = {};

socket.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.type === "snapshot") {
    players = data.players;
  }
};

window.addEventListener("keydown", (e) => {
  let dx = 0, dz = 0;
  if (e.key === "w") dz -= 1;
  if (e.key === "s") dz += 1;
  if (e.key === "a") dx -= 1;
  if (e.key === "d") dx += 1;

  socket.send(JSON.stringify({ type: "move", dx, dz }));
});

function loop() {
  console.clear();
  console.log(players);
  requestAnimationFrame(loop);
}
loop();
`);
//
// === AGENT + TASK SPEC FILES ===
//

// ROOT SPEC
write("docs/PROJECT_SPEC.md", `# DeadZone Dash — Project Specification

## Core Loop
Spawn → Survive → Loot → Extract or Die

## Architecture
- Server authoritative
- Client = rendering + prediction
- Modular systems only

## Systems
- Combat
- AI
- Spawn
- Weather
- Events

## Design Principles
- Data-driven (JSON)
- No monolithic files
- ECS or manager-based separation
`);

// TASK ROADMAP
write("docs/TASK_ROADMAP.md", `# Task Roadmap

## Phase 1 — Foundation
- Server/client connection
- Player movement
- Snapshot sync

## Phase 2 — Rendering
- Three.js scene
- Player models
- Camera system

## Phase 3 — Combat
- Weapons
- Damage system
- Projectiles

## Phase 4 — AI
- Zombie spawning
- Pathfinding
- Behaviour

## Phase 5 — World
- Chunk prefabs
- Map stitching

## Phase 6 — Events
- Airdrops
- Extraction zones
`);

// AGENT RULES (EXTENDED)
write("AGENTS.local.md", `# Local Agent Rules

- Always keep systems modular
- Never mix rendering with logic
- Use JSON configs for gameplay values
- Server is always authoritative
- Prefer composition over inheritance
- Keep files small and focused
`);

// SYSTEM TASK FILES
write("docs/systems/CombatSystem.md", `# Combat System Spec

## Responsibilities
- Damage calculation
- Hit detection
- Weapon handling

## Types
- Hitscan (raycast)
- Projectile (physics)
- Melee (range + direction)

## Rules
- Server authoritative
- Vector-based (3D)

## TODO
- Add headshot multiplier
- Add knockback
`);

write("docs/systems/AISystem.md", `# AI System Spec

## Base States
- Idle
- Chase
- Attack

## Behaviour
- Target nearest player
- Move using vector direction

## Advanced (Future)
- Pack coordination
- Flanking
- Spawn pressure

## TODO
- Add multiple zombie types
`);

write("docs/systems/WorldSystem.md", `# World System Spec

## Structure
- Chunk-based prefabs
- No tile-by-tile generation

## Chunk Rules
- Defined entry points
- Prebaked navmesh
- Tagged by biome

## TODO
- Implement chunk loader
- Add stitching logic
`);

write("docs/systems/EventSystem.md", `# Event System Spec

## Airdrops
- Timed spawn
- Loot crates
- Threat ring enemies

## Extraction
- Timed zones
- Survival pressure

## TODO
- Add timers
- Add spawn triggers
`);

write("docs/systems/WeatherSystem.md", `# Weather System Spec

## States
- Clear
- Rain
- Fog
- Storm

## Effects
- Visibility reduction
- Movement modifiers
- AI behavior changes

## TODO
- Implement state transitions
`);

// NETWORKING SPEC
write("docs/NETWORKING.md", `# Networking Model

## Server
- Authoritative state
- Sends snapshots at fixed tick

## Client
- Predicts local movement
- Interpolates remote players

## Flow
Input → Server → Snapshot → Client render

## TODO
- Add interpolation system
- Add latency compensation
`);

//
// === END SPEC FILES ===
//
console.log("Project created!");