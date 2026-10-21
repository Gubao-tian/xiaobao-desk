/* 云同步模块：微信登录 + 工作台快照拉取/推送
   本地优先（local-first）：所有页面照旧读写 store，本模块负责把快照同步到云端
   冲突策略：以 rev 版本号做最后写入获胜（LWW），整个快照一行存储，按用户隔离（RLS） */
const cloud = require('./cloud.js');
const store = require('./store.js');

const PUSH_DEBOUNCE = 800; // 毫秒：本地保存后防抖多久再推送

const state = {
  ready: false,      // SDK 可用（已构建 npm）
  loggedIn: false,   // 已建立微信会话
  lastSyncAt: null,  // 上次成功同步时间（ISO）
  lastError: '',     // 最近一次失败的用户可读信息
  user: null
};

let busy = 0;          // 进行中的同步操作数
let pushTimer = null;  // 防抖定时器
let queue = Promise.resolve(); // 同步操作串行队列
let loginPending = null;       // 进行中的登录 Promise（防并发重复登录）

/* ---------- 错误信息映射：把技术错误翻成用户看得懂的中文 ----------
   顺序很重要：稳定的 kind / PostgreSQL 错误码优先，启发式（message 正则）兜底，
   否则没有 status 字段的 PG 错误会被误判成网络错误 */
function friendlyError(err) {
  if (!err) return '云端同步失败';
  const kind = err.kind || '';
  const code = err.code || '';
  const status = err.status || err.statusCode || 0;
  const msg = err.message || '';
  if (kind === 'unauthenticated') return '云服务登录已过期，请重新进入小程序';
  if (code === '42501') return '没有权限访问云端数据';
  if (code === '42P01') return '云端数据表还没建好，请联系应用管理员';
  if (code === '23505') return '这条数据已经存在啦';
  if (kind === 'network' || status === 0 || /request:fail|network|timeout|超时|网络/i.test(msg)) {
    return '网络开小差了，云端同步失败，请稍后重试';
  }
  if (status === 401) return '云服务登录已过期，请重新进入小程序';
  if (kind === 'quota' || /quota|额度|limit/i.test(msg)) return '云服务额度已用完，暂时无法同步';
  return msg && msg.length <= 40 ? msg : '云端同步失败，请稍后重试';
}

/* 登录错误信息：SDK 返回的多为可操作中文提示（如「未打开微信登录」），直接透出 */
function authErrorMessage(err) {
  const msg = err && err.message;
  return msg && msg.length <= 40 ? msg : '微信登录失败，请重试';
}

/* SDK 是否可用（未构建 npm 时为本地模式，不报错、不打扰用户） */
function sdkOk() {
  try {
    cloud.getCloud();
    return true;
  } catch (e) {
    return false;
  }
}

/* 串行执行同步操作，避免并发写乱 rev */
function enqueue(fn) {
  busy++;
  const run = queue.then(fn, fn);
  queue = run.then(function () {}, function () {});
  run.then(function () { busy--; }, function () { busy--; });
  return run;
}

/* ---------- 微信登录：wx.login 拿 code，换取云端会话 ---------- */
function ensureLogin() {
  if (state.loggedIn) return Promise.resolve(true);
  if (loginPending) return loginPending;
  if (!sdkOk()) {
    state.lastError = '';
    return Promise.resolve(false); // 本地模式：静默
  }
  loginPending = new Promise(function (resolve) {
    wx.login({
      success(res) {
        const code = res && res.code;
        let appid = '';
        try { appid = wx.getAccountInfoSync().miniProgram.appId; } catch (e) { /* 忽略 */ }
        cloud.getCloud().auth.signInWithWechat(code, appid).then(function (ret) {
          loginPending = null;
          if (ret && ret.error) {
            state.lastError = authErrorMessage(ret.error);
            console.warn('[cloud] 微信登录失败', JSON.stringify({
              stage: 'signInWithWechat',
              message: state.lastError
            }));
            resolve(false);
            return;
          }
          state.loggedIn = true;
          state.user = (ret && ret.data && ret.data.user) || null;
          state.lastError = '';
          resolve(true);
        }).catch(function (e) {
          loginPending = null;
          state.lastError = '微信登录失败，请重试';
          console.warn('[cloud] 微信登录异常', JSON.stringify({
            stage: 'signInWithWechat',
            message: e && e.message
          }));
          resolve(false);
        });
      },
      fail(err) {
        loginPending = null;
        state.lastError = '微信登录失败，请重试';
        console.warn('[cloud] wx.login 失败', JSON.stringify({
          stage: 'wx.login',
          message: (err && err.errMsg) || 'unknown'
        }));
        resolve(false);
      }
    });
  });
  return loginPending;
}

/* 拉取云端快照：仅当云端 rev 比本地新时才采纳 */
function pull() {
  return enqueue(function () {
    return ensureLogin().then(function (ok) {
      if (!ok) return { ok: false, reason: 'not-logged-in' };
      return cloud.getCloud().database.from(cloud.TABLE).select('data, updated_at').maybeSingle()
        .then(function (ret) {
          if (ret && ret.error) {
            state.lastError = friendlyError(ret.error);
            return { ok: false, error: state.lastError };
          }
          const row = ret && ret.data;
          const remote = row && row.data;
          if (remote && typeof remote.rev === 'number' && remote.rev > store.getRev()) {
            store.applyCloud(remote); // 采纳云端：更新本地存储并标记已同步到该版本
            state.lastSyncAt = row.updated_at || new Date().toISOString();
            state.lastError = '';
            return { ok: true, adopted: true };
          }
          state.lastSyncAt = row && row.updated_at ? row.updated_at : (state.lastSyncAt || new Date().toISOString());
          state.lastError = '';
          return { ok: true, adopted: false };
        })
        .catch(function (e) {
          state.lastError = friendlyError(e);
          return { ok: false, error: state.lastError };
        });
    });
  });
}

/* 推送本地快照：rev 超过已推送版本才真正写入 */
function push() {
  return enqueue(function () {
    return ensureLogin().then(function (ok) {
      if (!ok) return { ok: false, reason: 'not-logged-in' };
      const rev = store.getRev();
      if (rev <= store.getPushedRev()) return { ok: true, skipped: true }; // 没有新内容
      const snapshot = store.snapshot();
      return cloud.getCloud().database.from(cloud.TABLE)
        .upsert({ data: snapshot }, { onConflict: 'owner_id' })
        .select()
        .then(function (ret) {
          if (ret && ret.error) {
            state.lastError = friendlyError(ret.error);
            return { ok: false, error: state.lastError };
          }
          const row = ret && ret.data && ret.data[0];
          markPushed(rev);
          state.lastSyncAt = (row && row.updated_at) || new Date().toISOString();
          state.lastError = '';
          return { ok: true };
        })
        .catch(function (e) {
          state.lastError = friendlyError(e);
          return { ok: false, error: state.lastError };
        });
    });
  });
}

/* 本地保存后调用：防抖推送（未登录时不调度，由启动时的兜底推送覆盖） */
function schedulePush(delay) {
  if (!state.loggedIn) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(function () {
    pushTimer = null;
    push();
  }, delay || PUSH_DEBOUNCE);
}

/* 应用启动：静默登录 + 先拉后推。失败不阻塞，本地照常可用 */
function bootstrap() {
  if (!sdkOk()) { state.ready = false; return Promise.resolve(); }
  state.ready = true;
  return ensureLogin().then(function (ok) {
    if (!ok) return { ok: false };
    return pull().then(function (pr) {
      return push().then(function (ps) {
        return { ok: true, pull: pr, push: ps };
      });
    });
  });
}

/* 回到前台：未登录就重试登录；已登录就拉一次最新 */
function onForeground() {
  if (!sdkOk()) return Promise.resolve();
  state.ready = true;
  if (state.loggedIn) return pull();
  return bootstrap();
}

/* 手动同步（「我的」页按钮） */
function syncNow() {
  if (!sdkOk()) {
    state.lastError = '';
    wx.showToast({ title: '云服务未配置，先构建 npm', icon: 'none' });
    return Promise.resolve({ ok: false });
  }
  state.ready = true;
  wx.showLoading({ title: '同步中…', mask: true });
  return ensureLogin().then(function (ok) {
    if (!ok) {
      wx.hideLoading();
      wx.showToast({ title: state.lastError || '微信登录失败', icon: 'none' });
      return { ok: false };
    }
    return pull().then(function () { return push(); }).then(function (r) {
      wx.hideLoading();
      const fail = r && r.error;
      wx.showToast({
        title: fail ? ('同步失败：' + fail) : '云端同步完成 ☁️',
        icon: fail ? 'none' : 'success'
      });
      return r;
    });
  });
}

/* 记录已推送版本（供 store.applyCloud 回环防护） */
function markPushed(rev) {
  store.setPushedRev(rev);
}

/* 供页面展示的状态快照 */
function getState() {
  return {
    ready: state.ready,
    loggedIn: state.loggedIn,
    syncing: busy > 0,
    lastSyncAt: state.lastSyncAt,
    lastError: state.lastError,
    user: state.user
  };
}

module.exports = {
  bootstrap, onForeground, syncNow, schedulePush, markPushed, getState,
  PUSH_DEBOUNCE
};
