const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');

const PRIOS = [
  { key: 'high', label: '重要', dot: '#F2689A' },
  { key: 'mid', label: '普通', dot: '#9ECDF5' },
  { key: 'low', label: '简单', dot: '#8ED8C0' }
];
const SLOTS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '21:30'];

Page({
  data: {
    pageStyle: '',
    form: {},
    editId: '',
    prioIdx: 1,
    prioLabels: PRIOS.map(p => p.label),
    plans: [],
    doneN: 0,
    todoN: 0,
    pct: 0,
    prioDist: [],
    timeline: []
  },

  onLoad() {},
  onUnload() { /* 无定时器需要清理 */ },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  onNav(e) { wx.reLaunch({ url: e.detail.url }); },

  refresh() {
    const DB = store.getDB();
    const t = u.today();
    const plans = DB.plans[t] || [];
    const total = plans.length;
    const doneN = plans.filter(x => x.done).length;
    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      plans,
      doneN,
      todoN: total - doneN,
      pct: total ? Math.round(doneN / total * 100) : 0,
      prioDist: PRIOS.map(p => {
        const n = plans.filter(x => x.prio === p.key).length;
        return { key: p.key, label: p.label, dot: p.dot, n, pct: total ? Math.round(n / total * 100) : 0 };
      }),
      timeline: plans.slice(0, SLOTS.length).map((x, i) => ({
        id: x.id,
        name: x.name,
        done: x.done,
        time: SLOTS[i]
      }))
    });
  },

  onFormName(e) { this.setData({ 'form.name': e.detail.value }); },

  onFormNameBlur(e) { this.setData({ 'form.name': e.detail.value }); },
  onPrioChange(e) {
    /* 兼容按钮组（dataset.i）与旧 picker（detail.value） */
    const raw = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.i !== undefined
      ? e.currentTarget.dataset.i
      : (e && e.detail && e.detail.value);
    const idx = Number(raw);
    if (isNaN(idx) || !PRIOS[idx]) return;
    this.setData({ prioIdx: idx, 'form.prio': PRIOS[idx].key });
  },
  onAddPlan() {
    const name = (this.data.form.name || '').trim();
    if (!name) { wx.showToast({ title: '先输入任务名称哦', icon: 'none' }); return; }
    const DB = store.getDB();
    const t = u.today();
    if (this.data.editId) {
      store.updateDayItem('plans', t, this.data.editId, { name, prio: this.data.form.prio || 'mid' });
      this.setData({ editId: '', 'form.name': '' });
      this.refresh();
      wx.showToast({ title: '已修改 ✓', icon: 'none' });
      return;
    }
    if (!DB.plans[t]) DB.plans[t] = [];
    DB.plans[t].push({ id: u.uid(), name, done: false, prio: this.data.form.prio || 'mid' });
    store.save();
    this.setData({ 'form.name': '' });
    this.refresh();
    wx.showToast({ title: '已添加到今天 📅', icon: 'none' });
  },
  onEditPlan(e) {
    const id = e.currentTarget.dataset.id;
    const DB = store.getDB();
    const t = u.today();
    const it = (DB.plans[t] || []).find(x => x.id === id);
    if (!it) return;
    const idx = PRIOS.findIndex(p => p.key === it.prio);
    this.setData({
      editId: id,
      'form.name': it.name,
      prioIdx: idx < 0 ? 1 : idx,
      'form.prio': it.prio || 'mid'
    });
  },
  onCancelEdit() {
    this.setData({ editId: '', 'form.name': '', 'form.prio': 'mid', prioIdx: 1 });
  },

  onToggle(e) {
    const DB = store.getDB();
    const t = u.today();
    const list = DB.plans[t] || [];
    const it = list.find(x => x.id === e.currentTarget.dataset.id);
    if (!it) return;
    it.done = !it.done;
    store.save();
    this.refresh();
    if (it.done && list.length && list.every(x => x.done)) {
      wx.showToast({ title: '今天的任务全部完成！🏆', icon: 'none' });
    }
  },

  onDel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除任务',
      content: '确定删除这条任务吗？删除后不可恢复哦',
      confirmColor: '#F2689A',
      success: (res) => {
        if (!res.confirm) return;
        const DB = store.getDB();
        const t = u.today();
        DB.plans[t] = (DB.plans[t] || []).filter(x => x.id !== id);
        store.save();
        this.refresh();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  onClearDone() {
    const DB = store.getDB();
    const t = u.today();
    const n = (DB.plans[t] || []).filter(x => x.done).length;
    if (!n) { wx.showToast({ title: '当前没有已完成的任务', icon: 'none' }); return; }
    wx.showModal({
      title: '清除已完成',
      content: '将清除今天已完成的 ' + n + ' 条任务，确定吗？',
      confirmColor: '#F2689A',
      success: (res) => {
        if (!res.confirm) return;
        DB.plans[t] = (DB.plans[t] || []).filter(x => !x.done);
        store.save();
        this.refresh();
        wx.showToast({ title: '已清除 ' + n + ' 条任务', icon: 'none' });
      }
    });
  },

  onMoveTomorrow() {
    const DB = store.getDB();
    const t = u.today();
    const rest = (DB.plans[t] || []).filter(x => !x.done);
    if (!rest.length) { wx.showToast({ title: '没有未完成的任务', icon: 'none' }); return; }
    wx.showModal({
      title: '搬到明天',
      content: '将 ' + rest.length + ' 条未完成任务搬到 ' + u.dateAdd(t, 1) + '，确定吗？',
      confirmColor: '#F2689A',
      success: (res) => {
        if (!res.confirm) return;
        const tm = u.dateAdd(t, 1);
        if (!DB.plans[tm]) DB.plans[tm] = [];
        rest.forEach(x => {
          DB.plans[tm].push({ id: u.uid(), name: x.name, done: false, prio: x.prio });
        });
        store.save();
        this.refresh();
        wx.showToast({ title: '已搬到明天 📅', icon: 'none' });
      }
    });
  },

  onShareAppMessage() { return { title: '小宝工作台', path: '/pages/home/home' }; }
});
