/* 复现：理财页分类选择全流程（收入/支出） */
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

console.log('=== 理财页分类选择复现 ===');
const store = freshStore();
const u = require(path.join(ROOT, 'utils/util.js'));
const fin = loadPage('finance');

let threw = null;
try {
  fin.onShow();
  check(fin.data.list.length === 0, '初始渲染：无记录');

  /* --- 记支出：默认分类 + 切换分类 --- */
  fin.onOpenRec({ currentTarget: { dataset: { type: 'expense' } } });
  check(fin.data.showModal === true, '支出弹层打开');
  check(Array.isArray(fin.data.cats) && fin.data.cats.length === 9, '支出分类列表 9 项（实际 ' + (fin.data.cats || []).length + '）');
  check(fin.data.cats[0] === '餐饮', '支出首项为「餐饮」');
  check(fin.data.modalType === 'expense', '弹层类型为支出');

  // 不切换分类，直接记账
  fin.onFormAmount({ detail: { value: '35.5' } });
  fin.onFormAmountBlur({ detail: { value: '35.5' } });
  fin.submitModal();
  check(store.getDB().finance.length === 1, '支出记录入库');
  check(store.getDB().finance[0].cat === '餐饮', '默认分类「餐饮」生效');

  /* --- 记支出：手动选择第 3 项分类 --- */
  fin.onOpenRec({ currentTarget: { dataset: { type: 'expense' } } });
  check(fin.data.form.catIdx === 0, '重开弹层分类索引归零');
  fin.onPickCat({ detail: { value: 2 } });
  check(fin.data.form.catIdx === 2, 'picker 选择索引 2 生效');
  check(fin.data.cats[fin.data.form.catIdx] === '购物', '选中的分类为「购物」');
  fin.onFormAmount({ detail: { value: '120' } });
  fin.submitModal();
  check(store.getDB().finance[1].cat === '购物', '选中分类「购物」正确入库');

  /* --- 记收入：分类列表应切换为收入类 --- */
  fin.onOpenRec({ currentTarget: { dataset: { type: 'income' } } });
  check(fin.data.modalType === 'income', '收入弹层打开');
  check(fin.data.cats.length === 5, '收入分类列表 5 项（实际 ' + (fin.data.cats || []).length + '）');
  check(fin.data.cats[0] === '工资', '收入首项为「工资」');
  fin.onPickCat({ detail: { value: 1 } });
  check(fin.data.cats[fin.data.form.catIdx] === '兼职', '选中的收入分类为「兼职」');
  fin.onFormAmount({ detail: { value: '500' } });
  fin.submitModal();
  check(store.getDB().finance[2].type === 'income' && store.getDB().finance[2].cat === '兼职', '收入「兼职 500」正确入库');

  /* --- 明细与统计 --- */
  check(fin.data.list.length === 3, '明细列表 3 条');
  check(fin.data.monthIn === 500, '本月收入 500');
  check(fin.data.monthOut === 155.5, '本月支出 155.5');
  check(fin.data.catRows.length === 2, '分类占比 2 类（餐饮/购物）');

  /* --- 删除 --- */
  fin.onDel({ currentTarget: { dataset: { id: store.getDB().finance[0].id } } });
  check(store.getDB().finance.length === 2, '删除一条记录生效');

  /* --- 储蓄目标 --- */
  fin.onFormGoalName({ detail: { value: '旅行基金' } });
  fin.onFormGoalTarget({ detail: { value: '3000' } });
  fin.onAddGoal();
  check(store.getDB().goals.length === 1, '储蓄目标创建成功');
  fin.onOpenDep({ currentTarget: { dataset: { id: store.getDB().goals[0].id } } });
  fin.onFormDepAmount({ detail: { value: '500' } });
  fin.submitDep();
  check(store.getDB().goals[0].saved === 500, '存入 500 生效');
} catch (e) { threw = e; }
check(!threw, '理财页全链路无运行时错误' + (threw ? ' → ' + threw.stack.split('\n').slice(0, 3).join(' | ') : ''));

console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
process.exit(fail === 0 ? 0 : 1);
