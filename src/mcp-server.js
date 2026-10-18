const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { z } = require('zod');

function createMcpServer(bot) {
  const server = new Server(
    {
      name: 'mc-cube-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Define tools for the Local Model
  const tools = [
    {
      name: 'get_status',
      description: 'Get current status of bot and target player (AURTX), including HP, hunger, distance, held items, inventory, and progression score.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'follow_player',
      description: 'Instruct the bot to pathfind to and follow the player (AURTX).',
      inputSchema: {
        type: 'object',
        properties: {
          distance: {
            type: 'number',
            description: 'Distance to maintain from the player in blocks (default: 2).'
          }
        }
      }
    },
    {
      name: 'collect_resource',
      description: 'Autonomously find, pathfind to, mine, and pick up block resources (e.g., oak_log, iron_ore, coal_ore, stone).',
      inputSchema: {
        type: 'object',
        properties: {
          block_name: {
            type: 'string',
            description: 'Name of the block to harvest (e.g. "oak_log", "stone", "iron_ore", "coal_ore").'
          },
          count: {
            type: 'number',
            description: 'Number of blocks to collect (default: 1).'
          }
        },
        required: ['block_name']
      }
    },
    {
      name: 'craft_item',
      description: 'Craft an item in 2x2 grid or nearby 3x3 crafting table.',
      inputSchema: {
        type: 'object',
        properties: {
          item_name: {
            type: 'string',
            description: 'Name of the item to craft (e.g. "oak_planks", "stick", "crafting_table").'
          },
          count: {
            type: 'number',
            description: 'Number of items to craft (default: 1).'
          }
        },
        required: ['item_name']
      }
    },
    {
      name: 'move_to',
      description: 'Navigate to exact 3D world coordinates.',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          z: { type: 'number', description: 'Z coordinate' }
        },
        required: ['x', 'y', 'z']
      }
    },
    {
      name: 'defend_player',
      description: 'Scan for and attack hostile mobs threatening the player (AURTX) or the bot.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'outperform_player',
      description: 'Evaluate player (AURTX) resource count and autonomously gather extra wood, stone, or ores to beat them.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'send_chat',
      description: 'Send a message in Minecraft public chat to communicate with player AURTX.',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to speak in game chat' }
        },
        required: ['message']
      }
    },
    {
      name: 'stop_actions',
      description: 'Immediately abort all current pathfinding, mining, and combat routines.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Execute tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.log(`[MCP Server] Executing tool: ${name} with args:`, args);

    try {
      let resultText = '';

      switch (name) {
        case 'get_status': {
          const status = bot.actions.getStatus();
          resultText = JSON.stringify(status, null, 2);
          break;
        }

        case 'follow_player': {
          const dist = args?.distance || 2;
          resultText = await bot.actions.followPlayer(dist);
          break;
        }

        case 'collect_resource': {
          const blockName = args.block_name;
          const count = args.count || 1;
          resultText = await bot.actions.collectResource(blockName, count);
          break;
        }

        case 'craft_item': {
          const itemName = args.item_name;
          const count = args.count || 1;
          resultText = await bot.actions.craftItem(itemName, count);
          break;
        }

        case 'move_to': {
          resultText = await bot.actions.moveTo(args.x, args.y, args.z);
          break;
        }

        case 'defend_player': {
          resultText = await bot.actions.defendPlayer();
          break;
        }

        case 'outperform_player': {
          resultText = await bot.actions.outperformPlayer();
          break;
        }

        case 'send_chat': {
          resultText = bot.actions.sendChat(args.message);
          break;
        }

        case 'stop_actions': {
          resultText = bot.actions.stopAll();
          break;
        }

        default:
          throw new Error(`Unknown tool "${name}".`);
      }

      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ]
      };
    } catch (err) {
      console.error(`[MCP Tool Error (${name})]:`, err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${err.message}`
          }
        ]
      };
    }
  });

  return { server, tools };
}

// Support running directly as a stdio MCP server process
if (require.main === module) {
  const { createAgent } = require('./agent');
  console.log('[MCP Server] Starting standalone MCP server on stdio...');
  const bot = createAgent();
  const { server } = createMcpServer(bot);
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.log('[MCP Server] Connected to stdio transport.');
  });
}

module.exports = { createMcpServer };
