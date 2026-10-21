const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let pass = 0, fail = 0;
function check(ok, msg) { console.log((ok ? '  PASS ' : '  FAIL ') + msg); ok ? pass++ : fail++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 390, height: 700, isMobile: true, hasTouch: true });
  await page.goto('file:///E:/work%20%20buddy/2026-10-20-18-11-03/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  const state = () => page.evaluate(() => {
    const b = document.querySelector('#collapseBtn');
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    return { open: document.querySelector('#sidebar').classList.contains('open'),
      opacity: +cs.opacity, clickable: cs.pointerEvents !== 'none',
      left: Math.round(r.left), top: Math.round(r.top) };
  });

  console.log('=== 1/4 关闭态：按钮显示在左上角 ===');
  let s = await state();
  check(!s.open && s.opacity === 1 && s.clickable, '初始按钮可见可点');
  check(s.left === 16 && s.top === 14, '位置在左上角 (left=' + s.left + ', top=' + s.top + ')');

  console.log('=== 2/4 打开抽屉：按钮隐藏不可点 ===');
  await page.evaluate(() => document.querySelector('#collapseBtn').click());
  await new Promise(r => setTimeout(r, 400));
  s = await state();
  check(s.open, '抽屉已打开');
  check(s.opacity === 0 && !s.clickable, '按钮隐藏且不可点（opacity=' + s.opacity + '）');

  console.log('=== 3/4 点侧边栏外部关闭：按钮重新出现 ===');
  await page.evaluate(() => {
    const ev = new MouseEvent('click', { bubbles: true });
    document.querySelector('#scroll').dispatchEvent(ev);
  });
  await new Promise(r => setTimeout(r, 400));
  s = await state();
  check(!s.open && s.opacity === 1, '关闭后按钮重新出现（opacity=' + s.opacity + '）');

  console.log('=== 4/4 再次点击可重新打开 ===');
  await page.evaluate(() => document.querySelector('#collapseBtn').click());
  await new Promise(r => setTimeout(r, 300));
  s = await state();
  check(s.open && s.opacity === 0, '可再次打开并隐藏按钮');
  check(errs.length === 0, '无未捕获异常' + (errs.length ? '：' + errs[0] : ''));
  await page.evaluate(() => document.querySelector('#collapseBtn').click());
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: '.spec/ev_collapse_top.png' });

  console.log('---- summary: ' + pass + ' passed, ' + fail + ' failed ----');
  await browser.close();
  if (fail) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
