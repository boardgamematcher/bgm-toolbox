/**
 * Yucata Page Extract
 * Runs in the PAGE context (not content script) to access jQuery DataTable API.
 * Fetches ALL play data by paginating through the server-side AJAX endpoint.
 */
(function () {
  try {
    /* eslint-disable no-undef */
    var table = $('#divPlayerRankingListTable').DataTable();
    var settings = table.settings()[0];
    var ajaxUrl = settings.ajax.url || settings.ajax;
    var PAGE_SIZE = 1000;

    // First request to get total count
    fetch(ajaxUrl + '&draw=1&start=0&length=' + PAGE_SIZE, { credentials: 'same-origin' })
      .then(function (r) {
        return r.json();
      })
      .then(function (firstPage) {
        var total = firstPage.recordsTotal || 0;
        var allRows = firstPage.data || firstPage.aaData || [];

        if (allRows.length >= total) {
          // All rows fetched in first request
          sendPlays(allRows);
          return;
        }

        // Fetch remaining pages in parallel
        var fetches = [];
        for (var start = PAGE_SIZE; start < total; start += PAGE_SIZE) {
          var url = ajaxUrl + '&draw=1&start=' + start + '&length=' + PAGE_SIZE;
          fetches.push(
            fetch(url, { credentials: 'same-origin' }).then(function (r) {
              return r.json();
            })
          );
        }

        Promise.all(fetches).then(function (pages) {
          pages.forEach(function (page) {
            var rows = page.data || page.aaData || [];
            allRows = allRows.concat(rows);
          });
          sendPlays(allRows);
        });
      })
      .catch(function (e) {
        window.postMessage({ type: 'bgm-yucata-data', error: 'Fetch failed: ' + e.message }, '*');
      });

    function sendPlays(rows) {
      var plays = rows.map(function (row) {
        return {
          GameTypeId: row.GameTypeId,
          GameTypeName: row.GameTypeName,
          FinishedOnString: row.FinishedOnString,
          NumPlayers: row.NumPlayers,
          FinalPosition: row.FinalPosition,
        };
      });
      window.postMessage({ type: 'bgm-yucata-data', plays: plays }, '*');
    }
    /* eslint-enable no-undef */
  } catch (e) {
    window.postMessage({ type: 'bgm-yucata-data', error: e.message }, '*');
  }
})();
