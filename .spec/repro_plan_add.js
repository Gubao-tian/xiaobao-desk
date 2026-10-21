/* 复现脚本：Web 版「每日计划」添加任务全流程 + 控制台错误捕获 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle0' });

  // 清掉旧数据，保证干净起点
  await page.evaluate(() => localStorage.removeItem('gubao_desk_v1'));
  await page.reload({ waitUntil: 'networkidle0' });

  // 进入计划页
  await page.click('#nav .nav-item[data-go="plan"]');
  await new Promise(r => setTimeout(r, 300));

  // 场景 1：输入任务名 → 点「添加」
  await page.type('#planInput', '复现测试任务A');
  await page.click('#planAdd');
  await new Promise(r => setTimeout(r, 300));
  const r1 = await page.evaluate(() => ({
    listText: document.querySelector('#planList').textContent,
    inputVal: document.querySelector('#planInput').value,
    count: (JSON.parse(localStorage.getItem('gubao_desk_v1') || '{}').plans || {})[Object.keys(JSON.parse(localStorage.getItem('gubao_desk_v1')).plans || {})[0] || '']?.length ?? -1
  }));
  console.log('场景1 点按钮添加:', JSON.stringify(r1, null, 2));

  // 场景 2：输入任务名 → 按回车
  await page.evaluate(() => { document.querySelector('#planInput').value = ''; });
  await page.type('#planInput', '复现测试任务B');
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 300));
  const r2 = await page.evaluate(() => document.querySelector('#planList').textContent);
  console.log('场景2 回车添加 列表含B:', r2.includes('复现测试任务B'));

  // 场景 3：空输入点添加（应聚焦不报错）
  await page.evaluate(() => { document.querySelector('#planInput').value = ''; });
  await page.click('#planAdd');
  await new Promise(r => setTimeout(r, 200));

  // 场景 4：刷新后是否仍在
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('#nav .nav-item[data-go="plan"]');
  await new Promise(r => setTimeout(r, 300));
  const r4 = await page.evaluate(() => document.querySelector('#planList').textContent);
  console.log('场景4 刷新后 A在:', r4.includes('复现测试任务A'), ' B在:', r4.includes('复现测试任务B'));

  // 场景 5：切走再切回是否仍在
  await page.click('#nav .nav-item[data-go="home"]');
  await new Promise(r => setTimeout(r, 200));
  await page.click('#nav .nav-item[data-go="plan"]');
  await new Promise(r => setTimeout(r, 300));
  const r5 = await page.evaluate(() => document.querySelector('#planList').textContent);
  console.log('场景5 切回后 A在:', r5.includes('复现测试任务A'), ' B在:', r5.includes('复现测试任务B'));

  console.log('--- 控制台错误 ---');
  console.log(errors.length ? errors.join('\n') : '(无)');

  await browser.close();
})().catch(e => { console.error('REPRO FAILED:', e); process.exit(1); });
