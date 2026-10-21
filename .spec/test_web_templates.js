/* P2-9 模板库：Web 端一键套用（计划 / 复盘 / 便签） */
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

  console.log('=== 1/3 模板库渲染 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="templates"]').click());
  await new Promise(r => setTimeout(r, 400));
  const btnCount = await page.evaluate(() => document.querySelectorAll('#page-templates [data-tpl]').length);
  check(btnCount >= 8, '模板卡片渲染数量: ' + btnCount);

  console.log('=== 2/3 套用计划模板 ===');
  await page.evaluate(() => document.querySelector('#page-templates [data-tpl="p_work"]').click());
  await new Promise(r => setTimeout(r, 400));
  const plans = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('gubao_desk_v1'));
    return (d.plans[Object.keys(d.plans)[0]] || []).length;
  });
  check(plans === 4, '工作日模板加入 4 条计划: ' + plans);

  console.log('=== 3/3 套用便签 / 复盘 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="templates"]').click());
  await new Promise(r => setTimeout(r, 350));
  await page.evaluate(() => document.querySelector('#page-templates [data-tpl="m_shop"]').click());
  await new Promise(r => setTimeout(r, 400));
  const memos = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).memos.length);
  check(memos === 1, '购物清单模板新建 1 条便签: ' + memos);
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="templates"]').click());
  await new Promise(r => setTimeout(r, 350));
  await page.evaluate(() => document.querySelector('#page-templates [data-tpl="r_week"]').click());
  await new Promise(r => setTimeout(r, 400));
  const reviews = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('gubao_desk_v1')).reviews).length);
  check(reviews === 1, '复盘模板写入本周复盘: ' + reviews);
  check(pageErrors.length === 0, '全程无未捕获 JS 异常' + (pageErrors.length ? '：' + pageErrors.join('; ') : ''));

  await browser.close();
  console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('异常:', e.message); process.exit(1); });
