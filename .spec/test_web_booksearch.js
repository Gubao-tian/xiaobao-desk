const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let pass = 0, fail = 0;
function check(ok, msg) {
  console.log((ok ? '  PASS ' : '  FAIL ') + msg);
  ok ? pass++ : fail++;
}
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('file:///E:/work%20%20buddy/2026-10-20-18-11-03/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  console.log('=== 1/4 打开添加书籍弹窗 ===');
  await page.evaluate(() => document.querySelector('#bookAddBtn').click());
  await new Promise(r => setTimeout(r, 300));
  const has = await page.evaluate(() => !!document.querySelector('#bkSearch'));
  check(has, '书名旁存在「搜书」按钮');

  console.log('=== 2/4 空书名点搜书：不打开新页 ===');
  let opened = [];
  await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); }; });
  await page.evaluate(() => document.querySelector('#bkSearch').click());
  await new Promise(r => setTimeout(r, 700));
  opened = await page.evaluate(() => window.__opened);
  check(opened.length === 0, '空书名不触发搜索（opened=' + opened.length + '）');

  console.log('=== 3/4 输入书名点搜书：打开豆瓣+必应 ===');
  await page.type('#bkTitle', '被讨厌的勇气');
  await page.evaluate(() => document.querySelector('#bkSearch').click());
  await new Promise(r => setTimeout(r, 900));
  opened = await page.evaluate(() => window.__opened);
  check(opened.length === 2, '打开两个搜索结果页（' + opened.length + '）');
  check(opened[0] && opened[0].includes('douban.com') && opened[0].includes(encodeURIComponent('被讨厌的勇气')),
    '豆瓣搜索链接含书名：' + (opened[0] || '无').slice(0, 80));
  check(opened[1] && opened[1].includes('bing.com') && opened[1].includes(encodeURIComponent('被讨厌的勇气')),
    '必应兜底链接含书名：' + (opened[1] || '无').slice(0, 80));

  console.log('=== 4/4 保存不新增重复（编辑态不受影响） ===');
  await page.evaluate(() => document.querySelector('#mOk').click());
  await new Promise(r => setTimeout(r, 300));
  const cnt = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).books.length);
  check(cnt === 1, '正常保存书籍（书架 ' + cnt + ' 本）');
  const editHas = await page.evaluate(() => {
    const btn = document.querySelector('#bookList [data-bedit], [data-bedit]');
    return !!btn;
  });
  check(editHas, '编辑按钮仍存在');

  console.log('---- summary: ' + pass + ' passed, ' + fail + ' failed ----');
  await browser.close();
  if (fail) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
