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
     *   outcome is 'win' | 'loss' | null. null means the source didn't give us
     *   enough to decide (co-op with unknown label, player not listed, empty
     *   HTML). Never guess — downstream stores null rather than a false loss.
     */
    parseResultHtml(html, playerId) {
      // Use DOMParser if available (browser), otherwise use regex fallback (tests)
      let gameName = '';
      let playerCount = 0;
      let outcome = null;

      if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // Extract game name from .gamename span
        const gameNameEl = doc.querySelector('.gamename');
        gameName = gameNameEl ? gameNameEl.textContent.trim() : '';

        // Count players from .board-score-entry divs
        const scoreEntries = doc.querySelectorAll('.board-score-entry');
        playerCount = scoreEntries.length;

        // Win detection strategy (language-independent, works across 42 BGA languages):
        //
        // Competitive games: entries are ordered by rank — first entry = winner.
        //   Different labels per entry (e.g. "1er", "2e", "3e").
        //   → Player at index 0 = 'win', any other index = 'loss' (explicit rank).
        //
        // Co-op games: all entries share the same label ("Gagnant"/"Perdant"/etc).
        //   → Match the shared label against known win/loss word lists.
        //     Unknown label = null (we cannot tell; do not guess).

        // Collect all labels
        const labels = Array.from(scoreEntries).map((e) => extractLabel(e.textContent));
        const allSameLabel = labels.length > 0 && labels.every((l) => l === labels[0]);

        scoreEntries.forEach((entry, index) => {
          const playerLink = entry.querySelector('a.playername');
          if (!playerLink) return;

          const href = playerLink.getAttribute('href') || '';
          const idMatch = href.match(/id=(\d+)/);
          if (!idMatch || idMatch[1] !== String(playerId)) return;

          if (allSameLabel) {
            outcome = coopOutcomeFromLabel(labels[0]);
          } else {
            outcome = index === 0 ? 'win' : 'loss';
          }
        });
      } else {
        // Regex fallback for Node.js/test environments
        const gameNameMatch = html.match(/<span class="gamename">([^<]+)<\/span>/);
        gameName = gameNameMatch ? gameNameMatch[1].trim() : '';

        const scoreEntryMatches = html.match(/<div class="board-score-entry">/g);
        playerCount = scoreEntryMatches ? scoreEntryMatches.length : 0;

        // Collect all entries, then use position/label-based detection
        const entryRegex = /<div class="board-score-entry">([\s\S]*?)<\/div>/g;
        const entries = [];
        let entryMatch;
        while ((entryMatch = entryRegex.exec(html)) !== null) {
          entries.push(entryMatch[1]);
        }

        const entryLabels = entries.map((e) => extractLabel(e));
        const allSame = entryLabels.length > 0 && entryLabels.every((l) => l === entryLabels[0]);

        for (let i = 0; i < entries.length; i++) {
          const entryHtml = entries[i];
          const playerIdPattern = new RegExp('id=' + playerId + '"');
          if (playerIdPattern.test(entryHtml)) {
            if (allSame) {
              outcome = coopOutcomeFromLabel(entryLabels[0]);
            } else {
              outcome = i === 0 ? 'win' : 'loss';
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
 * Check if a co-op label indicates a win.
 * Only used when all players share the same label (co-op game).
 * BGA co-op results use simple words: Winner/Gagnant/Ganador/Gewinner/etc.
 * @param {string} label - The shared label text
 * @returns {boolean} True if the label indicates a win
 */
function isWinLabel(label) {
  const lower = label.toLowerCase();
  // Known win labels across major BGA languages
  const winWords = [
    'winner',
    'gagnant',
    'ganador',
    'gewinner',
    'vincitore',
    'vencedor',
    'winnaar',
    'zwycięzca',
    'победитель',
    'vítěz',
    'győztes',
    '승자',
    '胜者',
    '勝者',
    'kazanan',
  ];
  return winWords.some((w) => lower.includes(w));
}

/**
 * Check if a co-op label indicates a loss.
 * @param {string} label - The shared label text
 * @returns {boolean} True if the label indicates a loss
 */
function isLossLabel(label) {
  const lower = label.toLowerCase();
  const lossWords = [
    'loser',
    'perdant',
    'perdedor',
    'verlierer',
    'perdente',
    'verliezer',
    'przegrany',
    'проигравший',
    'poražený',
    'vesztes',
    '패자',
    '败者',
    '敗者',
    'kaybeden',
  ];
  return lossWords.some((w) => lower.includes(w));
}

/**
 * Resolve the outcome for a co-op game from the shared label.
 * Returns null when the label matches neither win nor loss words — the source
 * isn't explicit, so we refuse to guess.
 * @param {string} label - The shared label text
 * @returns {'win'|'loss'|null}
 */
function coopOutcomeFromLabel(label) {
  if (isWinLabel(label)) return 'win';
  if (isLossLabel(label)) return 'loss';
  return null;
}

/**
 * Extract the rank/status label from a score entry's text.
 * BGA entries look like "Gagnant - PlayerName - 5" or "1er - PlayerName - 42".
 * The label is the text before the first " - " separator, trimmed.
 * Used for position-based win detection (language-independent).
 * @param {string} text - Full text content of a score entry
 * @returns {string} The label portion (e.g. "Gagnant", "1er", "Winner")
 */
function extractLabel(text) {
  const sep = text.indexOf(' - ');
  const raw = sep >= 0 ? text.substring(0, sep) : text;
  return raw.trim().replace(/\s+/g, ' ');
}

// Export to global scope for use in content scripts
if (typeof window !== 'undefined') {
  window.BGAScraper = BGAScraper;
  window.extractLabel = extractLabel;
  window.isWinLabel = isWinLabel;
  window.isLossLabel = isLossLabel;
  window.coopOutcomeFromLabel = coopOutcomeFromLabel;
}

// Export for Node.js/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BGAScraper, extractLabel, isWinLabel, isLossLabel, coopOutcomeFromLabel };
}
