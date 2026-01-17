# Bedrock AFK Bot (Fly.io)

This is a hardened Bedrock AFK bot using `bedrock-protocol`.

Features:
- Microsoft device login (persisted across restarts)
- Pings server every 49s and joins when alive
- Disconnects when server goes down
- Telegram alert (max once/hour) when server is down
- AFK movement + 26min crouch/back step
- Process never dies on transient errors

## Deploy

1. Create volume:
   fly volumes create authdata --size 1

2. Deploy:
   fly deploy

First boot will print a Microsoft device login code in logs.
Complete it once. It will be remembered in /data/auth.
