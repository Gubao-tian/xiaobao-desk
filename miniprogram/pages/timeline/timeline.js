const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');

Page({
  data: {
    pageStyle: '',
    day: '',
    dayLabel: '',
    weekLabel: '',
    isToday: true,
    prevDay: '',
    nextDay: '',
    canNext: true,
    nodes: [],
    summary: [],
    empty: false
  },

  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  onNav(e) { wx.reLaunch({ url: e.detail.url }); },

  refresh() {
    const DB = store.getDB();
    const day = this.data.day || u.today();
    const d = u.parseD(day);
    const t = u.today();
    const week = u.WEEK_CN[d.getDay()];
    const nodes = buildNodes(DB, day);
    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      day,
      dayLabel: (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日',
      weekLabel: '星期' + week,
      isToday: day === t,
      prevDay: u.dateAdd(day, -1),
      nextDay: u.dateAdd(day, 1),
      canNext: day < t,
      nodes,
      empty: nodes.length === 0,
      summary: [
        { l: '计划完成', v: (DB.plans[day] || []).filter(x => x.done).length + '/' + (DB.plans[day] || []).length },
        { l: '运动', v: (DB.workout[day] || []).reduce((a, b) => a + b.min, 0) + ' 分' },
        { l: '学习', v: (DB.studyLog[day] || 0) + ' 分' },
        { l: '阅读', v: (DB.readLog[day] || 0) + ' 分' }
      ]
    });
  },

  onPrev() { this.setData({ day: u.dateAdd(this.data.day, -1) }); this.refresh(); },
  onNext() {
    if (!this.data.canNext) { wx.showToast({ title: '还没到那天呢', icon: 'none' }); return; }
    this.setData({ day: u.dateAdd(this.data.day, 1) }); this.refresh();
  },
  onToday() { this.setData({ day: u.today() }); this.refresh(); },
  onPickDay(e) {
    const v = e.detail.value;
    if (v) { this.setData({ day: v }); this.refresh(); }
  },

  onShareAppMessage() { return { title: '小宝工作台 · 时间轴', path: '/pages/home/home' }; }
});

/* 汇总某一天全部模块的记录，生成时间轴节点 */
function buildNodes(DB, day) {
  const out = [];
  const push = (icon, title, sub, tag) => out.push({ icon, title, sub: sub || '', tag: tag || '' });

  if (DB.checkins[day]) {
    const at = new Date(DB.checkins[day].at);
    push('💗', '打卡签到', u.pad(at.getHours()) + ':' + u.pad(at.getMinutes()), '打卡');
  }
  (DB.plans[day] || []).forEach(p => {
    push(p.done ? '✅' : '⬜', p.name, p.prio === 'high' ? '重要' : p.prio === 'low' ? '简单' : '普通', '计划');
  });
  (DB.workout[day] || []).forEach(w => {
    push('🏃', w.type || '运动', w.min + ' 分钟 · ' + Math.round(w.burn) + ' 千卡', '运动');
  });
  if (DB.studyLog[day]) push('📚', '课程学习', DB.studyLog[day] + ' 分钟', '学习');
  if (DB.readLog[day]) push('📖', '阅读', DB.readLog[day] + ' 分钟', '阅读');
  (DB.finance || []).filter(f => f.date === day).forEach(f => {
    push(f.type === 'income' ? '💰' : '🧾', f.note || f.cat || '一笔', (f.type === 'income' ? '+' : '-') + '¥' + (f.amount || 0), '理财');
  });
  (DB.pubs || []).filter(p => p.date === day).forEach(p => {
    push('📮', p.title, p.platform + ' · ' + (p.hits || 0) + ' 曝光', '发布');
  });
  (DB.ideas || []).filter(i => i.created === day).forEach(i => {
    push('💡', i.title, i.note || '', '灵感');
  });
  (DB.skillLog || []).filter(s => s.date === day).forEach(s => {
    push('⭐', s.name || '技能练习', '练习一次', '技能');
  });
  (DB.memos || []).filter(m => (m.created || '').slice(0, 10) === day).forEach(m => {
    push('🗒️', m.title || '便签', m.body || '', '便签');
  });
  (DB.quotes || []).filter(q => q.date === day).forEach(q => {
    push('✍️', q.text, '', '摘抄');
  });
  return out;
}
