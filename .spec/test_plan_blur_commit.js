/* TDD 失败测试：复现真机「输入框失焦丢末字符」导致的添加结果不正确
   真机行为（微信已知 race）：用户输入最后一个字符后立刻点击按钮/打开选择器，
   该字符的 bindinput 尚未同步到 this.data，输入框失焦时 bindblur 才带上完整值。
   期望：有 bindblur 提交时名称完整；没有时名称被截断 → 本测试先证明缺陷存在 */
const path = require('path');
const MP = path.resolve(__dirname, '..', 'miniprogram');

global.wx = {
  getStorageSync() { return ''; },
  setStorageSync() {}, removeStorageSync() {},
  login() {}, getAccountInfoSync() { return { miniProgram: { appId: 'wx.t' } }; },
  showToast() {}, showLoading() {}, hideLoading() {}, showModal() {},
  setBackgroundColor() {}, setNavigationBarColor() {},
  reLaunch() {}, stopPullDownRefresh() {}
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

require(path.join(MP, 'pages/plan/plan.js'));
const plan = makePage(lastPageCfg);
plan.onShow();

let failed = 0;
function check(name, cond, extra) {
  if (!cond) failed++;
  console.log((cond ? '✓ ' : '✗ FAIL ') + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
}

/* ---- 模拟真机：末字符 bindinput 丢失，blur 才带完整值 ---- */
function typeLikeRealDevice(text) {
  // 除最后一个字符外逐字符触发 bindinput（真机 race：末字符常随 blur 才提交）
  for (let i = 1; i < text.length; i++) {
    plan.onFormName({ detail: { value: text.slice(0, i) } });
  }
  // 返回 blur 事件的完整值，由调用方决定是否派发
  return text;
}

/* 场景 1：没有 bindblur 处理时（旧行为）——点添加前失焦不提交 */
console.log('--- 场景1：旧行为（无 blur 提交）---');
plan.onFormName({ detail: { value: '写周' } });          // 末字符「报」未同步
plan.onAddPlan();                                        // 直接点添加
let list = plan.data.plans || [];
check('旧行为下名称被截断为「写周」', list.some(x => x.name === '写周') && !list.some(x => x.name === '写周报'),
  list.map(x => x.name));

/* 场景 2：修复后期望——blur 提交完整值后再添加 */
console.log('--- 场景2：修复后（blur 提交完整值）---');
const full = typeLikeRealDevice('买牛奶');
if (typeof plan.onFormNameBlur === 'function') {
  plan.onFormNameBlur({ detail: { value: full } });          // 失焦提交完整值
  plan.onAddPlan();
  list = plan.data.plans || [];
  check('blur 提交后名称完整「买牛奶」', list.some(x => x.name === '买牛奶'), list.map(x => x.name));
} else {
  check('页面应提供 onFormNameBlur 处理器', false, 'onFormNameBlur 不存在');
}

/* 场景 3：修复后——选优先级（失焦）后再添加，名称不丢 */
console.log('--- 场景3：选优先级后添加（名称不丢）---');
if (typeof plan.onFormNameBlur === 'function') {
  plan.onFormName({ detail: { value: '健身' } });        // 末字符「房」未同步
  plan.onPrioChange({ detail: { value: 0 } });           // 打开选择器 → 输入框失焦
  if (typeof plan.onFormNameBlur === 'function') plan.onFormNameBlur({ detail: { value: '健身房' } });
  plan.onAddPlan();
  list = plan.data.plans || [];
  check('选优先级后名称完整「健身房」', list.some(x => x.name === '健身房'), list.map(x => x.name));
  const it = list.find(x => x.name === '健身房');
  check('优先级仍为重要', it && it.prio === 'high', it && it.prio);
} else {
  check('页面应提供 onFormNameBlur 处理器（场景3）', false);
}

/* 场景 4：正常逐字输入不受影响 */
console.log('--- 场景4：正常输入回归 ---');
plan.onFormName({ detail: { value: '正' } });
plan.onFormName({ detail: { value: '正常' } });
plan.onFormName({ detail: { value: '正常任务' } });
plan.onAddPlan();
list = plan.data.plans || [];
check('正常输入名称完整', list.some(x => x.name === '正常任务'), list.map(x => x.name));

console.log('\n==== ' + (failed ? 'FAILED (' + failed + ' 项未过)' : 'ALL PASS') + ' ====');
process.exit(failed ? 1 : 0);
