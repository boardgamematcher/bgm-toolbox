const { describe, test, expect } = require('@jest/globals');
const {
  BGAScraper,
  extractLabel,
  isWinLabel,
  isLossLabel,
  coopOutcomeFromLabel,
  resolveOutcome,
} = require('../src/content/bga-scraper.js');

describe('BGAScraper', () => {
  describe('extractLabel', () => {
    test('extracts French "Gagnant" label', () => {
      expect(extractLabel('Gagnant - PlayerName - 5')).toBe('Gagnant');
    });

    test('extracts English "Winner" label', () => {
      expect(extractLabel('Winner - PlayerName - 5')).toBe('Winner');
    });

    test('extracts French ordinal "1er" label', () => {
      expect(extractLabel('1er - PlayerName - 42')).toBe('1er');
    });

    test('extracts "1st" label', () => {
      expect(extractLabel('1st - PlayerName - 42')).toBe('1st');
    });

    test('extracts "2e" label', () => {
      expect(extractLabel('2e - PlayerName - 30')).toBe('2e');
    });

    test('handles text without separator', () => {
      expect(extractLabel('  some text  ')).toBe('some text');
    });
  });

  describe('isWinLabel', () => {
    test('detects French "Gagnant"', () => {
      expect(isWinLabel('Gagnant')).toBe(true);
    });

    test('detects English "Winner"', () => {
      expect(isWinLabel('Winner')).toBe(true);
    });

    test('detects German "Gewinner"', () => {
      expect(isWinLabel('Gewinner')).toBe(true);
    });

    test('rejects French loss label', () => {
      expect(isWinLabel('Perdant')).toBe(false);
    });

    test('rejects English loss label', () => {
      expect(isWinLabel('Loser')).toBe(false);
    });

    test('rejects unknown labels (safe default)', () => {
      expect(isWinLabel('何か')).toBe(false);
    });
  });

  describe('isLossLabel', () => {
    test('detects French "Perdant"', () => {
      expect(isLossLabel('Perdant')).toBe(true);
    });

    test('detects English "Loser"', () => {
      expect(isLossLabel('Loser')).toBe(true);
    });

    test('rejects win labels', () => {
      expect(isLossLabel('Gagnant')).toBe(false);
    });

    test('rejects unknown labels', () => {
      expect(isLossLabel('何か')).toBe(false);
    });
  });

  describe('coopOutcomeFromLabel', () => {
    test('win word resolves to "win"', () => {
      expect(coopOutcomeFromLabel('Winner')).toBe('win');
    });

    test('loss word resolves to "loss"', () => {
      expect(coopOutcomeFromLabel('Perdant')).toBe('loss');
    });

    test('unknown label resolves to null (no guessing)', () => {
      expect(coopOutcomeFromLabel('???')).toBeNull();
    });
  });

  describe('resolveOutcome (unit)', () => {
    test('empty labels → null', () => {
      expect(resolveOutcome([], 0)).toBeNull();
    });

    test('playerIndex out of range → null', () => {
      expect(resolveOutcome(['1ᵉʳ', '2ᵉ'], -1)).toBeNull();
      expect(resolveOutcome(['1ᵉʳ', '2ᵉ'], 5)).toBeNull();
    });

    test('rank labels, player at sole top → win', () => {
      expect(resolveOutcome(['1ᵉʳ', '2ᵉ'], 0)).toBe('win');
    });

    test('rank labels, player not at top → loss', () => {
      expect(resolveOutcome(['1ᵉʳ', '2ᵉ'], 1)).toBe('loss');
    });

    test('rank labels, player tied at top → draw', () => {
      expect(resolveOutcome(['1ᵉʳ', '1ᵉʳ'], 0)).toBe('draw');
      expect(resolveOutcome(['1ᵉʳ', '1ᵉʳ'], 1)).toBe('draw');
    });

    test('rank labels, 4 players with 2 tied at top', () => {
      const labels = ['1ᵉʳ', '1ᵉʳ', '3ᵉ', '4ᵉ'];
      expect(resolveOutcome(labels, 0)).toBe('draw');
      expect(resolveOutcome(labels, 1)).toBe('draw');
      expect(resolveOutcome(labels, 2)).toBe('loss');
      expect(resolveOutcome(labels, 3)).toBe('loss');
    });

    test('co-op labels all identical, win word → win', () => {
      expect(resolveOutcome(['Gagnant', 'Gagnant'], 0)).toBe('win');
    });

    test('co-op labels all identical, loss word → loss', () => {
      expect(resolveOutcome(['Perdant', 'Perdant'], 1)).toBe('loss');
    });

    test('co-op labels all identical, unknown word → null', () => {
      expect(resolveOutcome(['???', '???'], 0)).toBeNull();
    });

    test('mixed non-rank labels fall back to position', () => {
      expect(resolveOutcome(['승자', '2위'], 0)).toBe('win');
      expect(resolveOutcome(['승자', '2위'], 1)).toBe('loss');
    });
  });

  describe('parseResultHtml — position-based win detection', () => {
    const scraper = BGAScraper();
    const playerId = '84147370';

    test('extracts game name from HTML', () => {
      const html = `
        <a href="/table?table=831154036"><span class="gamename">Sky Team</span></a>:
        <div>
          <div class="board-score-entry">
            Gagnant - <a href="player?id=94225954" class="playername">Itisha</a> - 5
          </div>
          <div class="board-score-entry">
            Gagnant - <a href="player?id=84147370" class="playername">GreenVelvet</a> - 5
          </div>
        </div>
      `;

      const result = scraper.parseResultHtml(html, playerId);
      expect(result.gameName).toBe('Sky Team');
    });

    test('counts players correctly', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">Catan</span></a>:
        <div>
          <div class="board-score-entry">1er - <a href="player?id=111" class="playername">A</a></div>
          <div class="board-score-entry">2e - <a href="player?id=222" class="playername">B</a></div>
          <div class="board-score-entry">3e - <a href="player?id=333" class="playername">C</a></div>
        </div>
      `;

      const result = scraper.parseResultHtml(html, '111');
      expect(result.playerCount).toBe(3);
    });

    test('detects win for first-place player (competitive)', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">Catan</span></a>:
        <div>
          <div class="board-score-entry">
            1er - <a href="player?id=84147370" class="playername">Me</a> - 50
          </div>
          <div class="board-score-entry">
            2e - <a href="player?id=99999" class="playername">Other</a> - 30
          </div>
        </div>
      `;

      const result = scraper.parseResultHtml(html, playerId);
      expect(result.outcome).toBe('win');
    });

    test('detects loss for non-first player (competitive)', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">Catan</span></a>:
        <div>
          <div class="board-score-entry">
            1er - <a href="player?id=99999" class="playername">Winner</a> - 50
          </div>
          <div class="board-score-entry">
            2e - <a href="player?id=84147370" class="playername">Me</a> - 30
          </div>
        </div>
      `;

      const result = scraper.parseResultHtml(html, playerId);
      expect(result.outcome).toBe('loss');
    });

    test('detects co-op win (all players share same label)', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">Sky Team</span></a>:
        <div>
          <div class="board-score-entry">
            Gagnant - <a href="player?id=99999" class="playername">Other</a> - 5
          </div>
          <div class="board-score-entry">
            Gagnant - <a href="player?id=84147370" class="playername">Me</a> - 5
          </div>
        </div>
      `;

      const result = scraper.parseResultHtml(html, playerId);
      expect(result.outcome).toBe('win');
    });

    test('detects co-op loss (all players share same loss label)', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">Sky Team</span></a>:
        <div>
          <div class="board-score-entry">
            Perdant - <a href="player?id=99999" class="playername">Other</a> - 0
          </div>
          <div class="board-score-entry">
            Perdant - <a href="player?id=84147370" class="playername">Me</a> - 0
          </div>
        </div>
      `;

      const result = scraper.parseResultHtml(html, playerId);
      expect(result.outcome).toBe('loss');
    });

    test('works with German labels (language-independent)', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">Catan</span></a>:
        <div>
          <div class="board-score-entry">
            Gewinner - <a href="player?id=84147370" class="playername">Me</a> - 50
          </div>
          <div class="board-score-entry">
            2. - <a href="player?id=99999" class="playername">Other</a> - 30
          </div>
        </div>
      `;

      const result = scraper.parseResultHtml(html, playerId);
      expect(result.outcome).toBe('win');
    });

    test('works with Korean/any language (position-based)', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">Catan</span></a>:
        <div>
          <div class="board-score-entry">
            승자 - <a href="player?id=99999" class="playername">Other</a> - 50
          </div>
          <div class="board-score-entry">
            2위 - <a href="player?id=84147370" class="playername">Me</a> - 30
          </div>
        </div>
      `;

      const result = scraper.parseResultHtml(html, playerId);
      expect(result.outcome).toBe('loss');
    });

    test('handles empty HTML gracefully (outcome null, not loss)', () => {
      const result = scraper.parseResultHtml('', playerId);
      expect(result.gameName).toBe('');
      expect(result.playerCount).toBe(0);
      expect(result.outcome).toBeNull();
    });

    test('returns null outcome when current player is not in the entries', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">Catan</span></a>:
        <div>
          <div class="board-score-entry">1er - <a href="player?id=111" class="playername">A</a></div>
          <div class="board-score-entry">2e - <a href="player?id=222" class="playername">B</a></div>
        </div>
      `;
      const result = scraper.parseResultHtml(html, '999');
      expect(result.outcome).toBeNull();
    });

    test('detects draw when two players share the top rank label (BGA superscript)', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">Tipperary</span></a>:
        <div>
          <div class="board-score-entry">
            1ᵉʳ - <a href="player?id=84147370" class="playername">Me</a> - 80
          </div>
          <div class="board-score-entry">
            1ᵉʳ - <a href="player?id=99999" class="playername">Other</a> - 80
          </div>
        </div>
      `;
      const result = scraper.parseResultHtml(html, playerId);
      expect(result.outcome).toBe('draw');
    });

    test('detects draw for both players tied at top, regardless of DOM order', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">K2</span></a>:
        <div>
          <div class="board-score-entry">
            1ᵉʳ - <a href="player?id=11306915" class="playername">Other</a> - 30
          </div>
          <div class="board-score-entry">
            1ᵉʳ - <a href="player?id=84147370" class="playername">Me</a> - 30
          </div>
        </div>
      `;
      const result = scraper.parseResultHtml(html, playerId);
      expect(result.outcome).toBe('draw');
    });

    test('4 players, 2 tied at top: top players draw, others loss', () => {
      const htmlMeAtTop = `
        <a href="/table?table=1"><span class="gamename">Catan</span></a>:
        <div>
          <div class="board-score-entry">1ᵉʳ - <a href="player?id=84147370" class="playername">Me</a> - 10</div>
          <div class="board-score-entry">1ᵉʳ - <a href="player?id=222" class="playername">B</a> - 10</div>
          <div class="board-score-entry">3ᵉ - <a href="player?id=333" class="playername">C</a> - 7</div>
          <div class="board-score-entry">4ᵉ - <a href="player?id=444" class="playername">D</a> - 5</div>
        </div>
      `;
      expect(scraper.parseResultHtml(htmlMeAtTop, playerId).outcome).toBe('draw');

      const htmlMeThird = htmlMeAtTop.replace('player?id=333', 'player?id=84147370-swap');
      // swap player 'Me' into 3rd place by editing which row carries my id
      const htmlMeInThird = `
        <a href="/table?table=1"><span class="gamename">Catan</span></a>:
        <div>
          <div class="board-score-entry">1ᵉʳ - <a href="player?id=111" class="playername">A</a> - 10</div>
          <div class="board-score-entry">1ᵉʳ - <a href="player?id=222" class="playername">B</a> - 10</div>
          <div class="board-score-entry">3ᵉ - <a href="player?id=84147370" class="playername">Me</a> - 7</div>
          <div class="board-score-entry">4ᵉ - <a href="player?id=444" class="playername">D</a> - 5</div>
        </div>
      `;
      expect(scraper.parseResultHtml(htmlMeInThird, playerId).outcome).toBe('loss');
      void htmlMeThird;
    });

    test('sole top-rank player still resolves to win even when non-tied labels appear later', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">Catan</span></a>:
        <div>
          <div class="board-score-entry">1ᵉʳ - <a href="player?id=84147370" class="playername">Me</a> - 30</div>
          <div class="board-score-entry">2ᵉ - <a href="player?id=222" class="playername">B</a> - 20</div>
          <div class="board-score-entry">2ᵉ - <a href="player?id=333" class="playername">C</a> - 20</div>
        </div>
      `;
      expect(scraper.parseResultHtml(html, playerId).outcome).toBe('win');
    });

    test('returns null outcome for co-op with unknown shared label', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">MysteryCoop</span></a>:
        <div>
          <div class="board-score-entry">
            ??? - <a href="player?id=84147370" class="playername">Me</a> - 0
          </div>
          <div class="board-score-entry">
            ??? - <a href="player?id=99999" class="playername">Other</a> - 0
          </div>
        </div>
      `;
      const result = scraper.parseResultHtml(html, playerId);
      expect(result.outcome).toBeNull();
    });
  });

  describe('extractPlays', () => {
    test('paginates through API and filters game results', async () => {
      const mockResponses = [
        {
          status: 1,
          data: {
            news: [
              {
                id: '100',
                news_type: '2',
                subject_id: '1234',
                timestamp: 1712620800, // 2024-04-09
                html: '<span class="gamename">Catan</span><div><div class="board-score-entry">Gagnant - <a href="player?id=123" class="playername">Me</a></div><div class="board-score-entry">2e - <a href="player?id=456" class="playername">Other</a></div></div>',
              },
              {
                id: '101',
                news_type: '5', // Achievement, should be filtered out
                subject_id: '9999',
                timestamp: 1712620800,
                html: 'some achievement',
              },
            ],
          },
        },
        {
          status: 1,
          data: {
            news: [], // Empty page signals end of pagination
          },
        },
      ];

      let callCount = 0;
      const mockFetch = async () => ({
        ok: true,
        json: async () => mockResponses[callCount++],
      });

      const scraper = BGAScraper(mockFetch, 'test-token-123');
      const plays = await scraper.extractPlays('123');

      expect(plays).toHaveLength(1);
      expect(plays[0]).toEqual({
        bgaGameId: '1234',
        bgaSlug: '',
        gameName: 'Catan',
        date: '2024-04-09',
        playerCount: 2,
        outcome: 'win',
      });
    });

    test('throws error when no request token found', async () => {
      const scraper = BGAScraper(() => {}, null);
      await expect(scraper.extractPlays('123')).rejects.toThrow('request token');
    });
  });
});
