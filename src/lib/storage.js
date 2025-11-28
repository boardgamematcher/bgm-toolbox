// Storage helper for managing patterns and stats
const Storage = {
  // Load built-in patterns from JSON file
  async loadBuiltInPatterns() {
    try {
      const response = await fetch(chrome.runtime.getURL('patterns/built-in.json'));
      const data = await response.json();
      return data.patterns || [];
    } catch (error) {
      console.error('Error loading built-in patterns:', error);
      return [];
    }
  },

  // Load user custom patterns from storage
  async loadCustomPatterns() {
    try {
      const result = await chrome.storage.local.get('customPatterns');
      return result.customPatterns || [];
    } catch (error) {
      console.error('Error loading custom patterns:', error);
      return [];
    }
  },

  // Save custom patterns to storage
  async saveCustomPatterns(patterns) {
    try {
      await chrome.storage.local.set({ customPatterns: patterns });
      return true;
    } catch (error) {
      console.error('Error saving custom patterns:', error);
      return false;
    }
  },

  // Load and merge all patterns (custom overrides built-in by domain)
  async loadAllPatterns() {
    const builtIn = await this.loadBuiltInPatterns();
    const custom = await this.loadCustomPatterns();

    // Create map with built-in patterns
    const patternMap = new Map();
    builtIn.forEach(pattern => {
      patternMap.set(pattern.domain, pattern);
    });

    // Override with custom patterns
    custom.forEach(pattern => {
      patternMap.set(pattern.domain, pattern);
    });

    return Array.from(patternMap.values());
  },

  // Find pattern matching current domain
  findPatternForDomain(patterns, domain) {
    // Try exact match first
    let pattern = patterns.find(p => domain === p.domain || domain.endsWith('.' + p.domain));
    return pattern || null;
  },

  // Load extraction stats
  async loadStats() {
    try {
      const result = await chrome.storage.local.get('stats');
      return result.stats || { lastExtraction: null };
    } catch (error) {
      console.error('Error loading stats:', error);
      return { lastExtraction: null };
    }
  },

  // Save extraction stats
  async saveStats(stats) {
    try {
      await chrome.storage.local.set({ stats });
      return true;
    } catch (error) {
      console.error('Error saving stats:', error);
      return false;
    }
  }
};

// Make available to other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}
