/**
 * BGAScraper
 * Extracts play history data from Board Game Arena using their AJAX API
 */
function BGAScraper(fetchFn, tokenOverride) {
  // Use provided fetch or default to global fetch
  const _fetch = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);

  return {
    /**
     * Get the x-request-token from the TournoiEnLigneidt cookie
     * @returns {string|null} The request token or null if not found
     */
    getRequestToken() {
      // Search page scripts for the requestToken value
      // bgaConfig is set in an inline script, content scripts can read DOM text
      const scripts = document.querySelectorAll('script:not([src])');
      for (const script of scripts) {
        const text = script.textContent;
        // Match patterns like: requestToken: "xxx" or requestToken:"xxx"
        const match = text.match(/requestToken\s*[:=]\s*["']([^"']+)["']/);
        if (match) return match[1];
      }
      // Fallback: try cookie
      const cookieMatch = document.cookie.match(/TournoiEnLigneidt=([^;]+)/);
      return cookieMatch ? cookieMatch[1] : null;
    },

    /**
     * Parse the HTML fragment from a BGA game result to extract play details
     * @param {string} html - HTML fragment from a BGA news item
     * @param {string} playerId - The current player's BGA ID
     * @returns {Object} Parsed play details { gameName, playerCount, outcome }
     */
    parseResultHtml(html, playerId) {
      // Use DOMParser if available (browser), otherwise use regex fallback (tests)
      let gameName = '';
      let playerCount = 0;
      let outcome = 'loss';

      if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // Extract game name from .gamename span
        const gameNameEl = doc.querySelector('.gamename');
        gameName = gameNameEl ? gameNameEl.textContent.trim() : '';

        // Count players from .board-score-entry divs
        const scoreEntries = doc.querySelectorAll('.board-score-entry');
        playerCount = scoreEntries.length;

        // Determine outcome for the current player
        scoreEntries.forEach((entry) => {
          const playerLink = entry.querySelector('a.playername');
          if (!playerLink) return;

          const href = playerLink.getAttribute('href') || '';
          const idMatch = href.match(/id=(\d+)/);
          if (!idMatch || idMatch[1] !== String(playerId)) return;

          // Check if this player won
          const text = entry.textContent;
          if (isWinText(text)) {
            outcome = 'win';
          }
        });
      } else {
        // Regex fallback for Node.js/test environments
        const gameNameMatch = html.match(/<span class="gamename">([^<]+)<\/span>/);
        gameName = gameNameMatch ? gameNameMatch[1].trim() : '';

        const scoreEntryMatches = html.match(/<div class="board-score-entry">/g);
        playerCount = scoreEntryMatches ? scoreEntryMatches.length : 0;

        // Find the score entry containing the current player and check for win
        const entryRegex = /<div class="board-score-entry">([\s\S]*?)<\/div>/g;
        let entryMatch;
        while ((entryMatch = entryRegex.exec(html)) !== null) {
          const entryHtml = entryMatch[1];
          const playerIdPattern = new RegExp('id=' + playerId + '"');
          if (playerIdPattern.test(entryHtml)) {
            if (isWinText(entryHtml)) {
              outcome = 'win';
            }
            break;
          }
        }
      }

      return { gameName, playerCount, outcome };
    },

    /**
     * Fetch all plays for a player by paginating through the BGA API
     * @param {string} playerId - The BGA player ID
     * @returns {Promise<Object[]>} Array of play objects
     */
    async extractPlays(playerId) {
      if (!_fetch) {
        throw new Error('No fetch function available');
      }

      const requestToken = tokenOverride !== undefined ? tokenOverride : this.getRequestToken();
      if (!requestToken) {
        throw new Error('Could not find BGA request token. Make sure you are logged in.');
      }

      const plays = [];
      let page = 1;
      let fromTime = null;
      let fromId = null;
      let hasMore = true;

      while (hasMore) {
        let url = `/message/board?type=playerresult&id=${playerId}&social=false&page=${page}&per_page=100`;
        if (fromTime && fromId) {
          url += `&from_time=${fromTime}&from_id=${fromId}`;
        }

        let response;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            response = await _fetch(url, {
              credentials: 'include',
              headers: {
                'x-request-token': requestToken,
                'x-requested-with': 'XMLHttpRequest',
              },
            });
            break;
          } catch (e) {
            if (attempt === 2) throw e;
            await new Promise((r) => setTimeout(r, 2000));
          }
        }

        if (!response.ok) {
          throw new Error(`BGA API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!data || data.status !== 1 || !data.data || !data.data.news) {
          break;
        }

        const newsItems = data.data.news;
        if (newsItems.length === 0) {
          hasMore = false;
          break;
        }

        // Filter for game results only (news_type === "2")
        const gameResults = newsItems.filter((item) => String(item.news_type) === '2');

        for (const item of gameResults) {
          const parsed = this.parseResultHtml(item.html || '', playerId);
          if (!parsed.gameName) continue;

          // Extract BGA game slug from image URL (language-independent key)
          // e.g., "https://x.boardgamearena.net/data/gamemedia/skyteam/icon/default.png" → "skyteam"
          const imgUrl = item.img || '';
          const slugMatch = imgUrl.match(/gamemedia\/([^/]+)\//);
          const bgaSlug = slugMatch ? slugMatch[1] : '';

          // Convert unix timestamp to YYYY-MM-DD
          const date = new Date(item.timestamp * 1000);
          const dateStr =
            date.getFullYear() +
            '-' +
            String(date.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(date.getDate()).padStart(2, '0');

          plays.push({
            bgaGameId: String(item.subject_id),
            bgaSlug,
            gameName: parsed.gameName,
            date: dateStr,
            playerCount: parsed.playerCount,
            outcome: parsed.outcome,
          });
        }

        // Set up pagination cursor from the last item
        const lastItem = newsItems[newsItems.length - 1];
        fromTime = lastItem.timestamp;
        fromId = lastItem.id;
        page++;

        // If we got fewer items than requested, we've reached the end
        if (newsItems.length < 100) {
          hasMore = false;
        }
      }

      return plays;
    },
  };
}

/**
 * Check if a text fragment indicates a win
 * Handles multiple languages: "Gagnant" (French), "Winner" (English),
 * positional markers like "1er", "1st", etc.
 * @param {string} text - Text to check
 * @returns {boolean} True if the text indicates a win
 */
function isWinText(text) {
  // Check for common win indicators across languages
  const winPatterns = [
    /\bGagnant\b/i,
    /\bWinner\b/i,
    /\bGanador\b/i,
    /\bGewinner\b/i,
    /\bVincitore\b/i,
    /\b1\s*[eè][rR]?\b/, // 1er, 1e (French ordinals)
    /\b1st\b/i, // 1st (English)
    /\b1\u1d49\u02b3\b/, // 1 superscript e+r
  ];

  return winPatterns.some((pattern) => pattern.test(text));
}

// Export to global scope for use in content scripts
if (typeof window !== 'undefined') {
  window.BGAScraper = BGAScraper;
  window.isWinText = isWinText;
}

// Export for Node.js/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BGAScraper, isWinText };
}
