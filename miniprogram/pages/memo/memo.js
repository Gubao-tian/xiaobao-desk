const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');

/* 便签颜色：背景 + 边框（边框对应深一档） */
const COLORS = [
  { v: 'pink', t: '粉', bg: '#FFF0F6', bd: '#FFD6E7' },
  { v: 'mint', t: '绿', bg: '#EFFBF6', bd: '#CDEDDF' },
  { v: 'sky', t: '蓝', bg: '#EFF7FE', bd: '#D3E7FA' },
  { v: 'lemon', t: '黄', bg: '#FFFAEF', bd: '#F5E3B8' }
];
const BG = { pink: '#FFF0F6', mint: '#EFFBF6', sky: '#EFF7FE', lemon: '#FFFAEF' };
const BD = { pink: '#FFD6E7', mint: '#CDEDDF', sky: '#D3E7FA', lemon: '#F5E3B8' };
const TABS = [
  { v: 'all', t: '全部' },
  { v: 'pink', t: '粉' },
  { v: 'mint', t: '绿' },
  { v: 'sky', t: '蓝' },
  { v: 'lemon', t: '黄' }
];

Page({
  data: {
    pageStyle: '',
    memos: [],
    tabs: TABS,
    colors: COLORS,
    tab: 'all',
    emptyText: '还没有便签，点击「+ 新建便签」记录第一条吧 🗒️',
    form: {},
    showModal: false,
    modalTitle: '新建便签',
    editId: ''
  },

  onLoad() {},
  onUnload() { /* 无定时器需要清理 */ },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },

  /* 搜索 + 颜色筛选 + 排序（pin 优先，其余 created 倒序） */
  refresh() {
    const DB = store.getDB();
    const kw = ((this.data.form && this.data.form.search) || '').trim().toLowerCase();
    const tab = this.data.tab;
    const list = (DB.memos || []).filter(m => {
      if (tab !== 'all' && m.color !== tab) return false;
      if (kw) {
        const hay = ((m.title || '') + '\n' + (m.body || '')).toLowerCase();
        if (hay.indexOf(kw) === -1) return false;
      }
      return true;
    });
    list.sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.created || 0) - (a.created || 0));
    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      memos: list.map(m => ({
        id: m.id,
        title: m.title,
        body: m.body,
        color: m.color,
        pin: m.pin,
        createdText: u.dstr(new Date(m.created)),
        bg: BG[m.color] || BG.pink,
        bd: BD[m.color] || BD.pink
      })),
      emptyText: (kw || tab !== 'all')
        ? '没有找到匹配的便签，换个条件试试 🔍'
        : '还没有便签，点击「+ 新建便签」记录第一条吧 🗒️'
    });
  },

  /* ============ 工具栏 ============ */
  onSearchInput(e) {
    this.setData({ 'form.search': e.detail.value });
    this.refresh();
  },
  onSearchInputBlur(e) {
    this.setData({ 'form.search': e.detail.value });
    this.refresh();
  },
  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.v });
    this.refresh();
  },

  /* ============ 新建 / 编辑 ============ */
  onNew() {
    this.setData({
      showModal: true,
      modalTitle: '新建便签',
      editId: '',
      'form.title': '',
      'form.body': '',
      'form.color': 'pink'
    });
  },
  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const DB = store.getDB();
    const m = DB.memos.find(x => x.id === id);
    if (!m) return;
    this.setData({
      showModal: true,
      modalTitle: '编辑便签',
      editId: id,
      'form.title': m.title,
      'form.body': m.body,
      'form.color': m.color || 'pink'
    });
  },
  closeModal() { this.setData({ showModal: false }); },
  onMaskTap(e) {
    if (e && e.target === e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.key) {
      const k = e.currentTarget.dataset.key;
      this.setData({ [k]: false });
    }
  },
  onFormTitle(e) { this.setData({ 'form.title': e.detail.value }); },
  onFormTitleBlur(e) { this.setData({ 'form.title': e.detail.value }); },
  onFormBody(e) { this.setData({ 'form.body': e.detail.value }); },
  onFormBodyBlur(e) { this.setData({ 'form.body': e.detail.value }); },
  onPickColor(e) { this.setData({ 'form.color': e.currentTarget.dataset.v }); },
  submitModal(e) {
    const fv = (e && e.detail && e.detail.value) || {};
    const f = Object.assign({}, this.data.form || {}, fv);
    const title = (f.title || '').trim();
    const body = (f.body || '').trim();
    if (!title && !body) { wx.showToast({ title: '写点内容再保存吧', icon: 'none' }); return; }
    const DB = store.getDB();
    if (this.data.editId) {
      const m = DB.memos.find(x => x.id === this.data.editId);
      if (m) {
        m.title = title;
        m.body = body;
        m.color = f.color || 'pink';
      }
      wx.showToast({ title: '便签已更新 ✏️', icon: 'none' });
    } else {
      DB.memos.push({
        id: u.uid(),
        title: title || '无标题便签',
        body,
        color: f.color || 'pink',
        pin: false,
        created: Date.now()
      });
      wx.showToast({ title: '便签已创建 🗒️', icon: 'none' });
    }
    store.save();
    this.setData({ showModal: false, editId: '' });
    this.refresh();
  },

  /* ============ 置顶 / 删除 ============ */
  onTogglePin(e) {
    const id = e.currentTarget.dataset.id;
    const DB = store.getDB();
    const m = DB.memos.find(x => x.id === id);
    if (!m) return;
    m.pin = !m.pin;
    store.save();
    wx.showToast({ title: m.pin ? '已置顶 📌' : '已取消置顶', icon: 'none' });
    this.refresh();
  },
  onDel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除便签',
      content: '确定删除这条便签吗？',
      confirmColor: '#F2689A',
      success: res => {
        if (!res.confirm) return;
        const DB = store.getDB();
        const i = DB.memos.findIndex(x => x.id === id);
        if (i > -1) DB.memos.splice(i, 1);
        store.save();
        wx.showToast({ title: '已删除', icon: 'none' });
        this.refresh();
      }
    });
  },

  onNav(e) { wx.reLaunch({ url: e.detail.url }); },
  onShareAppMessage() { return { title: '小宝工作台', path: '/pages/home/home' }; }
});
