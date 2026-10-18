const http = require('http');
const https = require('https');
const { URL } = require('url');
const config = require('../config');

class LocalBrain {
  constructor(bot, mcpTools) {
    this.bot = bot;
    this.tools = mcpTools;
    this.modelConfig = config.localModel;
    this.isRunning = false;
    this.loopInterval = null;
    this.isProcessing = false;
  }

  start(intervalMs = 5000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[Local Brain] Started autonomous decision loop (polling every ${intervalMs / 1000}s)`);
    console.log(`[Local Brain] Configured model: ${this.modelConfig.model} at ${this.modelConfig.baseUrl}`);

    this.loopInterval = setInterval(() => {
      this.step().catch(err => {
        console.error('[Local Brain Loop Error]:', err.message);
      });
    }, intervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.loopInterval) clearInterval(this.loopInterval);
    console.log('[Local Brain] Stopped decision loop.');
  }

  async step() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const status = this.bot.actions.getStatus();

      // Check if target player AURTX is in game
      if (!status.player.online) {
        // Player not around yet, wait peacefully
        return;
      }

      // Check for unhandled player instruction in chat first
      const recentChat = status.player.recentChat;
      const isNewChat = recentChat && (Date.now() - recentChat.timestamp < 6000);

      // Attempt to query local LLM
      const llmDecision = await this.queryLocalModel(status, recentChat);

      if (llmDecision) {
        await this.executeDecision(llmDecision);
      } else {
        // Heuristic Fallback when local LLM server is offline
        await this.heuristicFallback(status, isNewChat ? recentChat.message : null);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async queryLocalModel(status, recentChat) {
    const prompt = {
      model: this.modelConfig.model,
      temperature: this.modelConfig.temperature,
      messages: [
        {
          role: 'system',
          content: `You are CubeAgent, an autonomous Minecraft AI companion and competitor to player ${config.targetPlayer}.
Your priorities:
1. Instruction Following: If ${config.targetPlayer} asked you to do something in chat, ALWAYS fulfill it first.
2. Self-Preservation & Defense: If hostiles threaten you or ${config.targetPlayer}, defend.
3. Progress Mirroring & Outperforming: If ${config.targetPlayer} is collecting wood, collect more wood to lead. If they mine ores, mine ores.
Return a tool call to perform your next action.`
        },
        {
          role: 'user',
          content: `Current Environment State:
${JSON.stringify(status, null, 2)}
${recentChat ? `Recent Chat from ${config.targetPlayer}: "${recentChat.message}"` : 'No recent chat.'}
What action will you take?`
        }
      ],
      tools: this.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema
        }
      })),
      tool_choice: 'auto'
    };

    try {
      const response = await this.makeHttpRequest(`${this.modelConfig.baseUrl}/chat/completions`, prompt);
      const choice = response?.choices?.[0]?.message;
      if (choice?.tool_calls && choice.tool_calls.length > 0) {
        const toolCall = choice.tool_calls[0];
        return {
          name: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments || '{}')
        };
      }
    } catch (_) {
      // Local LLM server not currently running, silently fall back to heuristics
      return null;
    }

    return null;
  }

  async executeDecision(decision) {
    console.log(`[Local Brain] Model chosen action: ${decision.name}`, decision.args);
    const { name, args } = decision;

    switch (name) {
      case 'follow_player':
        await this.bot.actions.followPlayer(args?.distance || 2);
        break;
      case 'collect_resource':
        await this.bot.actions.collectResource(args.block_name, args.count || 1);
        break;
      case 'craft_item':
        await this.bot.actions.craftItem(args.item_name, args.count || 1);
        break;
      case 'move_to':
        await this.bot.actions.moveTo(args.x, args.y, args.z);
        break;
      case 'defend_player':
        await this.bot.actions.defendPlayer();
        break;
      case 'outperform_player':
        await this.bot.actions.outperformPlayer();
        break;
      case 'send_chat':
        this.bot.actions.sendChat(args.message);
        break;
      case 'stop_actions':
        this.bot.actions.stopAll();
        break;
    }
  }

  async heuristicFallback(status, chatMsg) {
    // 1. Follow direct chat instructions
    if (chatMsg) {
      const lower = chatMsg.toLowerCase().trim();
      if (lower === 'hi' || lower === 'hello' || lower === 'hey') {
        this.bot.actions.sendChat(`Hey ${config.targetPlayer}! I am ready. What are we gathering?`);
        return;
      }
      if (lower.includes('come') || lower.includes('follow') || lower.includes('here')) {
        await this.bot.actions.followPlayer(2);
        this.bot.actions.sendChat(`Coming to you, ${config.targetPlayer}!`);
        return;
      }
      if (lower.includes('wood') || lower.includes('log') || lower.includes('tree')) {
        this.bot.actions.sendChat(`On it! Harvesting oak logs for us.`);
        await this.bot.actions.collectResource('oak_log', 2);
        return;
      }
      if (lower.includes('stop') || lower.includes('wait')) {
        this.bot.actions.stopAll();
        this.bot.actions.sendChat('Waiting here.');
        return;
      }
    }

    // 2. Defend if hostiles nearby
    try {
      const defendResult = await this.bot.actions.defendPlayer();
      if (defendResult.includes('Engaging')) return;
    } catch (_) {}

    // 3. Outperform & Mirror Progress
    const playerWood = status.player.estimatedScore.woodLogs;
    const botWood = status.bot.score.woodLogs;

    if (status.player.heldItem.includes('log') || botWood <= playerWood) {
      console.log(`[Heuristic Brain] AURTX is gathering wood (${playerWood} logs). Harvesting to compete!`);
      try {
        await this.bot.actions.outperformPlayer();
        return;
      } catch (err) {
        console.log(`[Heuristic Brain] Could not harvest: ${err.message}`);
      }
    }

    // 4. Stay close to player if far away (within loaded range)
    if (status.player.distance > 8 && status.player.distance < 48) {
      console.log(`[Heuristic Brain] AURTX is ${status.player.distance}m away. Moving closer.`);
      try {
        await this.bot.actions.followPlayer(3);
      } catch (err) {
        console.log(`[Heuristic Brain] Cannot follow right now: ${err.message}`);
      }
    }
  }

  makeHttpRequest(targetUrl, payload) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(targetUrl);
      const postData = JSON.stringify(payload);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': `Bearer ${this.modelConfig.apiKey}`
          },
          timeout: 4000
        },
        (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('LLM request timed out'));
      });

      req.write(postData);
      req.end();
    });
  }
}

module.exports = { LocalBrain };
