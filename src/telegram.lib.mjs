import { Telegraf } from 'telegraf';

/**
 * Telegram Group Chat Integration
 * Handles receiving and sending messages to Telegram group chats
 */
export class TelegramBridge {
  constructor(options = {}) {
    this.token = options.token;
    this.chatId = options.chatId;
    this.bot = null;
    this.messageHandler = null;
  }

  /**
   * Initialize Telegram bot
   */
  async init() {
    if (!this.token) {
      throw new Error('Telegram token is required');
    }

    this.bot = new Telegraf(this.token);

    // Set up message listener for group chats
    this.bot.on('text', async (ctx) => {
      // Only process messages from groups/supergroups
      if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        if (this.messageHandler) {
          const message = {
            id: `telegram-${ctx.message.message_id}`,
            timestamp: ctx.message.date * 1000,
            from: 'telegram',
            to: 'vk',
            text: ctx.message.text,
            userId: ctx.from.id,
            userName: this.getUserName(ctx.from),
            chatId: ctx.chat.id
          };

          await this.messageHandler(message);
        }
      }
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      console.error('Telegram bot error:', err);
    });

    console.log('Telegram bridge initialized');
  }

  /**
   * Start the bot
   */
  async start() {
    if (!this.bot) {
      await this.init();
    }

    await this.bot.launch();
    console.log('Telegram bridge started, listening for messages...');

    // Enable graceful stop
    process.once('SIGINT', () => this.stop());
    process.once('SIGTERM', () => this.stop());
  }

  /**
   * Stop the bot
   */
  async stop() {
    if (this.bot) {
      await this.bot.stop('SIGINT');
      console.log('Telegram bridge stopped');
    }
  }

  /**
   * Send a message to Telegram chat
   */
  async sendMessage(text, options = {}) {
    if (!this.bot) {
      throw new Error('Telegram bridge not initialized');
    }

    const chatId = options.chatId || this.chatId;
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    try {
      const result = await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: options.parseMode || 'HTML',
        disable_web_page_preview: options.disableWebPagePreview !== false
      });

      return {
        success: true,
        messageId: result.message_id
      };
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user name from Telegram user object
   */
  getUserName(user) {
    const parts = [];
    if (user.first_name) parts.push(user.first_name);
    if (user.last_name) parts.push(user.last_name);

    if (parts.length === 0 && user.username) {
      return `@${user.username}`;
    }

    return parts.length > 0 ? parts.join(' ') : `User ${user.id}`;
  }

  /**
   * Set message handler callback
   */
  onMessage(handler) {
    this.messageHandler = handler;
  }
}
