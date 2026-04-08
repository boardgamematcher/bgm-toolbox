const PatternMatcher = require('../src/lib/pattern-matcher.js');

describe('PatternMatcher.applyFilters', () => {
  test('trims whitespace by default', () => {
    const result = PatternMatcher.applyFilters(['  Catan  ', '  Azul  '], {});
    expect(result).toEqual(['Catan', 'Azul']);
  });

  test('does not trim when trim is false', () => {
    const result = PatternMatcher.applyFilters(['  Catan  '], { trim: false });
    expect(result).toEqual(['  Catan  ']);
  });

  test('removes empty strings', () => {
    const result = PatternMatcher.applyFilters(['Catan', '', '  ', 'Azul'], {});
    expect(result).toEqual(['Catan', 'Azul']);
  });

  test('deduplicates by default', () => {
    const result = PatternMatcher.applyFilters(['Catan', 'Azul', 'Catan'], {});
    expect(result).toEqual(['Catan', 'Azul']);
  });

  test('does not deduplicate when deduplicate is false', () => {
    const result = PatternMatcher.applyFilters(['Catan', 'Azul', 'Catan'], {
      deduplicate: false,
    });
    expect(result).toEqual(['Catan', 'Azul', 'Catan']);
  });

  test('excludes matching patterns', () => {
    const result = PatternMatcher.applyFilters(
      ['Sponsored: Catan', 'Azul', 'Ad: Monopoly', 'Brass'],
      { exclude: ['^Sponsored', '^Ad:'] }
    );
    expect(result).toEqual(['Azul', 'Brass']);
  });

  test('includes only matching patterns', () => {
    const result = PatternMatcher.applyFilters(
      ['Catan Board Game', 'Random Item', 'Azul Board Game'],
      { include: ['Board Game$'] }
    );
    expect(result).toEqual(['Catan Board Game', 'Azul Board Game']);
  });

  test('applies exclude and include together', () => {
    const result = PatternMatcher.applyFilters(
      ['Sponsored: Catan Game', 'Azul Game', 'Brass', 'Ad: Monopoly Game'],
      { exclude: ['^Sponsored', '^Ad:'], include: ['Game$'] }
    );
    expect(result).toEqual(['Azul Game']);
  });

  test('handles empty exclude array', () => {
    const result = PatternMatcher.applyFilters(['Catan', 'Azul'], { exclude: [] });
    expect(result).toEqual(['Catan', 'Azul']);
  });

  test('handles null include', () => {
    const result = PatternMatcher.applyFilters(['Catan', 'Azul'], { include: null });
    expect(result).toEqual(['Catan', 'Azul']);
  });

  test('handles empty input', () => {
    const result = PatternMatcher.applyFilters([], {});
    expect(result).toEqual([]);
  });

  test('full pipeline: trim + exclude + deduplicate', () => {
    const result = PatternMatcher.applyFilters(
      ['  Catan  ', 'Sponsored: Azul', '  Catan  ', '  Brass  ', ''],
      { exclude: ['^Sponsored'], trim: true, deduplicate: true }
    );
    expect(result).toEqual(['Catan', 'Brass']);
  });
});

describe('PatternMatcher.validatePattern', () => {
  test('valid pattern passes', () => {
    const result = PatternMatcher.validatePattern({
      domain: 'example.com',
      name: 'Example',
      selector: '.game-name',
    });
    expect(result).toEqual({ valid: true });
  });

  test('rejects null', () => {
    const result = PatternMatcher.validatePattern(null);
    expect(result.valid).toBe(false);
  });

  test('rejects missing domain', () => {
    const result = PatternMatcher.validatePattern({
      name: 'Test',
      selector: '.x',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/domain/);
  });

  test('rejects missing name', () => {
    const result = PatternMatcher.validatePattern({
      domain: 'test.com',
      selector: '.x',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/name/);
  });

  test('rejects missing selector', () => {
    const result = PatternMatcher.validatePattern({
      domain: 'test.com',
      name: 'Test',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/selector/);
  });

  test('rejects invalid CSS selector', () => {
    const result = PatternMatcher.validatePattern({
      domain: 'test.com',
      name: 'Test',
      selector: '[invalid[[',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid CSS selector/);
  });
});

describe('PatternMatcher.extract', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="product-list">
        <div class="game-name">Catan</div>
        <div class="game-name">Azul</div>
        <div class="game-name">Brass: Birmingham</div>
        <div class="other">Not a game</div>
      </div>
    `;
  });

  test('extracts elements matching selector', () => {
    const result = PatternMatcher.extract({
      selector: '.game-name',
      filters: {},
    });
    expect(result).toEqual(['Catan', 'Azul', 'Brass: Birmingham']);
  });

  test('returns empty array for no matches', () => {
    const result = PatternMatcher.extract({
      selector: '.nonexistent',
      filters: {},
    });
    expect(result).toEqual([]);
  });

  test('returns empty array for null pattern', () => {
    expect(PatternMatcher.extract(null)).toEqual([]);
  });

  test('returns empty array for missing selector', () => {
    expect(PatternMatcher.extract({})).toEqual([]);
  });

  test('applies filters during extraction', () => {
    document.body.innerHTML += '<div class="game-name">Catan</div>';
    const result = PatternMatcher.extract({
      selector: '.game-name',
      filters: { deduplicate: true },
    });
    expect(result).toEqual(['Catan', 'Azul', 'Brass: Birmingham']);
  });
});
