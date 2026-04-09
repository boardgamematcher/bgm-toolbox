// Import the scraper implementation
import { default as YucataScraperModule } from "../src/content/yucata-scraper.js";
const YucataScraper = YucataScraperModule;

// Mock DOM for testing
const mockDOM = {
  table: {
    rows: [
      { cells: ["822", "Catan", "2025-04-09", "4", "win"] },
      { cells: ["9209", "Ticket to Ride", "2025-04-08", "3", "loss"] }
    ]
  }
};

// Helper to get rows from table
function getTableRows(table) {
  return Array.from(table.rows).map((row) => ({
    cells: Array.from(row.cells).map((cell) => cell.textContent.trim())
  }));
}

// Test: Parse play rows from table
function testParseYucataPlays() {
  const scraper = YucataScraper();
  const plays = scraper.parsePlayRows(mockDOM.table.rows);

  console.assert(plays.length === 2, `Expected 2 plays, got ${plays.length}`);
  console.assert(plays[0].yucataId === "822", `Expected yucataId 822, got ${plays[0].yucataId}`);
  console.assert(plays[0].gameName === "Catan", `Expected Catan, got ${plays[0].gameName}`);
  console.assert(plays[0].date === "2025-04-09", `Expected 2025-04-09, got ${plays[0].date}`);
  console.assert(plays[0].playerCount === 4, `Expected 4, got ${plays[0].playerCount}`);
  console.assert(plays[0].outcome === "win", `Expected win, got ${plays[0].outcome}`);
  console.log("✓ Test 1: Parse play rows from table");
}

// Test: Handle empty table
function testParseEmptyTable() {
  const scraper = YucataScraper();
  const plays = scraper.parsePlayRows([]);

  console.assert(plays.length === 0, `Expected 0 plays, got ${plays.length}`);
  console.log("✓ Test 2: Handle empty table");
}

// Test: Handle malformed row (skip invalid entries)
function testParseMalformedRows() {
  const malformedDOM = {
    rows: [
      { cells: ["822", "Catan", "2025-04-09", "4", "win"] },
      { cells: ["invalid"] } // Missing fields
    ]
  };

  const scraper = YucataScraper();
  const plays = scraper.parsePlayRows(malformedDOM.rows);

  console.assert(plays.length === 1, `Expected 1 valid play (skipped malformed), got ${plays.length}`);
  console.log("✓ Test 3: Skip malformed rows");
}

// Run all tests
testParseYucataPlays();
testParseEmptyTable();
testParseMalformedRows();
console.log("All tests passed!");
