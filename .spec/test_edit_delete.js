/* P0-1 编辑/删除：通用 store helper + Web 版计划/阅读编辑实测 */
const fs = require('fs');
const path = require('path');

/* ---- 1. 通用 store helper 单元测试（mock wx） ---- */
const storePath = path.resolve('miniprogram/utils/store.js');
const storeSrc = fs.readFileSync(storePath, 'utf8');
let _db = {};
const wxMock = {
  getStorageSync: k => (k === 'gubao_desk_v1' ? JSON.parse(JSON.stringify(_db)) : null),
  setStorageSync: (k, v) => { if (k === 'gubao_desk_v1') _db = JSON.parse(JSON.stringify(v)); },
  showToast: () => {}
};
const sandbox = { wx: wxMock, module: { exports: {} }, require: (p) => {
  if (p.includes('theme.js')) return { THEMES: [{ id: 'day' }], applyTheme: () => {} };
  if (p.includes('util.js')) return { today: () => '2026-10-21', dateAdd: (d, n) => d, uid: () => 'u' + Math.random().toString(36).slice(2) };
  if (p.includes('sync.js')) return { schedulePush: () => {} };
  return {};
} };
const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(storeSrc + '\nmodule.exports=module.exports;', sandbox);
// 重新注入依赖后 require 已执行，取 exports
const store = sandbox.module.exports;

let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } };

console.log('=== 1/3 通用 helper ===');
// 扁平数组
store.removeItem('books', 'x'); // 对不存在无副作用
check(store.getDB().books.length === 0, 'removeItem 空数组安全');
store.getDB().books.push({ id: 'b1', title: '小王子', total: 100 });
store.updateItem('books', 'b1', { total: 200 });
check(store.getDB().books[0].total === 200, 'updateItem 修改生效');
store.removeItem('books', 'b1');
check(store.getDB().books.length === 0, 'removeItem 删除生效');
// 日期键
store.getDB().plans['2026-10-21'] = [{ id: 'p1', name: '任务A', prio: 'mid' }];
store.updateDayItem('plans', '2026-10-21', 'p1', { name: '任务A改', prio: 'high' });
check(store.getDB().plans['2026-10-21'][0].name === '任务A改' && store.getDB().plans['2026-10-21'][0].prio === 'high', 'updateDayItem 修改生效');
store.removeDayItem('plans', '2026-10-21', 'p1');
check(store.getDB().plans['2026-10-21'].length === 0, 'removeDayItem 删除生效');

/* ---- 2. Web 版：计划编辑实测 ---- */
(async () => {
  const puppeteer = require('puppeteer-core');
  const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const URL = 'file:///E:/work%20%20buddy/2026-10-20-18-11-03/index.html';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  console.log('=== 2/3 Web 计划编辑 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="plan"]').click());
  await new Promise(r => setTimeout(r, 300));
  await page.type('#planInput', '原始任务');
  await page.click('#planAdd');
  await new Promise(r => setTimeout(r, 250));
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).plans['2026-10-21'][0].name);
  check(before === '原始任务', '计划添加成功: ' + before);
  // 点编辑
  await page.evaluate(() => document.querySelector('#planList [data-edit]').click());
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => { const i = document.querySelector('#planInput'); i.value = ''; });
  await page.type('#planInput', '改后任务');
  await page.click('#planAdd'); // 此时为保存修改
  await new Promise(r => setTimeout(r, 250));
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).plans['2026-10-21'][0].name);
  const cnt = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).plans['2026-10-21'].length);
  check(after === '改后任务', '计划编辑生效: ' + after);
  check(cnt === 1, '编辑未新增重复条目（仍为 1 条）');

  console.log('=== 3/3 Web 阅读编辑 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="read"]').click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('#bookAddBtn').click());
  await new Promise(r => setTimeout(r, 300));
  await page.type('#bkTitle', '原书名');
  await page.evaluate(() => { document.querySelector('#bkAuthor').value = '原作者'; document.querySelector('#bkTotal').value = '100'; });
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 300));
  // 编辑
  await page.evaluate(() => document.querySelector('#bookList [data-bedit]').click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const i = document.querySelector('#bkTitle'); i.value = ''; });
  await page.type('#bkTitle', '改后书名');
  await page.evaluate(() => { document.querySelector('#bkAuthor').value = '改后作者'; });
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 300));
  const book = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).books[0]);
  check(book.title === '改后书名' && book.author === '改后作者', '书籍编辑生效: ' + book.title + '/' + book.author);
  const bookCnt = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).books.length);
  check(bookCnt === 1, '书籍编辑未新增重复条目（仍为 1 本）');

  console.log('=== 4/5 Web 自媒体编辑 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="media"]').click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('#ideaAddBtn').click());
  await new Promise(r => setTimeout(r, 300));
  await page.type('#iTitle', '原始灵感');
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 250));
  const ideaBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).ideas[0].title);
  check(ideaBefore === '原始灵感', '灵感添加成功: ' + ideaBefore);
  await page.evaluate(() => document.querySelector('#ideaList [data-iedit]').click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const i = document.querySelector('#iTitle'); i.value = ''; });
  await page.type('#iTitle', '改后灵感');
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 250));
  const ideaAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).ideas[0].title);
  const ideaCnt = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).ideas.length);
  check(ideaAfter === '改后灵感', '灵感编辑生效: ' + ideaAfter);
  check(ideaCnt === 1, '灵感编辑未新增重复条目（仍为 1 条）');
  // 发布编辑
  await page.evaluate(() => document.querySelector('#pubAddBtn').click());
  await new Promise(r => setTimeout(r, 300));
  await page.type('#pTitle', '原始发布');
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 250));
  const pubBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).pubs[0].title);
  check(pubBefore === '原始发布', '发布添加成功: ' + pubBefore);
  await page.evaluate(() => document.querySelector('#pubList [data-pedit]').click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const i = document.querySelector('#pTitle'); i.value = ''; });
  await page.type('#pTitle', '改后发布');
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 250));
  const pubAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).pubs[0].title);
  const pubCnt = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).pubs.length);
  check(pubAfter === '改后发布', '发布编辑生效: ' + pubAfter);
  check(pubCnt === 1, '发布编辑未新增重复条目（仍为 1 条）');

  console.log('=== 5/5 Web 锻炼编辑 ===');
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="workout"]').click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('#exCustom').click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const i = document.querySelector('#exName'); i.value = ''; });
  await page.type('#exName', '原始运动');
  await page.evaluate(() => { document.querySelector('#exM').value = '40'; });
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 250));
  const wkBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).workout['2026-10-21'][0].type);
  check(wkBefore === '原始运动', '自定义运动添加成功: ' + wkBefore);
  await page.evaluate(() => document.querySelector('#workoutLog [data-wedit]').click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const i = document.querySelector('#exName'); i.value = ''; });
  await page.type('#exName', '改后运动');
  await page.evaluate(() => { document.querySelector('#exM').value = '55'; });
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 250));
  const wkAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).workout['2026-10-21'][0]);
  const wkCnt = await page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1')).workout['2026-10-21'].length);
  check(wkAfter.type === '改后运动' && wkAfter.min === 55, '自定义运动编辑生效: ' + wkAfter.type + '/' + wkAfter.min);
  check(wkCnt === 1, '自定义运动编辑未新增重复条目（仍为 1 条）');

  await browser.close();
  console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('异常:', e.message); process.exit(1); });
