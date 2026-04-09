/**
 * Yucata Import UI Logic
 * Handles the import button click and status display
 */

// Get the import button
const yucataImportBtn = document.getElementById('yucataImportBtn');
const yucataStatus = document.getElementById('yucataStatus');

if (yucataImportBtn) {
  yucataImportBtn.addEventListener('click', () => {
    yucataImportBtn.disabled = true;
    yucataStatus.textContent = 'Importing...';
    yucataStatus.style.color = '#666';

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'import_yucata_plays' }, (response) => {
        yucataImportBtn.disabled = false;

        if (response.success) {
          yucataStatus.textContent = `✓ Imported ${response.data.posted} plays!`;
          yucataStatus.style.color = 'green';
        } else {
          yucataStatus.textContent = `✗ Error: ${response.error}`;
          yucataStatus.style.color = 'red';
        }

        // Clear status after 5 seconds
        setTimeout(() => {
          yucataStatus.textContent = '';
        }, 5000);
      });
    });
  });
}
