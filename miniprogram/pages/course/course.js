const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');

const COLORS = ['#FF8FB8', '#B79BEF', '#8ED8C0', '#9ECDF5', '#FFD98E', '#FFA98F'];

Page({
  data: {
    pageStyle: '',
    form: {},
    colors: COLORS,
    colorIdx: 0,
    showModal: false,
    modalTitle: '添加课程',
    editId: '',
    courses: [],
    courseN: 0,
    todayMin: 0,
    totalHour: 0,
    avgProg: 0,
    bars: [],
    weekMin: 0,
    streak: 0
  },

  onLoad() {},
  onUnload() { /* 无定时器需要清理 */ },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  onNav(e) { wx.reLaunch({ url: e.detail.url }); },

  refresh() {
    const DB = store.getDB();
    const t = u.today();
    const courses = DB.courses.map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      total: c.total,
      progress: c.progress,
      initial: (c.name || '课').trim().charAt(0) || '课',
      noteText: c.note ? ' · ' + c.note : ''
    }));
    const totalMin = Object.keys(DB.studyLog).reduce((a, k) => a + (DB.studyLog[k] || 0), 0);

    /* 近 7 天学习时长柱状图 */
    const days = u.lastNDays(7);
    const vals = days.map(d => DB.studyLog[d] || 0);
    const max = Math.max.apply(null, vals.concat([1]));
    const bars = days.map((d, i) => ({
      w: u.WEEK_CN[u.parseD(d).getDay()],
      v: vals[i],
      h: Math.max(Math.round(vals[i] / max * 100), vals[i] ? 6 : 2),
      today: d === t,
      bg: d === t ? 'linear-gradient(180deg,#FFA6C8,#F2689A)' : 'linear-gradient(180deg,#CDB6F2,#B79BEF)'
    }));

    /* 本周累计分钟 */
    const wStart = u.weekRange()[0];
    let weekMin = 0;
    for (let i = 0; i < 7; i++) weekMin += DB.studyLog[u.dateAdd(wStart, i)] || 0;

    /* 连续学习天数：从 today 或昨天往前数 */
    let streak = 0;
    let d = u.today();
    if (!(DB.studyLog[d] > 0)) d = u.dateAdd(d, -1);
    while (DB.studyLog[d] > 0) { streak++; d = u.dateAdd(d, -1); }

    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      courses,
      courseN: courses.length,
      todayMin: DB.studyLog[t] || 0,
      totalHour: Math.round(totalMin / 60),
      avgProg: courses.length ? Math.round(courses.reduce((a, c) => a + c.progress, 0) / courses.length) : 0,
      bars,
      weekMin,
      streak
    });
  },

  /* 记录学习时长 */
  onFormMin(e) { this.setData({ 'form.min': e.detail.value }); },
  onFormMinBlur(e) { this.setData({ 'form.min': e.detail.value }); },
  onLogStudy() {
    const v = Number(this.data.form.min);
    if (!v || v <= 0) { wx.showToast({ title: '请输入学习分钟数', icon: 'none' }); return; }
    const DB = store.getDB();
    const t = u.today();
    const m = Math.round(v);
    DB.studyLog[t] = (DB.studyLog[t] || 0) + m;
    store.save();
    this.setData({ 'form.min': '' });
    this.refresh();
    wx.showToast({ title: '已记录 ' + m + ' 分钟 📚', icon: 'none' });
  },

  /* 加减一节进度 */
  onStep(e) {
    const DB = store.getDB();
    const id = e.currentTarget.dataset.id;
    const dir = Number(e.currentTarget.dataset.dir);
    const c = DB.courses.find(x => x.id === id);
    if (!c) return;
    const step = Math.round(100 / c.total);
    c.progress = u.clamp(c.progress + dir * step, 0, 100);
    store.save();
    this.refresh();
    if (dir > 0 && c.progress >= 100) {
      wx.showToast({ title: '《' + c.name + '》已全部学完，太棒啦！🎉', icon: 'none' });
    }
  },

  onDel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除课程',
      content: '确定删除这门课程吗？删除后学习进度也会消失哦',
      confirmColor: '#F2689A',
      success: (res) => {
        if (!res.confirm) return;
        const DB = store.getDB();
        DB.courses = DB.courses.filter(x => x.id !== id);
        store.save();
        this.refresh();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  /* 添加/编辑课程弹层 */
  openModal(c) {
    if (c && c.id) {
      const idx = COLORS.indexOf(c.color);
      this.setData({
        showModal: true,
        modalTitle: '编辑课程',
        editId: c.id,
        colorIdx: idx < 0 ? 0 : idx,
        form: { name: c.name, total: c.total, note: c.note || '' }
      });
    } else {
      this.setData({ showModal: true, modalTitle: '添加课程', editId: '', colorIdx: 0, form: {} });
    }
  },
  onEditCourse(e) {
    const id = e.currentTarget.dataset.id;
    const c = store.getDB().courses.find(x => x.id === id);
    if (c) this.openModal(c);
  },
  closeModal() { this.setData({ showModal: false }); },
  onMaskTap(e) {
    if (e && e.target === e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.key) {
      const k = e.currentTarget.dataset.key;
      this.setData({ [k]: false });
    }
  },
  onFormName(e) { this.setData({ 'form.name': e.detail.value }); },
  onFormNameBlur(e) { this.setData({ 'form.name': e.detail.value }); },
  onFormTotal(e) { this.setData({ 'form.total': e.detail.value }); },
  onFormTotalBlur(e) { this.setData({ 'form.total': e.detail.value }); },
  onFormNote(e) { this.setData({ 'form.note': e.detail.value }); },
  onFormNoteBlur(e) { this.setData({ 'form.note': e.detail.value }); },
  onPickColor(e) { this.setData({ colorIdx: Number(e.currentTarget.dataset.idx) }); },
  submitModal(e) {
    const fv = (e && e.detail && e.detail.value) || {};
    const f = Object.assign({}, this.data.form || {}, fv);
    const name = (f.name || '').trim();
    const total = Number(f.total);
    if (!name) { wx.showToast({ title: '请输入课程名称', icon: 'none' }); return; }
    if (!total || total <= 0) { wx.showToast({ title: '请输入总节数', icon: 'none' }); return; }
    const DB = store.getDB();
    if (this.data.editId) {
      store.updateItem('courses', this.data.editId, {
        name,
        color: COLORS[this.data.colorIdx],
        total: Math.round(total),
        note: (f.note || '').trim()
      });
      this.closeModal();
      this.refresh();
      wx.showToast({ title: '已修改 ✓', icon: 'none' });
      return;
    }
    DB.courses.push({
      id: u.uid(),
      name,
      color: COLORS[this.data.colorIdx],
      total: Math.round(total),
      progress: 0,
      note: (f.note || '').trim()
    });
    store.save();
    this.closeModal();
    this.refresh();
    wx.showToast({ title: '课程添加成功 📚', icon: 'none' });
  },

  onShareAppMessage() { return { title: '小宝工作台', path: '/pages/home/home' }; }
});
