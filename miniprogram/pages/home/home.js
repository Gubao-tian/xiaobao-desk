const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');
const { searchAll } = require('../../utils/search.js');

/* 某天的综合活跃度（日历热力图着色）：打卡 + 完成任务 + 运动/学习/阅读时长 -> 0~4 */
function dayLevel(DB, ds) {
  const done = (DB.plans[ds] || []).filter(p => p.done).length;
  const wk = (DB.workout[ds] || []).reduce((a, b) => a + (+b.min || 0), 0);
  const study = DB.studyLog[ds] || 0;
  const read = DB.readLog[ds] || 0;
  const chk = !!DB.checkins[ds];
  let s = (chk ? 1 : 0) + done * 0.6 + Math.min(wk, 60) / 30 + Math.min(study, 60) / 30 + Math.min(read, 60) / 30;
  if (!chk && s === 0) return 0;
  return s >= 3 ? 4 : s >= 2 ? 3 : s >= 1 ? 2 : 1;
}

const SEARCH_MOD_NAME = {
  plan: '每日计划', course: '课程学习', workout: '锻炼身体', exam: '备考计划',
  finance: '理财', media: '自媒体', read: '阅读', skill: '技能训练',
  memo: '备忘录', review: '周复盘'
};

Page({
  data: {
    pageStyle: '',
    searchQuery: '',
    searchResults: [],
    now: '',
    hms: '',
    dateLine: '',
    greet: '',
    quoteCn: '',
    quoteEn: '',
    checked: false,
    checkTime: '',
    streak: 0,
    totalCheck: 0,
    plans: [],
    doneN: 0,
    pct: 0,
    calCells: [],
    monthLabel: '',
    recent: [],
    studyMin: 0,
    burn: 0,
    readMin: 0,
    profile: { name: '', sign: '', avatar: '💗', tags: [] }
  },

  onLoad() {
    this.tick();
    this._timer = setInterval(() => this.tick(), 1000);
  },
  onUnload() {
    this._timer && clearInterval(this._timer);
  },
  onShow() {
    if (store.initDay()) { this.refresh(); return; }
    this.refresh();
  },
  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  /* ---------- 全局搜索 ---------- */
  _runSearch(q) {
    const list = searchAll(store.getDB(), q).slice(0, 50).map(x => ({
      mod: x.mod, text: x.text, sub: x.sub, modName: SEARCH_MOD_NAME[x.mod] || x.mod
    }));
    this.setData({ searchQuery: q, searchResults: list });
  },
  onSearchInput(e) { this._runSearch(e.detail.value); },
  onSearchInputBlur(e) { this._runSearch(e.detail.value); },
  onSearchGo(e) {
    const mod = e.currentTarget.dataset.go;
    if (!mod) return;
    wx.reLaunch({ url: '/pages/' + mod + '/' + mod });
  },

  tick() {
    const d = new Date();
    const pad = u.pad;
    this.setData({
      hms: pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()),
      dateLine: d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + u.WEEK_CN[d.getDay()],
      greet: u.greet(d.getHours())
    });
  },

  refresh() {
    const DB = store.getDB();
    const t = u.today();
    const d = new Date();
    const plans = DB.plans[t] || [];
    const doneN = plans.filter(x => x.done).length;
    const pct = plans.length ? Math.round(doneN / plans.length * 100) : 0;
    const [qc, qe] = u.quoteOfDay(t);
    const ci = DB.checkins[t];

    /* 月历 */
    const y = d.getFullYear(), m = d.getMonth();
    const startPad = (new Date(y, m, 1).getDay() + 6) % 7;
    const dim = new Date(y, m + 1, 0).getDate();
    const prevDim = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = startPad - 1; i >= 0; i--) cells.push({ d: prevDim - i, out: true });
    for (let dd = 1; dd <= dim; dd++) {
      const ds = y + '-' + u.pad(m + 1) + '-' + u.pad(dd);
      const has = !!DB.checkins[ds];
      const lv = dayLevel(DB, ds);
      cells.push({ d: dd, out: false, full: has, today: ds === t, ds, future: ds > t, lv: has ? 0 : Math.min(3, lv), lvLabel: lv });
    }
    const tail = (7 - ((startPad + dim) % 7)) % 7;
    for (let i = 1; i <= tail; i++) cells.push({ d: i, out: true });

    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      quoteCn: qc,
      quoteEn: qe,
      checked: !!ci,
      checkTime: ci ? u.pad(new Date(ci.at).getHours()) + ':' + u.pad(new Date(ci.at).getMinutes()) : '',
      streak: store.streak(),
      totalCheck: Object.keys(DB.checkins).length,
      plans, doneN, pct,
      calCells: cells,
      monthLabel: (m + 1) + ' 月',
      recent: u.lastNDays(15).map(ds => ({ d: u.parseD(ds).getDate(), on: !!DB.checkins[ds], today: ds === t })),
      studyMin: DB.studyLog[t] || 0,
      burn: Math.round((DB.workout[t] || []).reduce((a, b) => a + b.burn, 0)),
      readMin: DB.readLog[t] || 0,
      profile: DB.profile
    });
  },

  onCheckin() {
    const DB = store.getDB();
    const t = u.today();
    if (DB.checkins[t]) {
      wx.showToast({ title: '今天已经打过卡啦，明天再来～', icon: 'none' });
      return;
    }
    DB.checkins[t] = { at: Date.now() };
    store.save();
    wx.showToast({ title: '打卡成功！连续 ' + store.streak() + ' 天 🎉', icon: 'none' });
    this.refresh();
  },

  /* 点击月历某一天：弹出当天全部记录（打卡/计划/运动/学习/阅读/理财/发布/便签/摘抄） */
  onDayDetail(e) {
    const ds = e.currentTarget.dataset.ds;
    if (!ds) return; // 占位空格
    const DB = store.getDB();
    const lines = [];
    if (DB.checkins[ds]) {
      const at = new Date(DB.checkins[ds].at);
      lines.push('💗 打卡 ' + u.pad(at.getHours()) + ':' + u.pad(at.getMinutes()));
    }
    const plans = DB.plans[ds] || [];
    if (plans.length) {
      lines.push('📋 计划 ' + plans.filter(x => x.done).length + '/' + plans.length);
      plans.forEach(p => lines.push((p.done ? '  ✅ ' : '  ⬜ ') + p.name));
    }
    (DB.workout[ds] || []).forEach(w => lines.push('🏃 ' + (w.type || '运动') + ' ' + w.min + '分 · ' + Math.round(w.burn) + '千卡'));
    if (DB.studyLog[ds]) lines.push('📚 学习 ' + DB.studyLog[ds] + ' 分钟');
    if (DB.readLog[ds]) lines.push('📖 阅读 ' + DB.readLog[ds] + ' 分钟');
    (DB.finance || []).filter(f => f.date === ds).forEach(f => lines.push((f.type === 'income' ? '💰 ' : '🧾 ') + (f.note || f.cat || '一笔') + ' ' + (f.type === 'income' ? '+' : '-') + '¥' + (f.amount || 0)));
    (DB.pubs || []).filter(p => p.date === ds).forEach(p => lines.push('📮 ' + p.title + ' · ' + p.platform));
    (DB.ideas || []).filter(i => i.created === ds).forEach(i => lines.push('💡 ' + i.title));
    (DB.skillLog || []).filter(s => s.date === ds).forEach(s => lines.push('⭐ ' + (s.name || '技能练习')));
    (DB.memos || []).filter(m => (m.created || '').slice(0, 10) === ds).forEach(m => lines.push('🗒️ ' + (m.title || '便签')));
    (DB.quotes || []).filter(q => q.date === ds).forEach(q => lines.push('✍️ ' + q.text));
    const d2 = u.parseD(ds);
    const title = (d2.getMonth() + 1) + ' 月 ' + d2.getDate() + ' 日 · 星期' + u.WEEK_CN[d2.getDay()];
    wx.showModal({
      title,
      content: lines.length ? lines.join('\n') : '这一天还没有任何记录',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onTogglePlan(e) {
    const DB = store.getDB();
    const id = e.currentTarget.dataset.id;
    const it = (DB.plans[u.today()] || []).find(x => x.id === id);
    if (!it) return;
    it.done = !it.done;
    store.save();
    this.refresh();
    const list = DB.plans[u.today()] || [];
    if (it.done && list.length && list.every(x => x.done)) {
      wx.showToast({ title: '今天的任务全部完成！🏆', icon: 'none' });
    }
  },

  onNav(e) {
    wx.reLaunch({ url: e.detail.url });
  },
  onGoPlan() {
    wx.reLaunch({ url: '/pages/plan/plan' });
  },
  onGoProfile() {
    wx.reLaunch({ url: '/pages/profile/profile' });
  },
  onShareAppMessage() {
    return { title: '小宝工作台', path: '/pages/home/home' };
  }
});
