/* P0-2 提醒/通知：Web 端提醒设置可用 + 调度不报错 */
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

  console.log('=== 1/3 Web 提醒卡片渲染 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="profile"]').click());
  await new Promise(r => setTimeout(r, 400));
  const hasCard = await page.evaluate(() => !!document.querySelector('#rPlanOn') && !!document.querySelector('#remNotif'));
  check(hasCard, '提醒与通知卡片已渲染（含开关与允许通知按钮）');

  console.log('=== 2/3 设置写入 DB.reminders ===');
  // 关闭每日计划提醒
  await page.evaluate(() => {
    const el = document.querySelector('#rPlanOn');
    el.checked = false;
    el.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  const planOff = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).reminders.plan.on);
  check(planOff === false, '关闭每日计划提醒已写入: ' + planOff);
  // 改时间
  await page.evaluate(() => {
    const el = document.querySelector('#rPlanTime');
    el.value = '08:30';
    el.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  const planTime = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).reminders.plan.time);
  check(planTime === '08:30', '修改计划时间已写入: ' + planTime);
  // 开启喝水提醒 + 改间隔
  await page.evaluate(() => {
    const on = document.querySelector('#rWaterOn');
    on.checked = true; on.dispatchEvent(new Event('change'));
    const iv = document.querySelector('#rWaterInt');
    iv.value = '90'; iv.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  const water = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).reminders.water);
  check(water.on === true && water.interval === 90, '喝水提醒开启+间隔写入: ' + JSON.stringify(water));

  console.log('=== 3/3 允许通知不报错 ===');
  const notifErr = await page.evaluate(() => {
    try { document.querySelector('#remNotif').click(); return null; } catch (e) { return e.message; }
  });
  await new Promise(r => setTimeout(r, 300));
  check(notifErr === null, '点击「允许浏览器通知」未抛异常' + (notifErr ? '：' + notifErr : ''));
  // 调度器已在启动时运行（scheduleReminders 被调用），确认无未捕获异常
  check(pageErrors.length === 0, '全程无未捕获 JS 异常' + (pageErrors.length ? '：' + pageErrors.join('; ') : ''));

  await browser.close();
  console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('异常:', e.message); process.exit(1); });
