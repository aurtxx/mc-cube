const { createAgent } = require('./agent');

console.log('====================================================');
console.log('    Autonomous Minecraft Agent (Mineflayer 1.16.5)  ');
console.log('====================================================');

const agent = createAgent();

process.on('SIGINT', () => {
  console.log('\n[Agent] Shutting down gracefully...');
  if (agent) {
    agent.quit();
  }
  process.exit(0);
});
