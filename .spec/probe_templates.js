const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await page.setViewport({ width: 1080, height: 720 });
  await page.goto('file:///E:/work%20%20buddy/2026-10-20-18-11-03/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  // 点击侧边栏「模板库」
  const ok = await page.evaluate(() => {
    const el = document.querySelector('.sidebar [data-go="templates"], .nav-item[data-go="templates"], [data-go="templates"]');
    if (!el) return 'NO_NAV';
    el.click(); return 'CLICKED';
  });
  await new Promise(r => setTimeout(r, 400));
  const state = await page.evaluate(() => ({
    len: (document.querySelector('#page-templates')||{innerHTML:''}).innerHTML.length,
    visible: (document.querySelector('#page-templates')||{}).offsetParent !== undefined ? getComputedStyle(document.querySelector('#page-templates')).display : 'n/a',
    tplPlan: (document.querySelector('#tplPlan')||{innerHTML:''}).innerHTML.length,
    tplReview: (document.querySelector('#tplReview')||{innerHTML:''}).innerHTML.length,
    tplMemo: (document.querySelector('#tplMemo')||{innerHTML:''}).innerHTML.length
  }));
  console.log('nav:', ok);
  console.log('state:', JSON.stringify(state, null, 1));
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await page.screenshot({ path: '.spec/probe_templates.png' });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
