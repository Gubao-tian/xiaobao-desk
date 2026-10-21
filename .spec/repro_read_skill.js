/* 复现脚本：阅读页 + 技能训练页全交互链路
   用真实模块（store/util/theme/read.js/skill.js），mock wx 与 Page，
   模拟真实时序驱动每个处理器，捕捉运行时错误 */
const path = require('path');
const ROOT = path.join(__dirname, '..', 'miniprogram');
const fs = require('fs');

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ FAIL: ' + msg); }
}

/* ---------- mock wx ---------- */
const storage = {};
global.wx = {
  getStorageSync(k) { return storage[k] === undefined ? '' : storage[k]; },
  setStorageSync(k, v) { storage[k] = v; },
  removeStorageSync(k) { delete storage[k]; },
  showToast(o) { (global.__toasts = global.__toasts || []).push(o && o.title); },
  showModal(o) { if (o && o.success) o.success({ confirm: true }); },
  showLoading() {}, hideLoading() {},
  login(o) { if (o && o.success) o.success({ code: 'mock_code' }); },
  getAccountInfoSync() { return { miniProgram: { appId: 'touristappid' } }; },
  reLaunch(o) { global.__reLaunch = o; },
  stopPullDownRefresh() {},
  setBackgroundColor() {}, setNavigationBarColor() {}
};

/* ---------- mock Page：捕获配置并补齐 setData（贴近真实页面实例） ---------- */
const pages = {};
global.Page = function (cfg) {
  // 真实页面实例的 setData：把数据合并进 data，支持 'a.b.c' 路径
  cfg.setData = function (patch) {
    Object.keys(patch).forEach(k => {
      const keys = k.split('.');
      let obj = cfg.data;
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] === undefined || obj[keys[i]] === null || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = patch[k];
    });
  };
  pages[cfg.__name || 'unknown'] = cfg;
};

function loadPage(name, dir) {
  const p = path.join(ROOT, 'pages', dir, dir + '.js');
  const src = fs.readFileSync(p, 'utf8');
  const Module = require('module');
  const m = new Module(p, null);
  m.filename = p;
  m.paths = Module._nodeModulePaths(path.dirname(p));
  m._compile(src, p);
  const cfgs = Object.values(pages);
  return cfgs[cfgs.length - 1];
}

/* 重置：清存储 + 重载 store 模块，保证页面与断言用的是同一实例 */
function freshStore() {
  Object.keys(storage).forEach(k => delete storage[k]);
  const storePath = path.join(ROOT, 'utils/store.js');
  delete require.cache[storePath];
  return require(storePath);
}

/* ================= 阅读页 ================= */
console.log('=== 阅读页 read ===');
const store = freshStore();
const u = require(path.join(ROOT, 'utils/util.js'));
const read = loadPage('read', 'read');
let threw = null;
try {
  // 1. 初始渲染（空数据）
  read.onShow();
  check(read.data.books.length === 0, '初始渲染：书架为空');
  check(read.data.todayMin === 0, '初始渲染：今日时长 0');

  // 2. 添加书籍（完整流程）
  read.openAdd();
  check(read.data.showModal === true, '打开添加弹层');
  read.onFormTitle({ detail: { value: '小王子' } });
  read.onFormTitleBlur({ detail: { value: '小王子' } });
  read.onFormAuthor({ detail: { value: '圣埃克苏佩里' } });
  read.onFormTotal({ detail: { value: '300' } });
  read.onStatusChange({ detail: { value: '0' } });
  read.submitModal();
  check(store.getDB().books.length === 1, '添加书籍成功入库');
  check(store.getDB().books[0].title === '小王子', '书名正确');
  check(read.data.showModal === false, '保存后弹层关闭');

  // 3. 更新页码（模拟真机末字符丢失 + blur 提交）
  const bid = store.getDB().books[0].id;
  read.onPageInput({ currentTarget: { dataset: { id: bid } }, detail: { value: '12' } });
  read.onPageBlur({ currentTarget: { dataset: { id: bid } }, detail: { value: '128' } });
  read.onUpdatePage({ currentTarget: { dataset: { id: bid } } });
  check(store.getDB().books[0].page === 128, '首次累加页码为 128（blur 完整值生效）');

  // 3.5 累加语义：再读 30 页应叠加而非覆盖
  read.onPageInput({ currentTarget: { dataset: { id: bid } }, detail: { value: '30' } });
  read.onUpdatePage({ currentTarget: { dataset: { id: bid } } });
  check(store.getDB().books[0].page === 158, '页码累加（128+30=158），实际 ' + store.getDB().books[0].page);

  // 4. 页码超总页数自动读完（累加后 158+300 封顶到 300）
  read.onPageInput({ currentTarget: { dataset: { id: bid } }, detail: { value: '300' } });
  read.onUpdatePage({ currentTarget: { dataset: { id: bid } } });
  check(store.getDB().books[0].page === 300 && store.getDB().books[0].status === 'done', '累加封顶到总页数并自动标记读完');

  // 5. 标记未读回退
  read.onToggleDone({ currentTarget: { dataset: { id: bid } } });
  check(store.getDB().books[0].status === 'reading', '标记未读生效');

  // 6. 记录时长：回车确认
  read.onMinInput({ detail: { value: '45' } });
  read.onMinInputBlur({ detail: { value: '45' } });
  read.onLogConfirm();
  check(store.getDB().readLog[u.today()] === 45, '回车确认记录 45 分钟');

  // 7. 快速 +30
  read.onQuick30();
  check(store.getDB().readLog[u.today()] === 75, '快速 +30 后累计 75 分钟');

  // 8. 摘抄本
  read.onQuoteInput({ detail: { value: '真正重要的东西，用眼睛是看不见的' } });
  read.onQuoteInputBlur({ detail: { value: '真正重要的东西，用眼睛是看不见的' } });
  read.onAddQuote();
  check(store.getDB().quotes.length === 1, '摘抄收录成功');

  // 9. 删除摘抄
  read.onDelQuote({ currentTarget: { dataset: { id: store.getDB().quotes[0].id } } });
  check(store.getDB().quotes.length === 0, '摘抄删除成功');

  // 10. 删除书籍
  read.onDelBook({ currentTarget: { dataset: { id: bid } } });
  check(store.getDB().books.length === 0, '书籍删除成功');

  // 11. 下拉刷新
  read.onPullDownRefresh();
  check(true, '下拉刷新无异常');

  // 12. 空名称防御
  read.openAdd();
  read.onFormTitle({ detail: { value: '   ' } });
  read.submitModal();
  check(store.getDB().books.length === 0, '空白书名被拦截');
} catch (e) {
  threw = e;
}
check(!threw, '阅读页全链路无运行时错误' + (threw ? ' → ' + threw.stack.split('\n').slice(0, 3).join(' | ') : ''));

/* ================= 技能训练页 ================= */
console.log('=== 技能训练页 skill ===');
const store2 = freshStore();
const skill = loadPage('skill', 'skill');
threw = null;
try {
  // 1. 初始渲染
  skill.onShow();
  check(skill.data.skills.length === 0, '初始渲染：无技能');

  // 2. 添加技能
  skill.openAdd();
  check(skill.data.showModal === true, '打开添加弹层');
  skill.onFormName({ detail: { value: '吉他' } });
  skill.onFormNameBlur({ detail: { value: '吉他' } });
  skill.onPickEmo({ currentTarget: { dataset: { i: 0 } } });
  check(skill.data.form.emoji === '🎸', 'emoji 选择生效');
  skill.submitModal();
  check(store2.getDB().skills.length === 1, '添加技能成功入库');
  check(store2.getDB().skills[0].name === '吉他', '技能名正确');

  // 3. 练习 +1（多次，验证 skillLog 与等级）
  const sid = store2.getDB().skills[0].id;
  for (let i = 0; i < 3; i++) skill.onPractice({ currentTarget: { dataset: { id: sid } } });
  check(store2.getDB().skills[0].count === 3, '练习 3 次 count=3');
  check(store2.getDB().skillLog.length === 3, '练习日志 3 条');
  check(skill.data.skills[0].lv === 1, '等级 Lv.1');
  check(skill.data.logs.length === 3, '日志列表渲染 3 条');

  // 4. 连练到升级
  for (let i = 0; i < 7; i++) skill.onPractice({ currentTarget: { dataset: { id: sid } } });
  check(store2.getDB().skills[0].count === 10, '累计 10 次');
  check(skill.data.skills[0].lv === 2, '升到 Lv.2');
  check(skill.data.logs.length === 10, '日志列表 10 条（上限 14）');

  // 5. 练习超 14 条截断
  for (let i = 0; i < 5; i++) skill.onPractice({ currentTarget: { dataset: { id: sid } } });
  check(store2.getDB().skillLog.length === 15, 'skillLog 累计 15 条');
  check(skill.data.logs.length === 14, '日志列表截断到最近 14 条');

  // 6. 删除技能
  skill.onDelSkill({ currentTarget: { dataset: { id: sid } } });
  check(store2.getDB().skills.length === 0, '删除技能成功');

  // 7. 空名称防御
  skill.openAdd();
  skill.onFormName({ detail: { value: '  ' } });
  skill.submitModal();
  check(store2.getDB().skills.length === 0, '空白技能名被拦截');

  // 8. 下拉刷新
  skill.onPullDownRefresh();
  check(true, '下拉刷新无异常');
} catch (e) {
  threw = e;
}
check(!threw, '技能页全链路无运行时错误' + (threw ? ' → ' + threw.stack.split('\n').slice(0, 3).join(' | ') : ''));

console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
process.exit(fail === 0 ? 0 : 1);
