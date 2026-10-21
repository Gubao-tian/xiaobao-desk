/* 手机视口取证：Web 版在 390x844 下的真实渲染 */
const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 320, height: 568, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const file = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
  await page.goto(file, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: path.join(__dirname, 'shot_se_home.png') });

  // 打开抽屉导航
  await page.tap('#collapseBtn').catch(() => page.click('#collapseBtn'));
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(__dirname, 'shot_se_drawer.png') });

  // 进入计划页
  await page.tap('#nav .nav-item[data-go="plan"]').catch(() => page.click('#nav .nav-item[data-go="plan"]'));
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(__dirname, 'shot_se_plan.png') });

  // 尝试添加计划（手机端真实点击）
  const typed = await page.$eval('#planInput', el => { el.focus(); return true; }).catch(() => false);
  if (typed) {
    await page.type('#planInput', '手机端测试任务');
    await new Promise(r => setTimeout(r, 200));
    const btn = await page.$('#planAdd');
    if (btn) { await page.tap('#planAdd').catch(() => page.click('#planAdd')); }
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(__dirname, 'shot_se_plan_added.png') });
  }

  // 横向溢出检测
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth
  }));

  console.log('JS 错误:', errors.length ? errors.slice(0, 5) : '(无)');
  console.log('横向溢出:', overflow.scrollW > overflow.clientW ? `有 (${overflow.scrollW} > ${overflow.clientW})` : '无');
  await browser.close();
})().catch(e => { console.error('SCRIPT FAIL:', e.message); process.exit(1); });
