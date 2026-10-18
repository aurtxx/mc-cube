const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const JAVA_PATH = 'C:\\Program Files\\Eclipse Adoptium\\jdk-8.0.504.1-hotspot\\bin\\java.exe';
const ENV_DIR = path.resolve(__dirname, '..', 'mclauncher-env');
const GAME_DIR = path.join(ENV_DIR, '.minecraft');
const ASSETS_DIR = path.join(ENV_DIR, 'assets');
const NATIVES_DIR = path.join(ENV_DIR, 'natives');
const LIBS_DIR = path.join(ENV_DIR, 'libraries');
const LOG_FILE = path.join(GAME_DIR, 'logs', 'latest.log');
const OUTPUT_LOG = path.join(ENV_DIR, 'client-output.log');

const jarList = [
  'org/lwjgl/lwjgl-glfw/3.2.2/lwjgl-glfw-3.2.2.jar',
  'org/lwjgl/lwjgl-jemalloc/3.2.2/lwjgl-jemalloc-3.2.2.jar',
  'org/lwjgl/lwjgl-openal/3.2.2/lwjgl-openal-3.2.2.jar',
  'org/lwjgl/lwjgl-opengl/3.2.2/lwjgl-opengl-3.2.2.jar',
  'org/lwjgl/lwjgl-stb/3.2.2/lwjgl-stb-3.2.2.jar',
  'org/lwjgl/lwjgl/3.2.2/lwjgl-3.2.2.jar',
  'org/lwjgl/lwjgl-tinyfd/3.2.2/lwjgl-tinyfd-3.2.2.jar',
  'com/mojang/patchy/1.3.9/patchy-1.3.9.jar',
  'oshi-project/oshi-core/1.1/oshi-core-1.1.jar',
  'net/java/dev/jna/jna/4.4.0/jna-4.4.0.jar',
  'net/java/dev/jna/platform/3.4.0/platform-3.4.0.jar',
  'com/ibm/icu/icu4j/66.1/icu4j-66.1.jar',
  'com/mojang/javabridge/1.0.22/javabridge-1.0.22.jar',
  'net/sf/jopt-simple/jopt-simple/5.0.3/jopt-simple-5.0.3.jar',
  'io/netty/netty-all/4.1.25.Final/netty-all-4.1.25.Final.jar',
  'com/google/guava/guava/21.0/guava-21.0.jar',
  'org/apache/commons/commons-lang3/3.5/commons-lang3-3.5.jar',
  'commons-io/commons-io/2.5/commons-io-2.5.jar',
  'commons-codec/commons-codec/1.10/commons-codec-1.10.jar',
  'com/mojang/brigadier/1.0.17/brigadier-1.0.17.jar',
  'com/mojang/datafixerupper/4.0.26/datafixerupper-4.0.26.jar',
  'com/google/code/gson/gson/2.8.0/gson-2.8.0.jar',
  'com/mojang/authlib/2.1.28/authlib-2.1.28.jar',
  'org/apache/commons/commons-compress/1.8.1/commons-compress-1.8.1.jar',
  'org/apache/httpcomponents/httpclient/4.3.3/httpclient-4.3.3.jar',
  'commons-logging/commons-logging/1.1.3/commons-logging-1.1.3.jar',
  'org/apache/httpcomponents/httpcore/4.3.2/httpcore-4.3.2.jar',
  'it/unimi/dsi/fastutil/8.2.1/fastutil-8.2.1.jar',
  'org/apache/logging/log4j/log4j-api/2.17.1/log4j-api-2.17.1.jar',
  'org/apache/logging/log4j/log4j-core/2.17.1/log4j-core-2.17.1.jar',
  'com/mojang/text2speech/1.11.3/text2speech-1.11.3.jar',
  'net/fabricmc/intermediary/1.16.5/intermediary-1.16.5.jar',
  'org/ow2/asm/asm/9.10.1/asm-9.10.1.jar',
  'org/ow2/asm/asm-analysis/9.10.1/asm-analysis-9.10.1.jar',
  'org/ow2/asm/asm-commons/9.10.1/asm-commons-9.10.1.jar',
  'org/ow2/asm/asm-tree/9.10.1/asm-tree-9.10.1.jar',
  'org/ow2/asm/asm-util/9.10.1/asm-util-9.10.1.jar',
  'net/fabricmc/sponge-mixin/0.17.4+mixin.0.8.7/sponge-mixin-0.17.4+mixin.0.8.7.jar',
  'net/fabricmc/fabric-loader/0.19.5/fabric-loader-0.19.5.jar',
  'com/mojang/minecraft/1.16.5/minecraft-1.16.5-client.jar'
];

const classPath = jarList.map(j => path.join(LIBS_DIR, j)).join(';');

function launchMinecraft(username = 'AURTX') {
  console.log('======================================================');
  console.log('    Launching Standalone Minecraft 1.16.5 Client      ');
  console.log('    Java: Java 8 (Adoptium Temurin 1.8.0_504)         ');
  console.log(`    Environment: ${ENV_DIR}                          `);
  console.log(`    Log Path: ${LOG_FILE}                            `);
  console.log('======================================================');

  const jvmArgs = [
    '-Xms512m',
    '-Xmx4096m',
    '-Duser.language=en',
    `-Djava.library.path=${NATIVES_DIR}`,
    '-cp',
    classPath,
    'net.fabricmc.loader.launch.knot.KnotClient',
    '--version', '1.16.5',
    '--gameDir', GAME_DIR,
    '--assetsDir', ASSETS_DIR,
    '--assetIndex', '1.16',
    '--username', username,
    '--accessToken', '0'
  ];

  const out = fs.openSync(OUTPUT_LOG, 'w');

  const child = spawn(JAVA_PATH, jvmArgs, {
    cwd: GAME_DIR,
    detached: true,
    stdio: ['ignore', out, out]
  });

  child.unref();

  console.log(`[Launcher] Minecraft GUI launched successfully (PID: ${child.pid}).`);
  return { child, logFile: LOG_FILE };
}

if (require.main === module) {
  launchMinecraft();
}

module.exports = { launchMinecraft, LOG_FILE, ENV_DIR, classPath };
