# Board Game Extractor

A cross-browser extension (Chrome/Firefox) for extracting board game names from websites using configurable CSS selector patterns.

## Features

- Extract board game names from supported sites with one click
- Copy results directly to clipboard
- Built-in patterns for popular board game sites (Knapix, Amazon, Philibert)
- Add custom extraction patterns for any website
- Import/export custom patterns
- Filter results with regex patterns
- Clean, intuitive interface

## Installation

### Chrome

1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `bgm-extension` directory
6. Extension icon will appear in your toolbar

### Firefox

1. Download or clone this repository
2. Open `about:debugging#/runtime/this-firefox` in Firefox
3. Click "Load Temporary Add-on"
4. Navigate to the extension directory and select `manifest.json`
5. Extension icon will appear in your toolbar

**Note:** In Firefox, temporary extensions are removed when you close the browser. For permanent installation, the extension needs to be signed by Mozilla.

## Usage

### Basic Extraction

1. Navigate to a supported website (e.g., knapix.com)
2. Click the Board Game Extractor icon in your toolbar
3. Verify the site is supported (green badge)
4. Click "Extract Board Games"
5. Game names are copied to your clipboard
6. Paste anywhere to use the results

### Adding Custom Patterns

1. Click the extension icon
2. Click "Settings"
3. Navigate to "Custom Patterns" tab
4. Click "Add New Pattern"
5. Fill in the form:
   - **Domain**: Website domain (e.g., "example.com")
   - **Display Name**: Friendly name for the site
   - **CSS Selector**: Pattern to find game names (e.g., ".product-title")
   - **Exclude Patterns** (optional): Regex to filter out unwanted results
   - **Include Patterns** (optional): Regex to keep only matching results
6. Click "Save Pattern"

### Pattern Examples

**Simple selector:**
```
Selector: h3
```

**Class-based selector:**
```
Selector: .product-name
```

**Nested selector:**
```
Selector: article .game-title
```

**With filters:**
```
Selector: .product h2
Exclude: ^Sponsored, ^Advertisement
```

### Import/Export Patterns

**Export:**
1. Open Settings → Custom Patterns
2. Click "Export JSON"
3. Save the downloaded file

**Import:**
1. Open Settings → Custom Patterns
2. Click "Import JSON"
3. Select a previously exported JSON file
4. Patterns are added to your collection

### Suggesting New Sites

1. Click the extension icon
2. Click "Suggest a Site"
3. Your email client opens with a pre-filled template
4. Fill in the site details and send

## Supported Sites

Currently includes built-in patterns for:

- **Knapix** (knapix.com)
- **Amazon** (amazon.com, amazon.fr)
- **Philibert** (philibert.com)

More sites coming soon! You can add your own via custom patterns.

## Development

### Project Structure

```
bgm-extension/
├── manifest.json          # Extension manifest
├── src/
│   ├── background/        # Service worker
│   ├── content/           # Content scripts
│   ├── popup/             # Extension popup UI
│   ├── options/           # Settings page
│   └── lib/               # Shared utilities
├── patterns/              # Built-in site patterns
├── icons/                 # Extension icons
└── docs/                  # Documentation
```

### Tech Stack

- Vanilla JavaScript (no build step required)
- WebExtensions API (Manifest V3)
- Chrome Storage API for persistence

### Testing

See [docs/TESTING.md](docs/TESTING.md) for comprehensive testing guide.

### Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in both Chrome and Firefox
5. Submit a pull request

## Pattern Syntax Reference

### CSS Selectors

- `h3` - All h3 elements
- `.class-name` - Elements with class
- `#id-name` - Element with ID
- `div > p` - Direct child
- `div p` - Any descendant
- `[data-attr]` - Elements with attribute

### Regex Filters

- `^Text` - Starts with "Text"
- `Text$` - Ends with "Text"
- `.*Text.*` - Contains "Text"
- `\d+` - Contains numbers

## Privacy

This extension:
- Works entirely locally (no external servers)
- Only reads page content when you click "Extract"
- Stores patterns only in your browser
- Never transmits data to external services

## License

MIT License - see LICENSE file for details

## Support

- Report bugs: [GitHub Issues](https://github.com/yourusername/bgm-extension/issues)
- Feature requests: [GitHub Issues](https://github.com/yourusername/bgm-extension/issues)
- Questions: [GitHub Discussions](https://github.com/yourusername/bgm-extension/discussions)

## Roadmap

- [ ] Firefox Add-ons store submission
- [ ] Chrome Web Store submission
- [ ] Pattern testing playground
- [ ] Export to multiple formats (CSV, JSON, etc.)
- [ ] Website redirect feature
- [ ] Pattern auto-update system
- [ ] Browser sync for custom patterns
