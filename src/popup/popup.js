// BGM Toolbox — Popup controller
const BGM_BASE_URL = 'http://localhost:8000'; // TODO: change to https://boardgamematcher.com for production
let currentDomain = null;
let currentPattern = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  await checkSiteSupport();
  await loadStats();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('extract-btn').addEventListener('click', handleExtract);
  document.getElementById('settings-btn').addEventListener('click', handleSettings);
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
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
      { action: 'checkSiteSupport', domain: currentDomain },
      (response) => {
        if (response && response.supported) {
          currentPattern = response.pattern;
          setSupported(response.pattern.name);
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

    let response = await sendExtractMessage(tab.id, currentPattern);

    // If content script not injected, inject and retry
    if (response.error) {
      try {
        await injectContentScript(tab.id);
        response = await sendExtractMessage(tab.id, currentPattern);
      } catch (e) {
        showMessage('Cannot access this page', 'error');
        return;
      }
    }

    if (response.error) {
      showMessage('Error: ' + response.error, 'error');
      return;
    }

    if (response && response.success) {
      const games = response.games;

      if (games.length === 0) {
        showMessage('No board games found', 'error');
        return;
      }

      const text = games.join('\n');

      // Open BGM extract page with the games
      const bgmUrl = BGM_BASE_URL + '/extract?text=' + encodeURIComponent(text);
      chrome.tabs.create({ url: bgmUrl });

      // Update stats
      const stats = {
        lastExtraction: {
          domain: currentDomain,
          count: games.length,
          timestamp: Date.now(),
        },
      };
      await chrome.runtime.sendMessage({ action: 'updateStats', stats });

      showMessage(`${games.length} games sent to BGM!`, 'success');
      updateStatsDisplay(stats);
    } else {
      showMessage('Failed to extract games', 'error');
    }
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
