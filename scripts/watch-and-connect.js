const fs = require('fs');
const path = require('path');
const { createAgent } = require('../src/agent');
const { createMcpServer } = require('../src/mcp-server');
const { LocalBrain } = require('../src/local-brain');
const config = require('../config');

const CANDIDATE_LOGS = [
  path.resolve(__dirname, '..', 'mclauncher-env', '.minecraft', 'logs', 'latest.log'),
  'C:\\Users\\aurtx\\AppData\\Roaming\\PolyMC\\instances\\mc-cube\\.minecraft\\logs\\latest.log'
];

let brain = null;
let activeBot = null;

function setupAgentWithBrain(port) {
  if (activeBot) return;
  activeBot = createAgent({ port });

  activeBot.once('spawn', () => {
    const { tools } = createMcpServer(activeBot);
    console.log(`[MCP] ${tools.length} tool definitions registered for Local Model.`);

    brain = new LocalBrain(activeBot, tools);
    brain.start(4000);
  });

  activeBot.on('end', () => {
    console.log('[AutoConnect] Bot disconnected. Reconnecting in 3 seconds...');
    if (brain) { brain.stop(); brain = null; }
    activeBot = null;
    setTimeout(() => {
      setupAgentWithBrain(port);
    }, 3000);
  });

  activeBot.on('kicked', (reason) => {
    console.log('[AutoConnect] Bot kicked from server:', reason);
  });

  return activeBot;
}

// Check if a direct port was provided via CLI
const directPort = process.argv[2] && !isNaN(parseInt(process.argv[2], 10)) ? parseInt(process.argv[2], 10) : null;

if (directPort) {
  console.log(`[AutoConnect] Direct port ${directPort} specified. Connecting agent immediately...`);
  setupAgentWithBrain(directPort);
} else {
  startLogWatcher();
}

function startLogWatcher() {
  console.log('======================================================');
  console.log('   LAN World Auto-Detector & Agent Connector         ');
  console.log('   Tracking & Competing with Player: ' + config.targetPlayer);
  console.log('======================================================');
  console.log('[AutoConnect] Watching for Minecraft LAN broadcasts across all instances...');
  console.log('[AutoConnect] In Minecraft, pause the game and click "Open to LAN".');

  const fileSizes = {};

  for (const file of CANDIDATE_LOGS) {
    if (fs.existsSync(file)) {
      fileSizes[file] = fs.statSync(file).size;
      console.log(`[AutoConnect] Actively watching: ${file}`);
    } else {
      fileSizes[file] = 0;
    }
  }

  const checkInterval = setInterval(() => {
    if (activeBot) return;

    for (const file of CANDIDATE_LOGS) {
      if (!fs.existsSync(file)) continue;

      const stats = fs.statSync(file);
      const prevSize = fileSizes[file] || 0;

      if (stats.size > prevSize) {
        const stream = fs.createReadStream(file, {
          start: prevSize,
          end: stats.size,
          encoding: 'utf8'
        });

        fileSizes[file] = stats.size;

        stream.on('data', (chunk) => {
          const lines = chunk.split('\n');
          for (const line of lines) {
            const match = line.match(/(?:Started serving on|Local game hosted on port)\s+(\d{4,5})/i);
            if (match && !activeBot) {
              const port = parseInt(match[1], 10);
              console.log(`\n>>> [LAN DETECTED] Minecraft hosted on port: ${port}! (from ${path.basename(path.dirname(path.dirname(file)))}) <<<`);
              console.log(`[AutoConnect] Connecting Mineflayer agent with MCP & LocalBrain to localhost:${port}...`);
              setupAgentWithBrain(port);
              clearInterval(checkInterval);
              break;
            }
          }
        });
      } else if (stats.size < prevSize) {
        fileSizes[file] = 0;
      }
    }
  }, 1000);

  process.on('SIGINT', () => {
    clearInterval(checkInterval);
    if (brain) brain.stop();
    if (activeBot) activeBot.quit();
    process.exit(0);
  });
}
