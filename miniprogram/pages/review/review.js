const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');
const { buildGrowthReport } = require('../../utils/report.js');

/* 日期格式：10月13日 */
const fmtMD = s => {
  const d = u.parseD(s);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
};

Page({
  data: {
    pageStyle: '',
    weekStart: '',
    weekLabel: '',
    checkN: 0,
    planN: 0,
    studyMin: 0,
    workoutMin: 0,
    checkPct: 0,
    bars: [],
    saved: false,
    form: {},
    history: [],
    report: null,
    reportStats: [],
    reportText: ''
  },

  onLoad() {},
  onUnload() { /* 无定时器需要清理 */ },

  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },

  refresh() {
    const DB = store.getDB();
    const t = u.today();
    const [ws, we] = u.weekRange();
    const days = u.lastNDays(7, we); // 本周一 ~ 本周日

    /* 本周数据概览 + 每日任务完成数柱状图 */
    let checkN = 0, planN = 0, studyMin = 0, workoutMin = 0, maxDone = 0;
    const bars = days.map(d => {
      if (DB.checkins[d]) checkN++;
      const done = (DB.plans[d] || []).filter(x => x.done).length;
      planN += done;
      studyMin += DB.studyLog[d] || 0;
      workoutMin += (DB.workout[d] || []).reduce((a, b) => a + (b.min || 0), 0);
      if (done > maxDone) maxDone = done;
      return {
        d,
        wk: u.WEEK_CN[u.parseD(d).getDay()],
        v: done,
        h: 0,
        today: d === t,
        bg: d === t
          ? 'linear-gradient(180deg,#FFA6C8,#F2689A)'
          : 'linear-gradient(180deg,#CDB6F2,#B79BEF)'
      };
    });
    bars.forEach(b => {
      b.h = Math.max(Math.round(b.v / (maxDone || 1) * 100), b.v ? 6 : 2);
    });

    const cur = DB.reviews[ws] || null;

    /* 历史复盘（按周倒序，当前周带标记） */
    const history = Object.keys(DB.reviews)
      .sort((a, b) => (a < b ? 1 : -1))
      .map(k => {
        const r = DB.reviews[k];
        return {
          weekStart: k,
          weekLabel: fmtMD(k) + ' ~ ' + fmtMD(u.dateAdd(k, 6)),
          good: r.good || '',
          bad: r.bad || '',
          next: r.next || '',
          atText: r.at ? fmtMD(r.at) : '',
          isCur: k === ws
        };
      });

    /* 表单回填：本周已有复盘则带出，否则清空 */
    const form = {
      good: cur ? (cur.good || '') : '',
      bad: cur ? (cur.bad || '') : '',
      next: cur ? (cur.next || '') : ''
    };

    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      weekStart: ws,
      weekLabel: fmtMD(ws) + ' ~ ' + fmtMD(we),
      checkN,
      planN,
      studyMin,
      workoutMin,
      checkPct: Math.round(checkN / 7 * 100),
      bars,
      saved: !!cur,
      form,
      history
    });
  },

  /* ============ 自动成长报告 ============ */
  onGenReport() {
    const DB = store.getDB();
    const r = buildGrowthReport(DB, this.data.weekStart);
    this.setData({
      report: r,
      reportStats: r.stats.map(s => ({
        l: s.l, v: s.v, u: s.u,
        d: s.d > 0 ? '↑' + s.d : s.d < 0 ? '↓' + Math.abs(s.d) : '—'
      })),
      reportText: r.text
    });
    wx.showToast({ title: '成长报告已生成 📊', icon: 'none' });
  },
  /* 把自动报告写进「本周做得好」，再自己补充即可 */
  onFillReport() {
    if (!this.data.reportText) { this.onGenReport(); }
    const txt = this.data.reportText || '';
    if (!txt) { wx.showToast({ title: '暂无可写入的报告', icon: 'none' }); return; }
    const old = (this.data.form.good || '').trim();
    const merged = old ? (old.indexOf(txt) >= 0 ? old : old + '\n' + txt) : txt;
    this.setData({ 'form.good': merged });
    wx.showToast({ title: '已写入「本周做得好」🌱', icon: 'none' });
  },

  /* ============ 复盘表单 ============ */
  onFormGood(e) { this.setData({ 'form.good': e.detail.value }); },
  onFormGoodBlur(e) { this.setData({ 'form.good': e.detail.value }); },
  onFormBad(e) { this.setData({ 'form.bad': e.detail.value }); },
  onFormBadBlur(e) { this.setData({ 'form.bad': e.detail.value }); },
  onFormNext(e) { this.setData({ 'form.next': e.detail.value }); },
  onFormNextBlur(e) { this.setData({ 'form.next': e.detail.value }); },

  onSave() {
    const f = this.data.form || {};
    const good = (f.good || '').trim();
    const bad = (f.bad || '').trim();
    const next = (f.next || '').trim();
    if (!good && !bad && !next) {
      wx.showToast({ title: '写点内容再保存吧 🌱', icon: 'none' });
      return;
    }
    const DB = store.getDB();
    DB.reviews[this.data.weekStart] = { good, bad, next, at: u.today() };
    store.save();
    wx.showToast({ title: '本周复盘已保存 🌙', icon: 'none' });
    this.refresh();
  },

  /* ============ 历史复盘 ============ */
  onDel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除复盘',
      content: '确定删除这一周的复盘记录吗？删除后不可恢复哦',
      confirmColor: '#F2689A',
      success: res => {
        if (!res.confirm) return;
        const DB = store.getDB();
        delete DB.reviews[id];
        store.save();
        wx.showToast({ title: '已删除 🗑️', icon: 'none' });
        this.refresh();
      }
    });
  },

  onNav(e) { wx.reLaunch({ url: e.detail.url }); },

  onShareAppMessage() { return { title: '小宝工作台', path: '/pages/home/home' }; }
});
