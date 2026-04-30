import * as THREE from "three";
import { SceneManager } from "./render/SceneManager.js";
import { HUDManager } from "./ui/HUDManager.js";

const socket = new WebSocket("ws://localhost:3000");

const sceneManager = new SceneManager();
const hud = new HUDManager();

let latestSnapshot = null;
let snapshotChanged = false;

socket.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.type === "init") {
    sceneManager.setLocalPlayer(data.id);
    if (data.map) {
      sceneManager.initWorld(data.map);
    }
  } else if (data.type === "snapshot") {
    latestSnapshot = data;
    snapshotChanged = true;
  } else if (data.type === "tracer") {
    if (data.rays) {
      data.rays.forEach(ray => {
        sceneManager.addTracer(ray.startX, ray.startZ, ray.endX, ray.endZ, data.shooterId);
      });
    } else if (data.startX !== undefined) {
      sceneManager.addTracer(data.startX, data.startZ, data.endX, data.endZ, data.shooterId);
    }
  } else if (data.type === "hit") {
    const effectType = data.hitType === "player" ? "blood_red" : "blood_green";
    const height = data.isHeadshot ? 1.8 : 1.2;
    sceneManager.particles.emit(effectType, new THREE.Vector3(data.x, height, data.z));
  } else if (data.type === "notification") {
    hud.showNotification(data.text, data.tone);
  }
};

// Input State
const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false, e: false, r: false };
let lastSentDx = 0;
let lastSentDz = 0;

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (keys.hasOwnProperty(key)) {
      if (key === 'e' && !keys.e && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "searchStart" }));
      }
      if (key === 'r' && !keys.r && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "reload" }));
      }
      keys[key] = true;
  }

  const slotNumber = Number.parseInt(key, 10);
  if (!e.repeat && !Number.isNaN(slotNumber) && slotNumber >= 1 && slotNumber <= 5 && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "switchWeaponSlot", slotIndex: slotNumber - 1 }));
  }
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (keys.hasOwnProperty(key)) {
      if (key === 'e' && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "searchEnd" }));
      }
      keys[key] = false;
  }
});

let aimTarget = null;
let isMouseDown = false;
let lastSentAimTime = 0;
let lastShootTime = 0;

window.addEventListener("mousemove", (e) => {
  if (sceneManager) {
      aimTarget = sceneManager.getAimCoordinates(e.clientX, e.clientY);
  }
});

window.addEventListener("mousedown", () => {
    isMouseDown = true;
});

window.addEventListener("mouseup", () => {
    isMouseDown = false;
});

window.addEventListener("wheel", (e) => {
  if (!latestSnapshot || !sceneManager.localPlayerId || socket.readyState !== WebSocket.OPEN) return;
  const localPlayer = latestSnapshot.players?.[sceneManager.localPlayerId];
  if (!localPlayer) return;

  const slotCount = localPlayer.inventory?.length || 5;
  const direction = e.deltaY > 0 ? 1 : -1;
  const nextSlot = (((localPlayer.selectedWeaponSlot || 0) + direction) % slotCount + slotCount) % slotCount;
  socket.send(JSON.stringify({ type: "switchWeaponSlot", slotIndex: nextSlot }));
}, { passive: true });

let lastTime = performance.now();

// Game loop
function loop() {
  const currentTime = performance.now();
  const dt = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  // Evaluate input and send to server if changed
  let dx = 0, dz = 0;
  if (keys.w || keys.arrowup) dz -= 1;
  if (keys.s || keys.arrowdown) dz += 1;
  if (keys.a || keys.arrowleft) dx -= 1;
  if (keys.d || keys.arrowright) dx += 1;

  if (socket.readyState === WebSocket.OPEN) {
    if (dx !== lastSentDx || dz !== lastSentDz) {
      socket.send(JSON.stringify({ type: "move", dx, dz }));
      lastSentDx = dx;
      lastSentDz = dz;
    }

    if (aimTarget) {
        if (currentTime - lastSentAimTime > 50) { // Max 20 times a second for aiming
            socket.send(JSON.stringify({ type: "aim", x: aimTarget.x, z: aimTarget.z }));
            lastSentAimTime = currentTime;
        }
        
        if (isMouseDown) {
            if (currentTime - lastShootTime > 50) { // Max 20 times a second for shooting network packets
                socket.send(JSON.stringify({ type: "shoot", aimX: aimTarget.x, aimZ: aimTarget.z, isHeadshot: aimTarget.isHeadshot }));
                lastShootTime = currentTime;
            }
        }
    }
  }

  if (latestSnapshot) {
    if (snapshotChanged) {
        sceneManager.sync(latestSnapshot);
        // Check for nearby searchable objects to show UI prompt
        const localPlayer = latestSnapshot.players[sceneManager.localPlayerId];
        if (localPlayer) {
            const hasSearchable = sceneManager.checkNearbySearchable(localPlayer.x, localPlayer.z, 3.0);
            hud.setSearchPromptVisible(hasSearchable);
        }
        hud.updateFromSnapshot(latestSnapshot, sceneManager.localPlayerId);
        
        // Update search progress
        const lp = latestSnapshot.players[sceneManager.localPlayerId];
        if (lp) {
            hud.updateSearchProgress(lp.searchProgress || 0);
        }
        snapshotChanged = false;
    }
    sceneManager.updateThrowPreview(latestSnapshot, sceneManager.localPlayerId, aimTarget);
    sceneManager.update(dt);
  }

  sceneManager.render();

  requestAnimationFrame(loop);
}

loop();
