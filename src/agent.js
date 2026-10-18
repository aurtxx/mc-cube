const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const collectBlock = require('mineflayer-collectblock').plugin;
const autoEat = require('mineflayer-auto-eat').plugin;
const armorManager = require('mineflayer-armor-manager');
const pvp = require('mineflayer-pvp').plugin;
const mcDataBuilder = require('minecraft-data');
const { Vec3 } = require('vec3');
let mineflayerViewer = null;
try {
  mineflayerViewer = require('prismarine-viewer').mineflayer;
} catch (_) {
  // Optional dependency: canvas not present
}
const config = require('../config');

function createAgent(customOptions = {}) {
  const options = {
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    ...customOptions
  };

  const targetPlayerName = options.targetPlayer || config.targetPlayer || 'AURTX';

  console.log(`[Agent] Initializing Mineflayer bot for Minecraft ${options.version}...`);
  console.log(`[Agent] Target server: ${options.host}:${options.port} as ${options.username}`);
  console.log(`[Agent] Tracking and mirroring player: ${targetPlayerName}`);

  const bot = mineflayer.createBot(options);

  // Load plugins
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(autoEat);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(pvp);

  let mcData;
  let defaultMovements;

  // Player Tracking & Progression State
  bot.targetPlayerName = targetPlayerName;
  bot.playerTracker = {
    username: targetPlayerName,
    online: false,
    position: null,
    distance: null,
    heldItem: null,
    lastSeen: Date.now(),
    recentActions: [],
    recentChats: [],
    score: {
      woodLogs: 0,
      ores: 0,
      kills: 0
    }
  };

  bot.botScore = {
    woodLogs: 0,
    ores: 0,
    kills: 0
  };

  function countItem(name) {
    return bot.inventory.items()
      .filter(item => item.name.includes(name))
      .reduce((acc, item) => acc + item.count, 0);
  }

  // Periodic Player Perception Loop
  function updatePlayerPerception() {
    const playerObj = Object.values(bot.players).find(p => p.username.toLowerCase() === targetPlayerName.toLowerCase());
    if (playerObj) {
      bot.playerTracker.online = true;
      const entity = playerObj.entity;
      if (entity && entity.position && bot.entity && bot.entity.position) {
        bot.playerTracker.position = entity.position.clone();
        bot.playerTracker.distance = Math.round(bot.entity.position.distanceTo(entity.position));
        bot.playerTracker.heldItem = entity.heldItem ? entity.heldItem.name : 'empty';
        bot.playerTracker.lastSeen = Date.now();

        if (bot.playerTracker.heldItem.includes('log')) {
          bot.playerTracker.recentActions.unshift(`Harvesting ${bot.playerTracker.heldItem}`);
        } else if (bot.playerTracker.heldItem.includes('ore') || bot.playerTracker.heldItem.includes('raw_')) {
          bot.playerTracker.recentActions.unshift(`Mining ${bot.playerTracker.heldItem}`);
        }
        if (bot.playerTracker.recentActions.length > 5) {
          bot.playerTracker.recentActions.pop();
        }
      } else {
        bot.playerTracker.distance = 999;
      }
    } else {
      bot.playerTracker.online = false;
    }

    // Refresh bot's current scores
    bot.botScore.woodLogs = countItem('log');
    bot.botScore.ores = countItem('ore') + countItem('raw_') + countItem('ingot');
  }

  bot.once('spawn', () => {
    console.log('[Agent] Bot successfully spawned into the world!');
    mcData = mcDataBuilder(bot.version);

    defaultMovements = new Movements(bot, mcData);
    defaultMovements.allowParkour = config.pathfinder.allowParkour;
    defaultMovements.allowSprinting = config.pathfinder.allowSprinting;
    defaultMovements.canDig = config.pathfinder.canDig;

    bot.pathfinder.setMovements(defaultMovements);
    bot.pathfinder.thinkTimeout = config.pathfinder.thinkTimeout;
    bot.pathfinder.tickTimeout = config.pathfinder.tickTimeout;
    bot.pathfinder.searchRadius = config.pathfinder.searchRadius;

    bot.autoEat.options = {
      priority: 'foodPoints',
      startAt: 14,
      bannedFood: ['rotten_flesh', 'pufferfish', 'poisonous_potato', 'spider_eye']
    };

    if (config.enableViewer && mineflayerViewer) {
      try {
        mineflayerViewer(bot, { port: config.viewerPort, firstPerson: false });
        console.log(`[Viewer] Web 3D visualizer running at http://localhost:${config.viewerPort}`);
      } catch (err) {
        console.warn(`[Viewer] Could not start prismarine-viewer: ${err.message}`);
      }
    }

    // --- ROBUST PACKET & PHYSICS PROTECTION ---
    // Minecraft 1.16.5 kicks clients with "Invalid move player packet received" if:
    // 1) Any coordinate/angle is NaN or Infinity
    // 2) Client sends movement packets while server awaits teleport_confirm
    // 3) Delta distance per tick exceeds 10 blocks (e.g. violent knockback or bad physics)
    let lastValidPos = null;
    let lastValidYaw = 0;
    let lastValidPitch = 0;
    let awaitingTeleport = false;

    bot._client.on('position', (packet) => {
      if (packet.teleportId != null) {
        awaitingTeleport = true;
      }
    });

    const origWrite = bot._client.write.bind(bot._client);
    bot._client.write = (name, params) => {
      if (name === 'teleport_confirm') {
        awaitingTeleport = false;
      }

      // Suppress movement packets if server is waiting for teleport confirmation
      if (awaitingTeleport && (name === 'position' || name === 'position_look' || name === 'look' || name === 'flying')) {
        return;
      }

      // Sanitize coordinates and clamp excessive jumps
      if (name === 'position' || name === 'position_look') {
        if (params.x == null || isNaN(params.x) || !isFinite(params.x)) {
          params.x = lastValidPos ? lastValidPos.x : (bot.entity ? bot.entity.position.x : 0);
        }
        if (params.y == null || isNaN(params.y) || !isFinite(params.y)) {
          params.y = lastValidPos ? lastValidPos.y : (bot.entity ? bot.entity.position.y : 64);
        }
        if (params.z == null || isNaN(params.z) || !isFinite(params.z)) {
          params.z = lastValidPos ? lastValidPos.z : (bot.entity ? bot.entity.position.z : 0);
        }

        if (lastValidPos) {
          const dx = params.x - lastValidPos.x;
          const dy = params.y - lastValidPos.y;
          const dz = params.z - lastValidPos.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq > 64) {
            params.x = lastValidPos.x + Math.max(-4, Math.min(4, dx));
            params.y = lastValidPos.y + Math.max(-4, Math.min(4, dy));
            params.z = lastValidPos.z + Math.max(-4, Math.min(4, dz));
          }
        }
        lastValidPos = { x: params.x, y: params.y, z: params.z };
      }

      if (name === 'look' || name === 'position_look') {
        if (params.yaw == null || isNaN(params.yaw) || !isFinite(params.yaw)) {
          params.yaw = lastValidYaw;
        } else {
          lastValidYaw = params.yaw;
        }
        if (params.pitch == null || isNaN(params.pitch) || !isFinite(params.pitch)) {
          params.pitch = lastValidPitch;
        } else {
          lastValidPitch = params.pitch;
        }
      }

      return origWrite(name, params);
    };

    // Guard lookAt & look from NaN inputs
    const originalLookAt = bot.lookAt.bind(bot);
    bot.lookAt = async (point, force) => {
      if (!point || isNaN(point.x) || isNaN(point.y) || isNaN(point.z)) {
        return;
      }
      return originalLookAt(point, force);
    };

    const originalLook = bot.look.bind(bot);
    bot.look = async (yaw, pitch, force) => {
      if (isNaN(yaw) || isNaN(pitch) || !isFinite(yaw) || !isFinite(pitch)) {
        return;
      }
      return originalLook(yaw, pitch, force);
    };

    // Auto-swim: prevent drowning when in water, but DO NOT hold jump permanently on land
    let wasInWater = false;
    bot.on('physicsTick', () => {
      if (!bot.entity) return;
      if (bot.entity.isInWater) {
        bot.setControlState('jump', true);
        wasInWater = true;
      } else if (wasInWater) {
        bot.setControlState('jump', false);
        wasInWater = false;
      }
    });

    // Knockback & Damage Safety: clear control states and pause pathfinding to avoid movement conflict kicks
    bot.on('entityHurt', (entity) => {
      if (entity === bot.entity) {
        console.log(`[Agent] Bot took damage! Health: ${bot.health}/20`);
        if (bot.pathfinder && bot.pathfinder.isMoving()) {
          bot.pathfinder.stop();
        }
        bot.clearControlStates();
      }
    });

    bot._client.on('packet', (data, meta) => {
      if (meta.name === 'entity_velocity' && data.entityId === bot.entity?.id) {
        bot.clearControlStates();
      }
    });

    bot.on('death', () => {
      console.log('[Agent] Bot died! Clearing actions and respawning...');
      bot.actions.stopAll();
    });

    bot.chat(`CubeAgent online! Tracking ${targetPlayerName}. Type "hi" or "help" for commands.`);

    // Start perception loop
    setInterval(updatePlayerPerception, 1000);
  });

  // Track player collection events
  bot.on('playerCollect', (collector, collected) => {
    if (collector.username === targetPlayerName) {
      const itemEntity = collected;
      const itemName = itemEntity?.metadata?.[7]?.name || 'resource';
      bot.playerTracker.recentActions.unshift(`Collected ${itemName}`);
      if (itemName.includes('log')) bot.playerTracker.score.woodLogs++;
      if (itemName.includes('ore') || itemName.includes('raw')) bot.playerTracker.score.ores++;
    } else if (collector.username === bot.username) {
      const itemName = collected?.metadata?.[7]?.name || 'resource';
      if (itemName.includes('log')) bot.botScore.woodLogs++;
      if (itemName.includes('ore') || itemName.includes('raw')) bot.botScore.ores++;
    }
  });

  // Chat tracking & natural language command handling
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;

    if (username.toLowerCase() === targetPlayerName.toLowerCase()) {
      bot.playerTracker.recentChats.unshift({
        message,
        timestamp: Date.now()
      });
      if (bot.playerTracker.recentChats.length > 5) {
        bot.playerTracker.recentChats.pop();
      }
    }

    handleIncomingChat(username, message);
  });

  // Natural Language Intent Parser
  function parseIntent(rawMessage) {
    const msg = rawMessage.replace(/^[!.\/]/, '').trim().toLowerCase();

    // 1. Crafting intents
    const craftMatch = msg.match(/(?:craft|create|make|build)\s+(?:a\s+|an\s+)?([a-z0-9_ ]+)/i);
    if (craftMatch) {
      const rawTarget = craftMatch[1].trim();
      if (rawTarget.includes('table') || rawTarget.includes('workbench')) return { intent: 'craft', item: 'crafting_table', count: 1 };
      if (rawTarget.includes('plank')) return { intent: 'craft', item: 'oak_planks', count: 4 };
      if (rawTarget.includes('stick')) return { intent: 'craft', item: 'stick', count: 4 };
      if (rawTarget.includes('pickaxe')) return { intent: 'craft', item: rawTarget.includes('stone') ? 'stone_pickaxe' : 'wooden_pickaxe', count: 1 };
      if (rawTarget.includes('axe')) return { intent: 'craft', item: rawTarget.includes('stone') ? 'stone_axe' : 'wooden_axe', count: 1 };
      if (rawTarget.includes('sword')) return { intent: 'craft', item: rawTarget.includes('stone') ? 'stone_sword' : 'wooden_sword', count: 1 };
      if (rawTarget.includes('furnace')) return { intent: 'craft', item: 'furnace', count: 1 };
      if (rawTarget.includes('torch')) return { intent: 'craft', item: 'torch', count: 4 };
      return { intent: 'craft', item: rawTarget.replace(/\s+/g, '_'), count: 1 };
    }

    // 2. Resource collection / Mining
    const mineMatch = msg.match(/(?:mine|collect|gather|chop|get|harvest|dig)\s+(?:some\s+)?(?:(\d+)\s+)?([a-z0-9_ ]+)/i);
    if (mineMatch) {
      const count = mineMatch[1] ? parseInt(mineMatch[1], 10) : 3;
      const rawTarget = mineMatch[2].trim();
      if (rawTarget.includes('wood') || rawTarget.includes('log') || rawTarget.includes('tree')) return { intent: 'mine', block: 'oak_log', count };
      if (rawTarget.includes('stone') || rawTarget.includes('cobble')) return { intent: 'mine', block: 'stone', count };
      if (rawTarget.includes('iron')) return { intent: 'mine', block: 'iron_ore', count };
      if (rawTarget.includes('coal')) return { intent: 'mine', block: 'coal_ore', count };
      if (rawTarget.includes('dirt')) return { intent: 'mine', block: 'dirt', count };
      return { intent: 'mine', block: rawTarget.replace(/\s+/g, '_'), count };
    }

    // 3. Follow / Come (supports "follow player in radius of 5", "follow me", "come here")
    const followMatch = msg.match(/(?:follow|come|stay\s+close|walk\s+with)(?:\s+(?:me|player|aurtx|with\s+me))?(?:\s+(?:within|in|radius\s+of|distance\s+of)?\s*(\d+))?/i);
    if (followMatch || /\b(?:follow|come|here|tp|teleport)\b/i.test(msg)) {
      const radius = followMatch && followMatch[1] ? parseInt(followMatch[1], 10) : 5;
      return { intent: 'follow', radius };
    }

    // 4. Defend / Protect
    if (/\b(?:defend|protect|guard|attack|kill)\b/i.test(msg)) {
      return { intent: 'defend' };
    }

    // 5. Outperform / Compete
    if (/\b(?:outperform|beat|compete|race)\b/i.test(msg)) {
      return { intent: 'outperform' };
    }

    // 6. Stop / Pause
    if (/\b(?:stop|wait|pause|freeze|stay|halt)\b/i.test(msg)) {
      return { intent: 'stop' };
    }

    // 7. Status / HP
    if (/\b(?:status|hp|health|inventory|info|score)\b/i.test(msg)) {
      return { intent: 'status' };
    }

    // 8. Pure greeting
    if (/\b(?:hi|hello|hey|yo|sup)\b/i.test(msg)) {
      return { intent: 'greet' };
    }

    return { intent: 'unknown', text: rawMessage };
  }

  // Natural Language & Command Dispatcher
  async function handleIncomingChat(username, rawMessage) {
    const parsed = parseIntent(rawMessage);
    console.log(`[Chat Input from ${username}]: "${rawMessage}" -> Intent:`, parsed);

    try {
      switch (parsed.intent) {
        case 'greet':
          bot.chat(`Hey ${username}! I am CubeAgent. What should we do or gather?`);
          break;

        case 'craft': {
          bot.chat(`On it, ${username}! Crafting ${parsed.item}...`);
          const res = await bot.actions.craftItem(parsed.item, parsed.count || 1);
          bot.chat(res);
          break;
        }

        case 'mine': {
          bot.chat(`Gathering ${parsed.count} of ${parsed.block} for us...`);
          const res = await bot.actions.collectResource(parsed.block, parsed.count || 3);
          bot.chat(res);
          break;
        }

        case 'follow': {
          const radius = parsed.radius || 5;
          bot.chat(`Following ${username} within a radius of ${radius} blocks!`);
          await bot.actions.followPlayer(radius);
          break;
        }

        case 'defend':
          bot.chat(`Protecting you, ${username}!`);
          await bot.actions.defendPlayer();
          break;

        case 'outperform':
          bot.chat(await bot.actions.outperformPlayer());
          break;

        case 'status': {
          const st = bot.actions.getStatus();
          const inv = st.bot.inventory.map(i => `${i.count}x${i.name}`).slice(0, 4).join(', ') || 'empty';
          bot.chat(`HP:${st.bot.health}/20 Food:${st.bot.food}/20 | Items: [${inv}] | Wood: ${st.bot.score.woodLogs} vs ${st.player.estimatedScore.woodLogs}`);
          break;
        }

        case 'stop':
          bot.actions.stopAll();
          bot.chat('Stopped current actions.');
          break;

        case 'unknown':
          if (rawMessage.startsWith('!goto')) {
            const parts = rawMessage.trim().split(/\s+/);
            if (parts.length >= 4) {
              await bot.actions.moveTo(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
              bot.chat(`Navigating to ${parts[1]}, ${parts[2]}, ${parts[3]}.`);
            }
          }
          break;
      }
    } catch (err) {
      console.error(`[Chat Action Error]: ${err.message}`);
      bot.chat(`Could not complete: ${err.message}`);
    }
  }

  // MCP / TOOL-CALLABLE ACTION SUITE
  bot.actions = {
    getStatus() {
      updatePlayerPerception();
      return {
        bot: {
          username: bot.username,
          health: bot.health,
          food: bot.food,
          position: bot.entity ? bot.entity.position.floored() : null,
          heldItem: bot.heldItem ? bot.heldItem.name : 'empty',
          inventory: bot.inventory.items().map(i => ({ name: i.name, count: i.count })),
          score: bot.botScore
        },
        player: {
          username: bot.playerTracker.username,
          online: bot.playerTracker.online,
          position: bot.playerTracker.position ? bot.playerTracker.position.floored() : null,
          distance: bot.playerTracker.distance,
          heldItem: bot.playerTracker.heldItem,
          recentActions: bot.playerTracker.recentActions,
          recentChat: bot.playerTracker.recentChats[0] || null,
          estimatedScore: bot.playerTracker.score
        },
        comparison: {
          woodComparison: `Bot: ${bot.botScore.woodLogs} vs ${targetPlayerName}: ${bot.playerTracker.score.woodLogs}`,
          oreComparison: `Bot: ${bot.botScore.ores} vs ${targetPlayerName}: ${bot.playerTracker.score.ores}`
        }
      };
    },

    async followPlayer(distance = 5) {
      updatePlayerPerception();
      const playerObj = Object.values(bot.players).find(p => p.username.toLowerCase() === targetPlayerName.toLowerCase());
      const target = playerObj?.entity;
      if (!target || !target.position) {
        bot.chat(`Cannot see you, ${targetPlayerName}! Come closer so chunks load, or type "!goto <x> <y> <z>".`);
        return `Player ${targetPlayerName} is not in loaded chunks.`;
      }
      bot.pathfinder.setGoal(new goals.GoalFollow(target, distance), true);
      return `Now following ${targetPlayerName} within a radius of ${distance} blocks.`;
    },

    async moveTo(x, y, z) {
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
      return `Moving to coordinates (${x}, ${y}, ${z}).`;
    },

    async collectResource(blockName, count = 1) {
      const targetName = blockName.toLowerCase();
      const isWood = targetName.includes('log') || targetName.includes('wood') || targetName.includes('tree');
      const botPos = bot.entity ? bot.entity.position : new Vec3(0, 0, 0);

      let collectedCount = 0;
      for (let i = 0; i < count; i++) {
        // Prioritize ground-level reachable blocks (so bot does not try to path into tree canopies)
        let block = bot.findBlock({
          matching: (b) => {
            if (!b) return false;
            if (isWood) {
              if (!b.name.includes('_log')) return false;
              const dy = b.position.y - botPos.y;
              return dy >= -1 && dy <= 3;
            }
            if (targetName.includes('stone') || targetName.includes('cobble')) {
              return (b.name === 'stone' || b.name === 'cobblestone') && Math.abs(b.position.y - botPos.y) <= 3;
            }
            if (targetName.includes('iron')) return b.name.includes('iron_ore');
            if (targetName.includes('coal')) return b.name.includes('coal_ore');
            if (targetName.includes('dirt')) return b.name === 'dirt' || b.name === 'grass_block';
            return b.name === targetName;
          },
          maxDistance: 32
        });

        // Fallback to wider search if reachable ground block not found
        if (!block) {
          block = bot.findBlock({
            matching: (b) => {
              if (!b) return false;
              if (isWood) return b.name.includes('_log');
              return b.name === targetName;
            },
            maxDistance: 48
          });
        }

        if (!block) {
          throw new Error(`Could not find reachable "${blockName}" nearby.`);
        }

        bot.chat(`Harvesting ${block.name} at (${block.position.x}, ${block.position.y}, ${block.position.z})...`);
        await bot.collectBlock.collect(block);

        // Wait a few ticks for item pickup to register in inventory
        await bot.waitForTicks(8);
        collectedCount++;
      }

      return `Successfully gathered ${collectedCount} of ${blockName}!`;
    },

    async craftItem(itemName, count = 1) {
      const target = itemName.toLowerCase().replace(/\s+/g, '_');
      const itemInfo = mcData.itemsByName[target];
      if (!itemInfo) {
        throw new Error(`Unknown item "${itemName}".`);
      }

      // 1. Crafting table
      if (target === 'crafting_table') {
        const existing = countItem('crafting_table');
        if (existing >= count) {
          return `I already have ${existing} crafting table(s) in my inventory!`;
        }

        // Check planks
        let plankCount = countItem('planks');
        if (plankCount < 4) {
          let logCount = countItem('log');
          if (logCount < 1) {
            bot.chat('I need wood first! Gathering an oak log...');
            await this.collectResource('oak_log', 1);
          }

          // Craft logs into planks
          const logItem = bot.inventory.items().find(i => i.name.includes('_log'));
          if (logItem) {
            const plankType = logItem.name.replace('_log', '_planks');
            const plankItem = mcData.itemsByName[plankType] || mcData.itemsByName.oak_planks;
            const plankRecipes = bot.recipesFor(plankItem.id, null, 1, null);
            if (plankRecipes.length > 0) {
              await bot.craft(plankRecipes[0], 1, null);
              await bot.waitForTicks(4);
            }
          }
        }

        let tableRecipes = bot.recipesFor(itemInfo.id, null, 1, null);
        if (!tableRecipes || tableRecipes.length === 0) {
          // Retry crafting planks from any available log
          const anyLog = bot.inventory.items().find(i => i.name.includes('_log'));
          if (anyLog) {
            const plankType = anyLog.name.replace('_log', '_planks');
            const plankItem = mcData.itemsByName[plankType] || mcData.itemsByName.oak_planks;
            const plankRecipes = bot.recipesFor(plankItem.id, null, 1, null);
            if (plankRecipes.length > 0) {
              await bot.craft(plankRecipes[0], 1, null);
              await bot.waitForTicks(4);
            }
          }
          tableRecipes = bot.recipesFor(itemInfo.id, null, 1, null);
        }

        if (!tableRecipes || tableRecipes.length === 0) {
          throw new Error('Not enough planks to craft crafting table.');
        }
        await bot.craft(tableRecipes[0], count, null);
        return `Successfully crafted ${count} crafting table!`;
      }

      // 2. Planks
      if (target.includes('plank')) {
        let logCount = countItem('log');
        if (logCount < 1) {
          bot.chat('Gathering wood to craft planks...');
          await this.collectResource('oak_log', 1);
        }
        const logItem = bot.inventory.items().find(i => i.name.includes('_log'));
        const plankType = logItem ? logItem.name.replace('_log', '_planks') : 'oak_planks';
        const plankItem = mcData.itemsByName[plankType] || mcData.itemsByName.oak_planks;
        const recipes = bot.recipesFor(plankItem.id, null, 1, null);
        if (!recipes || recipes.length === 0) throw new Error('Cannot craft planks from available logs.');
        await bot.craft(recipes[0], count, null);
        return `Crafted ${count * 4} ${plankType}!`;
      }

      // 3. Stick
      if (target === 'stick') {
        let plankCount = countItem('planks');
        if (plankCount < 2) {
          await this.craftItem('oak_planks', 1);
        }
        const recipes = bot.recipesFor(itemInfo.id, null, 1, null);
        if (!recipes || recipes.length === 0) throw new Error('Not enough planks for sticks.');
        await bot.craft(recipes[0], count, null);
        return `Crafted ${count * 4} sticks!`;
      }

      // 4. Generic 2x2 crafting
      let recipes = bot.recipesFor(itemInfo.id, null, 1, null);
      if (recipes && recipes.length > 0) {
        await bot.craft(recipes[0], count, null);
        return `Crafted ${count} ${itemName} in 2x2 grid.`;
      }

      // 5. 3x3 crafting with table
      let craftingTable = bot.findBlock({
        matching: mcData.blocksByName.crafting_table.id,
        maxDistance: 16
      });

      if (!craftingTable) {
        const tableItem = bot.inventory.items().find(i => i.name === 'crafting_table');
        if (tableItem && bot.entity) {
          const feet = bot.entity.position.floored();
          const solidBlock = bot.findBlock({
            matching: b => b.boundingBox === 'block' && b.position.distanceTo(feet) < 3 && b.position.y <= feet.y,
            maxDistance: 4
          });
          if (solidBlock) {
            try {
              await bot.equip(tableItem, 'hand');
              await bot.placeBlock(solidBlock, new Vec3(0, 1, 0));
              craftingTable = bot.findBlock({
                matching: mcData.blocksByName.crafting_table.id,
                maxDistance: 5
              });
            } catch (_) {}
          }
        }
      }

      if (craftingTable) {
        await bot.pathfinder.goto(new goals.GoalGetToBlock(craftingTable.position.x, craftingTable.position.y, craftingTable.position.z));
        const tableRecipes = bot.recipesFor(itemInfo.id, null, 1, craftingTable);
        if (!tableRecipes || tableRecipes.length === 0) {
          throw new Error(`Missing ingredients to craft ${itemName} at crafting table.`);
        }
        await bot.craft(tableRecipes[0], count, craftingTable);
        return `Crafted ${count} ${itemName} using crafting table.`;
      }

      throw new Error(`Cannot craft ${itemName}: missing ingredients or crafting table.`);
    },

    async defendPlayer() {
      const player = bot.players[targetPlayerName]?.entity;
      if (!player) throw new Error(`${targetPlayerName} is not nearby.`);

      // Find nearest hostile mob targeting player or bot
      const hostile = bot.nearestEntity(e => {
        if (!e || e.type !== 'mob') return false;
        const distToPlayer = player.position.distanceTo(e.position);
        const distToBot = bot.entity.position.distanceTo(e.position);
        return distToPlayer < 12 || distToBot < 8;
      });

      if (!hostile) {
        return `No hostile threats within 12 blocks of ${targetPlayerName}.`;
      }

      bot.chat(`Defending ${targetPlayerName}! Engaging ${hostile.name || 'hostile'}!`);
      bot.pvp.attack(hostile);
      return `Engaging hostile ${hostile.name} in combat.`;
    },

    async outperformPlayer() {
      updatePlayerPerception();
      const pWood = bot.playerTracker.score.woodLogs;
      const bWood = bot.botScore.woodLogs;

      if (bWood <= pWood) {
        const needed = (pWood - bWood) + 3;
        bot.chat(`AURTX has ${pWood} wood logs. I will gather ${needed} more logs to beat them!`);
        return await this.collectResource('oak_log', Math.min(needed, 4));
      } else {
        const needed = 3;
        bot.chat(`I am ahead in wood (${bWood} vs ${pWood})! Gathering ${needed} cobblestone/iron to advance faster!`);
        try {
          return await this.collectResource('iron_ore', 2);
        } catch (_) {
          return await this.collectResource('stone', 3);
        }
      }
    },

    sendChat(message) {
      bot.chat(message);
      return `Sent in-game chat: "${message}"`;
    },

    stopAll() {
      bot.pathfinder.setGoal(null);
      if (bot.pvp) bot.pvp.stop();
      bot.clearControlStates();
      return 'All active actions and pathfinding stopped.';
    }
  };

  return bot;
}

module.exports = { createAgent };
