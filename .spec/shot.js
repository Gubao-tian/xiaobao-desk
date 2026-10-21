const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 884, deviceScaleFactor: 2 });
  await page.goto('file://' + path.resolve(__dirname, 'render_modal.html'));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.resolve(__dirname, 'render_modal.png') });
  await browser.close();
  console.log('OK -> render_modal.png');
})().catch(e => { console.error('ERR', e); process.exit(1); });
