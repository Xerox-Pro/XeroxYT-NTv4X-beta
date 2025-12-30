/**
 * XeroxYT-NTv4X for Google Apps Script (CDN Loader)
 * 
 * 配信元リポジトリ: Xerox-Pro/XeroxYT-NTv4X-beta (mainブランチ)
 */

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/Xerox-Pro/XeroxYT-NTv4X-beta@main/dist/assets';

function doGet(e) {
  const html = `
    <!DOCTYPE html>
    <html lang="ja" class="dark">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>XeroxYT-NTv4X</title>
        <!-- 固定名で出力されたCSSを読み込み -->
        <link rel="stylesheet" href="${CDN_BASE}/index.css">
        <link rel="icon" href="${CDN_BASE}/../icon.svg">
        <script>
          const theme = localStorage.getItem('theme') || 'dark';
          document.documentElement.className = theme;
        </script>
      </head>
      <body>
        <div id="root"></div>
        <script type="module">
          // GASの環境で動作させるためのAPIブリッジ
          window.google = {
            script: {
              run: {
                withSuccessHandler: function(callback) {
                  this.success = callback;
                  return this;
                },
                withFailureHandler: function(callback) {
                  this.failure = callback;
                  return this;
                },
                proxyApi: function(url) {
                  const self = this;
                  google.script.run_internal('proxyApi', [url], self.success, self.failure);
                }
              }
            }
          };

          google.script.run_internal = function(name, args, success, failure) {
            google.script.host.run[name].apply(google.script.host.run, args)
              .withSuccessHandler(success)
              .withFailureHandler(failure);
          };
        </script>
        <!-- 固定名で出力されたJSを読み込み -->
        <script type="module" src="${CDN_BASE}/index.js"></script>
      </body>
    </html>
  `;

  return HtmlService.createHtmlOutput(html)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('XeroxYT-NTv4X')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function proxyApi(url) {
  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return {
      status: response.getResponseCode(),
      body: response.getContentText()
    };
  } catch (e) {
    return { status: 500, body: JSON.stringify({ error: e.toString() }) };
  }
}
