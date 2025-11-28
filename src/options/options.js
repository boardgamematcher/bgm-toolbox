// Options page controller
let customPatterns = [];
let builtInPatterns = [];
let editingIndex = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadPatterns();
  setupTabs();
  setupEventListeners();
  renderPatterns();
});

// Setup tab switching
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // Update active states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      button.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  // Custom pattern actions
  document.getElementById('add-pattern-btn').addEventListener('click', () => openModal());
  document.getElementById('import-btn').addEventListener('click', handleImport);
  document.getElementById('export-btn').addEventListener('click', handleExport);

  // Modal actions
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('pattern-form').addEventListener('submit', handleFormSubmit);

  // Search
  document.getElementById('search-supported').addEventListener('input', handleSearch);
}

// Load patterns from storage
async function loadPatterns() {
  try {
    // Load built-in patterns
    const response = await fetch(chrome.runtime.getURL('patterns/built-in.json'));
    const data = await response.json();
    builtInPatterns = data.patterns || [];

    // Load custom patterns
    const result = await chrome.storage.local.get('customPatterns');
    customPatterns = result.customPatterns || [];
  } catch (error) {
    console.error('Error loading patterns:', error);
  }
}

// Render all patterns
function renderPatterns() {
  renderSupportedPatterns();
  renderCustomPatterns();
}

// Render built-in patterns
function renderSupportedPatterns(filter = '') {
  const list = document.getElementById('supported-list');
  list.innerHTML = '';

  const filtered = builtInPatterns.filter(p =>
    filter === '' ||
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.domain.toLowerCase().includes(filter.toLowerCase())
  );

  filtered.forEach(pattern => {
    const card = createPatternCard(pattern, false);
    list.appendChild(card);
  });
}

// Render custom patterns
function renderCustomPatterns() {
  const list = document.getElementById('custom-list');
  const empty = document.getElementById('custom-empty');

  if (customPatterns.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = '';

  customPatterns.forEach((pattern, index) => {
    const card = createPatternCard(pattern, true, index);
    list.appendChild(card);
  });
}

// Create pattern card element
function createPatternCard(pattern, isCustom, index) {
  const card = document.createElement('div');
  card.className = 'pattern-card';

  const header = document.createElement('div');
  header.className = 'pattern-header';

  const info = document.createElement('div');
  info.className = 'pattern-info';
  info.innerHTML = `
    <h3>${escapeHtml(pattern.name)}</h3>
    <div class="pattern-domain">${escapeHtml(pattern.domain)}</div>
  `;

  header.appendChild(info);

  if (isCustom) {
    const actions = document.createElement('div');
    actions.className = 'pattern-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => editPattern(index));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deletePattern(index));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(actions);
  }

  card.appendChild(header);

  const details = document.createElement('div');
  details.className = 'pattern-details';
  details.innerHTML = `
    <div class="pattern-row">
      <span class="pattern-label">Selector:</span>
      <span class="pattern-value">${escapeHtml(pattern.selector)}</span>
    </div>
  `;

  if (pattern.filters) {
    if (pattern.filters.exclude && pattern.filters.exclude.length > 0) {
      details.innerHTML += `
        <div class="pattern-row">
          <span class="pattern-label">Exclude:</span>
          <span class="pattern-value">${escapeHtml(pattern.filters.exclude.join(', '))}</span>
        </div>
      `;
    }
    if (pattern.filters.include && pattern.filters.include.length > 0) {
      details.innerHTML += `
        <div class="pattern-row">
          <span class="pattern-label">Include:</span>
          <span class="pattern-value">${escapeHtml(pattern.filters.include.join(', '))}</span>
        </div>
      `;
    }
  }

  card.appendChild(details);
  return card;
}

// Continue in next step...
