const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');

/* 书籍状态：在读 / 想读 / 已读完 */
const STATUS = [
  { v: 'reading', t: '在读' },
  { v: 'todo', t: '想读' },
  { v: 'done', t: '已读完' }
];

Page({
  data: {
    pageStyle: '',
    books: [],
    doneN: 0,
    readingN: 0,
    todayMin: 0,
    quotes: [],
    statusTexts: ['在读', '想读', '已读完'],
    statusIdx: 0,
    form: {},
    showModal: false,
    modalTitle: '添加书籍',
    editId: '',
    logFocus: false
  },

  onLoad() {},
  onUnload() { /* 无定时器需要清理 */ },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },

  /* 从 store.getDB() 读取数据，计算后写入界面 */
  refresh() {
    const DB = store.getDB();
    const t = u.today();
    const books = (DB.books || []).map(b => {
      const total = Number(b.total) || 0;
      let page = Number(b.page) || 0;
      if (total > 0 && page > total) page = total;
      const pct = total > 0 ? Math.round(page / total * 100) : 0;
      const st = STATUS.find(s => s.v === b.status) || STATUS[1];
      return {
        id: b.id, title: b.title, author: b.author, total, page, pct,
        status: b.status, statusText: st.t,
        pillCls: b.status === 'done' ? 'mint' : b.status === 'todo' ? 'lemon' : ''
      };
    });
    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      books,
      doneN: (DB.books || []).filter(b => b.status === 'done').length,
      readingN: (DB.books || []).filter(b => b.status === 'reading').length,
      todayMin: DB.readLog[t] || 0,
      quotes: (DB.quotes || []).slice().reverse()
    });
  },

  /* ============ 书架 ============ */
  openAdd() {
    const pages = (this.data.form && this.data.form.pages) || {};
    this.setData({
      showModal: true,
      modalTitle: '添加书籍',
      editId: '',
      statusIdx: 0,
      form: { title: '', author: '', total: '', status: 'reading', pages }
    });
  },
  onEditBook(e) {
    const id = e.currentTarget.dataset.id;
    const DB = store.getDB();
    const b = (DB.books || []).find(x => x.id === id);
    if (!b) return;
    const si = STATUS.findIndex(s => s.v === b.status);
    this.setData({
      showModal: true,
      modalTitle: '编辑书籍',
      editId: id,
      statusIdx: si < 0 ? 0 : si,
      form: {
        title: b.title, author: b.author || '',
        total: b.total ? String(b.total) : '', status: b.status || 'reading'
      }
    });
  },
  closeModal() { this.setData({ showModal: false }); },
  /* 遮罩点击：只有"直接点到遮罩背景"才关闭；点到输入框/按钮（target≠currentTarget）
     不关闭——避免点输入框的 tap 冒泡到遮罩误触发关闭（旧版在某些微信版本会这样） */
  onMaskTap(e) {
    if (e && e.target === e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.key) {
      const k = e.currentTarget.dataset.key;
      this.setData({ [k]: false });
    }
  },
  onFormTitle(e) { this.setData({ 'form.title': e.detail.value }); },
  onFormTitleBlur(e) { this.setData({ 'form.title': e.detail.value }); },
  /* 联网搜书：小程序不能直接打开外部浏览器，复制「书名 + 豆瓣」关键词，
     用户去微信/浏览器粘贴搜索即可查到作者、页数等信息 */
  onSearchBook() {
    const kw = (this.data.form.title || '').trim();
    if (!kw) { wx.showToast({ icon: 'none', title: '先输入书名再搜索' }); return; }
    wx.setClipboardData({
      data: kw + ' 豆瓣 图书',
      success: () => wx.showToast({ icon: 'none', title: '已复制，去微信/浏览器粘贴搜索' })
    });
  },
  onFormAuthor(e) { this.setData({ 'form.author': e.detail.value }); },
  onFormAuthorBlur(e) { this.setData({ 'form.author': e.detail.value }); },
  onFormTotal(e) { this.setData({ 'form.total': e.detail.value }); },
  onFormTotalBlur(e) { this.setData({ 'form.total': e.detail.value }); },
  onStatusChange(e) {
    /* 兼容按钮组（dataset.i）与旧 picker（detail.value） */
    const raw = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.i !== undefined
      ? e.currentTarget.dataset.i
      : (e && e.detail && e.detail.value);
    const i = Number(raw);
    if (isNaN(i) || !STATUS[i]) return;
    this.setData({ statusIdx: i, 'form.status': STATUS[i].v });
  },
  /* form 组件提交：e.detail.value 一次性拿到所有 input 当前值，规避 blur/tap 时序竞态 */
  submitModal(e) {
    const fv = (e && e.detail && e.detail.value) || {};
    const f = Object.assign({}, this.data.form || {}, fv);
    const title = (f.title || '').trim();
    if (!title) { wx.showToast({ title: '请输入书名', icon: 'none' }); return; }
    const DB = store.getDB();
    const total = Math.max(0, parseInt(f.total, 10) || 0);
    if (this.data.editId) {
      store.updateItem('books', this.data.editId, {
        title,
        author: (f.author || '').trim(),
        total,
        status: f.status || 'reading'
      });
      this.setData({ showModal: false, editId: '' });
      wx.showToast({ title: '已修改 ✓', icon: 'none' });
      this.refresh();
      return;
    }
    DB.books.push({
      id: u.uid(),
      title,
      author: (f.author || '').trim(),
      total,
      page: 0,
      status: f.status || 'reading'
    });
    store.save();
    this.setData({ showModal: false });
    wx.showToast({ title: '已加入书架 📚', icon: 'none' });
    this.refresh();
  },

  onPageInput(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ ['form.pages.' + id]: e.detail.value });
  },
  onPageBlur(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ ['form.pages.' + id]: e.detail.value });
  },
  onUpdatePage(e) {
    const id = e.currentTarget.dataset.id;
    const DB = store.getDB();
    const b = DB.books.find(x => x.id === id);
    if (!b) return;
    const pages = (this.data.form && this.data.form.pages) || {};
    const v = parseInt(pages[id], 10);
    if (isNaN(v) || v <= 0) { wx.showToast({ title: '请输入本次阅读的页数', icon: 'none' }); return; }
    /* 累加：输入的是「本次读了多少页」，叠加到当前页码，封顶总页数 */
    const before = b.page || 0;
    b.page = b.total > 0 ? Math.min(before + v, b.total) : before + v;
    const added = b.page - before;
    if (b.total > 0 && b.page >= b.total && b.status !== 'done') {
      b.status = 'done';
      wx.showToast({ title: '本次读了 ' + added + ' 页，恭喜读完《' + b.title + '》🎉', icon: 'none' });
    } else {
      wx.showToast({ title: '已累加 ' + added + ' 页，读到 ' + b.page + '/' + b.total + ' 页', icon: 'none' });
    }
    this.setData({ ['form.pages.' + id]: '' });
    store.save();
    this.refresh();
  },
  onToggleDone(e) {
    const id = e.currentTarget.dataset.id;
    const DB = store.getDB();
    const b = DB.books.find(x => x.id === id);
    if (!b) return;
    if (b.status === 'done') {
      b.status = 'reading';
      if (b.total > 0 && b.page >= b.total) b.page = Math.max(0, b.total - 1);
      wx.showToast({ title: '已标记为未读完', icon: 'none' });
    } else {
      b.status = 'done';
      if (b.total > 0) b.page = b.total;
      wx.showToast({ title: '恭喜读完《' + b.title + '》🎉', icon: 'none' });
    }
    store.save();
    this.refresh();
  },
  onDelBook(e) {
    const id = e.currentTarget.dataset.id;
    const DB = store.getDB();
    const b = DB.books.find(x => x.id === id);
    wx.showModal({
      title: '删除书籍',
      content: '确定删除《' + (b ? b.title : '') + '》吗？',
      confirmColor: '#F2689A',
      success: res => {
        if (!res.confirm) return;
        const i = DB.books.findIndex(x => x.id === id);
        if (i > -1) DB.books.splice(i, 1);
        store.save();
        wx.showToast({ title: '已删除', icon: 'none' });
        this.refresh();
      }
    });
  },

  /* ============ 阅读时长 ============ */
  onMinInput(e) { this.setData({ 'form.minutes': e.detail.value }); },
  /* 失焦提交：既补全 bindinput 可能未同步的末字符，也一并收起焦点 */
  onMinInputBlur(e) { this.setData({ 'form.minutes': e.detail.value, logFocus: false }); },
  onFocusLog() {
    this.setData({ logFocus: true });
    wx.showToast({ title: '请输入分钟数，回车即提交', icon: 'none' });
  },
  onLogConfirm() { this.addMinutes(parseInt((this.data.form && this.data.form.minutes), 10)); },
  onQuick30() { this.addMinutes(30); },
  addMinutes(m) {
    if (isNaN(m) || m <= 0) { wx.showToast({ title: '请输入有效分钟数', icon: 'none' }); return; }
    const DB = store.getDB();
    const t = u.today();
    DB.readLog[t] = (DB.readLog[t] || 0) + m;
    this.setData({ 'form.minutes': '', logFocus: false });
    store.save();
    wx.showToast({ title: '已记录 ' + m + ' 分钟 📖', icon: 'none' });
    this.refresh();
  },

  /* ============ 摘抄本 ============ */
  onQuoteInput(e) { this.setData({ 'form.quote': e.detail.value }); },
  onQuoteInputBlur(e) { this.setData({ 'form.quote': e.detail.value }); },
  onAddQuote() {
    const text = ((this.data.form && this.data.form.quote) || '').trim();
    if (!text) { wx.showToast({ title: '先写点什么吧', icon: 'none' }); return; }
    const DB = store.getDB();
    DB.quotes.push({ id: u.uid(), text, date: u.today() });
    this.setData({ 'form.quote': '' });
    store.save();
    wx.showToast({ title: '已收录摘抄 ✍️', icon: 'none' });
    this.refresh();
  },
  onDelQuote(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除摘抄',
      content: '确定删除这条摘抄吗？',
      confirmColor: '#F2689A',
      success: res => {
        if (!res.confirm) return;
        const DB = store.getDB();
        const i = DB.quotes.findIndex(x => x.id === id);
        if (i > -1) DB.quotes.splice(i, 1);
        store.save();
        wx.showToast({ title: '已删除', icon: 'none' });
        this.refresh();
      }
    });
  },

  onNav(e) { wx.reLaunch({ url: e.detail.url }); },
  onShareAppMessage() { return { title: '小宝工作台', path: '/pages/home/home' }; }
});
