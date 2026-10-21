const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
  await page.goto('file:///E:/work%20%20buddy/2026-10-20-18-11-03/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { const el = document.querySelector('[data-go="templates"]'); if (el) el.click(); });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: '.spec/ev_templates_ok.png' });
  console.log('saved');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
