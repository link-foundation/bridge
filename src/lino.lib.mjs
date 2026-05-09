import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { LinoParser } from './lino-parser.mjs';

/**
 * Message status in the transaction log
 */
export const MessageStatus = {
  QUEUED: 'queued',
  SENT: 'sent',
  FAILED: 'failed'
};

/**
 * Links Notation Manager for message queue and transaction logging
 * Implements append-only log with automatic archiving
 */
export class LinksNotationManager {
  constructor(options = {}) {
    this.dataDir = options.dataDir || './data';
    this.currentFile = join(this.dataDir, 'current.lino');
    this.archiveDir = join(this.dataDir, 'archive');
    this.partitionBy = options.partitionBy || 'day'; // 'day' or 'week'
    this.maxEntriesPerFile = options.maxEntriesPerFile || 10000;

    this.ensureDirectories();
  }

  /**
   * Ensure data directories exist
   */
  ensureDirectories() {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    if (!existsSync(this.archiveDir)) {
      mkdirSync(this.archiveDir, { recursive: true });
    }
  }

  /**
   * Parse a .lino file and extract message entries
   */
  parse(filePath) {
    if (!existsSync(filePath)) {
      return [];
    }

    const content = readFileSync(filePath, 'utf-8');
    if (!content.trim()) {
      return [];
    }

    const parser = new LinoParser(content);
    const parsed = parser.parse();

    // Convert parsed data to message entries
    return this.parseMessageEntries(parsed);
  }

  /**
   * Convert parsed lino data to message entries
   */
  parseMessageEntries(parsed) {
    const entries = [];

    if (!parsed || !Array.isArray(parsed)) {
      return entries;
    }

    for (const item of parsed) {
      if (Array.isArray(item) && item.length >= 5) {
        entries.push({
          id: item[0],
          timestamp: item[1],
          from: item[2],
          to: item[3],
          text: item[4],
          status: item[5] || MessageStatus.QUEUED
        });
      }
    }

    return entries;
  }

  /**
   * Format message entry to Links Notation
   */
  formatEntry(entry) {
    return `(\n  ${entry.id}\n  ${entry.timestamp}\n  ${entry.from}\n  ${entry.to}\n  ${JSON.stringify(entry.text)}\n  ${entry.status}\n)\n`;
  }

  /**
   * Append a message to the current .lino file
   */
  appendMessage(message) {
    const entry = {
      id: message.id || this.generateId(),
      timestamp: message.timestamp || Date.now(),
      from: message.from,
      to: message.to,
      text: message.text,
      status: message.status || MessageStatus.QUEUED
    };

    const formatted = this.formatEntry(entry);

    // Append to current file
    if (existsSync(this.currentFile)) {
      const content = readFileSync(this.currentFile, 'utf-8');
      writeFileSync(this.currentFile, content + formatted, 'utf-8');
    } else {
      writeFileSync(this.currentFile, formatted, 'utf-8');
    }

    // Check if archiving is needed
    this.checkAndArchive();

    return entry;
  }

  /**
   * Update message status
   */
  updateMessageStatus(messageId, newStatus) {
    const messages = this.parse(this.currentFile);
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, status: newStatus };
      }
      return msg;
    });

    // Rewrite the current file
    const content = updatedMessages.map(msg => this.formatEntry(msg)).join('');
    writeFileSync(this.currentFile, content, 'utf-8');
  }

  /**
   * Get all pending messages (queued status)
   */
  getPendingMessages() {
    const messages = this.parse(this.currentFile);
    return messages.filter(msg => msg.status === MessageStatus.QUEUED);
  }

  /**
   * Generate unique message ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if archiving is needed and perform it
   */
  checkAndArchive() {
    if (!existsSync(this.currentFile)) {
      return;
    }

    const messages = this.parse(this.currentFile);

    // Archive if all messages are sent/failed or max entries reached
    const allCompleted = messages.every(msg =>
      msg.status === MessageStatus.SENT || msg.status === MessageStatus.FAILED
    );
    const tooManyEntries = messages.length >= this.maxEntriesPerFile;

    if (allCompleted || tooManyEntries) {
      this.archive();
    }
  }

  /**
   * Archive current .lino file
   */
  archive() {
    if (!existsSync(this.currentFile)) {
      return;
    }

    const now = new Date();
    const dateStr = this.getDateString(now);
    const archiveName = `${dateStr}.lino`;
    const archivePath = join(this.archiveDir, archiveName);

    // If archive file already exists, append a counter
    let counter = 1;
    let finalArchivePath = archivePath;
    while (existsSync(finalArchivePath)) {
      const base = archiveName.replace('.lino', '');
      finalArchivePath = join(this.archiveDir, `${base}-${counter}.lino`);
      counter++;
    }

    renameSync(this.currentFile, finalArchivePath);
    console.log(`Archived: ${finalArchivePath}`);
  }

  /**
   * Get date string for archiving based on partition strategy
   */
  getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    if (this.partitionBy === 'week') {
      const weekNum = this.getWeekNumber(date);
      return `${year}-W${String(weekNum).padStart(2, '0')}`;
    }

    return `${year}-${month}-${day}`;
  }

  /**
   * Get ISO week number
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * List all archive files
   */
  listArchives() {
    if (!existsSync(this.archiveDir)) {
      return [];
    }
    return readdirSync(this.archiveDir)
      .filter(file => file.endsWith('.lino'))
      .sort()
      .reverse();
  }

  /**
   * Get messages from an archive file
   */
  getArchive(archiveName) {
    const archivePath = join(this.archiveDir, archiveName);
    return this.parse(archivePath);
  }
}
