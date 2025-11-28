// Pattern matching and extraction logic
const PatternMatcher = {
  // Extract board game names using a pattern
  extract(pattern) {
    if (!pattern || !pattern.selector) {
      return [];
    }

    try {
      // Execute CSS selector
      const elements = document.querySelectorAll(pattern.selector);
      let games = Array.from(elements).map(el => el.textContent);

      // Apply filters
      if (pattern.filters) {
        games = this.applyFilters(games, pattern.filters);
      }

      return games;
    } catch (error) {
      console.error('Error extracting games:', error);
      return [];
    }
  },

  // Apply filters to extracted text
  applyFilters(games, filters) {
    let filtered = games;

    // Trim whitespace if enabled
    if (filters.trim !== false) {
      filtered = filtered.map(game => game.trim());
    }

    // Apply exclude patterns
    if (filters.exclude && Array.isArray(filters.exclude)) {
      filters.exclude.forEach(pattern => {
        const regex = new RegExp(pattern);
        filtered = filtered.filter(game => !regex.test(game));
      });
    }

    // Apply include patterns (only keep matches)
    if (filters.include && Array.isArray(filters.include)) {
      const includeRegexes = filters.include.map(pattern => new RegExp(pattern));
      filtered = filtered.filter(game =>
        includeRegexes.some(regex => regex.test(game))
      );
    }

    // Remove empty strings
    filtered = filtered.filter(game => game.length > 0);

    // Deduplicate if enabled
    if (filters.deduplicate !== false) {
      filtered = [...new Set(filtered)];
    }

    return filtered;
  },

  // Validate a pattern structure
  validatePattern(pattern) {
    if (!pattern || typeof pattern !== 'object') {
      return { valid: false, error: 'Pattern must be an object' };
    }

    if (!pattern.domain || typeof pattern.domain !== 'string') {
      return { valid: false, error: 'Pattern must have a domain string' };
    }

    if (!pattern.name || typeof pattern.name !== 'string') {
      return { valid: false, error: 'Pattern must have a name string' };
    }

    if (!pattern.selector || typeof pattern.selector !== 'string') {
      return { valid: false, error: 'Pattern must have a selector string' };
    }

    // Validate selector syntax
    try {
      document.querySelector(pattern.selector);
    } catch (error) {
      return { valid: false, error: 'Invalid CSS selector: ' + error.message };
    }

    return { valid: true };
  }
};

// Make available to other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PatternMatcher;
}
