/**
 * BGA Import UI Logic
 * Handles the import button click and status display for Board Game Arena
 */

// Show BGA panel only on boardgamearena.com
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0].url;
  if (url && url.includes('boardgamearena.com')) {
    const bgaPanel = document.getElementById('bgaPanel');
    if (bgaPanel) {
      bgaPanel.style.display = 'block';
    }
  }
});

// Get the import button and status element
const bgaImportBtn = document.getElementById('bgaImportBtn');
const bgaStatus = document.getElementById('bgaStatus');

// Listen for progress updates from the service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'yucataImportProgress' && bgaStatus && bgaImportBtn?.disabled) {
    bgaStatus.textContent = `Sending plays to BGM... ${message.current}/${message.total}`;
    bgaStatus.style.color = '#666';
  }
});

if (bgaImportBtn) {
  bgaImportBtn.addEventListener('click', () => {
    bgaImportBtn.disabled = true;
    bgaStatus.textContent = 'Fetching all plays from BGA... please wait';
    bgaStatus.style.color = '#666';

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'import_bga_plays' }, (response) => {
        bgaImportBtn.disabled = false;

        if (chrome.runtime.lastError || !response) {
          const msg = chrome.runtime.lastError?.message || 'No response from content script';
          bgaStatus.textContent = `Error: ${msg}`;
          bgaStatus.style.color = 'red';
        } else if (response.success) {
          const { posted, skipped, errors } = response.data;
          const parts = [`Imported ${posted} plays!`];
          if (skipped > 0) parts.push(`${skipped} not found on BGM`);
          if (errors > 0) parts.push(`${errors} errors`);
          bgaStatus.textContent = parts.join(' · ');
          bgaStatus.style.color = 'green';
        } else {
          bgaStatus.textContent = `Error: ${response.error}`;
          bgaStatus.style.color = 'red';
        }
      });
    });
  });
}
