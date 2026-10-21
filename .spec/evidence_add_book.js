/* 证据采集：真实 Chrome 手机视口，完整跑一遍「添加图书」全流程并逐步截图 */
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///E:/work%20%20buddy/2026-10-20-18-11-03/index.html';
const OUT = 'E:/work  buddy/2026-10-20-18-11-03/.spec/ev_';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  // iPhone 12 尺寸视口，模拟手机
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  const shot = async (name) => { await page.screenshot({ path: OUT + name + '.png' }); console.log('  截图 → ' + name); };

  // 进入阅读模块
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="read"]').click());
  await new Promise(r => setTimeout(r, 500));
  await shot('01_read_empty'); // 空书架

  // 点「添加书籍」
  await page.click('#bookAddBtn');
  await new Promise(r => setTimeout(r, 500));
  await shot('02_modal_open'); // 打开弹层（不透明遮罩）

  // 逐项输入：书名 / 作者 / 总页数 / 状态
  await page.type('#bkTitle', '小王子');
  await page.evaluate(() => {
    document.querySelector('#bkAuthor').value = '圣埃克苏佩里';
    document.querySelector('#bkTotal').value = '300';
  });
  await new Promise(r => setTimeout(r, 300));
  await shot('03_modal_filled'); // 填好表单

  // 点保存
  await page.evaluate(() => { const b = document.querySelector('#mOk'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 600));
  await shot('04_after_save'); // 列表里出现《小王子》

  // 再添加第二本，证明可连续添加
  await page.click('#bookAddBtn');
  await new Promise(r => setTimeout(r, 400));
  await page.type('#bkTitle', '活着');
  await page.evaluate(() => {
    document.querySelector('#bkAuthor').value = '余华';
    document.querySelector('#bkTotal').value = '200';
  });
  await page.evaluate(() => { const b = document.querySelector('#mOk'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 600));
  await shot('05_two_books'); // 两本都在

  await browser.close();
  console.log('证据采集完成');
})().catch(e => { console.error('异常:', e.message); process.exit(1); });
