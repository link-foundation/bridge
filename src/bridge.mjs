import { LinksNotationManager, MessageStatus } from './lino.lib.mjs';
import { VKBridge } from './vk.lib.mjs';
import { TelegramBridge } from './telegram.lib.mjs';

/**
 * Bidirectional Bridge between VK and Telegram group chats
 * Uses Links Notation for reliable message queue and transaction logging
 */
export class ChatBridge {
  constructor(config = {}) {
    this.config = config;

    // Initialize Links Notation manager for transaction log
    this.lino = new LinksNotationManager({
      dataDir: config.dataDir || './data',
      partitionBy: config.partitionBy || 'day',
      maxEntriesPerFile: config.maxEntriesPerFile || 10000
    });

    // Initialize platform bridges
    this.vk = new VKBridge({
      token: config.vk?.token,
      groupId: config.vk?.groupId,
      chatId: config.vk?.chatId
    });

    this.telegram = new TelegramBridge({
      token: config.telegram?.token,
      chatId: config.telegram?.chatId
    });

    this.isProcessing = false;
    this.processingInterval = null;
  }

  /**
   * Initialize the bridge
   */
  async init() {
    console.log('Initializing chat bridge...');

    // Initialize VK bridge
    await this.vk.init();
    this.vk.onMessage(async (message) => {
      await this.handleIncomingMessage(message);
    });

    // Initialize Telegram bridge
    await this.telegram.init();
    this.telegram.onMessage(async (message) => {
      await this.handleIncomingMessage(message);
    });

    console.log('Chat bridge initialized');
  }

  /**
   * Start the bridge
   */
  async start() {
    console.log('Starting chat bridge...');

    // Start both platforms
    await Promise.all([
      this.vk.start(),
      this.telegram.start()
    ]);

    // Start processing pending messages from the queue
    this.startProcessingQueue();

    console.log('Chat bridge is running!');
    console.log('- VK ↔ Telegram group chats are now linked');
    console.log('- Messages are logged in .lino files');
    console.log('- Archives will be created automatically');
  }

  /**
   * Stop the bridge
   */
  async stop() {
    console.log('Stopping chat bridge...');

    // Stop processing queue
    this.stopProcessingQueue();

    // Stop both platforms
    await Promise.all([
      this.vk.stop(),
      this.telegram.stop()
    ]);

    console.log('Chat bridge stopped');
  }

  /**
   * Handle incoming message from either platform
   */
  async handleIncomingMessage(message) {
    console.log(`📨 Received message from ${message.from}: ${message.text}`);

    // Add to transaction log
    const entry = this.lino.appendMessage({
      id: message.id,
      timestamp: message.timestamp,
      from: message.from,
      to: message.to,
      text: this.formatMessage(message),
      status: MessageStatus.QUEUED
    });

    console.log(`✅ Message queued: ${entry.id}`);

    // Try to send immediately
    await this.processMessage(entry);
  }

  /**
   * Format message with sender name
   */
  formatMessage(message) {
    const userName = message.userName || 'Unknown';
    const platform = message.from.toUpperCase();
    return `[${platform}] ${userName}: ${message.text}`;
  }

  /**
   * Process a single message from the queue
   */
  async processMessage(message) {
    if (this.isProcessing) {
      return; // Avoid concurrent processing
    }

    this.isProcessing = true;

    try {
      let result;

      // Send to destination platform
      if (message.to === 'telegram') {
        result = await this.telegram.sendMessage(message.text);
      } else if (message.to === 'vk') {
        result = await this.vk.sendMessage(message.text);
      } else {
        console.error(`Unknown destination: ${message.to}`);
        this.lino.updateMessageStatus(message.id, MessageStatus.FAILED);
        return;
      }

      // Update status based on result
      if (result.success) {
        console.log(`✅ Message sent: ${message.id} → ${message.to}`);
        this.lino.updateMessageStatus(message.id, MessageStatus.SENT);
      } else {
        console.error(`❌ Failed to send message ${message.id}: ${result.error}`);
        this.lino.updateMessageStatus(message.id, MessageStatus.FAILED);
      }
    } catch (error) {
      console.error(`❌ Error processing message ${message.id}:`, error);
      this.lino.updateMessageStatus(message.id, MessageStatus.FAILED);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start processing pending messages from the queue
   */
  startProcessingQueue() {
    // Process queue every 5 seconds
    this.processingInterval = setInterval(async () => {
      await this.processPendingMessages();
    }, 5000);

    console.log('Message queue processor started');
  }

  /**
   * Stop processing queue
   */
  stopProcessingQueue() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Message queue processor stopped');
    }
  }

  /**
   * Process all pending messages in the queue
   */
  async processPendingMessages() {
    const pending = this.lino.getPendingMessages();

    if (pending.length === 0) {
      return;
    }

    console.log(`📋 Processing ${pending.length} pending message(s)...`);

    for (const message of pending) {
      await this.processMessage(message);
    }
  }

  /**
   * Get bridge statistics
   */
  getStats() {
    const archives = this.lino.listArchives();
    const pending = this.lino.getPendingMessages();

    return {
      pendingMessages: pending.length,
      archivedFiles: archives.length,
      archives: archives
    };
  }
}
