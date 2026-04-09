/**
 * YucataScraper
 * Extracts play history data from the Yucata Game History page
 */
function YucataScraper() {
  return {
    /**
     * Parse play rows from a Yucata Game History DataTable
     * Expects rows with cells: [GameTypeId, GameName, Date, PlayerCount, Outcome]
     * @param {HTMLTableRowElement[]} rows - Array of table rows
     * @returns {Object[]} Array of parsed play objects
     */
    parsePlayRows(rows) {
      return rows
        .map((row) => {
          const cells = Array.from(row.cells || []).map((cell) => {
            // Handle both DOM elements (with textContent) and test strings
            if (typeof cell === 'string') {
              return cell;
            }
            return cell.textContent ? cell.textContent.trim() : '';
          });

          // Expect: [yucataId, gameName, date, playerCount, outcome]
          if (cells.length < 5) {
            return null; // Skip malformed rows
          }

          return {
            yucataId: cells[0],
            gameName: cells[1],
            date: cells[2],
            // Parse player count as base-10 integer (radix 10 prevents accidental octal interpretation)
            playerCount: parseInt(cells[3], 10),
            // Normalize outcome to lowercase for consistency (Yucata may vary casing)
            outcome: cells[4].toLowerCase(),
          };
        })
        .filter((play) => play !== null);
    },

    /**
     * Extract all plays from the page
     * Finds the Game History DataTable and extracts all visible rows
     * @returns {Object[]} Array of play objects
     */
    extractPlays() {
      // Selector for Yucata Game History DataTable (may need adjustment based on actual DOM)
      const table = document.querySelector('#divPlayerRankingListTable');
      if (!table) {
        console.warn('Yucata Game History table not found');
        return [];
      }

      const tbody = table.querySelector('tbody');
      if (!tbody) {
        return [];
      }

      const rows = Array.from(tbody.querySelectorAll('tr'));
      return this.parsePlayRows(rows);
    },
  };
}

// Export to global scope for use in content scripts
if (typeof window !== 'undefined') {
  window.YucataScraper = YucataScraper;
}

// Export for Node.js/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YucataScraper;
}
