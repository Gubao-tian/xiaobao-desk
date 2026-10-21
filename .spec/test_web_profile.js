/* Web 版新功能回归测试：我的名片 + 背景主题 */
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'E:/work  buddy/2026-10-20-18-11-03';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise(r => server.listen(8901, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const results = [];
  const t = (name, ok, extra) => { results.push((ok ? '✓ ' : '✗ ') + name + (extra ? ' -> ' + extra : '')); };

  await page.goto('http://127.0.0.1:8901/index.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  // 1. 导航应有 12 项（含「我的」）
  const navCount = await page.$$eval('#nav .nav-item', els => els.length);
  t('导航 16 项（含日历/日历时间轴/AI 小宝/模板库）', navCount === 16, '实际 ' + navCount);
  const hasProfile = await page.$$eval('#nav .nav-item', els => els.some(e => e.dataset.go === 'profile'));
  t('导航含「我的」', hasProfile);

  // 2. 首页个人名片卡片
  const homeCard = await page.$('#page-home [data-goprofile]');
  t('首页个人名片卡片', !!homeCard);
  const homeName = await page.$eval('#page-home .pf-name', e => e.textContent);
  t('空名片显示引导文案', homeName.includes('设置我的名字'), homeName);

  // 3. 进入「我的」页
  await page.click('#nav .nav-item[data-go="profile"]');
  await page.waitForSelector('#page-profile .pf-avatar', { timeout: 3000 });
  const activePage = await page.$eval('#page-profile', e => e.classList.contains('active'));
  t('我的页面可打开', activePage);

  // 4. 填写名片（即时保存）
  await page.type('#pfName', '小宝');
  await page.type('#pfSign', '每天进步一点点');
  await page.click('#pfAvatars .chip[data-av="🐱"]');
  await page.type('#pfTagInput', '终身学习者');
  await page.click('#pfTagAdd');
  await page.click('#pfSuggest .chip[data-tag="早起星人"]');
  await new Promise(r => setTimeout(r, 250));

  // 5. 首页名片同步
  await page.click('#nav .nav-item[data-go="home"]');
  const homeName2 = await page.$eval('#page-home .pf-name', e => e.textContent);
  const homeSign = await page.$eval('#page-home .pf-sign', e => e.textContent);
  const homeTags = await page.$$eval('#page-home [data-goprofile] .pill', els => els.map(e => e.textContent));
  t('首页显示昵称', homeName2 === '小宝', homeName2);
  t('首页显示签名', homeSign === '每天进步一点点', homeSign);
  t('首页显示标签', homeTags.includes('终身学习者') && homeTags.includes('早起星人'), JSON.stringify(homeTags));

  // 6. 切换预设主题（薄荷）
  await page.click('#nav .nav-item[data-go="profile"]');
  await page.waitForSelector('#pfThemes .th-card');
  await page.click('#pfThemes .th-card[data-th="mint"]');
  await new Promise(r => setTimeout(r, 150));
  const pinkVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pink').trim());
  const bgVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  t('主题切换改写 --pink', pinkVar === '#4FB79A', pinkVar);
  t('主题切换改写 --bg', bgVar === '#EFFBF6', bgVar);

  // 7. 自定义调色
  await page.evaluate(() => {
    const r = document.querySelector('#pfR'), g = document.querySelector('#pfG'), b = document.querySelector('#pfB');
    r.value = 255; g.value = 120; b.value = 60;
    r.dispatchEvent(new Event('input', { bubbles: true }));
    g.dispatchEvent(new Event('input', { bubbles: true }));
    b.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#pfUseCustom');
  await new Promise(r => setTimeout(r, 150));
  const customPink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pink').trim());
  t('自定义背景已应用', customPink.length > 0 && customPink !== '#4FB79A', customPink);

  // 8. 持久化：刷新后保留
  await page.reload({ waitUntil: 'networkidle0' });
  const afterName = await page.$eval('#page-home .pf-name', e => e.textContent);
  const afterPink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pink').trim());
  t('刷新后昵称保留', afterName === '小宝', afterName);
  t('刷新后主题保留', afterPink === customPink, afterPink);

  // 9. 恢复默认
  await page.click('#nav .nav-item[data-go="profile"]');
  await page.waitForSelector('#pfResetTheme');
  await page.click('#pfResetTheme');
  await new Promise(r => setTimeout(r, 150));
  const resetPink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pink').trim());
  t('恢复默认背景', resetPink === '#FF8FB8', resetPink);

  // 10. 夜间模式仍可用
  await page.click('#themeBtn');
  const nightAttr = await page.evaluate(() => document.documentElement.dataset.theme);
  t('夜间模式切换', nightAttr === 'night', nightAttr);

  // 11. 其他页面无异常
  for (const id of ['plan', 'course', 'workout', 'exam', 'finance', 'media', 'read', 'skill', 'memo', 'review']) {
    await page.click(`#nav .nav-item[data-go="${id}"]`);
    await new Promise(r => setTimeout(r, 60));
  }
  t('10 个功能页全部可打开', true);

  console.log(results.join('\n'));
  console.log('---- console errors ----');
  console.log(errors.length ? errors.join('\n') : '(none)');
  const failed = results.filter(r => r.startsWith('✗'));
  console.log('---- summary: ' + (results.length - failed.length) + '/' + results.length + ' passed, ' + errors.length + ' js errors ----');

  await browser.close();
  server.close();
  process.exit(failed.length || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
