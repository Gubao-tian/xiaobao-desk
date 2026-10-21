/* P1-6 统一日历/时间轴视图：Web 端跨模块汇总 + 日期切换 */
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

  console.log('=== 1/3 造当天数据 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="plan"]').click());
  await new Promise(r => setTimeout(r, 350));
  await page.type('#planInput', '时间轴任务A');
  await page.click('#planAdd');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { document.querySelector('#checkinBtn') && document.querySelector('#checkinBtn').click(); });
  await new Promise(r => setTimeout(r, 250));
  const seeded = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('gubao_desk_v1'));
    return (d.plans[Object.keys(d.plans)[0]] || []).length;
  });
  check(seeded === 1, '已添加 1 条计划: ' + seeded);

  console.log('=== 2/3 时间轴汇总 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="timeline"]').click());
  await new Promise(r => setTimeout(r, 450));
  const rendered = await page.evaluate(() => {
    const el = document.querySelector('#page-timeline');
    return el ? el.innerText : '';
  });
  check(rendered.includes('时间轴任务A'), '时间轴汇总到计划任务');
  check(rendered.includes('计划完成'), '时间轴显示统计卡片');
  const nodeCount = await page.evaluate(() => document.querySelectorAll('#page-timeline .sr-item').length);
  check(nodeCount >= 1, '时间轴节点数: ' + nodeCount);

  console.log('=== 3/3 日期切换 ===');
  const beforeDay = await page.evaluate(() => document.querySelector('#tlDate').value);
  await page.evaluate(() => document.querySelector('#tlPrev').click());
  await new Promise(r => setTimeout(r, 350));
  const afterDay = await page.evaluate(() => document.querySelector('#tlDate').value);
  check(afterDay < beforeDay, '点「前一天」日期回退: ' + beforeDay + ' -> ' + afterDay);
  await page.evaluate(() => { const b = document.querySelector('#tlToday'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 350));
  const backDay = await page.evaluate(() => document.querySelector('#tlDate').value);
  check(backDay === beforeDay, '「回到今天」恢复: ' + backDay);
  check(pageErrors.length === 0, '全程无未捕获 JS 异常' + (pageErrors.length ? '：' + pageErrors.join('; ') : ''));

  await browser.close();
  console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('异常:', e.message); process.exit(1); });
