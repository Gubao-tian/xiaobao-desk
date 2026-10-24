/* 全模块手机端实测：Web 版 12 个模块
   手机视口 390x844，逐模块验证：可打开 / 无横向溢出 / 核心添加交互 / 数据入库 / 无 JS 错误 */
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/manifest|ERR_FAILED/.test(m.text())) jsErrors.push('CONSOLE: ' + m.text()); });

  await page.goto('file:///E:/work  buddy/2026-10-20-18-11-03/index.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  let pass = 0, fail = 0;
  const check = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } };
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('gubao_desk_v1') || '{}'));
  const goTo = async (id) => {
    await page.evaluate(g => { document.querySelector('#nav .nav-item[data-go="' + g + '"]').click(); }, id);
    await new Promise(r => setTimeout(r, 350));
  };
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const saveModal = async () => {
    await page.evaluate(() => { const b = document.querySelector('#mOk'); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 300));
  };

  /* ===== 1. 桌面（首页） ===== */
  console.log('=== 1/12 桌面 home ===');
  await goTo('home');
  check(await page.$('#page-home') !== null, '页面可打开');
  check(await overflow() <= 0, '无横向溢出');
  await page.evaluate(() => { const b = document.querySelector('#checkinBtn'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 300));
  check(Object.keys((await db()).checkins || {}).length === 1, '打卡入库');

  /* ===== 2. 每日计划 ===== */
  console.log('=== 2/12 每日计划 plan ===');
  await goTo('plan');
  check(await overflow() <= 0, '无横向溢出');
  await page.type('#planInput', '写周报');
  await page.evaluate(() => { document.querySelector('#planPriority').value = 'high'; });
  await page.click('#planAdd');
  await new Promise(r => setTimeout(r, 300));
  check((await db()).plans[Object.keys((await db()).plans)[0]].length === 1, '计划添加入库（优先级 high）');
  await page.type('#planInput', '买牛奶');
  await page.click('#planAdd');
  await new Promise(r => setTimeout(r, 300));
  const plans2 = (await db()).plans[Object.keys((await db()).plans)[0]];
  check(plans2.length === 2, '第二条计划入库');
  await page.evaluate(() => { const b = document.querySelector('#planList [data-check]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 250));
  check((await db()).plans[Object.keys((await db()).plans)[0]][0].done === true, '勾选完成生效');

  /* ===== 3. 课程学习 ===== */
  console.log('=== 3/12 课程学习 course ===');
  await goTo('course');
  check(await overflow() <= 0, '无横向溢出');
  await page.click('#courseAddBtn');
  await new Promise(r => setTimeout(r, 300));
  check(await page.$('#modalMask.on') !== null, '添加课程弹层打开');
  await page.type('#cName', '英语口语');
  await page.evaluate(() => { document.querySelector('#cTotal').value = '20'; });
  await saveModal();
  check((await db()).courses.length === 1, '课程添加入库');
  check((await db()).courses[0].name === '英语口语', '课程名正确');
  await page.evaluate(() => { const b = document.querySelector('#courseList [data-cplus]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 250));
  check((await db()).courses[0].progress > 0, '课程进度 +1');

  /* ===== 4. 锻炼身体 ===== */
  console.log('=== 4/12 锻炼身体 workout ===');
  await goTo('workout');
  check(await overflow() <= 0, '无横向溢出');
  await page.click('#exCustom');
  await new Promise(r => setTimeout(r, 300));
  await page.type('#exName', '爬山');
  await page.evaluate(() => { document.querySelector('#exM').value = '60'; });
  await saveModal();
  const wdb = await db();
  const wkey = Object.keys(wdb.workout || {})[0];
  check((wdb.workout[wkey] || []).length === 1, '自定义运动入库');
  check((wdb.workout[wkey] || [])[0].min === 60, '时长 60 分钟正确');

  /* ===== 5. 备考计划 ===== */
  console.log('=== 5/12 备考计划 exam ===');
  await goTo('exam');
  check(await overflow() <= 0, '无横向溢出');
  await page.click('#examAddBtn');
  await new Promise(r => setTimeout(r, 300));
  await page.type('#eName', '考研数学');
  await page.evaluate(() => { document.querySelector('#eTotal').value = '20'; });
  await saveModal();
  check((await db()).exam.length === 1, '备考科目入库');
  await page.evaluate(() => { const b = document.querySelector('#examList [data-eplus]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 250));
  check((await db()).exam[0].done === 1, '章节完成 +1');

  /* ===== 6. 理财 ===== */
  console.log('=== 6/12 理财 finance ===');
  await goTo('finance');
  check(await overflow() <= 0, '无横向溢出');
  // 记支出（分类下拉可选）
  await page.click('#finAddExpense');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    document.querySelector('#fAmt').value = '35.5';
    const s = document.querySelector('#fCat'); if (s) s.value = '餐饮';
  });
  await saveModal();
  check((await db()).finance.length === 1, '支出记账入库');
  check((await db()).finance[0].cat === '餐饮', '支出分类「餐饮」生效');
  // 记收入
  await page.click('#finAddIncome');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    document.querySelector('#fAmt').value = '500';
    const s = document.querySelector('#fCat'); if (s) s.value = '工资';
  });
  await saveModal();
  check((await db()).finance.length === 2 && (await db()).finance[1].type === 'income', '收入记账入库');
  // 储蓄目标
  await page.evaluate(() => {
    document.querySelector('#goalName').value = '旅行基金';
    document.querySelector('#goalAmt').value = '3000';
    document.querySelector('#goalAdd').click();
  });
  await new Promise(r => setTimeout(r, 300));
  check((await db()).goals.length === 1, '储蓄目标创建');

  /* ===== 7. 自媒体 ===== */
  console.log('=== 7/12 自媒体 media ===');
  await goTo('media');
  check(await overflow() <= 0, '无横向溢出');
  await page.click('#ideaAddBtn');
  await new Promise(r => setTimeout(r, 300));
  await page.type('#iTitle', '一个人住的第 100 天');
  await saveModal();
  check((await db()).ideas.length === 1, '灵感记录入库');
  await page.click('#pubAddBtn');
  await new Promise(r => setTimeout(r, 300));
  await page.type('#pTitle', '我的第一支 vlog');
  await saveModal();
  check((await db()).pubs.length === 1, '发布登记入库');

  /* ===== 8. 阅读 ===== */
  console.log('=== 8/12 阅读 read ===');
  await goTo('read');
  check(await overflow() <= 0, '无横向溢出');
  await page.click('#bookAddBtn');
  await new Promise(r => setTimeout(r, 300));
  await page.type('#bkTitle', '小王子');
  await page.evaluate(() => {
    document.querySelector('#bkAuthor').value = '圣埃克苏佩里';
    document.querySelector('#bkTotal').value = '300';
  });
  await saveModal();
  check((await db()).books.length === 1, '书籍上架入库');
  await page.click('#readQuick');
  await new Promise(r => setTimeout(r, 300));
  check((await db()).readLog[Object.keys((await db()).readLog)[0]] === 30, '快速 +30 分钟入库');
  await page.evaluate(() => {
    document.querySelector('#readQuoteInput').value = '真正重要的东西，用眼睛是看不见的';
    document.querySelector('#readQuoteAdd').click();
  });
  await new Promise(r => setTimeout(r, 300));
  check((await db()).quotes.length === 1, '摘抄收录入库');

  /* ===== 9. 技能训练 ===== */
  console.log('=== 9/12 技能训练 skill ===');
  await goTo('skill');
  check(await overflow() <= 0, '无横向溢出');
  await page.click('#skillAddBtn');
  await new Promise(r => setTimeout(r, 300));
  await page.type('#sName', '吉他');
  await saveModal();
  check((await db()).skills.length === 1, '技能创建入库');
  await page.evaluate(() => { const b = document.querySelector('[data-splus]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 300));
  check((await db()).skills[0].count === 1, '练习 +1 生效');
  check((await db()).skillLog.length === 1, '练习日志入库');

  /* ===== 10. 备忘录 ===== */
  console.log('=== 10/12 备忘录 memo ===');
  await goTo('memo');
  check(await overflow() <= 0, '无横向溢出');
  await page.click('#memoAddBtn');
  await new Promise(r => setTimeout(r, 300));
  await page.type('#mTitle', '周末安排');
  await page.evaluate(() => { document.querySelector('#mBody').value = '周六上午体检，下午看书'; });
  await saveModal();
  check((await db()).memos.length === 1, '便签创建入库');
  check((await db()).memos[0].title === '周末安排', '便签标题正确');

  /* ===== 11. 周复盘 ===== */
  console.log('=== 11/12 周复盘 review ===');
  await goTo('review');
  check(await overflow() <= 0, '无横向溢出');
  await page.evaluate(() => {
    document.querySelector('#rvGood').value = '1. 坚持早起';
    document.querySelector('#rvBad').value = '运动量不足';
    document.querySelector('#rvNext').value = '1. 每周三次跑步';
    document.querySelector('#rvSave').click();
  });
  await new Promise(r => setTimeout(r, 300));
  check(Object.keys((await db()).reviews || {}).length === 1, '周复盘保存入库');

  /* ===== 12. 我的 ===== */
  console.log('=== 12/12 我的 profile ===');
  await goTo('profile');
  check(await overflow() <= 0, '无横向溢出');
  await page.evaluate(() => {
    const n = document.querySelector('#pfName');
    n.value = '小宝'; n.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  check((await db()).profile.name === '小宝', '昵称即时保存入库');
  await page.evaluate(() => {
    const i = document.querySelector('#pfTagInput');
    i.value = '早起星人'; i.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#pfTagAdd').click();
  });
  await new Promise(r => setTimeout(r, 300));
  check(((await db()).profile.tags || []).includes('早起星人'), '标签添加入库');

  /* ===== 汇总 ===== */
  console.log('');
  console.log('JS 错误: ' + jsErrors.length);
  jsErrors.slice(0, 5).forEach(e => console.log('  ' + e));
  console.log('==== ' + (fail === 0 && jsErrors.length === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed, ' + jsErrors.length + ' js errors) ====');
  await browser.close();
  process.exit(fail === 0 && jsErrors.length === 0 ? 0 : 1);
})().catch(e => { console.error('脚本异常:', e.message); process.exit(1); });
