/**
 * YucataMapper
 * Maps Yucata game IDs to BGG object IDs using a lookup table.
 */
function YucataMapper(mappingData) {
  const mappings = mappingData.mappings || {};

  return {
    /**
     * Map a single Yucata game ID to BGG object ID
     * @param {string} yucataId - Yucata GameTypeId
     * @returns {number|null} BGG objectid or null if unmapped
     */
    mapGameId(yucataId) {
      const mapped = mappings[yucataId];
      // Return null (not throw) for unmapped games to allow graceful filtering
      // in the import pipeline. Unmapped games are logged as warnings but don't
      // block the entire import. This is better UX: import 100 games, skip 5 unknown ones.
      return mapped !== undefined ? mapped : null;
    },

    /**
     * Map multiple Yucata game IDs to BGG IDs
     * @param {string[]} yucataIds - Array of Yucata GameTypeIds
     * @returns {Array} Array of {yucataId, bggId} objects
     */
    mapGameIds(yucataIds) {
      return yucataIds.map((yucataId) => ({
        yucataId,
        bggId: this.mapGameId(yucataId),
      }));
    },
  };
}

// Export to global scope for use in content scripts
if (typeof window !== 'undefined') {
  window.YucataMapper = YucataMapper;
}

// Export for Node.js/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YucataMapper;
}
