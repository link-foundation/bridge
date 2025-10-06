/**
 * Test script for Links Notation manager
 * Demonstrates the message queue and archiving functionality
 */
import { LinksNotationManager, MessageStatus } from '../src/lino.lib.mjs';
import { existsSync, rmSync } from 'fs';

const TEST_DATA_DIR = './test-data';

console.log('🧪 Testing Links Notation Manager\n');

// Clean up test data if exists
if (existsSync(TEST_DATA_DIR)) {
  rmSync(TEST_DATA_DIR, { recursive: true });
}

// Create manager
const lino = new LinksNotationManager({
  dataDir: TEST_DATA_DIR,
  partitionBy: 'day',
  maxEntriesPerFile: 5 // Small number for testing
});

console.log('✅ LinksNotationManager created\n');

// Test 1: Add messages
console.log('📝 Test 1: Adding messages to queue');
const message1 = lino.appendMessage({
  from: 'telegram',
  to: 'vk',
  text: 'Hello from Telegram!'
});
console.log(`   Added message: ${message1.id}`);

const message2 = lino.appendMessage({
  from: 'vk',
  to: 'telegram',
  text: 'Hello from VK!'
});
console.log(`   Added message: ${message2.id}`);

// Test 2: Get pending messages
console.log('\n📋 Test 2: Getting pending messages');
const pending = lino.getPendingMessages();
console.log(`   Pending messages: ${pending.length}`);
pending.forEach(msg => {
  console.log(`   - ${msg.id}: ${msg.from} → ${msg.to} (${msg.status})`);
});

// Test 3: Update message status
console.log('\n✏️  Test 3: Updating message status');
lino.updateMessageStatus(message1.id, MessageStatus.SENT);
console.log(`   Updated ${message1.id} to SENT`);

const pendingAfter = lino.getPendingMessages();
console.log(`   Pending messages now: ${pendingAfter.length}`);

// Test 4: Mark all as sent
console.log('\n✅ Test 4: Marking all messages as sent');
lino.updateMessageStatus(message2.id, MessageStatus.SENT);
console.log(`   Updated ${message2.id} to SENT`);

// Test 5: Add more messages to trigger archiving
console.log('\n📦 Test 5: Testing automatic archiving');
for (let i = 0; i < 6; i++) {
  const msg = lino.appendMessage({
    from: 'telegram',
    to: 'vk',
    text: `Test message ${i}`
  });
  lino.updateMessageStatus(msg.id, MessageStatus.SENT);
  console.log(`   Added and sent message ${i + 1}/6`);
}

// Test 6: List archives
console.log('\n📚 Test 6: Listing archives');
const archives = lino.listArchives();
console.log(`   Archived files: ${archives.length}`);
archives.forEach(archive => {
  console.log(`   - ${archive}`);
  const messages = lino.getArchive(archive);
  console.log(`     Contains ${messages.length} messages`);
});

// Test 7: Current file status
console.log('\n📄 Test 7: Current file status');
const currentPending = lino.getPendingMessages();
console.log(`   Current pending messages: ${currentPending.length}`);

console.log('\n✅ All tests completed!\n');
console.log(`Test data directory: ${TEST_DATA_DIR}`);
console.log('You can inspect the .lino files to see the format.\n');
