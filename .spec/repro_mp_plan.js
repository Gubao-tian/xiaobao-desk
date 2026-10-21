/* 复现脚本 v2：小程序「每日计划」添加任务全生命周期
   修正 v1 的测试缺陷：每个场景独立重载模块（plan 实例与 store 保持同模块），
   并对不返回 Promise 的 onShow/onLaunch 显式等待同步链完成 */
const Module = require('module');
const path = require('path');
const MP = path.resolve(__dirname, '..', 'miniprogram');

/* ---------- mock wx ---------- */
const storage = new Map();
global.wx = {
  getStorageSync(k) { const v = storage.get(k); return v === undefined ? '' : JSON.parse(v); },
  setStorageSync(k, v) { storage.set(k, JSON.stringify(v)); },
  removeStorageSync(k) { storage.delete(k); },
  login(o) { setTimeout(() => o.success && o.success({ code: 'mock_code' }), 5); },
  getAccountInfoSync() { return { miniProgram: { appId: 'wx.mock' } }; },
  showToast() {}, showLoading() {}, hideLoading() {},
  showModal(o) { o.success && o.success({ confirm: true }); },
  setBackgroundColor() {}, setNavigationBarColor() {},
  reLaunch() {}, stopPullDownRefresh() {}, pageScrollTo() {}
};

/* ---------- mock SDK ---------- */
let cloudRow = null;
let signInShouldFail = false;
const fakeExports = {
  createMiniProgramWorkBuddyCloud() {
    return {
      auth: {
        signInWithWechat() {
          if (signInShouldFail) return Promise.resolve({ error: { message: '登录失败' } });
          return Promise.resolve({ data: { user: { id: 'user_mock' } } });
        }
      },
      database: {
        from() {
          const q = {
            select() { return q; },
            maybeSingle() { return Promise.resolve({ data: cloudRow }); },
            upsert(row) {
              cloudRow = Object.assign({}, row, { updated_at: new Date().toISOString() });
              return { select() { return Promise.resolve({ data: [cloudRow] }); } };
            }
          };
          return q;
        }
      }
    };
  }
};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '@tencent-ai/workbuddy-cloud-sdk/miniprogram') return 'WB_MOCK_SDK';
  return origResolve.call(this, request, parent, ...rest);
};
require.cache['WB_MOCK_SDK'] = {
  id: 'WB_MOCK_SDK', filename: 'WB_MOCK_SDK', loaded: true,
  exports: fakeExports, children: [], paths: []
};

/* ---------- 捕获 Page / App ---------- */
let lastPageCfg = null;
const apps = [];
global.Page = cfg => { lastPageCfg = cfg; return cfg; };
global.App = cfg => { apps.push(cfg); return cfg; };
global.Component = () => {};

/* ---------- 页面实例工厂 ---------- */
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 每个场景独立加载：返回 { app, plan, store, sync } */
function loadFresh() {
  ['app.js', 'pages/plan/plan.js', 'utils/store.js', 'utils/sync.js', 'utils/cloud.js']
    .forEach(f => delete require.cache[path.join(MP, f)]);
  require(path.join(MP, 'app.js'));
  require(path.join(MP, 'pages/plan/plan.js'));
  return {
    app: apps[apps.length - 1],
    plan: makePage(lastPageCfg),
    store: require(path.join(MP, 'utils/store.js')),
    sync: require(path.join(MP, 'utils/sync.js'))
  };
}

(async () => {
  const today = require(path.join(MP, 'utils/util.js')).today();

  /* ===== 场景 1：冷启动 + 添加计划 ===== */
  console.log('--- 场景1：冷启动 → 添加计划 ---');
  let env = loadFresh();
  await env.app.onLaunch();
  await sleep(30);
  check('bootstrap 后已登录', env.sync.getState().loggedIn === true);
  check('云端行已创建', cloudRow !== null);

  env.plan.onShow();
  env.plan.onFormName({ detail: { value: '复现任务-小程序' } });
  env.plan.onAddPlan();
  check('添加后本地有计划', (env.store.getDB().plans[today] || []).some(x => x.name === '复现任务-小程序'));
  check('添加后 form.name 已清空', env.plan.data.form.name === '');
  check('refresh 后列表有计划', (env.plan.data.plans || []).some(x => x.name === '复现任务-小程序'));

  await sleep(1000); // 等防抖推送
  check('防抖推送后云端有计划', !!(cloudRow && cloudRow.data && (cloudRow.data.plans[today] || []).some(x => x.name === '复现任务-小程序')));

  /* ===== 场景 2：回前台拉取（云端不更新）===== */
  console.log('--- 场景2：回前台 → 拉取 ---');
  env.app.onShow();
  await sleep(30);
  env.plan.onShow();
  check('回前台后本地计划仍在', (env.store.getDB().plans[today] || []).some(x => x.name === '复现任务-小程序'));
  check('回前台后页面列表仍在', (env.plan.data.plans || []).some(x => x.name === '复现任务-小程序'));

  /* ===== 场景 3：添加后立刻回前台（防抖未触发，竞态）===== */
  console.log('--- 场景3：添加后立即回前台（竞态）---');
  env.plan.onFormName({ detail: { value: '竞态任务' } });
  env.plan.onAddPlan();
  env.app.onShow();   // 不等 800ms 防抖
  await sleep(1000);
  check('竞态任务本地仍在', (env.store.getDB().plans[today] || []).some(x => x.name === '竞态任务'));
  check('竞态任务最终同步到云端', !!(cloudRow && (cloudRow.data.plans[today] || []).some(x => x.name === '竞态任务')));

  /* ===== 场景 4：重启小程序 ===== */
  console.log('--- 场景4：重启后数据恢复 ---');
  env = loadFresh();
  await env.app.onLaunch();
  await sleep(30);
  check('重启后本地计划恢复', (env.store.getDB().plans[today] || []).some(x => x.name === '复现任务-小程序') && (env.store.getDB().plans[today] || []).some(x => x.name === '竞态任务'));
  env.plan.onShow();
  check('重启后页面展示计划', (env.plan.data.plans || []).some(x => x.name === '复现任务-小程序'));

  /* ===== 场景 5：云端 rev 更高（另一台设备写入）===== */
  console.log('--- 场景5：云端更新（rev 更高）---');
  const curRev = env.store.getRev();
  cloudRow = {
    data: Object.assign({}, env.store.getDB(), {
      rev: curRev + 10,
      plans: Object.assign({}, env.store.getDB().plans, { [today]: [{ id: 'other', name: '另一台设备的任务', done: false, prio: 'mid' }] })
    }),
    updated_at: new Date().toISOString()
  };
  env.app.onShow();  // 回前台 → pull → 应采纳
  await sleep(50);
  check('云端新数据被采纳', (env.store.getDB().plans[today] || []).some(x => x.name === '另一台设备的任务'));
  env.plan.onShow();
  check('页面刷新后展示云端数据', (env.plan.data.plans || []).some(x => x.name === '另一台设备的任务'));

  /* ===== 场景 6：登录失败 → 本地模式添加 ===== */
  console.log('--- 场景6：登录失败 → 本地模式添加 ---');
  signInShouldFail = true;
  env = loadFresh();
  await env.app.onLaunch();
  await sleep(30);
  check('登录失败不阻塞（loggedIn=false）', env.sync.getState().loggedIn === false);
  env.plan.onShow();
  env.plan.onFormName({ detail: { value: '离线任务' } });
  env.plan.onAddPlan();
  check('离线模式添加成功（本地）', (env.store.getDB().plans[today] || []).some(x => x.name === '离线任务'));
  check('离线模式页面展示', (env.plan.data.plans || []).some(x => x.name === '离线任务'));

  /* ===== 场景 7：未构建 npm（SDK 不可用）===== */
  console.log('--- 场景7：SDK 不可用 → 本地模式添加 ---');
  const origCache = require.cache['WB_MOCK_SDK'];
  delete require.cache['WB_MOCK_SDK'];
  const origResolve2 = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, ...rest) {
    if (request === '@tencent-ai/workbuddy-cloud-sdk/miniprogram') {
      const e = new Error("Cannot find module '@tencent-ai/workbuddy-cloud-sdk/miniprogram'");
      e.code = 'MODULE_NOT_FOUND';
      throw e;
    }
    return origResolve2.call(this, request, parent, ...rest);
  };
  env = loadFresh();
  await env.app.onLaunch();
  await sleep(30);
  check('SDK 缺失不崩溃（本地模式）', env.sync.getState().ready === false);
  env.plan.onShow();
  env.plan.onFormName({ detail: { value: '无SDK任务' } });
  env.plan.onAddPlan();
  check('无 SDK 添加成功', (env.store.getDB().plans[today] || []).some(x => x.name === '无SDK任务'));
  Module._resolveFilename = origResolve2;
  require.cache['WB_MOCK_SDK'] = origCache;

  /* ===== 汇总 ===== */
  const failed = results.filter(r => !r.pass);
  console.log('\n==== ' + (failed.length ? 'FAILED (' + failed.length + '/' + results.length + ')' : 'ALL PASS (' + results.length + '/' + results.length + ')') + ' ====');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('REPRO CRASHED:', e); process.exit(2); });
