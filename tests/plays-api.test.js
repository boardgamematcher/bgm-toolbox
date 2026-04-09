import PlaysAPI from "../src/lib/plays-api.js";

// Mock fetch for testing
let fetchCalls = [];
const mockFetch = (url, options) => {
  fetchCalls.push({ url, options });
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true })
  });
};

// Test: POST single play session
async function testPostPlaySession() {
  const api = PlaysAPI("http://localhost:3000", mockFetch);
  const play = {
    gameName: "Catan",
    bggId: 822,
    date: "2025-04-09",
    playerCount: 4,
    outcome: "win",
    opponents: ["Alice", "Bob", "Charlie"]
  };

  const result = await api.postPlay(play);
  console.assert(result.success === true, `Expected success, got ${result.success}`);
  console.assert(fetchCalls.length === 1, `Expected 1 fetch call, got ${fetchCalls.length}`);
  console.assert(fetchCalls[0].url === "http://localhost:3000/api/plays", "URL mismatch");
  const body = JSON.parse(fetchCalls[0].options.body);
  console.assert(body.source === "yucata_import", "Source not set correctly");
  console.log("✓ Test 1: POST single play session");
}

// Test: POST multiple play sessions
async function testPostMultiplePlays() {
  fetchCalls = [];
  const api = PlaysAPI("http://localhost:3000", mockFetch);
  const plays = [
    { gameName: "Catan", bggId: 822, date: "2025-04-09", playerCount: 4, outcome: "win" },
    { gameName: "Ticket to Ride", bggId: 9209, date: "2025-04-08", playerCount: 3, outcome: "loss" }
  ];

  const results = await api.postPlays(plays);
  console.assert(results.length === 2, `Expected 2 results, got ${results.length}`);
  console.assert(fetchCalls.length === 2, `Expected 2 fetch calls, got ${fetchCalls.length}`);
  console.log("✓ Test 2: POST multiple play sessions");
}

// Run all tests
(async () => {
  await testPostPlaySession();
  await testPostMultiplePlays();
  console.log("All tests passed!");
})();
