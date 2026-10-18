module.exports = {
  // Connection details
  host: process.env.MC_HOST || 'localhost',
  port: parseInt(process.env.MC_PORT || '25565', 10),
  username: process.env.MC_USERNAME || 'CubeAgent',
  version: process.env.MC_VERSION || '1.16.5', // Golden standard version for agent testing

  // Target player to mirror and outperform
  targetPlayer: process.env.TARGET_PLAYER || 'AURTX',

  // Local model endpoint (Ollama / LM Studio / vLLM / llama.cpp)
  localModel: {
    baseUrl: process.env.LOCAL_MODEL_URL || 'http://localhost:11434/v1',
    model: process.env.LOCAL_MODEL_NAME || 'qwen2.5-coder:0.5b',
    apiKey: process.env.LOCAL_MODEL_KEY || 'ollama',
    temperature: 0.2
  },

  // Web viewer (prismarine-viewer) port for headless browser monitoring
  viewerPort: parseInt(process.env.VIEWER_PORT || '3000', 10),
  enableViewer: true,

  // Pathfinder performance tuning (optimized for 1.16.5)
  pathfinder: {
    thinkTimeout: 3000,   // Max ms spent searching for a path
    tickTimeout: 20,      // Max ms spent searching per 50ms game tick
    searchRadius: 64,     // Limit search radius in blocks
    allowParkour: false,  // Disabled by default to reduce erratic movements & anti-cheat flags
    allowSprinting: true,
    canDig: true
  }
};
