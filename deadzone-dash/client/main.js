import { SceneManager } from "./render/SceneManager.js";

const socket = new WebSocket("ws://localhost:3000");

const sceneManager = new SceneManager();

let latestSnapshot = null;
let snapshotChanged = false;

socket.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.type === "init") {
    sceneManager.setLocalPlayer(data.id);
  } else if (data.type === "snapshot") {
    latestSnapshot = data;
    snapshotChanged = true;
  } else if (data.type === "tracer") {
    sceneManager.addTracer(data.startX, data.startZ, data.endX, data.endZ);
  }
};

// Input State
const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
let lastSentDx = 0;
let lastSentDz = 0;

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (keys.hasOwnProperty(key)) keys[key] = true;
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (keys.hasOwnProperty(key)) keys[key] = false;
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
                socket.send(JSON.stringify({ type: "shoot", aimX: aimTarget.x, aimZ: aimTarget.z }));
                lastShootTime = currentTime;
            }
        }
    }
  }

  if (latestSnapshot) {
    if (snapshotChanged) {
        sceneManager.sync(latestSnapshot);
        snapshotChanged = false;
    }
    sceneManager.update(dt);
  }

  sceneManager.render();

  requestAnimationFrame(loop);
}

loop();