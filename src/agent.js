const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const collectBlock = require('mineflayer-collectblock').plugin;
const autoEat = require('mineflayer-auto-eat').plugin;
const armorManager = require('mineflayer-armor-manager');
const pvp = require('mineflayer-pvp').plugin;
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
const mcDataBuilder = require('minecraft-data');
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
    const player = bot.players[targetPlayerName]?.entity;
    if (player) {
      bot.playerTracker.online = true;
      bot.playerTracker.position = player.position.clone();
      bot.playerTracker.distance = Math.round(bot.entity.position.distanceTo(player.position));
      bot.playerTracker.heldItem = player.heldItem ? player.heldItem.name : 'empty';
      bot.playerTracker.lastSeen = Date.now();

      // Check if player held a newly gathered resource
      if (bot.playerTracker.heldItem.includes('log')) {
        bot.playerTracker.recentActions.unshift(`Harvesting ${bot.playerTracker.heldItem}`);
      } else if (bot.playerTracker.heldItem.includes('ore') || bot.playerTracker.heldItem.includes('raw_')) {
        bot.playerTracker.recentActions.unshift(`Mining ${bot.playerTracker.heldItem}`);
      }
      if (bot.playerTracker.recentActions.length > 5) {
        bot.playerTracker.recentActions.pop();
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

    if (config.enableViewer) {
      try {
        mineflayerViewer(bot, { port: config.viewerPort, firstPerson: false });
        console.log(`[Viewer] Web 3D visualizer running at http://localhost:${config.viewerPort}`);
      } catch (err) {
        console.warn(`[Viewer] Could not start prismarine-viewer: ${err.message}`);
      }
    }

    bot.chat(`CubeAgent online! Tracking ${targetPlayerName}. Type "!help" for commands.`);

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

  // Chat tracking
  bot.on('chat', (username, message) => {
    if (username === targetPlayerName) {
      bot.playerTracker.recentChats.unshift({
        message,
        timestamp: Date.now()
      });
      if (bot.playerTracker.recentChats.length > 5) {
        bot.playerTracker.recentChats.pop();
      }
    }

    if (username === bot.username) return;
    if (!message.startsWith('!')) return;

    handleManualCommand(username, message);
  });

  // Manual chat command fallback
  async function handleManualCommand(username, message) {
    const args = message.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
      switch (command) {
        case 'help':
          bot.chat('Commands: !come, !goto <x y z>, !mine <block> [count], !status, !outperform, !stop');
          break;
        case 'come':
        case 'follow':
          await bot.actions.followPlayer(2);
          bot.chat(`Following ${username}!`);
          break;
        case 'goto':
          if (args.length >= 3) {
            await bot.actions.moveTo(parseFloat(args[0]), parseFloat(args[1]), parseFloat(args[2]));
          }
          break;
        case 'mine':
        case 'collect':
          if (args.length >= 1) {
            const count = args[1] ? parseInt(args[1], 10) : 1;
            await bot.actions.collectResource(args[0], count);
          }
          break;
        case 'status': {
          const st = bot.actions.getStatus();
          bot.chat(`HP:${st.bot.health} Food:${st.bot.food} | Target ${st.player.username}: ${st.player.online ? st.player.distance + 'm away' : 'offline'}`);
          break;
        }
        case 'outperform':
          bot.chat(await bot.actions.outperformPlayer());
          break;
        case 'stop':
          bot.actions.stopAll();
          bot.chat('Stopped current actions.');
          break;
      }
    } catch (err) {
      bot.chat(`Error: ${err.message}`);
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

    async followPlayer(distance = 2) {
      const target = bot.players[targetPlayerName]?.entity;
      if (!target) {
        throw new Error(`Player ${targetPlayerName} is not in loaded chunks or offline.`);
      }
      bot.pathfinder.setGoal(new goals.GoalFollow(target, distance), true);
      return `Now following ${targetPlayerName} within ${distance} blocks.`;
    },

    async moveTo(x, y, z) {
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
      return `Moving to coordinates (${x}, ${y}, ${z}).`;
    },

    async collectResource(blockName, count = 1) {
      const targetName = blockName.toLowerCase();
      const blockInfo = mcData.blocksByName[targetName];
      if (!blockInfo) {
        throw new Error(`Unknown block "${blockName}" in Minecraft ${bot.version}.`);
      }

      let collectedCount = 0;
      for (let i = 0; i < count; i++) {
        const block = bot.findBlock({
          matching: blockInfo.id,
          maxDistance: 48
        });

        if (!block) {
          throw new Error(`Could not find "${blockName}" within 48 blocks. Collected ${collectedCount}/${count}.`);
        }

        bot.chat(`Harvesting ${blockName} at ${block.position}...`);
        await bot.collectBlock.collect(block);
        collectedCount++;
      }

      return `Successfully gathered ${collectedCount} of ${blockName}!`;
    },

    async craftItem(itemName, count = 1) {
      const itemInfo = mcData.itemsByName[itemName.toLowerCase()];
      if (!itemInfo) {
        throw new Error(`Unknown item "${itemName}".`);
      }

      const recipes = bot.recipesFor(itemInfo.id, null, 1, null);
      if (!recipes || recipes.length === 0) {
        // Try with crafting table nearby
        const craftingTable = bot.findBlock({
          matching: mcData.blocksByName.crafting_table.id,
          maxDistance: 16
        });

        const tableRecipes = bot.recipesFor(itemInfo.id, null, 1, craftingTable);
        if (!tableRecipes || tableRecipes.length === 0) {
          throw new Error(`Missing ingredients or crafting table to craft ${itemName}.`);
        }

        if (craftingTable) {
          await bot.pathfinder.goto(new goals.GoalGetToBlock(craftingTable.position.x, craftingTable.position.y, craftingTable.position.z));
          await bot.craft(tableRecipes[0], count, craftingTable);
          return `Crafted ${count} ${itemName} using crafting table.`;
        } else {
          throw new Error(`Crafting ${itemName} requires a 3x3 crafting table nearby.`);
        }
      }

      await bot.craft(recipes[0], count, null);
      return `Crafted ${count} ${itemName} in 2x2 inventory grid.`;
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
