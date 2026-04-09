const YucataMapper = require('../src/lib/yucata-mapper.js');
const PlaysAPI = require('../src/lib/plays-api.js');

// Mocks
const mockMappingData = {
  mappings: {
    "1": 822,
    "2": 9209,
    "999": null
  }
};

const mockRawPlays = [
  { yucataId: "1", gameName: "Catan", date: "2025-04-09", playerCount: 4, outcome: "win" },
  { yucataId: "2", gameName: "Ticket to Ride", date: "2025-04-08", playerCount: 3, outcome: "loss" },
  { yucataId: "999", gameName: "Unknown Game", date: "2025-04-07", playerCount: 2, outcome: "win" }
];

let fetchCalls = [];
const mockFetch = (url, options) => {
  fetchCalls.push({ url, options });
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true })
  });
};

// Integration test: Full pipeline
async function testFullImportPipeline() {
  // Step 1: Create mapper
  const mapper = YucataMapper(mockMappingData);

  // Step 2: Map games (filtering unmapped)
  const mappedPlays = mockRawPlays
    .map((play) => {
      const bggId = mapper.mapGameId(play.yucataId);
      if (!bggId) return null;
      return {
        gameName: play.gameName,
        bggId,
        date: play.date,
        playerCount: play.playerCount,
        outcome: play.outcome
      };
    })
    .filter((play) => play !== null);

  console.assert(mappedPlays.length === 2, `Expected 2 mapped plays, got ${mappedPlays.length}`);
  console.assert(mappedPlays[0].bggId === 822, "First game should map to BGG 822");
  console.assert(mappedPlays[1].bggId === 9209, "Second game should map to BGG 9209");

  // Step 3: POST to API
  const api = PlaysAPI("http://localhost:3000", mockFetch);
  const results = await api.postPlays(mappedPlays);

  console.assert(results.length === 2, `Expected 2 API calls, got ${results.length}`);
  console.assert(fetchCalls.length === 2, `Expected 2 fetch calls, got ${fetchCalls.length}`);

  // Verify payload structure
  const firstCall = JSON.parse(fetchCalls[0].options.body);
  console.assert(firstCall.source === "yucata_import", "Source not set");
  console.assert(firstCall.bggId === 822, "BGG ID not in payload");
  console.assert(firstCall.gameName === "Catan", "Game name not in payload");

  console.log("✓ Full import pipeline test passed");
}

// Run test
(async () => {
  await testFullImportPipeline();
  console.log("Integration tests passed!");
})();
