/* 模拟真机时序：bindtap 先于 bindblur 触发
   验证 submitModal 此时是否能读到完整 title */
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

/* 模拟真机 setData：同步更新 data，但 blur 回调延迟到下一个 tick
   即 tap 先执行，blur 后执行——真机已知时序问题 */
let blurQueue = [];
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
  // 包装 blur 处理器：延迟执行（模拟真机时序）
  ['onFormTitleBlur', 'onFormAuthorBlur', 'onFormTotalBlur'].forEach(name => {
    if (cfg[name]) {
      const orig = cfg[name];
      cfg[name] = function (e) {
        blurQueue.push({ fn: orig, ctx: this, arg: e });
      };
    }
  });
  cfg.__flushBlur = function () {
    const q = blurQueue; blurQueue = [];
    q.forEach(b => b.fn.call(b.ctx, b.arg));
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

(async () => {
  console.log('=== 真机时序模拟（tap 先于 blur）===');
  const store = freshStore();
  const read = loadPage('read');

  read.onShow();
  read.openAdd();

  // 模拟 bindinput 同步更新
  read.onFormTitle({ detail: { value: '小' } });
  read.onFormTitle({ detail: { value: '小王' } });
  read.onFormTitle({ detail: { value: '小王子' } });

  // form 组件提交：e.detail.value 包含完整当前值，不依赖 blur 时序
  read.submitModal({ detail: { value: { title: '小王子', author: '', total: '', status: 'reading' } } });

  const DB = store.getDB();
  check(DB.books.length === 1, 'form 提交书籍入库成功');
  check(DB.books[0].title === '小王子', '书名「小王子」正确');

  /* === 场景2：bindinput 完全丢失，blur 也丢失——form 仍能提交 === */
  console.log('');
  console.log('=== 极端场景：input/blur 全丢失，仅 form 提交 ===');
  freshStore();
  delete require.cache[path.join(ROOT, 'utils/store.js')];
  const read2 = loadPage('read');
  read2.onShow();
  read2.openAdd();
  // 不调用任何 onFormTitle——直接 form submit，e.detail.value 有完整值
  read2.submitModal({ detail: { value: { title: '活着', author: '余华', total: '191', status: 'todo' } } });

  const DB2 = require(path.join(ROOT, 'utils/store.js')).getDB();
  check(DB2.books.length === 1, '仅 form 提交也能入库');
  check(DB2.books[0].title === '活着', '书名「活着」正确');
  check(DB2.books[0].author === '余华', '作者「余华」正确');
  check(DB2.books[0].total === 191, '总页数 191 正确');
  check(DB2.books[0].status === 'todo', '状态 todo 正确');

  /* === 场景3：form 提交空 title —— 应提示输入书名 === */
  console.log('');
  console.log('=== 空标题防御 ===');
  freshStore();
  delete require.cache[path.join(ROOT, 'utils/store.js')];
  const read3 = loadPage('read');
  read3.onShow();
  read3.openAdd();
  global.__toasts = [];
  read3.submitModal({ detail: { value: { title: '', author: '', total: '' } } });
  check((global.__toasts || []).includes('请输入书名'), '空 title 时提示「请输入书名」');

  console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
  process.exit(fail === 0 ? 0 : 1);
})();
