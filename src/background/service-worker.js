// Background service worker for managing patterns and clipboard
const PROFILES_URL =
  'https://raw.githubusercontent.com/boardgamematcher/site-profiles/main/profiles.json';
const PROFILES_CACHE_KEY = 'cachedProfiles';
const PROFILES_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

let cachedPatterns = [];

// Load patterns eagerly (covers install, startup, and extension reload)
// Always fetch fresh from GitHub (cache is for between service worker restarts)
chrome.storage.local.remove(PROFILES_CACHE_KEY).then(() => reloadPatterns());

chrome.runtime.onInstalled.addListener(() => {
  console.log('BGM Toolbox installed/updated');
});

// Fetch shared profiles from GitHub, with local cache and bundled fallback
async function fetchSharedProfiles() {
  // Check local cache first
  try {
    const cached = await chrome.storage.local.get(PROFILES_CACHE_KEY);
    const entry = cached[PROFILES_CACHE_KEY];
    if (entry && Date.now() - entry.timestamp < PROFILES_CACHE_TTL) {
      console.log('Using cached profiles (%d profiles)', entry.profiles.length);
      return entry.profiles;
    }
  } catch (_e) {
    // Cache read failed, continue to fetch
  }

  // Fetch from GitHub
  try {
    const response = await fetch(PROFILES_URL);
    if (response.ok) {
      const data = await response.json();
      const profiles = data.profiles || [];
      // Cache the result
      await chrome.storage.local.set({
        [PROFILES_CACHE_KEY]: { profiles, timestamp: Date.now() },
      });
      console.log('Fetched %d profiles from GitHub', profiles.length);
      return profiles;
    }
  } catch (_e) {
    console.warn('Failed to fetch profiles from GitHub, using fallback');
  }

  // Fall back to bundled file
  try {
    const response = await fetch(chrome.runtime.getURL('patterns/built-in.json'));
    const data = await response.json();
    return data.profiles || data.patterns || [];
  } catch (_e) {
    return [];
  }
}

// Load patterns from shared profiles + custom patterns
async function reloadPatterns() {
  try {
    const sharedProfiles = await fetchSharedProfiles();

    // Load custom patterns
    const result = await chrome.storage.local.get('customPatterns');
    const custom = result.customPatterns || [];

    // Merge: shared profiles first, custom overrides by domain
    const patternMap = new Map();
    sharedProfiles.forEach((p) => patternMap.set(p.domain + ':' + p.name, p));
    custom.forEach((p) => patternMap.set(p.domain + ':' + (p.name || 'custom'), p));

    cachedPatterns = Array.from(patternMap.values());
    console.log('Loaded patterns:', cachedPatterns.length);
  } catch (error) {
    console.error('Error loading patterns:', error);
    cachedPatterns = [];
  }
}

// Find pattern for domain (simple) or full URL (precise via url_pattern)
function findPatternForDomain(domain, url) {
  // Try URL pattern match first (more specific, first match wins)
  if (url) {
    for (const p of cachedPatterns) {
      if (p.url_pattern) {
        try {
          if (new RegExp(p.url_pattern).test(url)) {
            console.log('Matched profile:', p.name, 'card_selector:', p.card_selector);
            return p;
          }
        } catch (_e) {
          // Invalid regex, skip
        }
      }
    }
  }
  // Fall back to domain match
  return cachedPatterns.find((p) => domain === p.domain || domain.endsWith('.' + p.domain)) || null;
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkSiteSupport') {
    const respond = () => {
      const pattern = findPatternForDomain(message.domain, message.url);
      sendResponse({ supported: pattern !== null, pattern });
    };
    if (cachedPatterns.length === 0) {
      reloadPatterns().then(respond);
      return true;
    }
    respond();
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
