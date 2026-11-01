const http = require('node:http');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN environment variable is missing.');
  process.exit(1);
}

const port = Number(process.env.PORT || 10000);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(client.isReady() ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ service: 'Departman Of Justice', discord: client.isReady() ? 'connected' : 'disconnected' }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});
server.listen(port, '0.0.0.0', () => console.log('Health server listening on port', port));

client.once('ready', () => {
  console.log('Departman Of Justice online:', client.user.tag);
  client.user.setPresence({ activities: [{ name: 'anevrix yapmıştır', type: ActivityType.Playing }], status: 'online' });
});
client.on('error', (error) => console.error('Discord client error:', error));
client.login(token).catch((error) => {
  console.error('Discord login failed:', error.message);
  process.exit(1);
});

const shutdown = () => {
  server.close();
  client.destroy();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
