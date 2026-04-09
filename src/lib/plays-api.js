/**
 * PlaysAPI
 * Client for posting play sessions to the BGM API
 */
export default (baseUrl, fetchFn = fetch) => {
  return {
    /**
     * POST a single play session to /api/plays
     * @param {Object} play - Play session data
     * @param {string} play.gameName - Game name
     * @param {number} play.bggId - BGG object ID
     * @param {string} play.date - Date played (YYYY-MM-DD)
     * @param {number} play.playerCount - Number of players
     * @param {string} play.outcome - Outcome (win/loss/draw)
     * @param {string[]} play.opponents - List of opponent names
     * @returns {Promise<Object>} API response
     */
    async postPlay(play) {
      const payload = {
        ...play,
        source: 'yucata_import',
      };

      const response = await fetchFn(`${baseUrl}/api/plays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },

    /**
     * POST multiple play sessions
     * @param {Object[]} plays - Array of play session objects
     * @returns {Promise<Object[]>} Array of API responses
     */
    async postPlays(plays) {
      return Promise.all(plays.map((play) => this.postPlay(play)));
    },
  };
};
