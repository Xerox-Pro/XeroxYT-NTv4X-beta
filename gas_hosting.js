function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('XeroxYT-NTv4X')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
