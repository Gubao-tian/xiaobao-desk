/* 云同步逻辑单测：mock @tencent-ai/workbuddy-cloud-sdk/miniprogram 与 wx，
   验证 登录 / 拉取采纳 / rev 守卫 / 防抖推送 / 回环防护 / 错误路径 */
const path = require('path');
const ROOT = 'E:/work  buddy/2026-10-20-18-11-03/miniprogram';
const issues = [];
const ok = [];

/* ---- mock 云端客户端 ---- */
const cloudState = {
  row: null,            // 模拟云端表里的一行
  loginError: null,     // 置位则 signInWithWechat 返回 error
  dbError: null,        // 置位则 select/upsert 返回 error
  calls: []
};
function mockFactory(opts) {
  cloudState.calls.push({ m: 'init', endpoint: opts.endpoint, publishableKey: !!opts.publishableKey, hasWx: !!opts.wx });
  return {
    auth: {
      signInWithWechat(code, appid) {
        cloudState.calls.push({ m: 'signInWithWechat', code, appid });
        if (cloudState.loginError) return Promise.resolve({ data: null, error: cloudState.loginError });
        return Promise.resolve({ data: { user: { id: 'u-test', name: '小宝' } }, error: null });
      },
      getSession() { return Promise.resolve({ data: { user: { id: 'u-test' } }, error: null }); }
    },
    database: {
      from(table) {
        return {
          select() {
            return {
              maybeSingle() {
                cloudState.calls.push({ m: 'select', table });
                if (cloudState.dbError) return Promise.resolve({ data: null, error: cloudState.dbError });
                return Promise.resolve({ data: cloudState.row, error: null });
              }
            };
          },
          upsert(payload, opts) {
            return {
              select() {
                cloudState.calls.push({ m: 'upsert', table, rev: payload.data && payload.data.rev, onConflict: opts && opts.onConflict });
                if (cloudState.dbError) return Promise.resolve({ data: null, error: cloudState.dbError });
                cloudState.row = { data: payload.data, updated_at: new Date().toISOString() };
                return Promise.resolve({ data: [cloudState.row], error: null });
              }
            };
          }
        };
      }
    }
  };
}

/* ---- 拦截 SDK require（在加载 cloud.js 之前） ---- */
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@tencent-ai/workbuddy-cloud-sdk/miniprogram') {
    return { createMiniProgramWorkBuddyCloud: mockFactory };
  }
  return origLoad.apply(this, arguments);
};

/* ---- mock wx ---- */
const storage = {};
global.wx = {
  getStorageSync: k => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  showToast: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  login(o) { o.success({ code: 'mock-code-123' }); },
  getAccountInfoSync() { return { miniProgram: { appId: 'touristappid' } }; }
};

function assert(cond, msg) { if (!cond) issues.push('失败: ' + msg); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 每个用例前重置：清存储、清模块缓存、重置 mock */
function reset() {
  Object.keys(storage).forEach(k => delete storage[k]);
  cloudState.row = null;
  cloudState.loginError = null;
  cloudState.dbError = null;
  cloudState.calls = [];
  ['utils/store.js', 'utils/sync.js', 'utils/cloud.js'].forEach(m => {
    delete require.cache[require.resolve(path.join(ROOT, m))];
  });
  return {
    store: require(path.join(ROOT, 'utils/store.js')),
    sync: require(path.join(ROOT, 'utils/sync.js'))
  };
}

/* 模拟重启：保留本地存储，重新加载 store/sync 模块 */
function restartWith(localData, pushedRev) {
  Object.keys(storage).forEach(k => delete storage[k]);
  if (localData) storage['gubao_desk_v1'] = JSON.parse(JSON.stringify(localData));
  if (pushedRev) storage['gubao_desk_sync_v1'] = pushedRev;
  delete require.cache[require.resolve(path.join(ROOT, 'utils/store.js'))];
  const storeMod = require(path.join(ROOT, 'utils/store.js'));
  delete require.cache[require.resolve(path.join(ROOT, 'utils/sync.js'))];
  const syncMod = require(path.join(ROOT, 'utils/sync.js'));
  return { store: storeMod, sync: syncMod };
}

(async function main() {
  /* ===== 1. 初始化：endpoint/publishableKey/wx 都传入工厂 ===== */
  let env = reset();
  env.sync.bootstrap();
  await sleep(30);
  const initCall = cloudState.calls.find(c => c.m === 'init');
  assert(initCall, '未调用 createMiniProgramWorkBuddyCloud');
  assert(initCall.endpoint === 'https://mp-api.app.workbuddy.host', 'endpoint 未传入');
  assert(initCall.publishableKey === true, 'publishableKey 未传入');
  assert(initCall.hasWx === true, '诊断 wx 未传入');
  const loginCall = cloudState.calls.find(c => c.m === 'signInWithWechat');
  assert(loginCall && loginCall.code === 'mock-code-123', 'wx.login 的 code 未传给 signInWithWechat');
  assert(loginCall && loginCall.appid === 'touristappid', 'appid 未传当前运行时 appid');
  ok.push('客户端初始化与微信登录调用正确');

  /* ===== 2. 新用户：本地空库 → bootstrap 后推送一行到云端 ===== */
  env = reset();
  env.store.getDB().checkins['2026-10-20'] = { at: 1 };
  env.store.save(); // rev: 1 -> 2
  await env.sync.bootstrap();
  await sleep(30);
  assert(cloudState.row, 'bootstrap 未在云端创建数据行');
  assert(cloudState.row.data.rev === 2, '云端快照 rev 应为 2，实际 ' + (cloudState.row.data && cloudState.row.data.rev));
  assert(cloudState.row.data.checkins['2026-10-20'], '云端快照缺少本地打卡数据');
  assert(env.store.getPushedRev() === 2, '已推送版本应为 2，实际 ' + env.store.getPushedRev());
  const st = env.sync.getState();
  assert(st.loggedIn === true, '登录状态应为 true');
  assert(st.lastError === '', '成功后 lastError 应为空');
  ok.push('新用户首次 bootstrap：登录 + 推送快照到云端');

  /* ===== 3. 重启后无新修改：不重复推送 ===== */
  const savedRow = JSON.parse(JSON.stringify(cloudState.row));
  const env3 = restartWith(savedRow.data, savedRow.data.rev);
  cloudState.calls = [];
  await env3.sync.bootstrap();
  await sleep(30);
  const upserts3 = cloudState.calls.filter(c => c.m === 'upsert');
  assert(upserts3.length === 0, '重启后无新修改时不应推送，实际 ' + upserts3.length);
  assert(env3.store.getDB().checkins['2026-10-20'], '重启后本地数据应保留');
  ok.push('重启后无新修改：不重复推送');

  /* ===== 4. 拉取：云端 rev 更新 → 采纳到本地 ===== */
  env = reset();
  cloudState.row = {
    data: Object.assign({}, env.store.DEFAULT, {
      rev: 42,
      profile: { name: '云端小宝', sign: '', avatar: '🌟', tags: [] },
      memos: [{ id: 'm1', title: '云端便签', body: '来自云端', color: '', pin: false, created: '' }]
    }),
    updated_at: new Date().toISOString()
  };
  await env.sync.bootstrap();
  await sleep(30);
  assert(env.store.getDB().rev === 42, '拉取后本地 rev 应为 42，实际 ' + env.store.getDB().rev);
  assert(env.store.getDB().profile.name === '云端小宝', '云端昵称未采纳');
  assert(env.store.getDB().memos.length === 1, '云端便签未采纳');
  assert(env.store.getPushedRev() === 42, '采纳后已推送版本应为 42');
  const upserts4 = cloudState.calls.filter(c => c.m === 'upsert');
  assert(upserts4.length === 0, '采纳后不应回环推送，实际 ' + upserts4.length);
  ok.push('云端数据更新：拉取采纳且无回环推送');

  /* ===== 5. rev 守卫：云端旧数据不覆盖本地新数据 ===== */
  env = reset();
  cloudState.row = {
    data: Object.assign({}, env.store.DEFAULT, { rev: 1, profile: { name: '旧数据', sign: '', avatar: '💗', tags: [] } }),
    updated_at: new Date().toISOString()
  };
  env.store.getDB().profile.name = '本地新数据';
  env.store.save(); // rev 2
  await env.sync.bootstrap();
  await sleep(30);
  assert(env.store.getDB().profile.name === '本地新数据', '旧云端数据覆盖了本地新数据');
  const upserts5 = cloudState.calls.filter(c => c.m === 'upsert');
  assert(upserts5.length === 1 && upserts5[0].rev === 2, '应推送本地 rev 2');
  ok.push('rev 守卫：旧云端数据不覆盖本地新修改');

  /* ===== 6. 采纳后本地再修改 → 防抖推送 ===== */
  env = reset();
  cloudState.row = {
    data: Object.assign({}, env.store.DEFAULT, { rev: 10 }),
    updated_at: new Date().toISOString()
  };
  await env.sync.bootstrap();
  await sleep(30);
  assert(env.store.getDB().rev === 10, '应已采纳 rev 10');
  cloudState.calls = [];
  env.store.getDB().plans['2026-10-20'] = [{ id: 'p9', name: '采纳后新增', done: false, prio: 'mid' }];
  env.store.save(); // rev 11
  env.sync.schedulePush(50);
  await sleep(250);
  const upserts6 = cloudState.calls.filter(c => c.m === 'upsert');
  assert(upserts6.length === 1 && upserts6[0].rev === 11, '采纳后修改应推送 rev 11，实际 ' + JSON.stringify(upserts6.map(x => x.rev)));
  assert(cloudState.row.data.plans['2026-10-20'].length === 1, '推送的快照缺少新任务');
  assert(env.store.getPushedRev() === 11, '推送后版本标记应为 11');
  ok.push('采纳云端后本地修改：防抖推送正常');

  /* ===== 7. 登录失败：本地模式继续，错误可见 ===== */
  env = reset();
  cloudState.loginError = { kind: 'unauthenticated', message: '未打开微信登录' };
  await env.sync.bootstrap();
  await sleep(30);
  const st7 = env.sync.getState();
  assert(st7.loggedIn === false, '登录失败时 loggedIn 应为 false');
  assert(st7.lastError === '未打开微信登录', '登录失败应暴露原因，实际: ' + st7.lastError);
  assert(cloudState.calls.filter(c => c.m === 'select').length === 0, '未登录不应查库');
  assert(env.store.getDB().plans !== undefined, '本地数据仍可用');
  ok.push('登录失败：保持本地模式且错误可见');

  /* ===== 8. 写入被拒（42501）：友好提示，数据不丢 ===== */
  env = reset();
  cloudState.dbError = { code: '42501', message: 'permission denied' };
  const r8 = await env.sync.syncNow();
  await sleep(30);
  assert(r8 && r8.ok === false, 'syncNow 应报告失败');
  assert(env.sync.getState().lastError === '没有权限访问云端数据', '42501 应映射为权限提示，实际: ' + env.sync.getState().lastError);
  assert(env.store.getDB() !== null, '本地数据完好');
  ok.push('写入被拒：友好错误映射且本地数据不丢');

  /* ===== 9. 网络错误映射 ===== */
  env = reset();
  cloudState.dbError = { kind: 'network', message: 'request:fail' };
  await env.sync.syncNow();
  await sleep(30);
  assert(env.sync.getState().lastError.indexOf('网络') === 0, '网络错误应提示网络问题，实际: ' + env.sync.getState().lastError);
  ok.push('网络错误：映射为网络提示');

  /* ===== 10. 云端无数据行：不崩溃，创建新行；upsert 指定 owner_id 冲突目标 ===== */
  env = reset();
  cloudState.row = null;
  await env.sync.bootstrap();
  await sleep(30);
  const up10 = cloudState.calls.filter(c => c.m === 'upsert').pop();
  assert(up10, '无云端行时应推送创建');
  assert(up10.onConflict === 'owner_id', 'upsert 应指定 onConflict=owner_id，实际: ' + up10.onConflict);
  assert(env.store.getPushedRev() >= 1, '推送后版本标记应更新');
  ok.push('云端无数据行：正常创建，upsert 冲突目标为 owner_id（每用户一行）');

  /* ===== 11. store 层：rev 递增 / 快照深拷贝 / applyCloud 迁移 ===== */
  env = reset();
  const s = env.store;
  assert(s.getRev() === 1, '初始 rev 应为 1');
  s.save();
  assert(s.getRev() === 2, 'save 后 rev 应为 2');
  const snap = s.snapshot();
  snap.memos.push({ id: 'x' });
  assert(s.getDB().memos.length === 0, 'snapshot 应为深拷贝');
  s.applyCloud({ rev: 7, profile: { name: '迁移测试' }, themeCfg: { bg: 'zzz' } });
  assert(s.getDB().rev === 7, 'applyCloud 应采纳 rev');
  assert(s.getDB().profile.name === '迁移测试', 'applyCloud 应合并 profile');
  assert(s.getDB().profile.tags.length === 0, 'applyCloud 应补全缺失嵌套字段');
  assert(s.getDB().themeCfg === null, '非法主题配置应被清洗为 null');
  assert(s.getDB().courses.length === 0, 'applyCloud 应补全缺失数组字段');
  assert(s.getPushedRev() === 7, 'applyCloud 后已推送版本应为 7');
  ok.push('store 层：rev/快照/迁移逻辑正确');

  console.log('==== OK ====');
  ok.forEach(o => console.log('✓ ' + o));
  console.log('==== ISSUES (' + issues.length + ') ====');
  issues.forEach(i => console.log('✗ ' + i));
  process.exit(issues.length ? 1 : 0);
})().catch(e => {
  console.error('测试执行异常:', e);
  process.exit(1);
});
