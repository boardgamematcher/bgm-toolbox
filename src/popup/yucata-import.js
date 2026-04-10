/**
 * Yucata Import UI Logic
 * Handles the import button click and status display
 */

// Show Yucata panel only on yucata.de
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0].url;
  if (url && url.includes('yucata.de')) {
    const yucataPanel = document.getElementById('yucataPanel');
    if (yucataPanel) {
      yucataPanel.style.display = 'block';
    }
  }
});

// Get the import button
const yucataImportBtn = document.getElementById('yucataImportBtn');
const yucataStatus = document.getElementById('yucataStatus');

// Listen for progress updates from the service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'yucataImportProgress' && yucataStatus) {
    yucataStatus.textContent = `Sending plays to BGM... ${message.current}/${message.total}`;
    yucataStatus.style.color = '#666';
  }
});

if (yucataImportBtn) {
  yucataImportBtn.addEventListener('click', () => {
    yucataImportBtn.disabled = true;
    yucataStatus.textContent = 'Fetching all plays from Yucata... please wait';
    yucataStatus.style.color = '#666';

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'import_yucata_plays' }, (response) => {
        yucataImportBtn.disabled = false;

        if (chrome.runtime.lastError || !response) {
          const msg = chrome.runtime.lastError?.message || 'No response from content script';
          yucataStatus.textContent = `✗ Error: ${msg}`;
          yucataStatus.style.color = 'red';
        } else if (response.success) {
          const { posted, skipped, duplicates } = response.data;
          const parts = [`✓ Imported ${posted} plays!`];
          if (duplicates > 0) parts.push(`${duplicates} duplicates skipped`);
          if (skipped > 0) parts.push(`${skipped} not found on BGM`);
          yucataStatus.textContent = parts.join(' · ');
          yucataStatus.style.color = 'green';
        } else {
          yucataStatus.textContent = `✗ Error: ${response.error}`;
          yucataStatus.style.color = 'red';
        }

        // Keep status visible (don't auto-clear)
      });
    });
  });
}
