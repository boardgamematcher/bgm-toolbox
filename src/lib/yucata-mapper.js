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
