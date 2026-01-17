import { createClient, ping } from 'bedrock-protocol'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'

dotenv.config()

const BOT_CONFIG = {
  host: 'play.sigmapallukka.xyz',
  port: 20465,
  username: 'BedrockBot',
  auth: 'microsoft',
  profilesFolder: './auth',
  version: 'latest'
}

const TELEGRAM_TOKEN = '8447340973:AAG2DVWC0KnsBlOkhRFVncXvmJo3N0LOIns'
const TELEGRAM_CHAT = '8447340973'
const PORT = process.env.PORT || 3000

if (!fs.existsSync('./auth')) fs.mkdirSync('./auth', { recursive: true })

const app = express()
const server = createServer(app)
const io = new Server(server)

let client = null
let serverAlive = false
let lastTelegram = 0
let movementTimer = null

let stats = {
  status: 'Idle',
  uptime: 0,
  reconnects: 0,
  memory: 0,
  lastUpdate: Date.now()
}

function updateStats() {
  const mem = process.memoryUsage()
  stats.memory = (mem.heapUsed / 1024 / 1024).toFixed(2)
  stats.lastUpdate = Date.now()
  io.emit('stats', stats)
}
setInterval(updateStats, 1000)

async function sendTelegram(msg) {
  const now = Date.now()
  if (now - lastTelegram < 60 * 60 * 1000) return
  lastTelegram = now

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT,
        text: msg
      })
    })
  } catch {}
}

function startMovement() {
  stopMovement()
  movementTimer = setInterval(() => {
    if (!client || !client.entityId) return
    try {
      client.queue('player_action', {
        runtime_id: client.entityId,
        action: 'start_sneak',
        position: { x: 0, y: 0, z: 0 },
        face: 0
      })
      setTimeout(() => {
        try {
          client.queue('player_action', {
            runtime_id: client.entityId,
            action: 'stop_sneak',
            position: { x: 0, y: 0, z: 0 },
            face: 0
          })
        } catch {}
      }, 200)
    } catch {}
  }, 26 * 60 * 1000)
}

function stopMovement() {
  if (movementTimer) clearInterval(movementTimer)
  movementTimer = null
}

function createBot() {
  if (client || !serverAlive) return

  try {
    stats.status = 'Joining'
    client = createClient(BOT_CONFIG)

    client.on('join', () => {
      stats.status = 'Online'
      stats.uptime = Date.now()
      startMovement()
    })

    client.on('spawn', () => {
      stats.status = 'In-Game'
    })

    const cleanup = () => {
      stopMovement()
      client = null
      stats.status = 'Disconnected'
    }

    client.on('close', cleanup)
    client.on('disconnect', cleanup)
    client.on('error', cleanup)
  } catch {
    client = null
  }
}

async function watchdog() {
  try {
    await ping({ host: BOT_CONFIG.host, port: BOT_CONFIG.port })
    if (!serverAlive) {
      serverAlive = true
      createBot()
    }
  } catch {
    if (serverAlive) {
      serverAlive = false
      if (client) {
        try { client.close() } catch {}
        client = null
      }
      await sendTelegram('Vittu servus taas räjähtäny 💔')
    }
  }
}

setInterval(watchdog, 49000)

server.listen(PORT, () => {
  console.log('Watchdog online')
  watchdog()
})
