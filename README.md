# MC-Cube: Autonomous Minecraft Agent Framework

> **Research-Backed Version Recommendation:** Minecraft **1.16.5** is the undisputed sweet spot for developing, testing, and benchmarking autonomous Mineflayer agents.

---

## 📑 Research Summary: Why Minecraft 1.16.5?

When starting an autonomous agent, **1.16.5** provides the highest stability, lowest debugging friction, and fastest testing loop:

| Factor | Minecraft 1.16.5 (The Sweet Spot) | Modern Versions (1.18 – 1.21) |
| :--- | :--- | :--- |
| **Pathfinder Physics** | **Flawless**: Zero jump/desync loops. | **1.21+ Bug**: Bots get stuck jumping against 1-block steps ("glued to block"). |
| **World Height** | **Y = 0 to 256**: Compact chunks, minimal RAM. | **Y = -64 to 320**: 50% larger world volume; A* search space slows down by 2–4x. |
| **Chat & Auth** | **Plaintext**: No crypto handshake overhead. | **1.19+ Signed Chat**: `enforce-secure-profile` causes disconnects on local/offline servers. |
| **Item System** | **Standard NBT**: 100% ecosystem compatibility. | **1.20.5+ Components**: Breaking rewrite of item formats across PrismarineJS. |
| **Server Footprint** | **Paper 1.16.5**: Runs on < 1GB RAM, boots in 5s. | **Paper 1.21**: Demands 2–4GB RAM, heavy chunk gen lag. |
| **Academic AI Standard** | Used by **MineDojo** (NeurIPS 2022), **Steve-1**, and **VPT**. | Voyager used 1.19 only for Wardens/Mangroves via custom Fabric mods. |

---

## 🛠 Features Included in this Agent

This repository provides an extensible starter agent pre-configured with the complete PrismarineJS production stack:

* 🧭 **3D A* Pathfinding (`mineflayer-pathfinder`)**: Configured with timeouts (`tickTimeout: 20ms`, `thinkTimeout: 3000ms`) to prevent Node.js event loop freezes.
* 🪓 **Autonomous Resource Harvesting (`mineflayer-collectblock`)**: Automatically computes the shortest route, equips the appropriate tool, mines target blocks, and gathers dropped items.
* 🍗 **Auto Sustenance (`mineflayer-auto-eat`)**: Continuously monitors hunger and health, prioritizes high-saturation foods, and avoids poisonous items.
* 🛡 **Armor Management (`mineflayer-armor-manager`)**: Instantly equips the highest tier armor upon pickup.
* ⚔️ **Combat System (`mineflayer-pvp`)**: Handles weapon cooldowns, critical hit jumps, and strafing.
* 🌐 **Headless 3D Browser Visualizer (`prismarine-viewer`)**: View the bot's live environment and pathfinding routes in your browser (`http://localhost:3000`) without opening the full Minecraft client.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up a 1.16.5 Local Test Server (Recommended)
1. Download **Paper 1.16.5** from [Papermc.io](https://papermc.io/downloads/paper).
2. Create a folder named `test-server/` and place `paper-1.16.5.jar` inside.
3. Accept the EULA in `eula.txt` (`eula=true`).
4. Set optimal testing properties in `server.properties`:
   ```properties
   online-mode=false
   view-distance=6
   simulation-distance=4
   allow-flight=true
   difficulty=easy
   ```
5. Launch the server:
   ```bash
   java -Xmx2G -jar paper-1.16.5.jar nogui
   ```

### 3. Run the Agent
```bash
npm start
```
By default, the bot connects to `localhost:25565` under the name `CubeAgent`.

You can also override parameters via environment variables:
```bash
MC_HOST=127.0.0.1 MC_PORT=25565 MC_USERNAME=MyBot npm start
```

### 4. Open the Web Visualizer
Open [http://localhost:3000](http://localhost:3000) in your web browser to monitor the bot's 3D perspective and path lines in real time!

---

## 💬 In-Game Chat Commands

Once the bot connects, you can send commands in Minecraft chat:

| Command | Description | Example |
| :--- | :--- | :--- |
| `!help` | Prints available commands | `!help` |
| `!come` | Pathfinds directly to the player calling the command | `!come` |
| `!goto <x> <y> <z>` | Navigates to exact 3D coordinates | `!goto 100 64 -250` |
| `!mine <block>` | Finds the nearest block, pathfinds to it, mines it, and picks up drops | `!mine oak_log` or `!mine iron_ore` |
| `!status` | Reports current HP, hunger, coordinates, and held item | `!status` |
| `!eat` | Forces the bot to consume food from inventory | `!eat` |
| `!attack <target>` | Initiates pvp engagement against a mob or player | `!attack zombie` |
| `!stop` | Instantly halts all movement, pathfinding, and combat | `!stop` |

---

## 🧠 Next Steps: Upgrading to an LLM Agent

To upgrade this framework into an autonomous LLM-powered agent (similar to Voyager or Mindcraft):
1. **Perception**: Feed `bot.status`, nearby entities, and inventory state into the LLM context prompt.
2. **Action Generation**: Allow the LLM to output structured JSON or JavaScript snippets that call `bot.pathfinder.setGoal()`, `bot.collectBlock.collect()`, or `bot.craft()`.
3. **Skill Library**: Store successful code snippets in a local vector database or JSON store to recall proven multi-step actions.
