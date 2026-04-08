// Background service worker for managing patterns and clipboard
let cachedPatterns = [];

// Load patterns eagerly (covers install, startup, and extension reload)
reloadPatterns();

chrome.runtime.onInstalled.addListener(() => {
  console.log('BGM Toolbox installed');
});

// Load patterns from storage helper
async function reloadPatterns() {
  try {
    // Load built-in patterns
    const response = await fetch(chrome.runtime.getURL('patterns/built-in.json'));
    const data = await response.json();
    const builtIn = data.patterns || [];

    // Load custom patterns
    const result = await chrome.storage.local.get('customPatterns');
    const custom = result.customPatterns || [];

    // Merge patterns (custom overrides built-in by domain)
    const patternMap = new Map();
    builtIn.forEach((pattern) => {
      patternMap.set(pattern.domain, pattern);
    });
    custom.forEach((pattern) => {
      patternMap.set(pattern.domain, pattern);
    });

    cachedPatterns = Array.from(patternMap.values());
    console.log('Loaded patterns:', cachedPatterns.length);
  } catch (error) {
    console.error('Error loading patterns:', error);
    cachedPatterns = [];
  }
}

// Find pattern for domain
function findPatternForDomain(domain) {
  return cachedPatterns.find((p) => domain === p.domain || domain.endsWith('.' + p.domain)) || null;
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkSiteSupport') {
    const respond = () => {
      const pattern = findPatternForDomain(message.domain);
      sendResponse({ supported: pattern !== null, pattern });
    };
    if (cachedPatterns.length === 0) {
      reloadPatterns().then(respond);
      return true;
    }
    respond();
    return false;
  }

  if (message.action === 'copyToClipboard') {
    copyToClipboard(message.text);
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'updateStats') {
    updateStats(message.stats);
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'reloadPatterns') {
    reloadPatterns().then(() => {
      sendResponse({ success: true, count: cachedPatterns.length });
    });
    return true; // Async response
  }

  if (message.action === 'getStats') {
    getStats().then((stats) => {
      sendResponse({ success: true, stats });
    });
    return true; // Async response
  }
});

// Copy text to clipboard (no-op in service worker, kept for future use)
async function copyToClipboard(text) {
  // navigator.clipboard is not available in MV3 service workers.
  // Clipboard writes now happen from the popup context if needed.
  console.log('copyToClipboard called, text length:', text.length);
}

// Update extraction stats
async function updateStats(stats) {
  try {
    await chrome.storage.local.set({ stats });
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// Get extraction stats
async function getStats() {
  try {
    const result = await chrome.storage.local.get('stats');
    return result.stats || { lastExtraction: null };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { lastExtraction: null };
  }
}
