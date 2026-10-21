const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');

const IN_CATS = ['工资', '兼职', '理财', '红包', '其他'];
const EX_CATS = ['餐饮', '交通', '购物', '居住', '娱乐', '学习', '医疗', '人情', '其他'];

Page({
  data: {
    pageStyle: '',
    form: {},
    cats: [],
    modalType: 'expense',
    showModal: false,
    editId: '',
    list: [],
    monthIn: 0,
    monthOut: 0,
    monthNet: 0,
    netSign: '+',
    netCls: 'in-amt',
    totalNet: 0,
    totalSign: '+',
    totalCls: 'in-amt',
    catRows: [],
    goals: [],
    goalForm: {},
    depForm: {},
    depId: '',
    showDep: false
  },

  onLoad() {},
  onUnload() { /* 无定时器需要清理 */ },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  onNav(e) { wx.reLaunch({ url: e.detail.url }); },

  refresh() {
    const DB = store.getDB();
    const mp = u.today().slice(0, 7);
    const sum = arr => arr.reduce((a, b) => a + b.amount, 0);

    const monthIn = sum(DB.finance.filter(f => f.type === 'income' && f.date.slice(0, 7) === mp));
    const monthOut = sum(DB.finance.filter(f => f.type === 'expense' && f.date.slice(0, 7) === mp));
    const allIn = sum(DB.finance.filter(f => f.type === 'income'));
    const allOut = sum(DB.finance.filter(f => f.type === 'expense'));
    const monthNet = monthIn - monthOut;
    const totalNet = allIn - allOut;

    /* 明细：按日期倒序取前 30 条 */
    const list = DB.finance.slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 30)
      .map(f => ({
        id: f.id,
        type: f.type,
        cat: f.cat,
        amount: f.amount,
        sign: f.type === 'income' ? '+' : '−',
        meta: f.date + (f.note ? ' · ' + f.note : '')
      }));

    /* 本月支出分类占比：按金额降序取前 6 */
    const byCat = {};
    DB.finance.forEach(f => {
      if (f.type !== 'expense' || f.date.slice(0, 7) !== mp) return;
      byCat[f.cat] = (byCat[f.cat] || 0) + f.amount;
    });
    const catRows = Object.keys(byCat)
      .map(k => ({ cat: k, amount: byCat[k], pct: monthOut ? Math.round(byCat[k] / monthOut * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    /* 储蓄目标 */
    const goals = DB.goals.map(g => ({
      id: g.id,
      name: g.name,
      target: g.target,
      saved: g.saved,
      pct: g.target ? u.clamp(Math.round(g.saved / g.target * 100), 0, 100) : 0,
      done: !!g.target && g.saved >= g.target
    }));

    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      list,
      catRows,
      goals,
      monthIn,
      monthOut,
      monthNet: Math.abs(monthNet),
      netSign: monthNet >= 0 ? '+' : '−',
      netCls: monthNet >= 0 ? 'in-amt' : 'out-amt',
      totalNet: Math.abs(totalNet),
      totalSign: totalNet >= 0 ? '+' : '−',
      totalCls: totalNet >= 0 ? 'in-amt' : 'out-amt'
    });
  },

  /* ========== 记收入 / 支出 ========== */
  onOpenRec(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      showModal: true,
      modalType: type,
      editId: '',
      cats: type === 'income' ? IN_CATS : EX_CATS,
      form: { amount: '', catIdx: 0, date: u.today(), note: '' }
    });
  },
  onEditRec(e) {
    const id = e.currentTarget.dataset.id;
    const rec = store.getDB().finance.find(x => x.id === id);
    if (!rec) return;
    const cats = rec.type === 'income' ? IN_CATS : EX_CATS;
    this.setData({
      showModal: true,
      modalType: rec.type,
      editId: id,
      cats,
      form: { amount: String(rec.amount), catIdx: Math.max(0, cats.indexOf(rec.cat)), date: rec.date, note: rec.note || '' }
    });
  },
  closeModal() { this.setData({ showModal: false }); },
  onFormAmount(e) { this.setData({ 'form.amount': e.detail.value }); },
  onFormAmountBlur(e) { this.setData({ 'form.amount': e.detail.value }); },
  onFormNote(e) { this.setData({ 'form.note': e.detail.value }); },
  onFormNoteBlur(e) { this.setData({ 'form.note': e.detail.value }); },
  /* 分类选择：兼容按钮组（dataset.i）与旧 picker（detail.value）两种事件 */
  onPickCat(e) {
    const raw = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.i !== undefined
      ? e.currentTarget.dataset.i
      : (e && e.detail && e.detail.value);
    const i = Number(raw);
    this.setData({ 'form.catIdx': isNaN(i) || i < 0 ? 0 : i });
  },
  onPickDate(e) { this.setData({ 'form.date': e.detail.value }); },
  submitModal(e) {
    const fv = (e && e.detail && e.detail.value) || {};
    const f = Object.assign({}, this.data.form || {}, fv);
    const amount = Number(f.amount);
    if (!amount || amount <= 0) { wx.showToast({ title: '请输入金额', icon: 'none' }); return; }
    const cats = this.data.cats;
    const DB = store.getDB();
    const payload = {
      type: this.data.modalType,
      amount: Math.round(amount * 100) / 100,
      cat: cats[f.catIdx || 0],
      note: (f.note || '').trim(),
      date: f.date || u.today()
    };
    if (this.data.editId) {
      store.updateItem('finance', this.data.editId, payload);
      this.closeModal();
      this.refresh();
      wx.showToast({ title: '已修改 ✓', icon: 'none' });
      return;
    }
    DB.finance.push(Object.assign({ id: u.uid() }, payload));
    store.save();
    this.closeModal();
    this.refresh();
    wx.showToast({ title: (this.data.modalType === 'income' ? '收入' : '支出') + '已记账 💰', icon: 'none' });
  },

  onDel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条记账记录吗？',
      confirmColor: '#F2689A',
      success: (res) => {
        if (!res.confirm) return;
        const DB = store.getDB();
        DB.finance = DB.finance.filter(x => x.id !== id);
        store.save();
        this.refresh();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  /* ========== 储蓄目标 ========== */
  onFormGoalName(e) { this.setData({ 'goalForm.name': e.detail.value }); },
  onFormGoalNameBlur(e) { this.setData({ 'goalForm.name': e.detail.value }); },
  onFormGoalTarget(e) { this.setData({ 'goalForm.target': e.detail.value }); },
  onFormGoalTargetBlur(e) { this.setData({ 'goalForm.target': e.detail.value }); },
  onAddGoal() {
    const name = (this.data.goalForm.name || '').trim();
    const target = Number(this.data.goalForm.target);
    if (!name) { wx.showToast({ title: '请输入目标名称', icon: 'none' }); return; }
    if (!target || target <= 0) { wx.showToast({ title: '请输入目标金额', icon: 'none' }); return; }
    const DB = store.getDB();
    DB.goals.push({ id: u.uid(), name: name, target: Math.round(target), saved: 0 });
    store.save();
    this.setData({ goalForm: {} });
    this.refresh();
    wx.showToast({ title: '目标添加成功 🎯', icon: 'none' });
  },

  onOpenDep(e) {
    this.setData({ showDep: true, depId: e.currentTarget.dataset.id, depForm: { amount: '' } });
  },
  closeDep() { this.setData({ showDep: false }); },
  onMaskTap(e) {
    if (e && e.target === e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.key) {
      const k = e.currentTarget.dataset.key;
      this.setData({ [k]: false });
    }
  },
  onFormDepAmount(e) { this.setData({ 'depForm.amount': e.detail.value }); },
  onFormDepAmountBlur(e) { this.setData({ 'depForm.amount': e.detail.value }); },
  submitDep(e) {
    const fv = (e && e.detail && e.detail.value) || {};
    const f = Object.assign({}, this.data.depForm || {}, fv);
    const amount = Number(f.amount);
    if (!amount || amount <= 0) { wx.showToast({ title: '请输入存入金额', icon: 'none' }); return; }
    const DB = store.getDB();
    const g = DB.goals.find(x => x.id === this.data.depId);
    if (!g) return;
    g.saved = Math.round((g.saved + amount) * 100) / 100;
    store.save();
    this.closeDep();
    this.refresh();
    wx.showToast({ title: g.saved >= g.target ? '目标达成！🎉 已存入 ¥' + amount : '已存入 ¥' + amount, icon: 'none' });
  },

  onDelGoal(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除目标',
      content: '确定删除这个储蓄目标吗？',
      confirmColor: '#F2689A',
      success: (res) => {
        if (!res.confirm) return;
        const DB = store.getDB();
        DB.goals = DB.goals.filter(x => x.id !== id);
        store.save();
        this.refresh();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },

  onShareAppMessage() { return { title: '小宝工作台', path: '/pages/home/home' }; }
});
