/* 小程序工程静态校验 + 数据层单测 */
const fs = require('fs');
const path = require('path');
const ROOT = 'E:/work  buddy/2026-10-20-18-11-03/miniprogram';
const issues = [];
const ok = [];

function walk(dir, out = []) {
  fs.readdirSync(dir).forEach(f => {
    if (f === 'node_modules' || f === 'miniprogram_npm' || f.startsWith('.')) return;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  });
  return out;
}
const all = walk(ROOT);
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');

/* 1. app.json 页面注册与目录一致 */
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
appJson.pages.forEach(pg => {
  ['js', 'json', 'wxml', 'wxss'].forEach(ext => {
    if (!fs.existsSync(path.join(ROOT, pg + '.' + ext))) issues.push('app.json 注册页面缺少文件: ' + pg + '.' + ext);
  });
});
const dirPages = all.filter(f => /pages\/[^/]+\/[^/]+\.js$/.test(rel(f))).map(f => rel(f).replace(/\.js$/, ''));
dirPages.forEach(pg => { if (!appJson.pages.includes(pg)) issues.push('目录存在但未注册: ' + pg); });
ok.push('页面注册一致：' + appJson.pages.length + ' 个');

/* 2. 每个页面的约定
   说明：以 side-nav 为框架的「内容模块页」需遵守全套约定（onNav/refresh/onPullDownRefresh…）；
        以 navigateTo 方式打开的「设置/二级页」（如 remind）不挂 side-nav，仅做轻量约束（禁止 px 单位）。 */
const SETTINGS_PAGES = new Set(['pages/remind/remind']);
/* 只读聚合页：只展示不落盘（如 timeline 汇总各模块），豁免 store.save 约定 */
const READONLY_PAGES = new Set(['pages/timeline/timeline', 'pages/assistant/assistant']);
appJson.pages.forEach(pg => {
  const base = path.join(ROOT, pg);
  const json = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
  const isModule = !SETTINGS_PAGES.has(pg);
  if (isModule) {
    if (!json.usingComponents || !json.usingComponents['side-nav']) issues.push(pg + ' 未引用 side-nav');
    if (json.enablePullDownRefresh !== true) issues.push(pg + ' 未开启下拉刷新');
    const wxml = fs.readFileSync(base + '.wxml', 'utf8');
    if (!wxml.trim().startsWith('<side-nav')) issues.push(pg + ' WXML 首行不是 side-nav');
    if (!/bind:navigate="onNav"/.test(wxml)) issues.push(pg + ' WXML 未绑定 onNav');
    const js = fs.readFileSync(base + '.js', 'utf8');
    ['store.getDB', 'onNav', 'refresh()', 'onPullDownRefresh', 'store.initDay', 'onShareAppMessage'].forEach(k => {
      if (!js.includes(k)) issues.push(pg + ' JS 缺少 ' + k);
    });
    /* 落盘：直接 store.save，或经 setProfile/setTheme（内部含 save）；只读聚合页豁免 */
    if (!READONLY_PAGES.has(pg) &&
        !js.includes('store.save') && !js.includes('store.setProfile') && !js.includes('store.setTheme')) {
      issues.push(pg + ' JS 缺少 store.save');
    }
    /* 动态背景：根节点必须接 pageStyle */
    if (!wxml.includes('style="{{pageStyle}}"')) issues.push(pg + ' WXML 根节点未接 pageStyle');
    if (!js.includes('T.pageStyle')) issues.push(pg + ' JS 未调用 T.pageStyle');
  }
  const wxml = fs.readFileSync(base + '.wxml', 'utf8');
  if (/:\s*\d+px/.test(wxml)) issues.push(pg + ' WXML 含 px 单位');
  const wxss = fs.readFileSync(base + '.wxss', 'utf8');
  if (/:\s*\d+px/.test(wxss)) issues.push(pg + ' WXSS 含 px 单位');
});
ok.push('页面约定检查完成（side-nav / onNav / save / refresh / rpx）');

/* 3. WXML 标签配平（忽略自闭合与注释） */
all.filter(f => f.endsWith('.wxml')).forEach(f => {
  const src = fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  const re = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^"'>])*?)(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const [full, tag, , selfClose] = m;
    if (full.startsWith('</')) {
      const top = stack.pop();
      if (top !== tag) { issues.push(rel(f) + ' 标签不配平: 期望 </' + top + '> 实际 </' + tag + '>'); break; }
    } else if (!selfClose && !/^(input|image|icon|audio|video|camera|live-player|live-pusher|import|include|wxs)$/.test(tag)) {
      stack.push(tag);
    }
  }
  if (stack.length) issues.push(rel(f) + ' 有未闭合标签: ' + stack.join(','));
});
ok.push('WXML 标签配平检查完成');

/* 3.5 WXML 输入框约定：① 同一元素禁止重复属性（重复 bindblur 会静默顶掉其中一个处理器）
        ② 有 bindinput 的 input/textarea 必须同时有 bindblur（失焦提交，防真机末字符未同步就被提交） */
all.filter(f => f.endsWith('.wxml')).forEach(f => {
  const src = fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const re = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^"'>])*?)(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const tag = m[1], attrs = m[2];
    const names = [];
    const are = /([\w:-]+)\s*=\s*("[^"]*"|'[^']*')/g;
    let a;
    while ((a = are.exec(attrs))) names.push(a[1]);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    if (dup.length) issues.push(rel(f) + ' <' + tag + '> 重复属性: ' + [...new Set(dup)].join(','));
    if (/^(input|textarea)$/.test(tag) && /\bbindinput=/.test(attrs) && !/\bbindblur=/.test(attrs)) {
      issues.push(rel(f) + ' <' + tag + '> 有 bindinput 但缺少 bindblur（失焦提交）');
    }
  }
});
ok.push('WXML 输入框约定检查完成（无重复属性 / bindinput 必配 bindblur）');

/* 3.6 悬浮按钮避让：FAB 在左上角 —— .page 顶部内边距必须 ≥ FAB 的 top + height + 16rpx 呼吸 */
const navWxss = fs.readFileSync(path.join(ROOT, 'components/side-nav/side-nav.wxss'), 'utf8');
const appWxss = fs.readFileSync(path.join(ROOT, 'app.wxss'), 'utf8');
const fabTop = (/top:\s*calc\((\d+)rpx/.exec(navWxss) || [])[1];
const fabH = (/\.nav-fab\s*\{[^}]*?height:\s*(\d+)rpx/.exec(navWxss) || [])[1];
const pagePadTop = (/\.page\s*\{[^}]*?padding:\s*(\d+)rpx/.exec(appWxss) || [])[1];
if (fabTop && fabH && pagePadTop) {
  const need = parseInt(fabTop, 10) + parseInt(fabH, 10) + 16;
  if (parseInt(pagePadTop, 10) < need) {
    issues.push('FAB 会压住页面顶部内容：.page 顶部内边距 ' + pagePadTop + 'rpx < FAB 占据 ' + need + 'rpx');
  } else {
    ok.push('FAB 避让检查完成（顶部内边距 ' + pagePadTop + 'rpx ≥ FAB ' + fabTop + '+' + fabH + '+16rpx）');
  }
} else {
  issues.push('未能解析 FAB / .page 尺寸，避让检查需人工确认');
}
/* FAB 交互约定：抽屉打开时按钮隐藏（.hide），关闭时出现 */
const navWxml = fs.readFileSync(path.join(ROOT, 'components/side-nav/side-nav.wxml'), 'utf8');
if (!/nav-fab[^>]*\{\{open \? 'hide' : ''\}\}/.test(navWxml)) issues.push('side-nav FAB 未绑定 open→hide（打开抽屉应隐藏按钮）');
if (!/\.nav-fab\.hide\s*\{[^}]*opacity:\s*0/.test(navWxss)) issues.push('side-nav WXSS 缺少 .nav-fab.hide 淡出样式');
ok.push('FAB 开关约定检查完成（open→hide 淡出）');

/* 4. 数据层单测（mock wx） */
const storage = {};
global.wx = {
  getStorageSync: k => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  showToast: () => {},
  console: console
};
const store = require(path.join(ROOT, 'utils/store.js'));
const u = require(path.join(ROOT, 'utils/util.js'));

function assert(cond, msg) { if (!cond) issues.push('单测失败: ' + msg); }

// 4.1 默认结构
const DB = store.getDB();
['checkins', 'plans', 'courses', 'studyLog', 'workout', 'exam', 'finance', 'goals', 'ideas', 'pubs', 'books', 'readLog', 'quotes', 'skills', 'skillLog', 'memos', 'reviews'].forEach(k => {
  assert(DB[k] !== undefined, 'DB 缺少字段 ' + k);
});
// 4.2 写入与持久化
DB.plans[u.today()] = [{ id: 't1', name: '单测任务', done: true, prio: 'high' }];
DB.checkins[u.today()] = { at: Date.now() };
DB.checkins[u.dateAdd(u.today(), -1)] = { at: Date.now() - 86400000 };
store.save();
const rawVal = storage[store.KEY];
const raw = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
assert(raw.plans[u.today()].length === 1, '持久化 plans 失败');
assert(store.streak() === 2, '连续打卡应为 2，实际 ' + store.streak());
// 4.3 重新加载（模拟重启）
delete require.cache[require.resolve(path.join(ROOT, 'utils/store.js'))];
const store2 = require(path.join(ROOT, 'utils/store.js'));
assert(store2.getDB().plans[u.today()].length === 1, '重启后数据丢失');
assert(store2.getDB().courses.length === 0, 'courses 应为空数组');
// 4.4 跨天翻页
assert(store2.initDay() === false, '同一天 initDay 应返回 false');
// 4.5 工具函数
assert(u.dateAdd('2026-02-28', 1) === '2026-03-01', '跨月日期计算错误');
assert(u.dateAdd('2026-12-31', 1) === '2027-01-01', '跨年日期计算错误');
assert(u.weekRange().length === 2 && u.daysBetween(...u.weekRange()) === 6, 'weekRange 应为 7 天');
assert(u.lastNDays(7).length === 7, 'lastNDays 长度错误');
const [qc, qe] = u.quoteOfDay('2026-10-20');
assert(qc.length > 0 && qe.length > 0, '每日一句为空');
assert(JSON.stringify(u.quoteOfDay('2026-10-20')) === JSON.stringify(u.quoteOfDay('2026-10-20')), '每日一句应确定性');
assert(u.quoteOfDay('2026-10-21')[0] !== qc || u.QUOTES.length === 1, '不同日期应换句');
assert(u.greet(9).includes('上午'), 'greet 时段错误');
// 4.6 主题与个人资料
const T = require(path.join(ROOT, 'utils/theme.js'));
assert(T.THEMES.length >= 7, '预设主题应至少 7 套');
assert(T.pageStyle(T.THEMES[0]).includes('--accent:'), 'pageStyle 未注入主题变量');
assert(T.deriveTheme('#F2689A').accent !== T.THEMES[0].accent, '自定义派生主题异常');
const p0 = store2.getProfile();
store2.setProfile({ name: '小宝', sign: '每天进步一点点', tags: ['终身学习者'] });
const p1 = store2.getProfile();
assert(p1.name === '小宝' && p1.tags.length === 1, 'setProfile 未生效');
assert(p0.avatar, 'profile 应有默认头像');
store2.setTheme(T.THEMES[1]);
assert(store2.currentTheme().id === 'lavender', 'setTheme 未生效');
store2.setTheme(T.deriveTheme('#4FB79A'));
assert(store2.currentTheme().id === 'custom', '自定义主题 id 应为 custom');
ok.push('数据层单测完成（存储/重启/连续打卡/日期工具/每日一句/主题/个人资料）');

/* 6. 页面处理器冒烟测试：模拟小程序 Page 环境，跑通每个页面的关键交互
   （此类测试专门捕捉 this.form 未初始化、setData 路径写错等运行时错误） */
(function pageSmoke(){
  Object.assign(global.wx, {
    showToast: () => {},
    showModal: o => { if (o && o.success) o.success({ confirm: true }); },
    stopPullDownRefresh: () => {},
    reLaunch: () => {},
    vibrateShort: () => {},
    setBackgroundColor: () => {},
    setNavigationBarColor: () => {}
  });
  /* 重置数据层，从空库开始断言 */
  Object.keys(storage).forEach(k => delete storage[k]);
  delete require.cache[require.resolve(path.join(ROOT, 'utils/store.js'))];
  const st = require(path.join(ROOT, 'utils/store.js'));
  const uu = require(path.join(ROOT, 'utils/util.js'));

  function loadPageCfg(pg) {
    let cfg = null;
    global.Page = c => { cfg = c; };
    delete require.cache[require.resolve(path.join(ROOT, pg + '.js'))];
    require(path.join(ROOT, pg + '.js'));
    return cfg;
  }
  function makeCtx(cfg) {
    const ctx = { data: JSON.parse(JSON.stringify(cfg.data || {})) };
    ctx.setData = function (patch) {
      Object.keys(patch).forEach(k => {
        const parts = k.split('.');
        let obj = this.data;
        while (parts.length > 1) {
          const p = parts.shift();
          if (typeof obj[p] !== 'object' || obj[p] === null) obj[p] = {};
          obj = obj[p];
        }
        obj[parts[0]] = patch[k];
      });
    };
    Object.keys(cfg).forEach(k => { if (typeof cfg[k] === 'function') ctx[k] = cfg[k]; });
    return ctx;
  }
  const input = v => ({ detail: { value: v } });
  const tap = o => ({ currentTarget: { dataset: o } });
  const both = (v, o) => ({ detail: { value: v }, currentTarget: { dataset: o } });

  /* 每个场景从空库开始，避免相互污染 */
  function resetDB() {
    const DB = st.getDB();
    Object.keys(DB).forEach(k => delete DB[k]);
    Object.assign(DB, JSON.parse(JSON.stringify(st.DEFAULT)));
  }

  const scenarios = {
    home: c => {
      const DB = st.getDB();
      c.onLoad(); c.onShow();
      c.onCheckin();
      assert(!!DB.checkins[uu.today()], 'home 打卡未写入');
      DB.plans[uu.today()] = [{ id: 'p1', name: '冒烟任务', done: false, prio: 'mid' }];
      c.refresh();
      c.onTogglePlan(tap({ id: 'p1' }));
      assert(DB.plans[uu.today()][0].done === true, 'home 勾选任务未生效');
      /* 全局搜索：跨模块命中 */
      DB.books.push({ id: 'b1', title: '英语语法书', author: '佚名', total: 100, page: 0, status: 'reading' });
      c.onSearchInput(input('英语'));
      assert(c.data.searchResults.length === 1, 'home 全局搜索未命中书籍');
      assert(c.data.searchResults[0].mod === 'read', 'home 搜索结果模块应为 read');
      c.onSearchInput(input('不存在的关键词xyz'));
      assert(c.data.searchResults.length === 0, 'home 搜索无匹配时应为空');
      /* 月历点一天查看详情：弹 showModal（mock 自动确认），不应抛异常 */
      const yd = uu.dateAdd(uu.today(), -1);
      DB.plans[yd] = [{ id: 'pp', name: '昨天任务', done: true, prio: 'mid' }];
      c.onDayDetail(tap({ ds: yd })); // 有记录的一天
      c.onDayDetail(tap({ ds: uu.dateAdd(uu.today(), 1) })); // 未来空的一天
      c.onDayDetail(tap({})); // 占位空格（无 ds）
      c.onUnload();
    },
    plan: c => {
      const DB = st.getDB();
      c.onShow();
      c.onAddPlan();
      assert((DB.plans[uu.today()] || []).length === 0, 'plan 空名称不应入账');
      c.onFormName(input('写周报'));
      c.onAddPlan();
      assert((DB.plans[uu.today()] || []).length === 1, 'plan 添加任务失败');
      /* 真机 race：输入末字符后立刻点按钮，该字符的 bindinput 可能未同步到 this.data，
         bindblur 才携带完整值——必须有失焦提交，否则名称被截断（添加结果不正确） */
      assert(typeof c.onFormNameBlur === 'function', 'plan 缺少 onFormNameBlur 失焦提交处理器');
      c.onFormName(input('买牛'));                  // 末字符「奶」未同步
      c.onFormNameBlur(input('买牛奶'));            // 失焦提交完整值
      c.onAddPlan();
      const lastP = DB.plans[uu.today()][DB.plans[uu.today()].length - 1];
      assert(lastP.name === '买牛奶', 'plan 失焦提交后名称应完整，实际: ' + lastP.name);
      c.onToggle(tap({ id: DB.plans[uu.today()][0].id }));
      assert(DB.plans[uu.today()][0].done === true, 'plan 勾选未生效');
    },
    course: c => {
      const DB = st.getDB();
      c.onShow();
      c.openModal();
      c.onFormName(input('高等数学')); c.onFormTotal(input('20'));
      c.submitModal();
      assert(DB.courses.length === 1, 'course 添加课程失败');
      c.onStep(tap({ id: DB.courses[0].id, dir: 1 }));
      assert(DB.courses[0].progress > 0, 'course 章节进度未更新');
    },
    workout: c => {
      const DB = st.getDB();
      c.onShow();
      c.onPickType(tap({ key: 'run' }));
      /* 真机 race：末字符未同步时靠 blur 提交完整值 */
      assert(typeof c.onFormMinBlur === 'function', 'workout 缺少 onFormMinBlur 失焦提交处理器');
      c.onFormMin(input('3'));                  // 末字符「0」未同步
      c.onFormMinBlur(input('30'));             // 失焦提交完整值
      c.onRecord();
      assert((DB.workout[uu.today()] || []).length === 1, 'workout 记录运动失败');
      assert(DB.workout[uu.today()][0].min === 30, 'workout 失焦提交后分钟数应完整');
      c.openModal();
      c.onFormCName(input('爬山')); c.onFormCMin(input('60'));
      c.submitModal();
      assert((DB.workout[uu.today()] || []).length === 2, 'workout 自定义运动失败');
    },
    exam: c => {
      const DB = st.getDB();
      c.onShow();
      c.openModal();
      c.onFormName(input('英语六级')); c.onFormTotal(input('10'));
      c.submitModal();
      assert(DB.exam.length === 1, 'exam 添加科目失败');
      c.onStep(tap({ id: DB.exam[0].id, dir: 1 }));
      assert(DB.exam[0].done === 1, 'exam 章节进度未更新');
    },
    finance: c => {
      const DB = st.getDB();
      c.onShow();
      c.onOpenRec(tap({ type: 'expense' }));
      c.onFormAmount(input('35.5')); c.onFormNote(input('午饭'));
      c.submitModal();
      assert(DB.finance.length === 1, 'finance 记一笔失败');
      c.setData({ 'goalForm.name': '旅行基金', 'goalForm.target': '5000' });
      c.onAddGoal();
      assert(DB.goals.length === 1, 'finance 添加目标失败');
      c.onOpenDep(tap({ id: DB.goals[0].id }));
      c.onFormDepAmount(input('500'));
      c.submitDep();
      assert(DB.goals[0].saved === 500, 'finance 存入目标失败');
    },
    media: c => {
      const DB = st.getDB();
      c.onShow();
      c.openIdea();
      c.onFormIdeaTitle(input('通勤穿搭选题'));
      c.submitIdea();
      assert(DB.ideas.length === 1, 'media 添加灵感失败');
      c.openPub();
      c.onFormPubTitle(input('我的书桌好物')); c.onFormPubHits(input('120'));
      c.submitPub();
      assert(DB.pubs.length === 1, 'media 登记发布失败');
    },
    read: c => {
      const DB = st.getDB();
      c.onShow();
      c.openAdd();
      c.onFormTitle(input('被讨厌的勇气')); c.onFormAuthor(input('岸见一郎')); c.onFormTotal(input('200'));
      c.submitModal();
      assert(DB.books.length === 1, 'read 添加书籍失败');
      const bid = DB.books[0].id;
      /* 真机 race：末字符未同步时靠 blur 提交完整值 */
      assert(typeof c.onPageBlur === 'function', 'read 缺少 onPageBlur 失焦提交处理器');
      c.onPageInput(both('5', { id: bid }));     // 末字符「0」未同步
      c.onPageBlur(both('50', { id: bid }));     // 失焦提交完整值
      c.onUpdatePage(tap({ id: bid }));
      assert(DB.books[0].page === 50, 'read 首次累加页码应为 50');
      /* 累加语义：再读 30 页应叠加而非覆盖 */
      c.onPageInput(both('3', { id: bid }));
      c.onPageBlur(both('30', { id: bid }));
      c.onUpdatePage(tap({ id: bid }));
      assert(DB.books[0].page === 80, 'read 页码应累加（50+30=80），实际 ' + DB.books[0].page);
      c.onMinInput(input('4'));                  // 末字符「5」未同步
      c.onMinInputBlur(input('45'));             // 失焦提交完整值
      c.onLogConfirm();
      assert(DB.readLog[uu.today()] === 45, 'read 失焦提交后时长应完整');
      c.onQuoteInput(input('世界很简单，人生也是一样。'));
      c.onAddQuote();
      assert(DB.quotes.length === 1, 'read 收录摘抄失败');
    },
    skill: c => {
      const DB = st.getDB();
      c.onShow();
      c.openAdd();
      c.onFormName(input('吉他'));
      c.submitModal();
      assert(DB.skills.length === 1, 'skill 添加技能失败');
      c.onPractice(tap({ id: DB.skills[0].id }));
      assert(DB.skills[0].count === 1, 'skill 练习 +1 失败');
    },
    memo: c => {
      const DB = st.getDB();
      c.onShow();
      c.onSearchInput(input('牛奶'));
      c.refresh();
      c.onNew();
      c.onFormTitle(input('购物清单')); c.onFormBody(input('牛奶、鸡蛋'));
      c.submitModal();
      assert(DB.memos.length === 1, 'memo 新建便签失败');
      c.onTogglePin(tap({ id: DB.memos[0].id }));
      assert(DB.memos[0].pin === true, 'memo 置顶失败');
    },
    review: c => {
      const DB = st.getDB();
      c.onShow();
      c.onFormGood(input('坚持了一周'));
      c.onSave();
      const [ws] = uu.weekRange();
      assert(!!DB.reviews[ws], 'review 保存复盘失败');
      /* 自动成长报告 */
      c.onGenReport();
      assert(!!c.data.reportText, 'review 成长报告未生成');
      assert(c.data.reportStats.length >= 5, 'review 报告统计项不足: ' + c.data.reportStats.length);
      c.onFillReport();
      assert((c.data.form.good || '').indexOf(c.data.reportText) >= 0, 'review 报告未写入 form.good');
    },
    profile: c => {
      const DB = st.getDB();
      c.onShow();
      c.onName(input('小宝'));
      assert(DB.profile.name === '小宝', 'profile 保存昵称失败');
      c.onPickAvatar(tap({ av: '🐱' }));
      assert(DB.profile.avatar === '🐱', 'profile 选择头像失败');
      c.onTagInput(input('早起星人'));
      c.onAddTag();
      assert(DB.profile.tags.length === 1, 'profile 添加标签失败');
      c.onPickTheme(tap({ id: 'mint' }));
      assert(st.currentTheme().id === 'mint', 'profile 切换主题失败');
      c.onSlider({ currentTarget: { dataset: { k: 'customR' } }, detail: { value: 80 } });
      c.onUseCustom();
      assert(st.currentTheme().id === 'custom', 'profile 自定义背景失败');
    },
    templates: c => {
      const DB = st.getDB();
      c.onShow();
      assert(c.data.planTpl.length >= 4, 'templates 计划模板不足');
      c.onApply(tap({ tpl: 'p_work' }));
      assert((DB.plans[uu.today()] || []).length === 4, 'templates 套用计划模板失败');
      c.onApply(tap({ tpl: 'm_shop' }));
      assert(DB.memos.length === 1, 'templates 套用便签模板失败');
      c.onApply(tap({ tpl: 'r_week' }));
      const [ws] = uu.weekRange();
      assert(!!DB.reviews[ws], 'templates 套用复盘模板失败');
    },
    assistant: c => {
      c.onShow(); // 未连云端时 refresh 应安全降级
      assert(typeof c._stream === 'function', 'assistant 缺少流式处理器');
      c.onInput(input('今天先做什么'));
      assert(c.data.input === '今天先做什么', 'assistant 输入未生效');
      c.onSend(); // 未连云端 -> 走提示分支，不应抛异常
      c.onClear();
      assert(c.data.messages.length === 0, 'assistant 清空对话失败');
    },
    timeline: c => {
      const DB = st.getDB();
      DB.plans[uu.today()] = [{ id: 'p1', name: '时间轴任务', done: true, prio: 'high' }];
      DB.checkins[uu.today()] = { at: Date.now() };
      c.onShow();
      assert(c.data.nodes.length >= 2, 'timeline 时间轴节点不足（打卡+计划）');
      assert(c.data.nodes.some(n => n.title === '时间轴任务'), 'timeline 未汇总计划任务');
      assert(c.data.nodes.some(n => n.tag === '打卡'), 'timeline 未汇总打卡');
      c.onPrev();
      assert(c.data.day === uu.dateAdd(uu.today(), -1), 'timeline 前一天切换失败');
      c.onToday();
      assert(c.data.day === uu.today(), 'timeline 回到今天失败');
      c.onNext(); // 未来不可前进
      assert(c.data.day === uu.today(), 'timeline 不应前进到未来');
    },
    remind: c => {
      const DB = st.getDB();
      c.onShow();
      c.onTogglePlan({ detail: { value: false } });
      assert(DB.reminders.plan.on === false, 'remind 关闭计划提醒未生效');
      c.onTimePlan({ detail: { value: '08:30' } });
      assert(DB.reminders.plan.time === '08:30', 'remind 修改计划时间未生效');
      c.onToggleWater({ detail: { value: true } });
      assert(DB.reminders.water.on === true, 'remind 开启喝水提醒未生效');
      c.onIntervalWater({ detail: { value: '2' } });
      assert(DB.reminders.water.interval === 90, 'remind 修改喝水间隔未生效');
      c.onEnableSubscribe(); // 模板未配置 -> showModal，不应抛异常
    }
  };

  appJson.pages.forEach(pg => {
    const name = pg.split('/')[1];
    const run = scenarios[name];
    if (!run) return;
    let cfg;
    try {
      cfg = loadPageCfg(pg);
      if (!cfg) { issues.push(name + ' 页面未调用 Page()'); return; }
      resetDB();
      const ctx = makeCtx(cfg);
      run(ctx);
    } catch (e) {
      issues.push(name + ' 页面交互抛异常: ' + e.message);
    }
  });
  ok.push('页面处理器冒烟测试完成（12 页关键交互）');
})();

/* 5. 引用检查：页面只用 store/util 已导出的能力 */
const storeSrc = fs.readFileSync(path.join(ROOT, 'utils/store.js'), 'utf8');
['getDB', 'save', 'initDay', 'streak'].forEach(k => assert(storeSrc.includes(k), 'store 未导出 ' + k));
const utilExports = require(path.join(ROOT, 'utils/util.js'));
const usedUtils = new Set();
all.filter(f => f.endsWith('.js')).forEach(f => {
  const src = fs.readFileSync(f, 'utf8');
  const re = /\bu\.([A-Za-z_]\w*)/g; let m;
  while ((m = re.exec(src))) usedUtils.add(m[1]);
});
usedUtils.forEach(name => { if (!(name in utilExports)) issues.push('使用了 util 不存在的函数: u.' + name); });
ok.push('util 引用检查完成，使用到: ' + [...usedUtils].join(','));

/* 7. 云服务接入约定 */
(function cloudChecks() {
  /* 7.1 隐私清单：位于小程序根、文件名用 applicationId、内容是 JSON 数组 */
  const pvPath = path.join(ROOT, '.wbapp_ZcCFIKSesfyiQjzc3gNjkn.privacy.json');
  if (!fs.existsSync(pvPath)) {
    issues.push('缺少隐私清单 .wbapp_ZcCFIKSesfyiQjzc3gNjkn.privacy.json');
  } else {
    try {
      const pv = JSON.parse(fs.readFileSync(pvPath, 'utf8'));
      if (!Array.isArray(pv)) issues.push('隐私清单内容应为数组');
      else ok.push('隐私清单就绪（' + pv.length + ' 项隐私能力声明）');
    } catch (e) { issues.push('隐私清单不是合法 JSON: ' + e.message); }
  }
  /* 7.2 客户端初始化：唯一入口、两个 publicConfig 值齐备、用小程序专用工厂 */
  const cloudSrc = fs.readFileSync(path.join(ROOT, 'utils/cloud.js'), 'utf8');
  assert(cloudSrc.includes('createMiniProgramWorkBuddyCloud'), 'cloud.js 未使用小程序专用工厂');
  assert(cloudSrc.includes("endpoint:") && cloudSrc.includes('mp-api.app.workbuddy.host'), 'cloud.js 未传入 endpoint');
  assert(/publishableKey:\s*'wbpk_/.test(cloudSrc), 'cloud.js 未传入 publishableKey');
  assert(cloudSrc.includes('createDiagnosticWx'), 'cloud.js 未接入请求诊断');
  const syncSrc = fs.readFileSync(path.join(ROOT, 'utils/sync.js'), 'utf8');
  assert(syncSrc.includes('signInWithWechat'), 'sync.js 未实现微信登录');
  assert(syncSrc.includes('wx.login'), 'sync.js 未调用 wx.login');
  assert(/upsert\([^)]*onConflict/.test(syncSrc), 'sync.js 推送未指定 onConflict');
  assert(!syncSrc.includes('owner_id:'), 'sync.js 不应手写 owner_id（由 DEFAULT auth.uid() 填充）');
  /* 7.3 禁用形态：root 入口工厂、手写数据平面请求、第二个 CloudBase 客户端 */
  all.filter(f => f.endsWith('.js')).forEach(f => {
    const src = fs.readFileSync(f, 'utf8');
    if (/require\(['"]@tencent-ai\/workbuddy-cloud-sdk['"]\)/.test(src) || /from\s+['"]@tencent-ai\/workbuddy-cloud-sdk['"]/.test(src)) {
      issues.push(rel(f) + ' 使用了 root 入口（应使用 /miniprogram 子路径）');
    }
    if (/wx\.request\([^)]*\.cloud\//.test(src) || /['"]\/\.cloud\//.test(src)) {
      issues.push(rel(f) + ' 出现手写数据平面请求（应走 SDK）');
    }
    if (/@cloudbase\/js-sdk/.test(src)) issues.push(rel(f) + ' 引入了 CloudBase SDK');
  });
  /* 7.4 app.js 启动接入与 store 云同步能力 */
  const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert(appSrc.includes("require('./utils/sync.js')"), 'app.js 未接入云同步');
  assert(appSrc.includes('bootstrap()') && appSrc.includes('onForeground()'), 'app.js 未在启动/前台接入同步');
  ['getRev', 'getPushedRev', 'setPushedRev', 'snapshot', 'applyCloud'].forEach(k => {
    assert(storeSrc.includes(k), 'store 未导出云同步能力 ' + k);
  });
  assert(/scheduleCloudPush/.test(storeSrc), 'store.save 未调度云推送');
  ok.push('云服务接入约定检查完成（初始化/登录/推送/隐私清单/禁用形态）');
})();

console.log('==== OK ====');
ok.forEach(o => console.log('✓ ' + o));
console.log('==== ISSUES (' + issues.length + ') ====');
issues.forEach(i => console.log('✗ ' + i));
