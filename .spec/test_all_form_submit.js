/* 全弹层 form 提交时序专项：模拟真机「input/blur 全丢失」极端场景
   验证 8 个弹层在仅 form submit（e.detail.value）下都能正确入库 */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', 'miniprogram');

let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } };

const storage = {};
global.wx = {
  getStorageSync(k) { return storage[k] === undefined ? '' : storage[k]; },
  setStorageSync(k, v) { storage[k] = v; },
  showToast(o) { (global.__toasts = global.__toasts || []).push(o && o.title); },
  showModal(o) { if (o && o.success) o.success({ confirm: true }); },
  reLaunch(o) {}, stopPullDownRefresh() {},
  setBackgroundColor() {}, setNavigationBarColor() {}
};
global.Page = function (cfg) {
  cfg.setData = function (patch) {
    Object.keys(patch).forEach(k => {
      const keys = k.split('.'); let obj = cfg.data;
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] === undefined || obj[keys[i]] === null || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = patch[k];
    });
  };
  global.__page = cfg;
};
function freshStore() {
  Object.keys(storage).forEach(k => delete storage[k]);
  const p = path.join(ROOT, 'utils/store.js');
  delete require.cache[p];
  return require(p);
}
function loadPage(dir) {
  const p = path.join(ROOT, 'pages', dir, dir + '.js');
  const Module = require('module');
  const m = new Module(p, null);
  m.filename = p;
  m.paths = Module._nodeModulePaths(path.dirname(p));
  m._compile(fs.readFileSync(p, 'utf8'), p);
  return global.__page;
}
const formEvent = (value) => ({ detail: { value } });

/* 1. 阅读 - 添加书籍 */
console.log('=== 1/8 阅读 添加书籍 ===');
let store = freshStore();
let p = loadPage('read');
p.onShow(); p.openAdd();
p.submitModal(formEvent({ title: '小王子', author: '圣埃克苏佩里', total: '300' }));
check(store.getDB().books.length === 1, '书籍入库');
check(store.getDB().books[0].title === '小王子', '书名正确');

/* 2. 课程 - 添加课程 */
console.log('=== 2/8 课程 添加课程 ===');
store = freshStore();
p = loadPage('course');
p.onShow(); p.openModal();
p.submitModal(formEvent({ name: '英语口语', total: '20', note: 'B站' }));
check(store.getDB().courses.length === 1, '课程入库');
check(store.getDB().courses[0].name === '英语口语', '课程名正确');

/* 3. 备考 - 添加科目 */
console.log('=== 3/8 备考 添加科目 ===');
store = freshStore();
p = loadPage('exam');
p.onShow(); p.openModal();
p.submitModal(formEvent({ name: '考研数学', total: '20', unit: '章' }));
check(store.getDB().exam.length === 1, '科目入库');
check(store.getDB().exam[0].name === '考研数学', '科目名正确');

/* 4. 技能 - 添加技能 */
console.log('=== 4/8 技能 添加技能 ===');
store = freshStore();
p = loadPage('skill');
p.onShow(); p.openAdd();
p.submitModal(formEvent({ name: '吉他' }));
check(store.getDB().skills.length === 1, '技能入库');
check(store.getDB().skills[0].name === '吉他', '技能名正确');

/* 5. 备忘录 - 新建便签 */
console.log('=== 5/8 备忘录 新建便签 ===');
store = freshStore();
p = loadPage('memo');
p.onShow(); p.onNew();
p.submitModal(formEvent({ title: '周末安排', body: '周六体检' }));
check(store.getDB().memos.length === 1, '便签入库');
check(store.getDB().memos[0].title === '周末安排', '便签标题正确');

/* 6. 理财 - 记支出 */
console.log('=== 6/8 理财 记支出 ===');
store = freshStore();
p = loadPage('finance');
p.onShow();
p.onOpenRec({ currentTarget: { dataset: { type: 'expense' } } });
p.submitModal(formEvent({ amount: '35.5', note: '午餐' }));
check(store.getDB().finance.length === 1, '支出入库');
check(store.getDB().finance[0].cat === '餐饮', '默认分类「餐饮」');

/* 7. 理财 - 存入目标 */
console.log('=== 7/8 理财 存入目标 ===');
store = freshStore();
p = loadPage('finance');
p.onShow();
p.onFormGoalName({ detail: { value: '旅行基金' } });
p.onFormGoalTarget({ detail: { value: '3000' } });
p.onAddGoal();
const gid = store.getDB().goals[0].id;
p.onOpenDep({ currentTarget: { dataset: { id: gid } } });
p.submitDep(formEvent({ amount: '500' }));
check(store.getDB().goals[0].saved === 500, '存入 500 生效');

/* 8. 自媒体 - 灵感 + 发布 */
console.log('=== 8/8 自媒体 灵感+发布 ===');
store = freshStore();
p = loadPage('media');
p.onShow();
p.openIdea();
p.submitIdea(formEvent({ title: '一个人住的第100天', note: '' }));
check(store.getDB().ideas.length === 1, '灵感入库');
p.openPub();
p.submitPub(formEvent({ title: '我的vlog', hits: '1200' }));
check(store.getDB().pubs.length === 1, '发布入库');
check(store.getDB().pubs[0].title === '我的vlog', '发布标题正确');

console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
process.exit(fail === 0 ? 0 : 1);
