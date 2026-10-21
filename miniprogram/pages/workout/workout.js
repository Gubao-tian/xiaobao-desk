const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');

const TYPES = [
  { key: 'walk', name: '散步', emoji: '🚶', k: 3 },
  { key: 'run', name: '跑步', emoji: '🏃', k: 9 },
  { key: 'yoga', name: '瑜伽', emoji: '🧘', k: 4 },
  { key: 'strength', name: '力量', emoji: '🏋️', k: 7 },
  { key: 'cycle', name: '骑行', emoji: '🚴', k: 7 },
  { key: 'swim', name: '游泳', emoji: '🏊', k: 8 },
  { key: 'rope', name: '跳绳', emoji: '🪢', k: 11 },
  { key: 'dance', name: '跳舞', emoji: '💃', k: 6 },
  { key: 'stretch', name: '拉伸', emoji: '🤸', k: 2.5 },
  { key: 'ball', name: '球类', emoji: '🏸', k: 7 }
];
const HEAT_COLORS = ['#F6ECF1', '#FFE3EF', '#FFC2D8', '#FF9CC0', '#F2689A'];

Page({
  data: {
    pageStyle: '',
    form: {},
    showModal: false,
    editId: '',
    types: TYPES,
    heatColors: HEAT_COLORS,
    selType: 'walk',
    selName: '散步',
    todayMin: 0,
    todayBurn: 0,
    weekMin: 0,
    streak: 0,
    logs: [],
    heat: []
  },

  onLoad() {},
  onUnload() { /* 无定时器需要清理 */ },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  onNav(e) { wx.reLaunch({ url: e.detail.url }); },

  refresh() {
    const DB = store.getDB();
    const t = u.today();
    const list = DB.workout[t] || [];

    /* 今日统计 */
    const todayMin = list.reduce((a, b) => a + b.min, 0);
    const todayBurn = list.reduce((a, b) => a + b.burn, 0);

    /* 本周累计分钟 */
    const wStart = u.weekRange()[0];
    let weekMin = 0;
    for (let i = 0; i < 7; i++) {
      weekMin += (DB.workout[u.dateAdd(wStart, i)] || []).reduce((a, b) => a + b.min, 0);
    }

    /* 连续运动天数：从 today 或昨天往前数 */
    let streak = 0;
    let d = u.today();
    if (!(DB.workout[d] || []).length) d = u.dateAdd(d, -1);
    while ((DB.workout[d] || []).length) { streak++; d = u.dateAdd(d, -1); }

    /* 运动类型九宫格（含今日次数） */
    const types = TYPES.map(ty => ({
      key: ty.key,
      name: ty.name,
      emoji: ty.emoji,
      k: ty.k,
      n: list.filter(x => !x.custom && x.type === ty.name).length,
      on: ty.key === this.data.selType
    }));

    /* 今日记录（最新在上） */
    const logs = list.map(x => {
      const ty = TYPES.find(tt => tt.name === x.type);
      return {
        id: x.id,
        emoji: x.custom ? '✨' : (ty ? ty.emoji : '🏅'),
        name: x.type,
        min: x.min,
        burn: x.burn
      };
    }).reverse();

    /* 近 30 天热力图：按分钟数分 5 级 */
    const days = u.lastNDays(30);
    const vals = days.map(d => (DB.workout[d] || []).reduce((a, b) => a + b.min, 0));
    const max = Math.max.apply(null, vals.concat([1]));
    const lvOf = v => v === 0 ? 0 : v <= max * 0.25 ? 1 : v <= max * 0.5 ? 2 : v <= max * 0.75 ? 3 : 4;
    const heat = days.map((d, i) => ({
      day: u.parseD(d).getDate(),
      lv: lvOf(vals[i]),
      bg: HEAT_COLORS[lvOf(vals[i])],
      today: d === t
    }));

    const sel = TYPES.find(ty => ty.key === this.data.selType) || TYPES[0];
    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      types,
      selName: sel.name,
      todayMin,
      todayBurn,
      weekMin,
      streak,
      logs,
      heat
    });
  },

  /* 选择运动类型 */
  onPickType(e) {
    const key = e.currentTarget.dataset.key;
    const ty = TYPES.find(x => x.key === key);
    this.setData({ selType: key, selName: ty ? ty.name : '' });
    this.refresh();
  },

  /* 记录一次运动 */
  onFormMin(e) { this.setData({ 'form.min': e.detail.value }); },
  onFormMinBlur(e) { this.setData({ 'form.min': e.detail.value }); },
  onRecord() {
    const ty = TYPES.find(x => x.key === this.data.selType);
    if (!ty) { wx.showToast({ title: '请先选择运动类型', icon: 'none' }); return; }
    const min = Number(this.data.form.min);
    if (!min || min <= 0) { wx.showToast({ title: '请输入运动分钟数', icon: 'none' }); return; }
    const DB = store.getDB();
    const t = u.today();
    const m = Math.round(min);
    const burn = Math.round(m * ty.k);
    if (!DB.workout[t]) DB.workout[t] = [];
    DB.workout[t].push({ id: u.uid(), type: ty.name, min: m, burn, custom: false });
    store.save();
    this.setData({ 'form.min': '' });
    this.refresh();
    wx.showToast({ title: '已记录 ' + ty.name + ' ' + m + ' 分钟，消耗 ' + burn + ' 千卡 🔥', icon: 'none' });
  },

  /* 删除记录 */
  onDel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条运动记录吗？',
      confirmColor: '#F2689A',
      success: (res) => {
        if (!res.confirm) return;
        const DB = store.getDB();
        const t = u.today();
        DB.workout[t] = (DB.workout[t] || []).filter(x => x.id !== id);
        store.save();
        this.refresh();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  /* 自定义运动弹层（新增 / 编辑） */
  openModal(rec) {
    if (rec && rec.id) {
      this.setData({ showModal: true, editId: rec.id, 'form.cname': rec.type, 'form.cmin': String(rec.min) });
    } else {
      this.setData({ showModal: true, editId: '', 'form.cname': '', 'form.cmin': '' });
    }
  },
  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const DB = store.getDB();
    const rec = (DB.workout[u.today()] || []).find(x => x.id === id);
    if (rec) this.openModal(rec);
  },
  closeModal() { this.setData({ showModal: false }); },
  onMaskTap(e) {
    if (e && e.target === e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.key) {
      const k = e.currentTarget.dataset.key;
      this.setData({ [k]: false });
    }
  },
  onFormCName(e) { this.setData({ 'form.cname': e.detail.value }); },
  onFormCNameBlur(e) { this.setData({ 'form.cname': e.detail.value }); },
  onFormCMin(e) { this.setData({ 'form.cmin': e.detail.value }); },
  onFormCMinBlur(e) { this.setData({ 'form.cmin': e.detail.value }); },
  submitModal() {
    const name = (this.data.form.cname || '').trim();
    const min = Number(this.data.form.cmin);
    if (!name) { wx.showToast({ title: '请输入运动名称', icon: 'none' }); return; }
    if (!min || min <= 0) { wx.showToast({ title: '请输入运动分钟数', icon: 'none' }); return; }
    const DB = store.getDB();
    const t = u.today();
    const m = Math.round(min);
    const burn = Math.round(m * 5);
    if (this.data.editId) {
      store.updateDayItem('workout', t, this.data.editId, { type: name, min: m, burn, custom: true });
      this.setData({ showModal: false, editId: '' });
      this.refresh();
      wx.showToast({ title: '已修改 ✓', icon: 'none' });
      return;
    }
    if (!DB.workout[t]) DB.workout[t] = [];
    DB.workout[t].push({ id: u.uid(), type: name, min: m, burn, custom: true });
    store.save();
    this.closeModal();
    this.refresh();
    wx.showToast({ title: '已记录「' + name + '」' + m + ' 分钟 🔥', icon: 'none' });
  },

  onShareAppMessage() { return { title: '小宝工作台', path: '/pages/home/home' }; }
});
