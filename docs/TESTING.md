# Testing Guide

## Manual Testing Checklist

### Extension Loading

- [ ] **Chrome**: Load unpacked extension from `chrome://extensions/`
- [ ] **Firefox**: Load temporary add-on from `about:debugging`
- [ ] Extension icon appears in toolbar
- [ ] No console errors on load

### Basic Functionality

- [ ] Navigate to knapix.com
- [ ] Click extension icon
- [ ] Status shows "Supported Site: Knapix"
- [ ] Extract button is enabled
- [ ] Click "Extract Board Games"
- [ ] Success message shows game count
- [ ] Games are copied to clipboard (paste to verify)
- [ ] Last extraction stats update

### Unsupported Sites

- [ ] Navigate to unsupported site (e.g., google.com)
- [ ] Status shows "Site not supported"
- [ ] Extract button is disabled

### Custom Patterns

- [ ] Open settings (click "Settings" in popup)
- [ ] Navigate to "Custom Patterns" tab
- [ ] Click "Add New Pattern"
- [ ] Fill in pattern form:
  - Domain: test.com
  - Name: Test Site
  - Selector: h1
- [ ] Save pattern
- [ ] Pattern appears in custom list
- [ ] Edit pattern
- [ ] Delete pattern (with confirmation)

### Pattern Import/Export

- [ ] Add a custom pattern
- [ ] Click "Export JSON"
- [ ] JSON file downloads
- [ ] Delete the custom pattern
- [ ] Click "Import JSON"
- [ ] Select exported file
- [ ] Pattern reappears in list

### Supported Sites Tab

- [ ] View built-in patterns list
- [ ] Search for "amazon"
- [ ] List filters correctly
- [ ] Clear search
- [ ] Full list returns

### Help Tab

- [ ] View help documentation
- [ ] All sections render correctly
- [ ] External links work

### Edge Cases

- [ ] Extract from page with no matching elements (should show error)
- [ ] Extract from page with 100+ games (should work)
- [ ] Add pattern with invalid CSS selector (should validate)
- [ ] Navigate between tabs quickly (no errors)

## Test Sites

### Knapix.com
- URL: https://www.knapix.com/2025/11/...
- Selector: `article h3`
- Expected: List of board game names from article headings

### Amazon
- URL: https://www.amazon.com/s?k=board+games
- Selector: `[data-component-type='s-search-result'] h2 a span`
- Expected: Product names (with ads filtered out)

## Debugging Tips

### Check Console Logs
- Background: `chrome://extensions/` → Inspect views: service worker
- Content Script: Open DevTools on webpage
- Popup: Right-click extension icon → Inspect popup

### Common Issues

**"No board games found"**
- Check if selector matches elements on page
- Inspect page HTML structure
- Verify filters aren't excluding all results

**"Error copying to clipboard"**
- Check clipboardWrite permission in manifest
- Verify extension has activeTab permission

**Pattern not working after add**
- Check background console for reload confirmation
- Verify pattern saved in storage (DevTools → Application → Storage)

## Performance Testing

- [ ] Extract 1000+ items (should complete in < 2s)
- [ ] Switch between tabs rapidly (no UI lag)
- [ ] Load extension with 50+ custom patterns (no startup lag)

## Browser Compatibility

- [ ] All features work in Chrome
- [ ] All features work in Firefox
- [ ] Icons display correctly in both browsers
- [ ] Storage works in both browsers
