// BGM Toolbox — Popup controller
const BGM_BASE_URL = 'https://boardgamematcher.com';
let currentDomain = null;
let currentPattern = null;
let currentUser = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  await checkAuth();
  await checkSiteSupport();
  await loadStats();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('extract-btn').addEventListener('click', handleExtract);
  document.getElementById('settings-btn').addEventListener('click', handleSettings);
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('signup-link').addEventListener('click', handleSignup);
}

// ── Auth ──

async function checkAuth() {
  try {
    const response = await fetch(BGM_BASE_URL + '/api/me', {
      credentials: 'include',
    });
    if (response.ok) {
      currentUser = await response.json();
      setLoggedIn(currentUser);
    } else {
      setLoggedOut();
    }
  } catch (_e) {
    // Network error or server down — show logged-out state silently
    setLoggedOut();
  }
}

function setLoggedIn(user) {
  // Show avatar in header
  const avatar = document.getElementById('user-avatar');
  if (user.avatar_url) {
    avatar.innerHTML = '<img src="' + user.avatar_url + '" alt="">';
  } else {
    avatar.textContent = (user.display_name || user.username || '?').charAt(0).toUpperCase();
  }
  avatar.title = user.display_name || user.username;
  avatar.style.display = '';

  // Hide login card, show wishlist
  document.getElementById('card-login').style.display = 'none';
  document.getElementById('card-wishlist').style.display = '';
}

function setLoggedOut() {
  // Hide avatar
  document.getElementById('user-avatar').style.display = 'none';

  // Show login card, hide wishlist (requires auth)
  document.getElementById('card-login').style.display = '';
  document.getElementById('card-wishlist').style.display = 'none';
}

function handleLogin() {
  chrome.tabs.create({ url: BGM_BASE_URL + '/auth/login' });
}

function handleSignup(e) {
  e.preventDefault();
  chrome.tabs.create({ url: BGM_BASE_URL + '/auth/register' });
}

// ── Theme ──

function loadTheme() {
  chrome.storage.local.get('theme', (data) => {
    const theme = data.theme || 'dark';
    applyTheme(theme);
  });
}

function toggleTheme() {
  const popup = document.getElementById('popup');
  const isLight = popup.classList.contains('light');
  const newTheme = isLight ? 'dark' : 'light';
  chrome.storage.local.set({ theme: newTheme });
  applyTheme(newTheme);
}

function applyTheme(theme) {
  const popup = document.getElementById('popup');
  const icon = document.getElementById('theme-icon');
  if (theme === 'light') {
    popup.classList.add('light');
    icon.innerHTML = '&#9788;'; // sun
  } else {
    popup.classList.remove('light');
    icon.innerHTML = '&#9790;'; // moon
  }
}

// ── Site support ──

async function checkSiteSupport() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      setUnsupported('No active tab');
      return;
    }

    const url = new URL(tab.url);
    currentDomain = url.hostname;

    chrome.runtime.sendMessage(
      { action: 'checkSiteSupport', domain: currentDomain, url: tab.url },
      async (response) => {
        if (response && response.supported) {
          currentPattern = response.pattern;
          setSupported(response.pattern.name);
          // Count games on page for button label
          await countGames(tab.id, response.pattern);
        } else {
          setUnsupported(currentDomain);
        }
      }
    );
  } catch (error) {
    console.error('Error checking site support:', error);
    setUnsupported('Error checking site');
  }
}

function setSupported(siteName) {
  document.getElementById('card-extract').style.display = '';
  document.getElementById('card-unsupported').style.display = 'none';
  document.getElementById('detected-site').textContent = siteName + ' detected';
  document.getElementById('extract-btn').disabled = false;
}

function setUnsupported(domain) {
  document.getElementById('card-extract').style.display = 'none';
  document.getElementById('card-unsupported').style.display = '';
  document.getElementById('unsupported-text').textContent = domain
    ? `${domain} is not a supported site yet.`
    : 'Open a supported board game shop to extract games.';
}

async function countGames(tabId, pattern) {
  const selector = pattern.card_selector || pattern.selector;
  if (!selector) return;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel) => document.querySelectorAll(sel).length,
      args: [selector],
    });
    const count = results?.[0]?.result;
    if (count > 0) {
      document.getElementById('extract-btn').textContent = `Extract ${count} games`;
    }
  } catch (_e) {
    // Can't inject into this page — keep default button text
  }
}

// ── Extraction ──

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['src/lib/pattern-matcher.js', 'src/content/content-script.js'],
  });
}

function sendExtractMessage(tabId, pattern) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'extractGames', pattern }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

async function handleExtract() {
  if (!currentPattern) {
    showMessage('No pattern available', 'error');
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      showMessage('No active tab', 'error');
      return;
    }

    // Inject content script and extract structured data from the page
    let response = await sendExtractMessage(tab.id, currentPattern);
    if (response.error) {
      try {
        await injectContentScript(tab.id);
        response = await sendExtractMessage(tab.id, currentPattern);
      } catch (_e) {
        // Fall back to URL-based extraction on the website
        const bgmUrl = BGM_BASE_URL + '/extract?url=' + encodeURIComponent(tab.url);
        chrome.tabs.create({ url: bgmUrl });
        window.close();
        return;
      }
    }

    if (response.error || !response.success || !response.games?.length) {
      // Fall back to URL-based extraction
      const bgmUrl = BGM_BASE_URL + '/extract?url=' + encodeURIComponent(tab.url);
      chrome.tabs.create({ url: bgmUrl });
      window.close();
      return;
    }

    const games = response.games;

    // POST structured data to BGM and open results page
    const payload = { source: currentDomain, url: tab.url, games };
    const postResponse = await fetch(BGM_BASE_URL + '/api/extract/extension', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (postResponse.ok) {
      const result = await postResponse.json();
      chrome.tabs.create({ url: BGM_BASE_URL + '/extract?job=' + result.job_id });
    } else {
      // Fall back to URL-based extraction
      const bgmUrl = BGM_BASE_URL + '/extract?url=' + encodeURIComponent(tab.url);
      chrome.tabs.create({ url: bgmUrl });
    }

    // Update stats
    const stats = {
      lastExtraction: {
        domain: currentDomain,
        count: games.length,
        timestamp: Date.now(),
      },
    };
    await chrome.runtime.sendMessage({ action: 'updateStats', stats });
    updateStatsDisplay(stats);
    window.close();
  } catch (error) {
    console.error('Error extracting:', error);
    showMessage('Error: ' + error.message, 'error');
  }
}

// ── Stats ──

async function loadStats() {
  chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
    if (response && response.success && response.stats) {
      updateStatsDisplay(response.stats);
    }
  });
}

function updateStatsDisplay(stats) {
  const statsText = document.getElementById('stats-text');
  if (stats.lastExtraction) {
    const { count, domain } = stats.lastExtraction;
    statsText.textContent = `Last: ${count} games from ${domain}`;
  } else {
    statsText.textContent = 'No extractions yet';
  }
}

// ── UI helpers ──

function showMessage(text, type) {
  const message = document.getElementById('message');
  message.textContent = text;
  message.className = `message ${type}`;
  setTimeout(() => {
    message.className = 'message hidden';
  }, 3000);
}

function handleSettings() {
  chrome.runtime.openOptionsPage();
}
