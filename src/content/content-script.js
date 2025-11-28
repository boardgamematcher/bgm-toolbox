// Content script for extracting games from webpages
console.log('Board Game Extractor content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractGames') {
    const games = extractGames(message.pattern);
    sendResponse({
      success: true,
      games: games,
      count: games.length
    });
    return false;
  }

  if (message.action === 'getCurrentDomain') {
    sendResponse({ domain: window.location.hostname });
    return false;
  }
});

// Extract games using pattern
function extractGames(pattern) {
  if (!pattern || !pattern.selector) {
    console.error('Invalid pattern:', pattern);
    return [];
  }

  try {
    console.log('Extracting with selector:', pattern.selector);

    // Execute CSS selector
    const elements = document.querySelectorAll(pattern.selector);
    console.log('Found elements:', elements.length);

    let games = Array.from(elements).map(el => el.textContent);
    console.log('Raw games:', games.length);

    // Apply filters using PatternMatcher
    if (pattern.filters && typeof PatternMatcher !== 'undefined') {
      games = PatternMatcher.applyFilters(games, pattern.filters);
      console.log('Filtered games:', games.length);
    }

    return games;
  } catch (error) {
    console.error('Error extracting games:', error);
    return [];
  }
}
