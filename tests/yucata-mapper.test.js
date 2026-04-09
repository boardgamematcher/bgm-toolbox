import YucataMapper from '../src/lib/yucata-mapper.js';

// Mock storage for testing
const mockStorage = {
  mappings: {
    "1": 822,
    "2": 1111,
    "999": null
  }
};

// Test: Map known Yucata ID to BGG ID
function testMapKnownGameId() {
  const mapper = YucataMapper(mockStorage);
  const result = mapper.mapGameId("1");
  console.assert(result === 822, `Expected 822, got ${result}`);
  console.log("✓ Test 1: Map known Yucata ID to BGG ID");
}

// Test: Handle unmapped Yucata ID (return null)
function testMapUnmappedGameId() {
  const mapper = YucataMapper(mockStorage);
  const result = mapper.mapGameId("999");
  console.assert(result === null, `Expected null, got ${result}`);
  console.log("✓ Test 2: Handle unmapped Yucata ID");
}

// Test: Map multiple games
function testMapMultipleGameIds() {
  const mapper = YucataMapper(mockStorage);
  const results = mapper.mapGameIds(["1", "2", "999"]);
  console.assert(results.length === 3, `Expected 3 results, got ${results.length}`);
  console.assert(results[0].yucataId === "1" && results[0].bggId === 822, "First mapping incorrect");
  console.assert(results[1].yucataId === "2" && results[1].bggId === 1111, "Second mapping incorrect");
  console.assert(results[2].yucataId === "999" && results[2].bggId === null, "Third mapping should be null");
  console.log("✓ Test 3: Map multiple games");
}

// Run all tests
testMapKnownGameId();
testMapUnmappedGameId();
testMapMultipleGameIds();
console.log("All tests passed!");
