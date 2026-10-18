const { spawn } = require('child_process');
const path = require('path');

const ENV_DIR = path.resolve(__dirname, '..', 'mclauncher-env');
const BATCH_FILE = path.join(ENV_DIR, 'launch.bat');
const LOG_FILE = path.join(ENV_DIR, '.minecraft', 'logs', 'latest.log');

function launchMinecraft() {
  console.log('======================================================');
  console.log('    Launching Standalone Minecraft 1.16.5 Client      ');
  console.log('    Java: Java 8 (Adoptium Temurin 1.8.0_504)         ');
  console.log(`    Environment: ${ENV_DIR}                          `);
  console.log(`    Log Path: ${LOG_FILE}                            `);
  console.log('======================================================');

  const child = spawn('cmd.exe', ['/c', BATCH_FILE], {
    cwd: ENV_DIR,
    detached: true,
    stdio: 'ignore'
  });

  child.unref();

  console.log('[Launcher] Minecraft launched successfully in background.');
  return { child, logFile: LOG_FILE };
}

if (require.main === module) {
  launchMinecraft();
}

module.exports = { launchMinecraft, LOG_FILE, ENV_DIR };
