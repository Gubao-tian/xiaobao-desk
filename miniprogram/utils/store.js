/* 本地数据层：数据保存在小程序本地存储（wx.setStorageSync），并通过 utils/sync.js 同步到云端
   每日重置：以「日期键」存储当天数据（plans / workout / checkins / studyLog / readLog），
            跨天自动开启新的一天，历史记录全部保留
   累积记录：courses / exam / finance / goals / ideas / pubs / books / skills / memos / reviews 长期保存
   云同步：rev 为数据版本号，每次本地修改 +1；save() 后防抖推送云端快照 */
const KEY = 'gubao_desk_v1';
const SYNC_KEY = 'gubao_desk_sync_v1'; // 已推送版本记录（本地）

const DEFAULT = {
  v: 2,
  rev: 1,           // 数据版本号：云同步冲突判断（最后写入获胜）
  updatedAt: null,  // 最近一次本地修改时间（ISO）
  createdAt: null,
  theme: 'day',        // 兼容旧版字段（已由 themeCfg 取代，保留不删）
  profile: {           // 个人资料
    name: '',
    sign: '',
    avatar: '💗',
    tags: []
  },
  themeCfg: null,      // 背景主题配置（默认甜粉，null 时取 THEMES[0]）
  checkins: {},     // 日期 -> {at}
  plans: {},        // 日期 -> [{id,name,done,prio}]
  courses: [],      // {id,name,color,total,progress,note}
  studyLog: {},     // 日期 -> 分钟
  workout: {},      // 日期 -> [{id,type,min,burn,custom}]
  exam: [],         // {id,name,examDate,total,done,unit}
  finance: [],      // {id,type,amount,cat,note,date}
  goals: [],        // {id,name,target,saved}
  ideas: [],        // {id,title,note,status,created}
  pubs: [],         // {id,platform,title,date,hits}
  books: [],        // {id,title,author,total,page,status}
  readLog: {},      // 日期 -> 分钟
  quotes: [],       // {id,text,date}
  skills: [],       // {id,name,emoji,count,last}
  skillLog: [],     // {id,name,date}
  memos: [],        // {id,title,body,color,pin,created}
  reviews: {},      // 周起始日 -> {good,bad,next,at}
  reminders: {      // 提醒设置（本地提醒 + 微信订阅消息共用）
    plan:    { on: true,  time: '09:00' },   // 每日计划提醒（按时间点）
    workout: { on: true,  time: '19:00' },   // 锻炼提醒（按时间点）
    water:   { on: false, interval: 120 }     // 喝水提醒（按间隔分钟）
  },
  subGranted: false,    // 是否已授权微信订阅消息
  reminderLog: {}       // 去重记录：plan/workout -> 日期；water -> 时间戳
};

let DB = load();
let CUR_DAY = null;
let PUSHED_REV = loadPushedRev();

/* 把任意来源的原始数据合并/迁移成完整结构（本地读取与云端采纳共用） */
function mergeRaw(d) {
  const out = fresh();
  if (!d || typeof d !== 'object') return out;
  Object.keys(out).forEach(k => {
    if (d[k] !== undefined && d[k] !== null) out[k] = d[k];
  });
  /* 旧版数据迁移：补齐 profile / themeCfg 的嵌套字段 */
  out.profile = Object.assign({ name: '', sign: '', avatar: '💗', tags: [] }, d.profile || {});
  if (!Array.isArray(out.profile.tags)) out.profile.tags = [];
  out.themeCfg = normalizeTheme(d.themeCfg);
  if (typeof out.rev !== 'number' || out.rev < 1) out.rev = 1;
  return out;
}

function load() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (!raw) return fresh();
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return mergeRaw(d);
  } catch (e) {
    console.warn('数据读取失败，使用初始数据', e);
    return fresh();
  }
}

function fresh() { return JSON.parse(JSON.stringify(DEFAULT)); }

/* 已推送版本记录：避免重启后重复推送相同数据 */
function loadPushedRev() {
  try {
    const raw = wx.getStorageSync(SYNC_KEY);
    const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
    return typeof n === 'number' && n > 0 ? n : 0;
  } catch (e) { return 0; }
}

function setPushedRev(rev) {
  PUSHED_REV = typeof rev === 'number' ? rev : 0;
  try { wx.setStorageSync(SYNC_KEY, PUSHED_REV); } catch (e) { /* 忽略 */ }
}

/* 校验并补全主题配置字段 */
function normalizeTheme(t) {
  if (!t || typeof t !== 'object') return null;
  const need = ['bg', 'bg2', 'accent', 'accentSoft', 'navBg'];
  const ok = need.every(k => typeof t[k] === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(t[k]));
  if (!ok) return null;
  return {
    id: t.id || 'custom',
    name: t.name || '自定义',
    emoji: t.emoji || '🎨',
    bg: t.bg, bg2: t.bg2, accent: t.accent, accentSoft: t.accentSoft, navBg: t.navBg
  };
}

/* 本地保存：递增版本号并调度一次防抖云推送 */
function save() {
  DB.rev = (typeof DB.rev === 'number' ? DB.rev : 0) + 1;
  DB.updatedAt = new Date().toISOString();
  try {
    wx.setStorageSync(KEY, DB);
  } catch (e) {
    console.warn('本地存储写入失败', e);
  }
  scheduleCloudPush();
}

/* 惰性加载同步模块：未接入/未构建 npm 时静默保持本地模式 */
function scheduleCloudPush() {
  try {
    const sync = require('./sync.js');
    if (sync && typeof sync.schedulePush === 'function') sync.schedulePush();
  } catch (e) { /* 本地模式 */ }
}

/* 采纳云端快照：替换本地数据并标记已同步到该版本（不会再触发回环推送） */
function applyCloud(data) {
  const merged = mergeRaw(data);
  if (data && typeof data.rev === 'number') merged.rev = data.rev;
  DB = merged;
  try {
    wx.setStorageSync(KEY, DB);
  } catch (e) {
    console.warn('云端数据写入本地失败', e);
  }
  setPushedRev(DB.rev);
}

/* 启动/前台恢复时调用：跨天自动翻页 */
function initDay() {
  const t = require('./util.js').today();
  if (CUR_DAY !== t) {
    const first = CUR_DAY === null;
    CUR_DAY = t;
    if (!first) {
      wx.showToast({ title: '新的一天开始啦，记录已翻页 ☀️', icon: 'none' });
      return true; // 跨天了，页面需要刷新
    }
  }
  return false;
}

/* 连续打卡天数 */
function streak() {
  const u = require('./util.js');
  let n = 0;
  let d = u.today();
  if (!DB.checkins[d]) d = u.dateAdd(d, -1);
  while (DB.checkins[d]) { n++; d = u.dateAdd(d, -1); }
  return n;
}

/* ---------- 通用增删改（编辑/删除功能复用） ---------- */
/* 扁平数组模块（books/courses/exam/finance/goals/ideas/pubs/quotes/skills/skillLog/memos） */
function removeItem(arrKey, id) {
  if (!Array.isArray(DB[arrKey])) return;
  DB[arrKey] = DB[arrKey].filter(x => x.id !== id);
  save();
}
function updateItem(arrKey, id, patch) {
  const arr = DB[arrKey];
  if (!Array.isArray(arr)) return;
  const i = arr.findIndex(x => x.id === id);
  if (i < 0) return;
  arr[i] = Object.assign({}, arr[i], patch);
  save();
}
/* 日期键数组模块（plans / workout：DB[key][日期] = [...]） */
function removeDayItem(arrKey, day, id) {
  const a = DB[arrKey];
  if (!a || !a[day]) return;
  DB[arrKey][day] = a[day].filter(x => x.id !== id);
  save();
}
function updateDayItem(arrKey, day, id, patch) {
  const a = DB[arrKey];
  if (!a || !a[day]) return;
  const i = a[day].findIndex(x => x.id === id);
  if (i < 0) return;
  a[day][i] = Object.assign({}, a[day][i], patch);
  save();
}

/* 当前生效的主题（未设置时为默认甜粉） */
function currentTheme() {
  return DB.themeCfg || require('./theme.js').THEMES[0];
}

/* 切换主题：立即生效并全局应用 */
function setTheme(cfg) {
  DB.themeCfg = cfg;
  save();
  require('./theme.js').applyTheme(cfg);
}

/* 个人资料读写 */
function getProfile() { return DB.profile; }
function setProfile(patch) {
  DB.profile = Object.assign({}, DB.profile, patch);
  save();
  return DB.profile;
}

/* ---------- 云同步辅助 ---------- */
function getRev() { return typeof DB.rev === 'number' ? DB.rev : 0; }
function getPushedRev() { return PUSHED_REV; }
function snapshot() { return JSON.parse(JSON.stringify(DB)); }

module.exports = {
  KEY, DEFAULT, save, load, initDay, streak,
  getDB: () => DB,
  currentTheme, setTheme, getProfile, setProfile,
  getRev, getPushedRev, setPushedRev, snapshot, applyCloud, mergeRaw,
  removeItem, updateItem, removeDayItem, updateDayItem
};
