const { createAgent } = require('./agent');
const { createMcpServer } = require('./mcp-server');
const { LocalBrain } = require('./local-brain');

console.log('====================================================');
console.log('    Autonomous Minecraft Agent (Mineflayer 1.16.5)  ');
console.log('    MCP Tool-Layer & Local Brain Active             ');
console.log('====================================================');

const customPort = process.argv[2] && !isNaN(parseInt(process.argv[2], 10))
  ? parseInt(process.argv[2], 10)
  : undefined;

const agent = createAgent(customPort ? { port: customPort } : {});

let brain = null;

agent.once('spawn', () => {
  // Initialize MCP layer
  const { tools } = createMcpServer(agent);
  console.log(`[MCP] ${tools.length} tool definitions registered for Local Model.`);

  // Start Autonomous Local Brain loop (evaluating decisions every 4s)
  brain = new LocalBrain(agent, tools);
  brain.start(4000);
});

process.on('SIGINT', () => {
  console.log('\n[Agent] Shutting down gracefully...');
  if (brain) {
    brain.stop();
  }
  if (agent) {
    agent.quit();
  }
  process.exit(0);
});
