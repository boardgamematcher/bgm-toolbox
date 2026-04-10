/**
 * YucataScraper
 * Extracts play history data from the Yucata Game History page
 * Uses the DataTable API (via page-context script injection) to access all rows,
 * including those not currently visible due to pagination.
 */
function YucataScraper() {
  return {
    /**
     * Parse DataTable row objects into play objects
     * @param {Object[]} rows - Array of DataTable row data
     * @returns {Object[]} Array of parsed play objects
     */
    parseDataTableRows(rows) {
      return rows
        .map((row) => {
          if (!row.GameTypeId || !row.FinishedOnString) {
            return null;
          }

          // Convert DD.MM.YYYY to YYYY-MM-DD
          const dateParts = row.FinishedOnString.split('.');
          if (dateParts.length !== 3) {
            return null;
          }
          const date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

          // FinalPosition 1 = win, otherwise loss
          const outcome = row.FinalPosition === 1 ? 'win' : 'loss';

          return {
            yucataId: String(row.GameTypeId),
            gameName: row.GameTypeName,
            date,
            playerCount: row.NumPlayers,
            outcome,
          };
        })
        .filter((play) => play !== null);
    },

    /**
     * Extract all plays from the page using DataTable API
     * Injects a script into the page context to access jQuery DataTable data,
     * which gives access to all rows regardless of pagination state.
     * @returns {Promise<Object[]>} Array of play objects
     */
    extractPlays() {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Timed out waiting for Yucata DataTable data'));
        }, 60000);

        const handler = (event) => {
          if (event.data && event.data.type === 'bgm-yucata-data') {
            window.removeEventListener('message', handler);
            clearTimeout(timeout);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(this.parseDataTableRows(event.data.plays));
            }
          }
        };
        window.addEventListener('message', handler);

        // Inject script into page context to access DataTable API
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('src/content/yucata-page-extract.js');
        document.documentElement.appendChild(script);
        script.remove();
      });
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
