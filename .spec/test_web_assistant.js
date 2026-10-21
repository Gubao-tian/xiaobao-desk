/* P2-8 AI 小宝助理：Web 本地建议可用 */
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///E:/work%20%20buddy/2026-10-20-18-11-03/index.html';

let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } };

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  console.log('=== 1/2 快捷问题 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="assistant"]').click());
  await new Promise(r => setTimeout(r, 400));
  const hasQuick = await page.evaluate(() => document.querySelectorAll('#aiQuick .chip').length);
  check(hasQuick >= 3, '快捷问题按钮已渲染: ' + hasQuick);
  await page.evaluate(() => document.querySelector('#aiQuick .chip').click());
  await new Promise(r => setTimeout(r, 350));
  const chat = await page.evaluate(() => {
    const el = document.querySelector('#aiChat');
    return el ? el.innerText : '';
  });
  check(chat.length > 0 && chat.indexOf('💬') < 0, '点击后产生对话内容');
  check(/今天|任务|安排|打卡/.test(chat), '回答与今日安排相关');

  console.log('=== 2/2 自由输入 ===');
  await page.type('#aiInput', '帮我拆解目标');
  await page.evaluate(() => document.querySelector('#aiSend').click());
  await new Promise(r => setTimeout(r, 350));
  const chat2 = await page.evaluate(() => document.querySelector('#aiChat').innerText);
  check(chat2.includes('拆解'), '自由输入命中目标拆解建议');
  await page.evaluate(() => document.querySelector('#aiClear').click());
  await new Promise(r => setTimeout(r, 300));
  const cleared = await page.evaluate(() => document.querySelector('#aiChat').innerText);
  check(cleared.includes('💬'), '清空后回到空状态');
  check(pageErrors.length === 0, '全程无未捕获 JS 异常' + (pageErrors.length ? '：' + pageErrors.join('; ') : ''));

  await browser.close();
  console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('异常:', e.message); process.exit(1); });
