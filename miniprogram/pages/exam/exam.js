const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');

Page({
  data: {
    pageStyle: '',
    form: {},
    showModal: false,
    modalTitle: '添加科目',
    editId: '',
    exams: [],
    countdown: [],
    examN: 0,
    sumTotal: 0,
    sumDone: 0,
    pctAll: 0
  },

  onLoad() {},
  onUnload() { /* 无定时器需要清理 */ },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  onNav(e) { wx.reLaunch({ url: e.detail.url }); },

  refresh() {
    const DB = store.getDB();
    const t = u.today();
    const exams = DB.exam.map(x => {
      const left = u.daysBetween(t, x.examDate);
      return {
        id: x.id,
        name: x.name,
        examDate: x.examDate,
        total: x.total,
        done: x.done,
        unit: x.unit || '章',
        left: left,
        leftText: left < 0 ? '已结束' : (left === 0 ? '就是今天' : '剩 ' + left + ' 天'),
        urgent: left >= 0 && left <= 7,
        pct: x.total ? u.clamp(Math.round(x.done / x.total * 100), 0, 100) : 0,
        dateText: x.examDate.replace(/-/g, '/')
      };
    });
    /* 倒计时卡：按 examDate 升序取前 3 个 */
    const countdown = exams.slice()
      .sort((a, b) => a.examDate.localeCompare(b.examDate))
      .slice(0, 3)
      .map(x => ({
        id: x.id,
        name: x.name,
        numText: x.left < 0 ? '已结束' : (x.left === 0 ? '今天' : x.left + ' 天')
      }));
    const sumTotal = DB.exam.reduce((a, x) => a + (x.total || 0), 0);
    const sumDone = DB.exam.reduce((a, x) => a + (x.done || 0), 0);

    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      exams,
      countdown,
      examN: DB.exam.length,
      sumTotal,
      sumDone,
      pctAll: sumTotal ? Math.round(sumDone / sumTotal * 100) : 0
    });
  },

  /* 加减一章进度 */
  onStep(e) {
    const DB = store.getDB();
    const id = e.currentTarget.dataset.id;
    const dir = Number(e.currentTarget.dataset.dir);
    const x = DB.exam.find(y => y.id === id);
    if (!x) return;
    x.done = u.clamp(x.done + dir, 0, x.total);
    store.save();
    this.refresh();
    if (dir > 0 && x.done >= x.total) {
      wx.showToast({ title: '《' + x.name + '》已全部学完，太棒啦！🎉', icon: 'none' });
    }
  },

  onDel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除科目',
      content: '确定删除这个备考科目吗？学习进度也会一起删除哦',
      confirmColor: '#F2689A',
      success: (res) => {
        if (!res.confirm) return;
        const DB = store.getDB();
        DB.exam = DB.exam.filter(x => x.id !== id);
        store.save();
        this.refresh();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  /* 添加/编辑科目弹层 */
  openModal(e) {
    if (e && e.id) {
      this.setData({
        showModal: true,
        modalTitle: '编辑科目',
        editId: e.id,
        form: { name: e.name, date: e.examDate, total: e.total, unit: e.unit || '' }
      });
    } else {
      this.setData({
        showModal: true,
        modalTitle: '添加科目',
        editId: '',
        form: { name: '', date: u.dateAdd(u.today(), 60), total: '', unit: '' }
      });
    }
  },
  onEditExam(e) {
    const id = e.currentTarget.dataset.id;
    const x = store.getDB().exam.find(y => y.id === id);
    if (x) this.openModal(x);
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
  onFormUnit(e) { this.setData({ 'form.unit': e.detail.value }); },
  onFormUnitBlur(e) { this.setData({ 'form.unit': e.detail.value }); },
  onPickDate(e) { this.setData({ 'form.date': e.detail.value }); },
  submitModal(e) {
    const fv = (e && e.detail && e.detail.value) || {};
    const f = Object.assign({}, this.data.form || {}, fv);
    const name = (f.name || '').trim();
    const total = Number(f.total);
    if (!name) { wx.showToast({ title: '请输入科目名称', icon: 'none' }); return; }
    if (!total || total <= 0) { wx.showToast({ title: '请输入总章节数', icon: 'none' }); return; }
    const DB = store.getDB();
    if (this.data.editId) {
      store.updateItem('exam', this.data.editId, {
        name: name,
        examDate: f.date || u.dateAdd(u.today(), 60),
        total: Math.round(total),
        unit: (f.unit || '').trim() || '章'
      });
      this.closeModal();
      this.refresh();
      wx.showToast({ title: '已修改 ✓', icon: 'none' });
      return;
    }
    DB.exam.push({
      id: u.uid(),
      name: name,
      examDate: f.date || u.dateAdd(u.today(), 60),
      total: Math.round(total),
      done: 0,
      unit: (f.unit || '').trim() || '章'
    });
    store.save();
    this.closeModal();
    this.refresh();
    wx.showToast({ title: '科目添加成功 📖', icon: 'none' });
  },

  onShareAppMessage() { return { title: '小宝工作台', path: '/pages/home/home' }; }
});
