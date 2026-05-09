/**
 * Simple Links Notation Parser
 * Implements a basic parser for the .lino format
 *
 * Format:
 * (
 *   value1
 *   value2
 *   value3
 * )
 */

export class LinoParser {
  constructor(content) {
    this.content = content;
  }

  /**
   * Parse the Links Notation content
   * Returns an array of parsed entries
   */
  parse() {
    if (!this.content || !this.content.trim()) {
      return [];
    }

    const entries = [];
    let currentEntry = null;
    let depth = 0;

    const lines = this.content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '(') {
        // Start of new entry
        depth++;
        if (depth === 1) {
          currentEntry = [];
        }
      } else if (trimmed === ')') {
        // End of entry
        depth--;
        if (depth === 0 && currentEntry) {
          entries.push(currentEntry);
          currentEntry = null;
        }
      } else if (trimmed && depth > 0 && currentEntry !== null) {
        // Parse value
        const value = this.parseValue(trimmed);
        currentEntry.push(value);
      }
    }

    return entries;
  }

  /**
   * Parse a single value from the notation
   */
  parseValue(value) {
    // Try to parse as JSON first (for strings, numbers, etc.)
    try {
      return JSON.parse(value);
    } catch {
      // If not valid JSON, return as-is
      return value;
    }
  }

  /**
   * Extract numeric IDs from parsed entries
   */
  parseNumericIds() {
    const entries = this.parse();
    return entries.map(entry => {
      if (Array.isArray(entry) && entry.length > 0) {
        const firstValue = entry[0];
        if (typeof firstValue === 'number') {
          return firstValue;
        }
        // Try to parse as number
        const num = Number(firstValue);
        return isNaN(num) ? firstValue : num;
      }
      return null;
    }).filter(id => id !== null);
  }

  /**
   * Extract string values from parsed entries
   */
  parseStringValues() {
    const entries = this.parse();
    return entries.map(entry => {
      if (Array.isArray(entry) && entry.length > 0) {
        return String(entry[0]);
      }
      return null;
    }).filter(val => val !== null);
  }
}

/**
 * Format values into Links Notation
 */
export function formatLinksNotation(values) {
  if (!Array.isArray(values)) {
    values = [values];
  }

  const formatted = values.map(val => {
    if (typeof val === 'string' && !val.startsWith('"')) {
      return `  ${JSON.stringify(val)}`;
    }
    return `  ${val}`;
  }).join('\n');

  return `(\n${formatted}\n)\n`;
}
