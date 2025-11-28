// Popup controller
let currentDomain = null;
let currentPattern = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await checkSiteSupport();
  await loadStats();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('extract-btn').addEventListener('click', handleExtract);
  document.getElementById('suggest-btn').addEventListener('click', handleSuggest);
  document.getElementById('settings-btn').addEventListener('click', handleSettings);
}

// Check if current site is supported
async function checkSiteSupport() {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      setUnsupported('No active tab');
      return;
    }

    // Extract domain from URL
    const url = new URL(tab.url);
    currentDomain = url.hostname;

    // Check with background
    chrome.runtime.sendMessage(
      { action: 'checkSiteSupport', domain: currentDomain },
      (response) => {
        if (response && response.supported) {
          currentPattern = response.pattern;
          setSupported(response.pattern.name);
        } else {
          setUnsupported('Site not supported');
        }
      }
    );
  } catch (error) {
    console.error('Error checking site support:', error);
    setUnsupported('Error checking site');
  }
}

// Set UI to supported state
function setSupported(siteName) {
  const statusBadge = document.getElementById('site-status');
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const extractBtn = document.getElementById('extract-btn');

  statusBadge.className = 'status-badge supported';
  statusIcon.textContent = '✓';
  statusText.textContent = `Supported Site: ${siteName}`;
  extractBtn.disabled = false;
}

// Set UI to unsupported state
function setUnsupported(reason) {
  const statusBadge = document.getElementById('site-status');
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const extractBtn = document.getElementById('extract-btn');

  statusBadge.className = 'status-badge unsupported';
  statusIcon.textContent = '✗';
  statusText.textContent = reason;
  extractBtn.disabled = true;
}

// Handle extract button click
async function handleExtract() {
  if (!currentPattern) {
    showMessage('No pattern available', 'error');
    return;
  }

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Send message to content script
    chrome.tabs.sendMessage(
      tab.id,
      { action: 'extractGames', pattern: currentPattern },
      async (response) => {
        if (chrome.runtime.lastError) {
          showMessage('Error: ' + chrome.runtime.lastError.message, 'error');
          return;
        }

        if (response && response.success) {
          const games = response.games;

          if (games.length === 0) {
            showMessage('No board games found', 'error');
            return;
          }

          // Copy to clipboard
          const text = games.join('\n');
          await chrome.runtime.sendMessage({
            action: 'copyToClipboard',
            text: text
          });

          // Update stats
          const stats = {
            lastExtraction: {
              domain: currentDomain,
              count: games.length,
              timestamp: Date.now()
            }
          };
          await chrome.runtime.sendMessage({
            action: 'updateStats',
            stats: stats
          });

          // Update UI
          showMessage(`Copied ${games.length} games to clipboard!`, 'success');
          updateStatsDisplay(stats);
        } else {
          showMessage('Failed to extract games', 'error');
        }
      }
    );
  } catch (error) {
    console.error('Error extracting:', error);
    showMessage('Error: ' + error.message, 'error');
  }
}

// Load and display stats
async function loadStats() {
  chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
    if (response && response.success && response.stats) {
      updateStatsDisplay(response.stats);
    }
  });
}

// Update stats display
function updateStatsDisplay(stats) {
  const statsText = document.getElementById('stats-text');

  if (stats.lastExtraction) {
    const { count, domain } = stats.lastExtraction;
    statsText.textContent = `Last: ${count} games from ${domain}`;
  } else {
    statsText.textContent = 'No extractions yet';
  }
}

// Show message to user
function showMessage(text, type) {
  const message = document.getElementById('message');
  message.textContent = text;
  message.className = `message ${type}`;

  // Hide after 3 seconds
  setTimeout(() => {
    message.className = 'message hidden';
  }, 3000);
}

// Handle suggest button click
function handleSuggest() {
  const subject = encodeURIComponent('Board Game Extractor - Site Suggestion');
  const body = encodeURIComponent(`I would like to suggest support for the following site:

Site Name:
Site URL:
CSS Selector for game names:

Additional notes:
`);

  window.open(`mailto:?subject=${subject}&body=${body}`);
}

// Handle settings button click
function handleSettings() {
  chrome.runtime.openOptionsPage();
}
