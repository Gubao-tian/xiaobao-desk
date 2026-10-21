/* P1-4 全局搜索：跨模块检索命中 + 搜索弹层可用 */
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

  console.log('=== 1/3 造跨模块数据 ===');
  // 阅读：一本书
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="read"]').click());
  await new Promise(r => setTimeout(r, 350));
  await page.evaluate(() => document.querySelector('#bookAddBtn').click());
  await new Promise(r => setTimeout(r, 300));
  await page.type('#bkTitle', '英语语法书');
  await page.click('#mOk');
  await new Promise(r => setTimeout(r, 350));
  // 计划：一条任务
  await page.evaluate(() => document.querySelector('#nav .nav-item[data-go="plan"]').click());
  await new Promise(r => setTimeout(r, 350));
  await page.type('#planInput', '晨跑五公里');
  await page.click('#planAdd');
  await new Promise(r => setTimeout(r, 300));
  const db1 = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('gubao_desk_v1'));
    return { books: d.books.length, plans: (d.plans[Object.keys(d.plans)[0]] || []).length };
  });
  check(db1.books === 1 && db1.plans === 1, '已造数据：书 1 本 / 计划 1 条: ' + JSON.stringify(db1));

  console.log('=== 2/3 searchAll 跨模块命中 ===');
  const r1 = await page.evaluate(() => searchAll('英语').map(x => x.mod + '|' + x.text));
  check(r1.some(x => x.startsWith('read|英语语法书')), '搜「英语」命中阅读模块: ' + JSON.stringify(r1));
  const r2 = await page.evaluate(() => searchAll('晨跑').map(x => x.mod + '|' + x.text));
  check(r2.some(x => x.startsWith('plan|晨跑五公里')), '搜「晨跑」命中计划模块: ' + JSON.stringify(r2));
  const r3 = await page.evaluate(() => searchAll('不存在的关键词xyz').length);
  check(r3 === 0, '无匹配时返回空: ' + r3);

  console.log('=== 3/3 搜索弹层可用 ===');
  await page.evaluate(() => document.querySelector('#searchBtn').click());
  await new Promise(r => setTimeout(r, 350));
  const modalOpen = await page.evaluate(() => !!document.querySelector('#gSearchInput'));
  check(modalOpen, '搜索弹层已打开（含输入框）');
  // 只留一个「关闭」按钮，取消应隐藏
  const btns = await page.evaluate(() => {
    const c = document.querySelector('#mCancel'), o = document.querySelector('#mOk');
    return { cancelHidden: !c || c.style.display === 'none', okText: o ? o.textContent : '' };
  });
  check(btns.cancelHidden && btns.okText === '关闭', '弹窗只保留「关闭」按钮');
  await page.type('#gSearchInput', '英语');
  await new Promise(r => setTimeout(r, 350));
  const items = await page.evaluate(() => document.querySelectorAll('#gSearchResults .sr-item').length);
  check(items >= 1, '弹层内渲染出结果: ' + items);
  // 点击结果应跳转并关闭弹层
  await page.evaluate(() => document.querySelector('#gSearchResults .sr-item').click());
  await new Promise(r => setTimeout(r, 400));
  const closed = await page.evaluate(() => !document.querySelector('#modalMask').classList.contains('on'));
  check(closed, '点击结果后弹层关闭');
  check(pageErrors.length === 0, '全程无未捕获 JS 异常' + (pageErrors.length ? '：' + pageErrors.join('; ') : ''));

  console.log('=== 4/4 盲区修复：便签正文 / 储蓄目标 / 课程备注 ===');
  await page.evaluate(() => {
    DB.memos.push({ id: 'm1', title: '', body: '周末陪孩子踢足球', color: '#FFF4F8', pin: false, created: today() });
    DB.goals.push({ id: 'g1', name: '足球装备基金', target: 500, saved: 80 });
    DB.courses.push({ id: 'c1', name: '体育理论', note: '足球规则第一章', color: '#FFD0E2', total: 10, progress: 2 });
    DB.workout['2026-10-01'] = [{ id: 'w1', type: '足球', min: 60, burn: 300 }];
  });
  const r4 = await page.evaluate(() => searchAll('足球').map(x => x.mod + '|' + x.text));
  check(r4.some(x => x.startsWith('memo|')), '便签正文可搜到: ' + JSON.stringify(r4));
  check(r4.some(x => x.startsWith('finance|足球装备基金')), '储蓄目标可搜到');
  check(r4.some(x => x.startsWith('course|体育理论')), '课程备注可搜到');
  check(r4.some(x => x.startsWith('workout|足球')), '运动记录可搜到');
  check(r4.length >= 4, '「足球」共命中 ' + r4.length + ' 条');

  await browser.close();
  console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('异常:', e.message); process.exit(1); });
