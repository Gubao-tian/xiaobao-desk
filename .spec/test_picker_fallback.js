/* TDD 测试：枚举选择器按钮组化（修复预览面板 picker 不可交互）
   模拟预览面板环境：picker 原生交互不可用，用户只能点击页面元素。
   验证 finance 分类 / plan 优先级 / read 状态 / media 平台 均可点选。 */
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
  showLoading() {}, hideLoading() {},
  reLaunch(o) {}, stopPullDownRefresh() {},
  setBackgroundColor() {}, setNavigationBarColor() {}
};

global.Page = function (cfg) {
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
function wxml(dir) { return fs.readFileSync(path.join(ROOT, 'pages', dir, dir + '.wxml'), 'utf8'); }
function js(dir) { return fs.readFileSync(path.join(ROOT, 'pages', dir, dir + '.js'), 'utf8'); }

/* ===== 1. 理财分类：picker 已改为按钮组 ===== */
console.log('=== 理财分类（收入/支出）===');
const finW = wxml('finance'), finJ = js('finance');
check(!/<picker[^>]*range="\{\{cats\}\}"/.test(finW), 'WXML 不再用 picker 渲染分类');
check(/data-i="\{\{index\}\}"[^>]*bindtap="onPickCat"|bindtap="onPickCat"[^>]*data-i="\{\{index\}\}"/.test(finW.replace(/\n/g, ' ')),
  '分类按钮组带 data-i 且绑定 onPickCat');
check(/form\.catIdx === index/.test(finW), '分类选中态绑定 catIdx');
check(/currentTarget\.dataset\.i/.test(finJ), 'onPickCat 支持 dataset.i（按钮组）');

let store = freshStore();
const fin = loadPage('finance');
fin.onShow();
fin.onOpenRec({ currentTarget: { dataset: { type: 'expense' } } });
check(fin.data.cats.length === 9, '支出分类 9 项');
fin.onPickCat({ currentTarget: { dataset: { i: 3 } } });
check(fin.data.form.catIdx === 3, '点击第 4 个分类（居住）生效');
fin.onFormAmount({ detail: { value: '88' } });
fin.submitModal();
check(store.getDB().finance[0].cat === '居住', '「居住」分类正确入库');

fin.onOpenRec({ currentTarget: { dataset: { type: 'income' } } });
check(fin.data.cats.length === 5 && fin.data.cats[0] === '工资', '收入分类 5 项（工资/兼职/理财/红包/其他）');
fin.onPickCat({ currentTarget: { dataset: { i: 2 } } });
check(fin.data.form.catIdx === 2 && fin.data.cats[2] === '理财', '收入分类选「理财」');
fin.onFormAmount({ detail: { value: '200' } });
fin.submitModal();
check(store.getDB().finance[1].cat === '理财', '收入「理财 200」入库');

/* ===== 2. 计划优先级 ===== */
console.log('=== 计划优先级 ===');
const planW = wxml('plan'), planJ = js('plan');
check(!/<picker[^>]*range="\{\{prioLabels\}\}"/.test(planW), 'WXML 不再用 picker 渲染优先级');
check(/data-i="\{\{index\}\}"[^>]*bindtap="onPrioChange"|bindtap="onPrioChange"[^>]*data-i="\{\{index\}\}"/.test(planW.replace(/\n/g, ' ')),
  '优先级按钮组带 data-i 且绑定 onPrioChange');
check(/currentTarget\.dataset\.i/.test(planJ), 'onPrioChange 支持 dataset.i');

store = freshStore();
const uu = require(path.join(ROOT, 'utils/util.js'));
const plan = loadPage('plan');
plan.onShow();
plan.onFormName({ detail: { value: '写周报' } });
plan.onPrioChange({ currentTarget: { dataset: { i: 0 } } });
check(plan.data.prioIdx === 0, '点「重要」生效');
plan.onAddPlan();
check((store.getDB().plans[uu.today()] || []).length === 1, '计划添加成功');
check(store.getDB().plans[uu.today()][0].prio === 'high', '优先级 high 入库');
plan.onFormName({ detail: { value: '买牛奶' } });
plan.onPrioChange({ currentTarget: { dataset: { i: 2 } } });
plan.onAddPlan();
check(store.getDB().plans[uu.today()][1].prio === 'low', '优先级 low 入库');

/* ===== 3. 阅读状态 ===== */
console.log('=== 阅读状态 ===');
const readW = wxml('read'), readJ = js('read');
check(!/<picker[^>]*range="\{\{statusTexts\}\}"/.test(readW), 'WXML 不再用 picker 渲染状态');
check(/data-i="\{\{index\}\}"[^>]*bindtap="onStatusChange"|bindtap="onStatusChange"[^>]*data-i="\{\{index\}\}"/.test(readW.replace(/\n/g, ' ')),
  '状态按钮组带 data-i 且绑定 onStatusChange');
check(/currentTarget\.dataset\.i/.test(readJ), 'onStatusChange 支持 dataset.i');

store = freshStore();
const read = loadPage('read');
read.onShow();
read.openAdd();
read.onFormTitle({ detail: { value: '小王子' } });
read.onStatusChange({ currentTarget: { dataset: { i: 1 } } });
check(read.data.form.status === 'todo', '点「想读」生效');
read.submitModal();
check(store.getDB().books[0].status === 'todo', '书籍状态 todo 入库');

/* ===== 4. 自媒体平台 ===== */
console.log('=== 自媒体平台 ===');
const mediaW = wxml('media'), mediaJ = js('media');
check(!/<picker[^>]*range="\{\{platforms\}\}"/.test(mediaW), 'WXML 不再用 picker 渲染平台');
check(/data-i="\{\{index\}\}"[^>]*bindtap="onPickPlat"|bindtap="onPickPlat"[^>]*data-i="\{\{index\}\}"/.test(mediaW.replace(/\n/g, ' ')),
  '平台按钮组带 data-i 且绑定 onPickPlat');
check(/currentTarget\.dataset\.i/.test(mediaJ), 'onPickPlat 支持 dataset.i');

store = freshStore();
const media = loadPage('media');
media.onShow();
media.openPub();
check(media.data.platforms.length >= 4, '平台列表 ≥4 项');
media.onPickPlat({ currentTarget: { dataset: { i: 1 } } });
check(media.data.form.pIdx === 1, '点第 2 个平台生效');
media.onFormPubTitle({ detail: { value: '我的 vlog' } });
media.submitPub();
check(store.getDB().pubs[0].platform === media.data.platforms[1], '选中平台正确入库');

/* ===== 5. 日期 picker 保留（有默认值，低频操作） ===== */
console.log('=== 日期选择器（保留 picker）===');
check(/<picker mode="date"/.test(wml('exam')), 'exam 日期 picker 保留');
check(/<picker mode="date"/.test(wml('finance')), 'finance 日期 picker 保留');
check(/<picker mode="date"/.test(wml('media')), 'media 日期 picker 保留');
check(/date: u\.today\(\)|date: u\.dateAdd/.test(js('finance')), 'finance 日期有默认值');
check(/date: u\.dateAdd\(u\.today\(\), 60\)/.test(js('exam')), 'exam 日期默认 60 天后');

function wml(dir) { return wxml(dir); }

console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
process.exit(fail === 0 ? 0 : 1);
