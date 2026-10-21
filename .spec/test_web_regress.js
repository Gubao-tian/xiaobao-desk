/* Web 版核心功能回归：确保新增名片/主题未破坏原有 10 模块 */
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'E:/work  buddy/2026-10-20-18-11-03';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  fs.readFile(path.join(ROOT, p), (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise(r => server.listen(8904, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const R = [];
  const t = (n, ok, extra) => R.push((ok ? '✓ ' : '✗ ') + n + (extra !== undefined ? ' -> ' + extra : ''));

  await page.goto('http://127.0.0.1:8904/index.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  // 每日计划：添加 + 勾选 + 持久化
  await page.click('#nav .nav-item[data-go="plan"]');
  await page.type('#planInput', '回归测试任务');
  await page.click('#planAdd');
  const planCount = await page.$$eval('#planList .titem', e => e.length);
  t('计划添加', planCount === 1, planCount);
  await page.click('#planList .check');
  await new Promise(r => setTimeout(r, 300));
  await page.reload({ waitUntil: 'networkidle0' });
  const doneAfterReload = await page.$$eval('#planList .titem.done', e => e.length);
  t('计划勾选后刷新保留', doneAfterReload === 1, doneAfterReload);

  // 打卡 + 彩带 + 连续天数
  await page.click('#nav .nav-item[data-go="home"]');
  await page.click('#checkinBtn');
  await new Promise(r => setTimeout(r, 300));
  const streakTxt = await page.$eval('#streakPill', e => e.textContent);
  t('打卡后连续 1 天', streakTxt.includes('1'), streakTxt);

  // 课程：添加 + 进度
  await page.click('#nav .nav-item[data-go="course"]');
  await page.click('#courseAddBtn');
  await page.waitForSelector('#cName', { timeout: 2000 });
  await page.type('#cName', '高等数学');
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 200));
  const courseCount = await page.$$eval('#courseList .course-row', e => e.length);
  t('课程添加', courseCount === 1, courseCount);

  // 备忘录：新建
  await page.click('#nav .nav-item[data-go="memo"]');
  await page.click('#memoAddBtn');
  await page.waitForSelector('#mTitle', { timeout: 2000 });
  await page.type('#mTitle', '买牛奶');
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 200));
  const memoCount = await page.$$eval('#memoGrid .memo, #memoGrid > *', e => e.length);
  t('备忘录新建', memoCount >= 1, memoCount);

  // 周复盘：保存
  await page.click('#nav .nav-item[data-go="review"]');
  await page.type('#rvGood', '坚持了一周');
  await page.click('#rvSave');
  await new Promise(r => setTimeout(r, 200));
  const rvSaved = await page.$$eval('#reviewHistory .rv-item, #reviewHistory > *', e => e.length);
  t('周复盘保存', rvSaved >= 1, rvSaved);

  // 主题切换不影响数据
  await page.click('#nav .nav-item[data-go="profile"]');
  await page.waitForSelector('#pfThemes .th-card');
  await page.click('#pfThemes .th-card[data-th="dusk"]');
  await page.click('#nav .nav-item[data-go="home"]');
  const streakTxt2 = await page.$eval('#streakPill', e => e.textContent);
  t('换主题后打卡数据不变', streakTxt2.includes('1'), streakTxt2);

  // 导出按钮存在且可点（不实际下载）
  const hasExport = await page.$('#exportBtn');
  t('导出按钮存在', !!hasExport);

  console.log(R.join('\n'));
  console.log('---- js errors ----');
  console.log(errors.length ? errors.join('\n') : '(none)');
  const failed = R.filter(r => r.startsWith('✗')).length;
  console.log('---- summary: ' + (R.length - failed) + '/' + R.length + ' passed, ' + errors.length + ' errors ----');
  await browser.close();
  server.close();
  process.exit(failed || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
