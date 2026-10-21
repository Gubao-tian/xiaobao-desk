/* 弹层点击穿透专项（修复 v1.4.0）：
   验证「点输入框/按钮不关弹层、仅点遮罩背景才关」——杜绝 tap 冒泡误关弹层。
   覆盖 8 个页面共 10 个弹层。 */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', 'miniprogram');

let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } };

const storage = {};
global.wx = {
  getStorageSync(k) { return storage[k] === undefined ? '' : storage[k]; },
  setStorageSync(k, v) { storage[k] = v; },
  showToast() {}, showModal(o) { if (o && o.success) o.success({ confirm: true }); },
  reLaunch() {}, stopPullDownRefresh() {}, setBackgroundColor() {}, setNavigationBarColor() {}
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

/* tap on an input inside the sheet: target !== currentTarget */
const tapOnInput = { target: { dataset: {} }, currentTarget: { dataset: { key: 'X' } } };
/* tap directly on the mask background: target === currentTarget */
function tapOnBg(key) { const o = { dataset: { key } }; return { target: o, currentTarget: o }; }

const cases = [
  ['read', ['showModal']], ['course', ['showModal']], ['exam', ['showModal']],
  ['skill', ['showModal']], ['memo', ['showModal']], ['workout', ['showModal']],
  ['finance', ['showModal', 'showDep']], ['media', ['showIdea', 'showPub']]
];

let n = 0;
for (const [dir, keys] of cases) {
  for (const key of keys) {
    n++;
    console.log('=== ' + n + '. ' + dir + ' (' + key + ') ===');
    freshStore();
    const p = loadPage(dir);
    p.setData({ [key]: true });
    // 点输入框：不应关闭
    p.onMaskTap(tapOnInput);
    check(p.data[key] === true, '点输入框 → 弹层保持打开');
    // 点遮罩背景：应关闭
    p.onMaskTap(tapOnBg(key));
    check(p.data[key] === false, '点遮罩背景 → 弹层关闭');
  }
}

console.log('\n==== ' + (fail === 0 ? 'ALL PASS' : 'HAS FAILURES') + ' (' + pass + ' passed, ' + fail + ' failed) ====');
process.exit(fail === 0 ? 0 : 1);
