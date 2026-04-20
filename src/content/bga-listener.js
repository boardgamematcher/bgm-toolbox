/* eslint-disable no-undef */
/**
 * BGA Import Listener
 * Listens for import requests from the popup and executes the pipeline:
 * 1. Scrape play history from BGA via AJAX API
 * 2. Send plays to the service worker for game name resolution and posting
 */

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'import_bga_plays') {
    importBGAPlays()
      .then((result) => {
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        console.error('BGA import error:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Keep the message channel open for async response
    return true;
  }
});

/**
 * Extract the BGA player ID from the current page URL or DOM
 * Supports: /gamestats?player=84147370 and /player?id=84147370
 * @returns {string|null} The player ID or null
 */
function extractPlayerId() {
  const url = new URL(window.location.href);

  // Try ?player= parameter (gamestats page)
  const playerParam = url.searchParams.get('player');
  if (playerParam) return playerParam;

  // Try ?id= parameter (player profile page)
  const idParam = url.searchParams.get('id');
  if (idParam) return idParam;

  // Try to find player ID in the page DOM as fallback
  const playerIdMeta = document.querySelector('meta[name="player_id"]');
  if (playerIdMeta) return playerIdMeta.getAttribute('content');

  return null;
}

/**
 * Main import pipeline
 */
async function importBGAPlays() {
  // Step 1: Get player ID
  const playerId = extractPlayerId();
  if (!playerId) {
    throw new Error('Could not determine BGA player ID. Navigate to your game stats page first.');
  }

  // Step 2: Load BGA→BGG mapping
  const mappingResponse = await fetch(chrome.runtime.getURL('patterns/bga-mapping.json'));
  const mappingData = await mappingResponse.json();
  const mappings = mappingData.mappings;

  // Step 3: Scrape plays from BGA API
  const scraper = BGAScraper();
  const plays = await scraper.extractPlays(playerId);

  if (plays.length === 0) {
    throw new Error('No plays found. Make sure you are on the correct BGA profile page.');
  }

  // Step 4: Map BGA slugs to BGG IDs, filter unmapped
  const mappedPlays = [];
  const unmappedNames = new Set();

  for (const play of plays) {
    const bggId = mappings[play.bgaSlug] || mappings[play.gameName];
    if (!bggId) {
      unmappedNames.add(`${play.gameName} (${play.bgaSlug})`);
      continue;
    }
    mappedPlays.push({
      gameName: play.gameName,
      boardgame_id: bggId,
      played_at: play.date,
      player_count: play.playerCount,
      outcome: play.outcome,
    });
  }

  if (unmappedNames.size > 0) {
    console.warn('BGA import: unmapped games:', [...unmappedNames].join(', '));
  }

  if (mappedPlays.length === 0) {
    throw new Error('No plays could be mapped. Check the mapping file.');
  }

  // Step 5: Send to service worker for batch posting (uses bgg_id like Yucata)
  const response = await chrome.runtime.sendMessage({
    action: 'postYucataPlays',
    plays: mappedPlays,
  });

  if (!response.success) {
    throw new Error(response.error);
  }

  const { posted, skipped, duplicates } = response.results;

  return {
    scraped: plays.length,
    posted: posted.length,
    skipped: unmappedNames.size + skipped.length,
    errors: 0,
  };
}
