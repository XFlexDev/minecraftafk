import { createClient } from 'bedrock-protocol'
import fs from 'fs'
import path from 'path'
import https from 'https'

// ---- CONFIG ----
const HOST = 'play.sigmapallukka.xyz'
const PORT = 20465
const EMAIL = 'tissimattolou@outlook.com'
const VERSION = '1.21.111'

// Telegram
const TG_TOKEN = '8447340973:AAG2DVWC0KnsBlOkhRFVncXvmJo3N0LOIns'
const TG_CHAT = null // botin eka viesti kertoo chat id:n jos tää on null

// Persistent auth dir (Fly volume -> /data)
const AUTH_DIR = '/data/mc'

// ---- STATE ----
let client = null
let lastTelegram = 0
let reconnectTimer = null
let pingTimer = null

// ---- HELPERS ----
function log(...a) {
  console.log(new Date().toISOString(), ...a)
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

function sendTelegram(text) {
  const now = Date.now()
  if (now - lastTelegram < 60 * 60 * 1000) return // kerran tunnissa
  lastTelegram = now

  const msg = encodeURIComponent(text)
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT || '@MineServerStatus'}&text=${msg}`

  https.get(url).on('error', () => {})
}

function scheduleReconnect(ms) {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    startBot()
  }, ms)
}

function startPingLoop() {
  if (pingTimer) return
  pingTimer = setInterval(() => {
    if (client) return
    log('[PING] server unreachable')
    sendTelegram('Vittu servus taas räjähtäny 💔')
    startBot()
  }, 49_000)
}

// ---- BOT ----
function startBot() {
  ensureDir(AUTH_DIR)

  if (client) {
    try { client.close() } catch {}
    client = null
  }

  log('[BOT] starting…')

  try {
    client = createClient({
      host: HOST,
      port: PORT,
      username: EMAIL,
      auth: 'microsoft',
      profilesFolder: AUTH_DIR,
      version: VERSION
    })

    client.on('connect', () => {
      log('[NET] socket connected')
    })

    client.on('join', () => {
      log('[OK] joined server')
    })

    client.on('spawn', () => {
      log('[OK] spawned')
      startAFK()
    })

    client.on('disconnect', (p) => {
      log('[DISCONNECT]', p?.message || '')
      client = null
      scheduleReconnect(15_000)
    })

    client.on('close', () => {
      log('[CLOSE]')
      client = null
      scheduleReconnect(15_000)
    })

    client.on('error', (e) => {
      log('[ERROR]', e.message)
      if (String(e.message).includes('token') || String(e.message).includes('auth')) {
        log('[AUTH] token invalid -> reauth needed')
        sendTelegram('Microsoft-token hajosi, vaatii uuden loginin')
      }
    })
  } catch (e) {
    log('[FATAL]', e.message)
    client = null
    scheduleReconnect(30_000)
  }
}

function startAFK() {
  setInterval(() => {
    if (!client || !client.entityId) return
    try {
      client.queue('player_action', {
        runtime_id: client.entityId,
        action: 'start_sneak',
        position: { x: 0, y: 0, z: 0 },
        face: 0
      })
      setTimeout(() => {
        client.queue('player_action', {
          runtime_id: client.entityId,
          action: 'stop_sneak',
          position: { x: 0, y: 0, z: 0 },
          face: 0
        })
      }, 300)
    } catch {}
  }, 26 * 60 * 1000)
}

// ---- BOOT ----
startPingLoop()
startBot()

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
