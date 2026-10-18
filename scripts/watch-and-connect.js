const fs = require('fs');
const path = require('path');
const { createAgent } = require('../src/agent');
const config = require('../config');

// Locations to watch
const CANDIDATE_LOGS = [
  path.resolve(__dirname, '..', 'mclauncher-env', '.minecraft', 'logs', 'latest.log'),
  'C:\\Users\\aurtx\\AppData\\Roaming\\PolyMC\\instances\\mc-cube\\.minecraft\\logs\\latest.log'
];

// Check if a direct port was provided via CLI
const directPort = process.argv[2] && !isNaN(parseInt(process.argv[2], 10)) ? parseInt(process.argv[2], 10) : null;

if (directPort) {
  console.log(`[AutoConnect] Direct port ${directPort} specified. Connecting agent immediately...`);
  createAgent({ port: directPort });
} else {
  startLogWatcher();
}

function startLogWatcher() {
  console.log('======================================================');
  console.log('   LAN World Auto-Detector & Agent Connector         ');
  console.log('======================================================');
  console.log('[AutoConnect] Watching Minecraft client logs for LAN broadcast...');
  console.log('[AutoConnect] In Minecraft, pause the game and click "Open to LAN".');

  let activeBot = null;
  let logFile = CANDIDATE_LOGS.find(f => fs.existsSync(f)) || CANDIDATE_LOGS[0];

  console.log(`[AutoConnect] Actively monitoring: ${logFile}`);

  let lastSize = 0;
  if (fs.existsSync(logFile)) {
    lastSize = fs.statSync(logFile).size;
  }

  const checkInterval = setInterval(() => {
    if (!fs.existsSync(logFile)) return;

    const stats = fs.statSync(logFile);
    if (stats.size > lastSize) {
      const stream = fs.createReadStream(logFile, {
        start: lastSize,
        end: stats.size,
        encoding: 'utf8'
      });

      lastSize = stats.size;

      stream.on('data', (chunk) => {
        const lines = chunk.split('\n');
        for (const line of lines) {
          // Detect: "Started serving on 2390" or "Local game hosted on port 2390"
          const match = line.match(/(?:Started serving on|Local game hosted on port)\s+(\d{4,5})/i);
          if (match && !activeBot) {
            const port = parseInt(match[1], 10);
            console.log(`\n>>> [LAN DETECTED] Minecraft hosted on port: ${port}! <<<`);
            console.log(`[AutoConnect] Connecting Mineflayer agent to localhost:${port}...`);
            activeBot = createAgent({ port });
            clearInterval(checkInterval);
            break;
          }
        }
      });
    } else if (stats.size < lastSize) {
      // Log was rotated/re-created on client restart
      lastSize = 0;
    }
  }, 1000);

  process.on('SIGINT', () => {
    clearInterval(checkInterval);
    if (activeBot) activeBot.quit();
    process.exit(0);
  });
}
