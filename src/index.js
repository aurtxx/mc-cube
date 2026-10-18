const { createAgent } = require('./agent');

console.log('====================================================');
console.log('    Autonomous Minecraft Agent (Mineflayer 1.16.5)  ');
console.log('====================================================');

const customPort = process.argv[2] && !isNaN(parseInt(process.argv[2], 10))
  ? parseInt(process.argv[2], 10)
  : undefined;

const agent = createAgent(customPort ? { port: customPort } : {});

process.on('SIGINT', () => {
  console.log('\n[Agent] Shutting down gracefully...');
  if (agent) {
    agent.quit();
  }
  process.exit(0);
});
