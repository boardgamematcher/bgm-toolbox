/* eslint-disable no-undef */
/**
 * Yucata Import Listener
 * Listens for import requests from the popup and executes the full pipeline:
 * 1. Scrape play history from the page
 * 2. Load Yucata→BGG mapping
 * 3. Map game IDs
 * 4. POST to BGM API
 */

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'import_yucata_plays') {
    importYucataPlays()
      .then((result) => {
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        console.error('Yucata import error:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Keep the message channel open for async response
    return true;
  }
});

/**
 * Validate play outcome value
 * @param {string} outcome - The outcome to validate
 * @returns {boolean} True if outcome is valid
 * @description Valid outcomes are: 'win', 'loss', 'draw'. Yucata outcomes are normalized
 * to lowercase during scraping, so we check for these exact values.
 */
function isValidOutcome(outcome) {
  const validOutcomes = ['win', 'loss', 'draw'];
  return validOutcomes.includes(outcome);
}

/**
 * Main import pipeline
 */
async function importYucataPlays() {
  // Step 1: Load Yucata→BGG mapping from extension storage
  const mappingResponse = await fetch(chrome.runtime.getURL('patterns/yucata-mapping.json'));
  const mappingData = await mappingResponse.json();
  const mapper = YucataMapper(mappingData);

  // Step 2: Extract plays from the page
  const scraper = YucataScraper();
  const rawPlays = scraper.extractPlays();

  if (rawPlays.length === 0) {
    throw new Error(
      'No plays found on the page. Make sure you are on the Yucata Game History page.'
    );
  }

  // Step 3: Map game IDs and validate outcomes, filter unmapped/invalid games
  const mappedPlays = rawPlays
    .map((play) => {
      const bggId = mapper.mapGameId(play.yucataId);
      if (!bggId) {
        console.warn(`Skipping unmapped Yucata game: ${play.gameName} (ID: ${play.yucataId})`);
        return null;
      }
      // Validate outcome value (must be 'win', 'loss', or 'draw')
      if (!isValidOutcome(play.outcome)) {
        console.warn(
          `Skipping play with invalid outcome: ${play.gameName} (outcome: ${play.outcome})`
        );
        return null;
      }
      return {
        gameName: play.gameName,
        bggId,
        date: play.date,
        playerCount: play.playerCount,
        outcome: play.outcome,
      };
    })
    .filter((play) => play !== null);

  if (mappedPlays.length === 0) {
    throw new Error('No plays could be mapped to BGG. Check the mapping table.');
  }

  // Step 4: Get API URL from extension storage
  const storage = await chrome.storage.local.get('apiUrl');
  const apiUrl = storage.apiUrl || 'http://localhost:3000'; // Default for dev

  // Step 5: POST to BGM API
  const api = PlaysAPI(apiUrl);
  const results = await api.postPlays(mappedPlays);

  return {
    scraped: rawPlays.length,
    mapped: mappedPlays.length,
    posted: results.length,
    results,
  };
}
