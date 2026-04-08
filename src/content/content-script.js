// Content script for extracting games from webpages
console.log('BGM Toolbox content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractGames') {
    const games = extractGames(message.pattern);
    sendResponse({
      success: true,
      games: games,
      count: games.length,
    });
    return false;
  }

  if (message.action === 'getCurrentDomain') {
    sendResponse({ domain: window.location.hostname });
    return false;
  }
});

// Get image URL from an img element, checking multiple attributes
function getImageUrl(img) {
  if (!img) return null;
  return img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || null;
}

// Get text content from an element, trimmed
function getText(el) {
  return el ? el.textContent.trim() : null;
}

// Extract structured game data using pattern
function extractGames(pattern) {
  if (!pattern || !pattern.selector) {
    console.error('Invalid pattern:', pattern);
    return [];
  }

  try {
    // If card_selector is present, extract structured data per card
    if (pattern.card_selector) {
      return extractStructured(pattern);
    }

    // Legacy: flat text extraction
    console.log('Extracting with selector:', pattern.selector);
    const elements = document.querySelectorAll(pattern.selector);
    let names = Array.from(elements).map((el) => el.textContent);

    if (pattern.filters && typeof PatternMatcher !== 'undefined') {
      names = PatternMatcher.applyFilters(names, pattern.filters);
    }

    // Return as structured objects for consistency
    return names.map((name) => ({ name }));
  } catch (error) {
    console.error('Error extracting games:', error);
    return [];
  }
}

// Extract structured data from card elements
function extractStructured(pattern) {
  const cards = document.querySelectorAll(pattern.card_selector);
  console.log('Found %d cards with selector: %s', cards.length, pattern.card_selector);

  const results = [];
  const seen = new Set();

  for (const card of cards) {
    // Extract name
    const nameEl = card.querySelector(pattern.selector);
    const name = getText(nameEl);
    if (!name) continue;

    // Apply exclude filters
    if (pattern.filters && pattern.filters.exclude) {
      let excluded = false;
      for (const pat of pattern.filters.exclude) {
        if (new RegExp(pat).test(name)) {
          excluded = true;
          break;
        }
      }
      if (excluded) continue;
    }

    // Deduplicate
    if (pattern.filters && pattern.filters.deduplicate !== false) {
      if (seen.has(name)) continue;
      seen.add(name);
    }

    // Extract image
    const imgEl = pattern.image_selector ? card.querySelector(pattern.image_selector) : null;
    const image = getImageUrl(imgEl);

    // Extract price (current/sale price)
    const priceEl = pattern.price_selector ? card.querySelector(pattern.price_selector) : null;
    const price = getText(priceEl);

    // Extract original/struck-through price
    const salePriceEl = pattern.sale_price_selector
      ? card.querySelector(pattern.sale_price_selector)
      : null;
    const sale_price = getText(salePriceEl);

    results.push({
      name,
      image: image || null,
      price: price || null,
      sale_price: sale_price || null,
    });
  }

  console.log('Extracted %d structured games', results.length);
  return results;
}
