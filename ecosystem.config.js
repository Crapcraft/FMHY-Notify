// PM2 process config — https://pm2.keymetrics.io/docs/usage/application-declaration/
// Usage: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name:          'fmhy-rss',
      script:        'rss-to-discord.js',
      // Restart automatically if the process crashes, with a 10-second backoff
      restart_delay: 10_000,
      // PM2 will pick up DISCORD_WEBHOOK_URL (and any other vars) from your .env file
      // automatically because the script loads it on startup.
      // You can also set env vars here instead of using a .env file:
      // env: {
      //   DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/…',
      // },
    },
  ],
};
