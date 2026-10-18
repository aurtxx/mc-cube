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

  console.log(`[Agent] Initializing Mineflayer bot for Minecraft ${options.version}...`);
  console.log(`[Agent] Target server: ${options.host}:${options.port} as ${options.username}`);

  const bot = mineflayer.createBot(options);

  // Load plugins
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(autoEat);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(pvp);

  let mcData;
  let defaultMovements;

  bot.once('spawn', () => {
    console.log('[Agent] Bot successfully spawned into the world!');
    mcData = mcDataBuilder(bot.version);

    // Initialize movements tailored for 1.16.5 physics
    defaultMovements = new Movements(bot, mcData);
    defaultMovements.allowParkour = config.pathfinder.allowParkour;
    defaultMovements.allowSprinting = config.pathfinder.allowSprinting;
    defaultMovements.canDig = config.pathfinder.canDig;

    bot.pathfinder.setMovements(defaultMovements);

    // Tune pathfinder performance to prevent Node.js event-loop blocking
    bot.pathfinder.thinkTimeout = config.pathfinder.thinkTimeout;
    bot.pathfinder.tickTimeout = config.pathfinder.tickTimeout;
    bot.pathfinder.searchRadius = config.pathfinder.searchRadius;

    // Auto-eat configuration
    bot.autoEat.options = {
      priority: 'foodPoints',
      startAt: 14,
      bannedFood: ['rotten_flesh', 'pufferfish', 'poisonous_potato', 'spider_eye']
    };

    // Launch web visualizer
    if (config.enableViewer) {
      try {
        mineflayerViewer(bot, { port: config.viewerPort, firstPerson: false });
        console.log(`[Viewer] Web 3D visualizer running at http://localhost:${config.viewerPort}`);
      } catch (err) {
        console.warn(`[Viewer] Could not start prismarine-viewer: ${err.message}`);
      }
    }

    bot.chat(`Agent online [v${bot.version}]. Type "!help" for commands.`);
  });

  // Handle incoming chat commands
  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    if (!message.startsWith('!')) return;

    const args = message.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    console.log(`[Command] ${username} invoked: !${command} ${args.join(' ')}`);

    try {
      switch (command) {
        case 'help': {
          bot.chat('Commands: !come, !goto <x> <y> <z>, !mine <block>, !status, !eat, !attack <target>, !stop');
          break;
        }

        case 'come': {
          const targetPlayer = bot.players[username]?.entity;
          if (!targetPlayer) {
            bot.chat(`Cannot see you, ${username}! Come closer so chunks load.`);
            return;
          }
          bot.chat(`Navigating to ${username}...`);
          bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 1), true);
          break;
        }

        case 'goto': {
          if (args.length < 3) {
            bot.chat('Usage: !goto <x> <y> <z>');
            return;
          }
          const x = parseFloat(args[0]);
          const y = parseFloat(args[1]);
          const z = parseFloat(args[2]);
          if (isNaN(x) || isNaN(y) || isNaN(z)) {
            bot.chat('Coordinates must be numbers!');
            return;
          }
          bot.chat(`Moving to (${x}, ${y}, ${z})...`);
          bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
          break;
        }

        case 'mine':
        case 'collect': {
          if (args.length === 0) {
            bot.chat('Usage: !mine <block_name> (e.g., !mine oak_log, !mine iron_ore)');
            return;
          }
          const blockName = args[0].toLowerCase();
          const blockType = mcData.blocksByName[blockName];
          if (!blockType) {
            bot.chat(`Unknown block name: "${blockName}" in Minecraft ${bot.version}`);
            return;
          }

          const targetBlock = bot.findBlock({
            matching: blockType.id,
            maxDistance: 32
          });

          if (!targetBlock) {
            bot.chat(`No ${blockName} found within 32 blocks!`);
            return;
          }

          bot.chat(`Found ${blockName} at ${targetBlock.position}. Harvesting...`);
          await bot.collectBlock.collect(targetBlock);
          bot.chat(`Successfully harvested ${blockName}!`);
          break;
        }

        case 'status': {
          const pos = bot.entity.position.floored();
          const health = bot.health;
          const food = bot.food;
          const heldItem = bot.heldItem ? bot.heldItem.name : 'empty';
          bot.chat(`Health: ${health}/20 | Food: ${food}/20 | Pos: (${pos.x}, ${pos.y}, ${pos.z}) | Holding: ${heldItem}`);
          break;
        }

        case 'eat': {
          bot.chat('Checking food and attempting to eat...');
          bot.autoEat.eat();
          break;
        }

        case 'attack': {
          if (args.length === 0) {
            bot.chat('Usage: !attack <playerName/mobName>');
            return;
          }
          const targetName = args[0].toLowerCase();
          const entity = Object.values(bot.entities).find(e => 
            (e.username && e.username.toLowerCase() === targetName) ||
            (e.name && e.name.toLowerCase() === targetName)
          );

          if (!entity) {
            bot.chat(`Target "${targetName}" not found nearby.`);
            return;
          }

          bot.chat(`Engaging ${targetName} in combat!`);
          bot.pvp.attack(entity);
          break;
        }

        case 'stop': {
          bot.pathfinder.setGoal(null);
          if (bot.pvp) bot.pvp.stop();
          bot.clearControlStates();
          bot.chat('All actions stopped.');
          break;
        }

        default: {
          bot.chat(`Unknown command "!${command}". Type "!help" for list.`);
          break;
        }
      }
    } catch (err) {
      console.error(`[Error executing !${command}]:`, err);
      bot.chat(`Error: ${err.message}`);
    }
  });

  // Goal completion events
  bot.on('goal_reached', (goal) => {
    console.log('[Pathfinder] Goal successfully reached!');
  });

  bot.on('kicked', (reason) => {
    console.warn('[Agent] Kicked from server:', reason);
  });

  bot.on('error', (err) => {
    console.error('[Agent] Error:', err);
  });

  return bot;
}

module.exports = { createAgent };
