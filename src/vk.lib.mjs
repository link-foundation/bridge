import { VK } from 'vk-io';

/**
 * VK Group Chat Integration
 * Handles receiving and sending messages to VK group chats
 */
export class VKBridge {
  constructor(options = {}) {
    this.token = options.token;
    this.groupId = options.groupId;
    this.chatId = options.chatId;
    this.vk = null;
    this.messageHandler = null;
  }

  /**
   * Initialize VK connection
   */
  async init() {
    if (!this.token) {
      throw new Error('VK token is required');
    }

    this.vk = new VK({
      token: this.token,
      pollingGroupId: this.groupId
    });

    // Set up message listener
    this.vk.updates.on('message_new', async (context) => {
      if (this.messageHandler && context.peerType === 'chat') {
        const message = {
          id: `vk-${context.id}`,
          timestamp: Date.now(),
          from: 'vk',
          to: 'telegram',
          text: context.text,
          userId: context.senderId,
          userName: await this.getUserName(context.senderId),
          chatId: context.chatId
        };

        await this.messageHandler(message);
      }
    });

    console.log('VK bridge initialized');
  }

  /**
   * Start listening for messages
   */
  async start() {
    if (!this.vk) {
      await this.init();
    }

    await this.vk.updates.start();
    console.log('VK bridge started, listening for messages...');
  }

  /**
   * Stop listening for messages
   */
  async stop() {
    if (this.vk) {
      await this.vk.updates.stop();
      console.log('VK bridge stopped');
    }
  }

  /**
   * Send a message to VK chat
   */
  async sendMessage(text, options = {}) {
    if (!this.vk) {
      throw new Error('VK bridge not initialized');
    }

    const chatId = options.chatId || this.chatId;
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    try {
      const result = await this.vk.api.messages.send({
        chat_id: chatId,
        message: text,
        random_id: Math.floor(Math.random() * 1000000000)
      });

      return {
        success: true,
        messageId: result
      };
    } catch (error) {
      console.error('Error sending VK message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user name by ID
   */
  async getUserName(userId) {
    try {
      const [user] = await this.vk.api.users.get({
        user_ids: userId,
        fields: ['first_name', 'last_name']
      });

      return `${user.first_name} ${user.last_name}`;
    } catch (error) {
      console.error('Error getting VK user name:', error);
      return `User ${userId}`;
    }
  }

  /**
   * Set message handler callback
   */
  onMessage(handler) {
    this.messageHandler = handler;
  }
}
