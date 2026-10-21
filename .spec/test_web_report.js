/* P1-7 自动成长报告：Web 端生成 + 写入复盘 */
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

  console.log('=== 1/3 造本周数据 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="plan"]').click());
  await new Promise(r => setTimeout(r, 350));
  await page.type('#planInput', '报告测试任务');
  await page.click('#planAdd');
  await new Promise(r => setTimeout(r, 300));
  const seeded = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('gubao_desk_v1'));
    return (d.plans[Object.keys(d.plans)[0]] || []).length;
  });
  check(seeded === 1, '已添加 1 条计划: ' + seeded);

  console.log('=== 2/3 生成成长报告 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="review"]').click());
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('#rvReport').click());
  await new Promise(r => setTimeout(r, 450));
  const box = await page.evaluate(() => {
    const el = document.querySelector('#rvReportBox');
    return el ? el.innerText : '';
  });
  check(box.includes('这一周打卡'), '报告包含打卡汇总');
  check(box.includes('完成计划'), '报告包含计划完成情况');
  const hasFill = await page.evaluate(() => !!document.querySelector('#rvFillReport'));
  check(hasFill, '报告提供「写进复盘」按钮');

  console.log('=== 3/3 写入复盘 ===');
  await page.evaluate(() => document.querySelector('#rvFillReport').click());
  await new Promise(r => setTimeout(r, 350));
  const good = await page.evaluate(() => document.querySelector('#rvGood').value);
  check(good.includes('这一周打卡'), '报告已写入「做得好的三件事」');
  check(pageErrors.length === 0, '全程无未捕获 JS 异常' + (pageErrors.length ? '：' + pageErrors.join('; ') : ''));

  await browser.close();
  console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('异常:', e.message); process.exit(1); });
