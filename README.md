# Departman Of Justice

Minimal Discord bot for **Render Web Service**. It connects to Discord, sets an online presence and serves an HTTP health endpoint. No bot commands are installed.

## Render settings

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`
- Environment Variable: `DISCORD_TOKEN` = token from Discord Developer Portal
- PORT is provided by Render (local fallback: 10000).

## Important

Set the Discord application/bot display name to **Departman Of Justice** in the Discord Developer Portal; the code cannot reliably rename the application itself.

Free Render Web Services may sleep when inactive, so 24/7 Discord uptime requires a non-sleeping instance. Do not publish your token in GitHub.
