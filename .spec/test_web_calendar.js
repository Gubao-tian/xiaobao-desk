/* 日历页（阴阳历）真实浏览器测试：移动视口 390×844 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const FILE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

let pass = 0, fail = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + name + (extra ? ' — ' + extra : '')); };

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/manifest|ERR_FAILED/.test(m.text())) jsErrors.push(m.text()); });

  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 900));

  // 1. 导航里有「日历」
  const hasNav = await page.$$eval('#nav .nav-item', els => els.some(e => e.textContent.includes('日历') && e.dataset.go === 'calendar'));
  t('侧边导航有「日历」项', hasNav);

  // 2. 进入日历页
  await page.evaluate(() => go('calendar'));
  await new Promise(r => setTimeout(r, 500));
  const rendered = await page.$eval('#page-calendar', el => el.innerHTML.length);
  t('日历页渲染出内容', rendered > 500, rendered + ' 字符');

  // 3. 网格结构与天数
  const info = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#page-calendar .cal-grid:not(.cal-head) .cal-cell')];
    const y = new Date().getFullYear(), m = new Date().getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const real = cells.filter(c => c.dataset.cal);
    return {
      total: cells.length,
      real: real.length,
      daysInMonth,
      headCount: document.querySelectorAll('#page-calendar .cal-head .cal-w').length,
      firstLunar: real[0] ? real[0].querySelector('.cd-lunar').textContent : '',
      firstExpect: real[0] ? daySubLabel(real[0].dataset.cal) : '',
      allHaveLunar: real.every(c => (c.querySelector('.cd-lunar').textContent || '').trim().length > 0)
    };
  });
  t('星期表头 7 列', info.headCount === 7, '实际 ' + info.headCount);
  t('日期格数 = 当月天数', info.real === info.daysInMonth, info.real + ' / ' + info.daysInMonth);
  t('每格都有农历或节日文案', info.allHaveLunar);
  t('首格文案与计算结果一致', info.firstLunar.trim() === info.firstExpect, info.firstLunar + ' = ' + info.firstExpect);
  // 非节日的初一应显示月份名（如腊月初一 → 「腊月」）
  const chuYi = await page.evaluate(() => {
    const l = lunarOf('2026-01-19');          // 2026 腊月初一
    return { month: l.monthCn, sub: daySubLabel('2026-01-19') };
  });
  t('非节日初一显示月份名', chuYi.sub === chuYi.month, chuYi.sub + ' / ' + chuYi.month);

  // 4. 今日高亮 + 今日信息条
  const todayInfo = await page.evaluate(() => {
    const td = document.querySelector('#page-calendar .cal-cell.today');
    const strip = document.querySelector('#page-calendar .cts-lunar');
    return {
      hasToday: !!td,
      isToday: td ? td.dataset.cal === new Date().toISOString().slice(0, 10) || td.dataset.cal === (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })() : false,
      lunarText: strip ? strip.textContent.trim() : ''
    };
  });
  t('今天被高亮', todayInfo.hasToday && todayInfo.isToday);
  t('今日信息条含农历与生肖', /农历/.test(todayInfo.lunarText) && /年（.+年）/.test(todayInfo.lunarText), todayInfo.lunarText);

  // 5. 已知阴阳历对照
  const check = await page.evaluate(() => {
    const g = s => { const d = new Date(s + 'T00:00:00'); return null; };
    return {
      d20251001: (() => { const l = lunarOf('2025-10-06'); return l.monthCn + l.dayCn; })(),
      d20260217: (() => { const l = lunarOf('2026-02-17'); return l.monthCn + l.dayCn; })(),
      spring2026: solarTermOf('2026-02-04'),
      dongzhi2024: solarTermOf('2024-12-21'),
      qingming2024: solarTermOf('2024-04-04'),
      guoqing: daySubLabel('2026-10-01')
    };
  });
  t('2025-10-06 = 八月十五（中秋）', check.d20251001 === '八月十五', check.d20251001);
  t('2026-02-17 = 正月初一（春节）', check.d20260217 === '正月初一', check.d20260217);
  t('2026-02-04 = 立春', check.spring2026 === '立春', check.spring2026);
  t('2024-12-21 = 冬至（闰年不偏移）', check.dongzhi2024 === '冬至', check.dongzhi2024);
  t('2024-04-04 = 清明', check.qingming2024 === '清明', check.qingming2024);
  t('2026-10-01 显示国庆节', check.guoqing === '国庆节', check.guoqing);

  // 6. 本月节气/节日清单（以 2026 年 10 月为准，若为当月则直接校验）
  const evOk = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#page-calendar .ev-item .ev-name')].map(e => e.textContent.trim());
    return items.length > 0 && items.every(x => x.length > 0);
  });
  t('本月节气/节日清单有条目', evOk);

  // 7. 翻月
  const flip = await page.evaluate(async () => {
    const title = () => document.querySelector('#page-calendar .cal-title').textContent.trim();
    const before = title();
    document.querySelector('#calPrev').click();
    await new Promise(r => setTimeout(r, 120));
    const prev = title();
    document.querySelector('#calNext').click();
    await new Promise(r => setTimeout(r, 120));
    const back = title();
    document.querySelector('#calNext').click();
    await new Promise(r => setTimeout(r, 120));
    return { before, prev, back, next: title() };
  });
  t('上月按钮切换月份', flip.prev !== flip.before, flip.before + ' → ' + flip.prev);
  t('下月可回到原月并继续', flip.back === flip.before && flip.next !== flip.back, flip.back + ' → ' + flip.next);

  // 8. 点某天弹出当天记录（复用时间轴）
  await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#page-calendar .cal-cell[data-cal]')];
    cells[10].click();
  });
  await new Promise(r => setTimeout(r, 400));
  const modal = await page.evaluate(() => {
    const on = document.querySelector('#modalMask').classList.contains('on');
    const h3 = document.querySelector('#modalBox h3');
    const cancel = document.querySelector('#mCancel');
    return { on, title: h3 ? h3.textContent : '', cancelHidden: cancel ? cancel.style.display === 'none' : false };
  });
  t('点日期弹出当天详情', modal.on && /月.*日.*星期/.test(modal.title), modal.title);
  t('只读弹窗只保留「关闭」', modal.cancelHidden);

  await page.evaluate(() => document.querySelector('#mOk').click());
  await new Promise(r => setTimeout(r, 300));

  // 9. 移动端布局：网格不溢出
  const layout = await page.evaluate(() => {
    const grid = document.querySelector('#page-calendar .cal-grid:not(.cal-head)');
    const r = grid.getBoundingClientRect();
    const cell = document.querySelector('#page-calendar .cal-cell[data-cal]').getBoundingClientRect();
    return { gridRight: Math.round(r.right), vw: window.innerWidth, cellW: Math.round(cell.width), cellH: Math.round(cell.height) };
  });
  t('日历网格不横向溢出', layout.gridRight <= layout.vw, layout.gridRight + ' ≤ ' + layout.vw);
  t('手机端格子尺寸可点', layout.cellW >= 36 && layout.cellH >= 40, layout.cellW + '×' + layout.cellH);

  // 10. 桌面宽度下同样正常
  await page.setViewport({ width: 1280, height: 900 });
  await new Promise(r => setTimeout(r, 400));
  const desk = await page.evaluate(() => {
    const grid = document.querySelector('#page-calendar .cal-grid:not(.cal-head)');
    return { cells: grid.querySelectorAll('.cal-cell[data-cal]').length, w: Math.round(grid.getBoundingClientRect().width) };
  });
  t('桌面宽度下日历也正常', desk.cells > 27 && desk.w > 400, desk.cells + ' 格 / ' + desk.w + 'px');

  t('全程无 JS 报错', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));

  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => go('calendar'));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.resolve(__dirname, 'ev_calendar_mobile.png') });

  await browser.close();
  console.log('\n---- ' + pass + ' passed, ' + fail + ' failed ----');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('运行异常', e); process.exit(1); });
