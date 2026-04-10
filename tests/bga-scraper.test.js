const { describe, test, expect } = require('@jest/globals');
const { BGAScraper, isWinText } = require('../src/content/bga-scraper.js');

describe('BGAScraper', () => {
  describe('isWinText', () => {
    test('detects French "Gagnant"', () => {
      expect(isWinText('Gagnant - PlayerName - 5')).toBe(true);
    });

    test('detects English "Winner"', () => {
      expect(isWinText('Winner - PlayerName - 5')).toBe(true);
    });

    test('detects French ordinal "1er"', () => {
      expect(isWinText('1er - PlayerName - 42')).toBe(true);
    });

    test('detects "1st"', () => {
      expect(isWinText('1st - PlayerName - 42')).toBe(true);
    });

    test('does not match second place', () => {
      expect(isWinText('2e - PlayerName - 30')).toBe(false);
    });

    test('does not match non-win text', () => {
      expect(isWinText('Perdant - PlayerName - 10')).toBe(false);
    });
  });

  describe('parseResultHtml', () => {
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

    test('detects win for current player (Gagnant)', () => {
      const html = `
        <a href="/table?table=1"><span class="gamename">Sky Team</span></a>:
        <div>
          <div class="board-score-entry">
            Gagnant - <a href="player?id=84147370" class="playername">Me</a> - 5
          </div>
          <div class="board-score-entry">
            Gagnant - <a href="player?id=99999" class="playername">Other</a> - 5
          </div>
        </div>
      `;

      const result = scraper.parseResultHtml(html, playerId);
      expect(result.outcome).toBe('win');
    });

    test('detects loss for current player', () => {
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

    test('handles empty HTML gracefully', () => {
      const result = scraper.parseResultHtml('', playerId);
      expect(result.gameName).toBe('');
      expect(result.playerCount).toBe(0);
      expect(result.outcome).toBe('loss');
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
