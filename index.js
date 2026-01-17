import http from "http";
import fs from "fs";
import { createClient } from "bedrock-protocol";

// ===== FLY KEEPALIVE =====
const WEB_PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("alive\n");
}).listen(WEB_PORT, () => {
  console.log("[WEB] keepalive server on", WEB_PORT);
});

// ===== CONFIG =====
const HOST = "play.sigmapallukka.xyz";
const PORT = 20465;
const EMAIL = "tissimattolou@outlook.com";
const AUTH_DIR = "/data/mc"; // Fly volume

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// ===== STATE =====
let client = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let afkTimer = null;
let slowTimer = null;

// ===== UTILS =====
function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  const delay = Math.min(60_000 * (reconnectAttempts + 1), 5 * 60_000);
  reconnectAttempts++;

  log(`[RECONNECT] retry in ${Math.round(delay / 1000)}s`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startBot();
  }, delay);
}

function cleanup() {
  if (afkTimer) clearInterval(afkTimer);
  if (slowTimer) clearInterval(slowTimer);
  afkTimer = null;
  slowTimer = null;
  if (client) {
    try { client.close(); } catch {}
  }
  client = null;
}

// ===== BOT =====
function startBot() {
  cleanup();

  log("[BOT] starting…");

  try {
    client = createClient({
      host: HOST,
      port: PORT,
      username: EMAIL,
      auth: "microsoft",
      profilesFolder: AUTH_DIR,
      version: '1.21.130': 898,
    });

    client.on("connect", () => {
      log("[NET] socket connected");
    });

    client.on("join", () => {
      log("[OK] joined server");
      reconnectAttempts = 0;
    });

    client.on("spawn", () => {
      log("[OK] spawned");
      startAFK();
    });

    client.on("disconnect", (p) => {
      log("[DISCONNECT]", p?.message || "");
      cleanup();
      scheduleReconnect();
    });

    client.on("close", () => {
      log("[CLOSE]");
      cleanup();
      scheduleReconnect();
    });

    client.on("error", (e) => {
      log("[ERROR]", e.message);
      cleanup();
      scheduleReconnect();
    });

  } catch (e) {
    log("[FATAL]", e.message);
    cleanup();
    scheduleReconnect();
  }
}

function startAFK() {
  // pieni liike
  afkTimer = setInterval(() => {
    if (!client || !client.entityId) return;
    try {
      client.queue("move_player", {
        runtime_id: client.entityId,
        position: { x: 0, y: 0, z: 0 },
        pitch: 0,
        yaw: 0,
        head_yaw: 0,
        mode: "normal",
        on_ground: true,
        riding_eid: 0n,
        tick: BigInt(Date.now())
      });
    } catch {}
  }, 45_000);

  // 26 min välein crouch + askel taakse
  slowTimer = setInterval(() => {
    if (!client || !client.entityId) return;
    try {
      client.queue("player_action", {
        runtime_id: client.entityId,
        action: "start_sneak",
        position: { x: 0, y: 0, z: 0 },
        face: 0
      });
      setTimeout(() => {
        try {
          client.queue("player_action", {
            runtime_id: client.entityId,
            action: "stop_sneak",
            position: { x: 0, y: 0, z: 0 },
            face: 0
          });
          client.queue("move_player", {
            runtime_id: client.entityId,
            position: { x: 0, y: 0, z: -0.6 },
            pitch: 0,
            yaw: 0,
            head_yaw: 0,
            mode: "normal",
            on_ground: true,
            riding_eid: 0n,
            tick: BigInt(Date.now())
          });
        } catch {}
      }, 300);
    } catch {}
  }, 26 * 60 * 1000);
}

// ===== BOOT =====
log("[STARTUP] process alive");
startBot();

process.on("uncaughtException", err => {
  console.error("[FATAL]", err);
});

process.on("unhandledRejection", err => {
  console.error("[PROMISE]", err);
});
