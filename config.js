module.exports = {
  // Connection details
  host: process.env.MC_HOST || 'localhost',
  port: parseInt(process.env.MC_PORT || '25565', 10),
  username: process.env.MC_USERNAME || 'CubeAgent',
  version: process.env.MC_VERSION || '1.16.5', // Golden standard version for agent testing

  // Web viewer (prismarine-viewer) port for headless browser monitoring
  viewerPort: parseInt(process.env.VIEWER_PORT || '3000', 10),
  enableViewer: true,

  // Pathfinder performance tuning (optimized for 1.16.5)
  pathfinder: {
    thinkTimeout: 3000,   // Max ms spent searching for a path
    tickTimeout: 20,      // Max ms spent searching per 50ms game tick (prevents event loop lag)
    searchRadius: 64,     // Limit search radius in blocks
    allowParkour: false,  // Disabled by default to reduce erratic movements & anti-cheat flags
    allowSprinting: true,
    canDig: true
  }
};
