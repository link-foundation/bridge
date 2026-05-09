import { ChatBridge } from './bridge.mjs';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Main entry point for the VK-Telegram bridge
 */
async function main() {
  console.log('🌉 VK-Telegram Bridge');
  console.log('===================\n');

  // Load configuration
  let config;
  try {
    const configPath = process.env.CONFIG_PATH || './config.json';
    const configFile = readFileSync(configPath, 'utf-8');
    config = JSON.parse(configFile);
  } catch (error) {
    console.error('❌ Error loading configuration:');
    console.error('   Please create a config.json file (see .env.example)');
    console.error(`   Error: ${error.message}`);
    process.exit(1);
  }

  // Validate configuration
  if (!config.vk?.token || !config.telegram?.token) {
    console.error('❌ Missing required configuration:');
    console.error('   - vk.token: VK group token');
    console.error('   - telegram.token: Telegram bot token');
    process.exit(1);
  }

  // Create and start bridge
  const bridge = new ChatBridge(config);

  try {
    await bridge.init();
    await bridge.start();

    // Display statistics periodically
    setInterval(() => {
      const stats = bridge.getStats();
      console.log('\n📊 Bridge Statistics:');
      console.log(`   Pending messages: ${stats.pendingMessages}`);
      console.log(`   Archived files: ${stats.archivedFiles}`);
      if (stats.archivedFiles > 0) {
        console.log(`   Latest archives: ${stats.archives.slice(0, 3).join(', ')}`);
      }
    }, 60000); // Every minute

  } catch (error) {
    console.error('❌ Error starting bridge:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await bridge.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Shutting down...');
    await bridge.stop();
    process.exit(0);
  });
}

// Run the bridge
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
