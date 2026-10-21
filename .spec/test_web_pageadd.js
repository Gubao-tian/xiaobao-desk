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

  console.log('=== 1/3 添加一本书（300 页）===');
  await page.evaluate(() => {
    DB.books.push({ id: 'bk1', title: '测试书', author: '佚名', total: 300, page: 0, status: 'reading' });
    renderRead();
  });
  await new Promise(r => setTimeout(r, 200));

  console.log('=== 2/3 累加：90 + 60 = 150 ===');
  const add = async (n) => {
    await page.evaluate(n => {
      const inp = document.querySelector('[data-bpage="bk1"]');
      inp.value = String(n);
      document.querySelector('[data-bupd="bk1"]').click();
    }, n);
    await new Promise(r => setTimeout(r, 150));
  };
  await add(90);
  let st = await page.evaluate(() => { const b = DB.books.find(x => x.id === 'bk1'); return { page: b.page, status: b.status, inp: document.querySelector('[data-bpage="bk1"]').value }; });
  check(st.page === 90, '第一次累加 90 → 页码 90（实际 ' + st.page + '）');
  check(st.inp === '', '累加后输入框已清空');
  await add(60);
  st = await page.evaluate(() => DB.books.find(x => x.id === 'bk1').page);
  check(st === 150, '第二次累加 60 → 页码 150（实际 ' + st + '）');

  console.log('=== 3/3 超出封顶：+200 → 300 且自动读完 ===');
  await add(200);
  st = await page.evaluate(() => { const b = DB.books.find(x => x.id === 'bk1'); return { page: b.page, status: b.status }; });
  check(st.page === 300, '封顶到总页数 300（实际 ' + st.page + '）');
  check(st.status === 'done', '自动标记已读完');
  check(errs.length === 0, '全程无未捕获异常' + (errs.length ? '：' + errs[0] : ''));

  console.log('---- summary: ' + pass + ' passed, ' + fail + ' failed ----');
  await browser.close();
  if (fail) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
