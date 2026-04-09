const { describe, test, expect } = require('@jest/globals');
const YucataScraper = require("../src/content/yucata-scraper.js");

describe('YucataScraper', () => {
  const mockDOM = {
    table: {
      rows: [
        { cells: ["822", "Catan", "2025-04-09", "4", "win"] },
        { cells: ["9209", "Ticket to Ride", "2025-04-08", "3", "loss"] }
      ]
    }
  };

  test('parses play rows from table', () => {
    const scraper = YucataScraper();
    const plays = scraper.parsePlayRows(mockDOM.table.rows);

    expect(plays).toHaveLength(2);
    expect(plays[0]).toEqual({
      yucataId: "822",
      gameName: "Catan",
      date: "2025-04-09",
      playerCount: 4,
      outcome: "win"
    });
  });

  test('handles empty table', () => {
    const scraper = YucataScraper();
    const plays = scraper.parsePlayRows([]);
    expect(plays).toHaveLength(0);
  });

  test('skips malformed rows', () => {
    const malformedDOM = {
      rows: [
        { cells: ["822", "Catan", "2025-04-09", "4", "win"] },
        { cells: ["invalid"] }
      ]
    };

    const scraper = YucataScraper();
    const plays = scraper.parsePlayRows(malformedDOM.rows);
    expect(plays).toHaveLength(1);
  });
});
