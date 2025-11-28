# Board Game Extractor

A browser extension for extracting board game names from websites.

## Features

- Extract board game names from supported sites with one click
- Built-in patterns for popular board game sites
- Add custom extraction patterns
- Copy results to clipboard

## Installation

### Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension directory

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json`

## Usage

1. Navigate to a supported site (knapix.com, amazon, philibert, etc.)
2. Click the extension icon
3. Click "Extract Board Games"
4. Game names are copied to clipboard

## Development

Built with vanilla JavaScript and WebExtensions API (Manifest V3).

No build step required - load directly in browser.
