const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let pass = 0, fail = 0;
function check(ok, msg) { console.log((ok ? '  PASS ' : '  FAIL ') + msg); ok ? pass++ : fail++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 1080, height: 760 });
  await page.goto('file:///E:/work%20%20buddy/2026-10-20-18-11-03/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  const yd = await page.evaluate(() => {
    const t = new Date(); t.setDate(t.getDate() - 1);
    return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
  });
  const emptyDay = await page.evaluate(() => {
    const t = new Date(); t.setDate(t.getDate() - 7);
    return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
  });

  console.log('=== 1/3 注入昨天数据后点格子 → 弹窗显示当天记录 ===');
  await page.evaluate(ds => {
    DB.plans[ds] = [{ id: 'x1', name: '昨天做了运动', done: true, prio: 'mid' }];
    DB.workout[ds] = [{ id: 'w1', type: '跑步', min: 30, burn: 150 }];
    DB.readLog[ds] = 45;
    renderHome();
    const el = document.querySelector('.cal-day[data-day="' + ds + '"]');
    if (el) el.click();
  }, yd);
  await new Promise(r => setTimeout(r, 300));
  const m = await page.evaluate(() => ({
    open: document.querySelector('#modalMask').classList.contains('on'),
    title: (document.querySelector('#modalBox h3') || {}).textContent,
    body: document.querySelector('#modalBox').innerHTML
  }));
  check(m.open, '弹窗已打开');
  check(m.title && m.title.includes('星期'), '标题含星期：' + m.title);
  check(m.body.includes('昨天做了运动'), '弹窗内容含昨天的计划项');
  check(m.body.includes('跑步'), '弹窗内容含昨天的运动');
  check(m.body.includes('45'), '弹窗内容含阅读 45 分');
  check(m.body.includes('关闭'), '弹窗按钮为「关闭」（只读）');
  // 关闭
  await page.evaluate(() => { const b = document.querySelector('#mOk'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 200));

  console.log('=== 2/3 点空的一天 → 显示「没有记录」 ===');
  await page.evaluate(ds => {
    const el = document.querySelector('.cal-day[data-day="' + ds + '"]');
    if (el) el.click();
  }, emptyDay);
  await new Promise(r => setTimeout(r, 300));
  const eb = await page.evaluate(() => document.querySelector('#modalBox').innerHTML);
  check(eb.includes('没有记录'), '空日显示「这一天还没有记录」');
  check(!eb.includes('跑步'), '空日不含其他天的数据（隔离正确）');
  await page.evaluate(() => { const b = document.querySelector('#mOk'); if (b) b.click(); });

  console.log('=== 3/3 直接调用 showDayDetail 也正常 ===');
  const direct = await page.evaluate(ds => {
    showDayDetail(ds);
    return document.querySelector('#modalBox').innerHTML;
  }, yd);
  check(direct.includes('昨天做了运动'), '直接调用 showDayDetail 含昨天计划项');
  check(errs.length === 0, '全程无未捕获异常' + (errs.length ? '：' + errs[0] : ''));

  console.log('---- summary: ' + pass + ' passed, ' + fail + ' failed ----');
  await browser.close();
  if (fail) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
