const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let pass = 0, fail = 0;
function check(ok, msg) { console.log((ok ? '  PASS ' : '  FAIL ') + msg); ok ? pass++ : fail++; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();

  console.log('=== A/1 老数据（缺新字段）下模板页/AI页正常 ===');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('gubao_desk_v1', JSON.stringify({ v: 2, checkins: {}, plans: {}, courses: [] }));
  });
  await page.goto('file:///E:/work%20%20buddy/2026-10-20-18-11-03/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  for (const id of ['templates', 'assistant', 'timeline', 'review', 'read']) {
    await page.evaluate(sid => { const el = document.querySelector(`[data-go="${sid}"]`); if (el) el.click(); }, id);
    await new Promise(r => setTimeout(r, 250));
    const len = await page.evaluate(sid => (document.querySelector('#page-' + sid) || { innerHTML: '' }).innerHTML.length, id);
    check(len > 300, '老数据下「' + id + '」页有内容（' + len + ' 字符）');
  }

  console.log('=== A/2 渲染出错时显示兜底提示而非空白 ===');
  await page.evaluate(() => { window.__origRender = renderTemplates; renderTemplates = () => { throw new Error('模拟渲染故障'); }; });
  await page.evaluate(() => { const el = document.querySelector('[data-go="templates"]'); if (el) el.click(); });
  await new Promise(r => setTimeout(r, 300));
  const fb = await page.evaluate(() => (document.querySelector('#page-templates') || { innerHTML: '' }).innerHTML);
  check(fb.includes('这个页面暂时打不开'), '出错页显示兜底提示卡片');
  check(fb.includes('模拟渲染故障'), '兜底卡片展示错误信息（方便反馈定位）');
  check(fb.includes('Web v1.7.0'), '兜底卡片带版本号');

  console.log('=== A/3 侧边栏显示版本号 ===');
  const ver = await page.evaluate(() => (document.querySelector('#webVer') || {}).textContent);
  check(ver === '1.7.0', '侧边栏底部显示 Web v1.7.0');

  console.log('=== B/1 恢复后模板页内容完整 ===');
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { const el = document.querySelector('[data-go="templates"]'); if (el) el.click(); });
  await new Promise(r => setTimeout(r, 300));
  const counts = await page.evaluate(() => ({
    plan: document.querySelectorAll('#tplPlan [data-tpl]').length,
    review: document.querySelectorAll('#tplReview [data-tpl]').length,
    memo: document.querySelectorAll('#tplMemo [data-tpl]').length
  }));
  check(counts.plan === 5 && counts.review === 1 && counts.memo === 3,
    '模板数量 5 计划 / 1 复盘 / 3 便签（' + JSON.stringify(counts) + '）');

  console.log('---- summary: ' + pass + ' passed, ' + fail + ' failed ----');
  await browser.close();
  if (fail) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
