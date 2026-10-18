const path = require('path');
const { spawn } = require('child_process');

const JAVA_PATH = 'C:\\Program Files\\Eclipse Adoptium\\jdk-8.0.504.1-hotspot\\bin\\java.exe';
const ENV_DIR = path.resolve(__dirname, '..', 'mclauncher-env');
const GAME_DIR = path.join(ENV_DIR, '.minecraft');
const ASSETS_DIR = path.join(ENV_DIR, 'assets');
const NATIVES_DIR = path.join(ENV_DIR, 'natives');
const LIBS_DIR = path.join(ENV_DIR, 'libraries');

const { classPath } = require('./launch-client');

const args = [
  '-Xms512m',
  '-Xmx2048m',
  '-Duser.language=en',
  `-Djava.library.path=${NATIVES_DIR}`,
  '-cp',
  classPath,
  'net.fabricmc.loader.launch.knot.KnotClient',
  '--version', '1.16.5',
  '--gameDir', GAME_DIR,
  '--assetsDir', ASSETS_DIR,
  '--assetIndex', '1.16',
  '--username', 'AURTX',
  '--accessToken', '0'
];

console.log('Spawning java process...');
const child = spawn(JAVA_PATH, args, { cwd: GAME_DIR });

child.stdout.on('data', d => process.stdout.write(d.toString()));
child.stderr.on('data', d => process.stderr.write(d.toString()));

child.on('exit', (code, sig) => {
  console.log(`\nProcess exited with code ${code}, signal: ${sig}`);
  process.exit(code || 0);
});
