/* 复现脚本 v3：计划页「添加结果不正确」专项 —— 优先级流程 + 双事件触发时序 */
const Module = require('module');
const path = require('path');
const MP = path.resolve(__dirname, '..', 'miniprogram');

const storage = new Map();
global.wx = {
  getStorageSync(k) { const v = storage.get(k); return v === undefined ? '' : JSON.parse(v); },
  setStorageSync(k, v) { storage.set(k, JSON.stringify(v)); },
  removeStorageSync(k) { storage.delete(k); },
  login(o) { setTimeout(() => o.success && o.success({ code: 'mock_code' }), 5); },
  getAccountInfoSync() { return { miniProgram: { appId: 'wx.mock' } }; },
  showToast(o) { toasts.push(o.title); },
  showLoading() {}, hideLoading() {},
  showModal(o) { o.success && o.success({ confirm: true }); },
  setBackgroundColor() {}, setNavigationBarColor() {},
  reLaunch() {}, stopPullDownRefresh() {}, pageScrollTo() {}
};
let toasts = [];

/* 无 SDK：本地模式，聚焦页面逻辑 */
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '@tencent-ai/workbuddy-cloud-sdk/miniprogram') {
    const e = new Error("Cannot find module"); e.code = 'MODULE_NOT_FOUND'; throw e;
  }
  return origResolve.call(this, request, parent, ...rest);
};

let lastPageCfg = null;
global.Page = cfg => { lastPageCfg = cfg; return cfg; };
global.App = () => {};
global.Component = () => {};

function makePage(cfg) {
  const inst = Object.assign({}, cfg);
  inst.data = JSON.parse(JSON.stringify(cfg.data || {}));
  inst.setData = function (patch) {
    Object.keys(patch).forEach(k => {
      if (k.indexOf('.') > 0) {
        const [a, b] = k.split('.');
        inst.data[a] = inst.data[a] || {};
        inst.data[a][b] = patch[k];
      } else inst.data[k] = patch[k];
    });
  };
  return inst;
}

const results = [];
function check(name, cond, extra) {
  results.push({ name, pass: !!cond });
  console.log((cond ? '✓ ' : '✗ FAIL ') + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
}

require(path.join(MP, 'pages/plan/plan.js'));
const store = require(path.join(MP, 'utils/store.js'));
const u = require(path.join(MP, 'utils/util.js'));
const today = u.today();
const plan = makePage(lastPageCfg);
plan.onShow();

/* ===== A：完整优先级流程：选「重要」→ 输入 → 添加 ===== */
console.log('--- A：选重要 → 添加 ---');
toasts = [];
plan.onPrioChange({ detail: { value: 0 } });           // 选「重要」
plan.onFormName({ detail: { value: '重要任务测试' } });
plan.onAddPlan();
const listA = plan.data.plans || [];
const itemA = listA.find(x => x.name === '重要任务测试');
check('A1 任务已添加', !!itemA);
check('A2 优先级为 high（重要）', itemA && itemA.prio === 'high', itemA && itemA.prio);
check('A3 选择器显示重要', plan.data.prioIdx === 0 && plan.data.prioLabels[plan.data.prioIdx] === '重要');
check('A4 只有成功提示无异常提示', toasts.length === 1 && toasts[0].includes('已添加'), toasts);

/* ===== B：回车确认添加（bindconfirm）===== */
console.log('--- B：回车添加 ---');
toasts = [];
plan.onFormName({ detail: { value: '回车任务测试' } });
plan.onAddPlan({ type: 'confirm' });                   // bindconfirm 事件
const itemB = (plan.data.plans || []).find(x => x.name === '回车任务测试');
check('B1 回车添加成功', !!itemB);
check('B2 无异常提示', toasts.length === 1 && toasts[0].includes('已添加'), toasts);

/* ===== C：双事件触发（真机：输入法收起时 confirm 与 tap 可能都触发）===== */
console.log('--- C：confirm + tap 双事件时序 ---');
toasts = [];
plan.onFormName({ detail: { value: '双事件任务' } });
plan.onAddPlan({ type: 'confirm' });                   // 先 confirm
plan.onAddPlan({ type: 'tap' });                       // 再 tap（此时 form.name 已清空）
const dup = (plan.data.plans || []).filter(x => x.name === '双事件任务').length;
check('C1 双事件不重复添加', dup === 1, dup);
check('C2 双事件的提示序列', toasts.length === 2 && toasts[0].includes('已添加') && toasts[1].includes('先输入'), toasts);

/* ===== D：反向时序（tap 先，confirm 后）===== */
console.log('--- D：tap + confirm 反向时序 ---');
toasts = [];
plan.onFormName({ detail: { value: '反向双事件' } });
plan.onAddPlan({ type: 'tap' });
plan.onAddPlan({ type: 'confirm' });
const dupD = (plan.data.plans || []).filter(x => x.name === '反向双事件').length;
check('D1 反向双事件不重复添加', dupD === 1, dupD);

/* ===== E：快速连续添加（防抖/竞态）===== */
console.log('--- E：快速连续添加 3 条 ---');
toasts = [];
['快1', '快2', '快3'].forEach(n => {
  plan.onFormName({ detail: { value: n } });
  plan.onAddPlan();
});
const cnt = ['快1', '快2', '快3'].every(n => (plan.data.plans || []).some(x => x.name === n));
check('E1 三条全部添加', cnt);
check('E2 三条提示均正常', toasts.length === 3 && toasts.every(t => t.includes('已添加')), toasts);

/* ===== F：添加后 store 中的数据形态（模拟真机读取）===== */
console.log('--- F：数据形态核查 ---');
const DB = store.getDB();
const raw = JSON.parse(storage.get(store.KEY));
check('F1 本地存储含今天全部计划', (raw.plans[today] || []).length === (DB.plans[today] || []).length);
check('F2 rev 已递增', typeof DB.rev === 'number' && DB.rev > 1, DB.rev);
check('F3 计划字段完整', (DB.plans[today] || []).every(x => x.id && x.name && typeof x.done === 'boolean' && x.prio));

/* ===== G：跨天键一致性 ===== */
console.log('--- G：日期键一致性 ---');
check('G1 页面列表与 store 同日期键', (plan.data.plans || []).length === (DB.plans[today] || []).length);

const failed = results.filter(r => !r.pass);
console.log('\n==== ' + (failed.length ? 'FAILED (' + failed.length + '/' + results.length + ')' : 'ALL PASS (' + results.length + '/' + results.length + ')') + ' ====');
failed.forEach(f => console.log('  ✗ ' + f.name));
process.exit(failed.length ? 1 : 0);
