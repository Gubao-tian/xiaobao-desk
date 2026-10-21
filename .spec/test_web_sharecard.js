/* P2-10 分享战绩卡片：Web 端 canvas 绘制 + 导出可用 */
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

  console.log('=== 1/2 卡片渲染 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="profile"]').click());
  await new Promise(r => setTimeout(r, 450));
  const hasCv = await page.evaluate(() => !!document.querySelector('#shareCanvas') && !!document.querySelector('#genCard'));
  check(hasCv, '战绩卡片区域已渲染（画布 + 生成按钮）');
  await page.evaluate(() => document.querySelector('#genCard').click());
  await new Promise(r => setTimeout(r, 400));
  const state = await page.evaluate(() => (document.querySelector('#cardState') || {}).textContent || '');
  check(state.includes('已生成'), '生成后状态提示正确: ' + state);

  console.log('=== 2/2 画布确实被绘制 ===');
  const painted = await page.evaluate(() => {
    const cv = document.querySelector('#shareCanvas');
    const ctx = cv.getContext('2d');
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    // 统计非透明/非纯白像素，确认真的画了东西
    let n = 0;
    for (let i = 0; i < d.length; i += 4000) { if (d[i + 3] > 0 && !(d[i] === 255 && d[i + 1] === 255 && d[i + 2] === 255)) n++; }
    return n;
  });
  check(painted > 0, '画布已绘制内容（采样非白像素: ' + painted + '）');
  const dataUrl = await page.evaluate(() => document.querySelector('#shareCanvas').toDataURL('image/png').slice(0, 20));
  check(dataUrl.indexOf('data:image/png') === 0, '可导出为 PNG 图片');
  check(pageErrors.length === 0, '全程无未捕获 JS 异常' + (pageErrors.length ? '：' + pageErrors.join('; ') : ''));

  await browser.close();
  console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('异常:', e.message); process.exit(1); });
