
/**
 * GASでReactアプリを配信するためのスクリプトです。
 * (Single File Build対応版)
 * 
 * 手順:
 * 1. ターミナルで `npm install` を実行し、新しい依存関係(vite-plugin-singlefile)をインストールします。
 * 2. `npm run build` を実行します。`dist` フォルダに `index.html` が生成されます。
 *    ※このHTMLファイルにJavaScriptとCSSが全て埋め込まれています。
 * 3. Google Apps Script プロジェクトを開きます。
 * 4. このファイルの内容を `Code.gs` にコピーします。
 * 5. GASエディタで「HTML」ファイルを追加し、名前を `index` とします。
 * 6. ローカルの `dist/index.html` の中身を**すべてコピー**し、GASの `index.html` に貼り付けます。
 * 7. 「デプロイ」 > 「新しいデプロイ」 > 「ウェブアプリ」を選択し、アクセス権限を「全員」にしてデプロイします。
 */

function doGet(e) {
  // ルートアクセス時はアプリのHTMLを返す
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('XeroxYT-NTv4X')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * クライアントサイド(React)からのAPIリクエストを中継する関数
 * CORSエラーを回避するためにGASサーバー側でfetchを実行します。
 */
function proxyApi(url) {
  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true
    });
    
    return {
      status: response.getResponseCode(),
      body: response.getContentText()
    };
  } catch (e) {
    return {
      status: 500,
      body: JSON.stringify({ error: e.toString() })
    };
  }
}
