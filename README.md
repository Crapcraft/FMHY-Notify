# fmhy-rss-discord

Polls the [FMHY Tracker](https://fmhy-tracker.pages.dev/) RSS feed and forwards new entries to a Discord channel via webhook. Runs as a lightweight background process — no database, no framework, just Node.js.

## Features

- Posts each new RSS item as a Discord embed with colour-coded status (green = new, yellow = updated, red = removed/dead)
- Respects Discord rate limits automatically
- Caps at 10 posts per poll to avoid flooding after downtime
- On first run, seeds existing items silently so you only see *new* updates going forward
- State persists across restarts in a local `rss-seen.json` file

## Requirements

- Node.js 18 or newer
- A Discord webhook URL

## Setup

```bash
# 1. Clone / download and install dependencies
git clone https://github.com/YOUR_USERNAME/fmhy-rss-discord.git
cd fmhy-rss-discord
npm install

# 2. Create your config
cp .env.example .env
# Edit .env and set DISCORD_WEBHOOK_URL to your webhook URL

# 3. Run
npm start
```

To get a webhook URL: open your Discord server → channel settings → **Integrations** → **Webhooks** → **New Webhook**, then copy the URL.

## Configuration

All options live in `.env` (copy from `.env.example`):

| Variable | Required | Default | Description |
|---|---|---|---|
| `DISCORD_WEBHOOK_URL` | ✅ | — | Discord webhook URL |
| `FEED_URL` | | `https://fmhy-tracker.pages.dev/feed.xml` | RSS feed to watch |
| `POLL_INTERVAL_MIN` | | `15` | Polling interval in minutes |
| `STATE_FILE` | | `./rss-seen.json` | Path for seen-items state |

## Running in the background

### Option 1 — PM2 (recommended, cross-platform)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save             # persist across reboots
pm2 startup          # follow the printed instructions once
```

Useful commands:
```bash
pm2 logs fmhy-rss    # live logs
pm2 status           # process list
pm2 stop fmhy-rss    # stop
pm2 restart fmhy-rss # restart
```

### Option 2 — systemd (Linux)

Edit `fmhy-rss.service`: set `User`, `WorkingDirectory`, and the path in `ExecStart` to match your system, then:

```bash
sudo cp fmhy-rss.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fmhy-rss
sudo journalctl -u fmhy-rss -f   # follow logs
```

### Option 3 — quick background process

```bash
nohup npm start > fmhy-rss.log 2>&1 &
```

## File structure

```
fmhy-rss-discord/
├── rss-to-discord.js   # main script
├── package.json
├── ecosystem.config.js # PM2 config
├── fmhy-rss.service    # systemd unit
├── .env.example        # config template
└── .gitignore
```

`rss-seen.json` is created automatically on first run to track which items have been posted. It is excluded from git.

## License

MIT
