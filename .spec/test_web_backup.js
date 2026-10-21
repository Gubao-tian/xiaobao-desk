/* P0-3 数据导出/备份下载：Web 端导出不报错 + 恢复备份可还原数据 */
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

  console.log('=== 1/3 制造数据 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="read"]').click());
  await new Promise(r => setTimeout(r, 350));
  await page.evaluate(() => document.querySelector('#bookAddBtn').click());
  await new Promise(r => setTimeout(r, 300));
  await page.type('#bkTitle', '备份测试书');
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 350));
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).books.length);
  check(before === 1, '添加了一本书用于备份: ' + before);

  console.log('=== 2/3 导出备份不报错 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="profile"]').click());
  await new Promise(r => setTimeout(r, 400));
  const hasBackup = await page.evaluate(() => !!document.querySelector('#backupExport') && !!document.querySelector('#backupImport'));
  check(hasBackup, '备份卡片已渲染（导出/恢复按钮）');
  const expErr = await page.evaluate(() => {
    try { document.querySelector('#backupExport').click(); return null; } catch (e) { return e.message; }
  });
  await new Promise(r => setTimeout(r, 300));
  check(expErr === null, '点击「导出备份」未抛异常' + (expErr ? '：' + expErr : ''));
  // 快照整库用于恢复测试
  const snapshot = await page.evaluate(() => localStorage.getItem('gubao_desk_v1'));

  console.log('=== 3/3 恢复备份还原数据 ===');
  // 注意：应用有 beforeunload 落盘机制，clear()+reload 会被内存数据写回，
  // 因此改用「导入一份空备份」来模拟清空，验证恢复链路本身。
  const wipe = await page.evaluate(snap => {
    const o = JSON.parse(snap);
    o.books = [];
    return JSON.stringify(o);
  }, snapshot);
  await page.evaluate(w => { importBackup(w); }, wipe);
  await new Promise(r => setTimeout(r, 500));
  const empty = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).books.length);
  check(empty === 0, '导入空备份后书架为空: ' + empty);
  // 用快照恢复
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="profile"]').click());
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(snap => { importBackup(snap); }, snapshot);
  await new Promise(r => setTimeout(r, 500));
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).books.length);
  check(restored === 1, '恢复备份后书回到 1 本: ' + restored);
  const title = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).books[0].title);
  check(title === '备份测试书', '恢复的书名正确: ' + title);
  check(pageErrors.length === 0, '全程无未捕获 JS 异常' + (pageErrors.length ? '：' + pageErrors.join('; ') : ''));

  await browser.close();
  console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('异常:', e.message); process.exit(1); });
