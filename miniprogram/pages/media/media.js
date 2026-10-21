const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');

const PLATFORMS = ['小红书', '抖音', 'B站', '公众号', '视频号', '知乎', '微博'];

Page({
  data: {
    pageStyle: '',
    platforms: PLATFORMS,
    form: {},
    showIdea: false,
    showPub: false,
    editIdIdea: '',
    editIdPub: '',
    pubN: 0,
    monthPub: 0,
    ideaTodo: 0,
    hitsText: '0',
    ideas: [],
    pubs: [],
    bars: []
  },

  onLoad() {},
  onUnload() { /* 无定时器需要清理 */ },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  onNav(e) { wx.reLaunch({ url: e.detail.url }); },

  refresh() {
    const DB = store.getDB();
    const mp = u.today().slice(0, 7);

    const pubN = DB.pubs.length;
    const monthPub = DB.pubs.filter(p => p.date.slice(0, 7) === mp).length;
    const ideaTodo = DB.ideas.filter(i => i.status !== 'done').length;
    const hits = DB.pubs.reduce((a, p) => a + (p.hits || 0), 0);
    const hitsText = hits >= 10000 ? (hits / 10000).toFixed(1) + 'w' : String(hits);

    /* 选题灵感库：新的在前 */
    const ideas = DB.ideas.slice().reverse().map(i => ({
      id: i.id,
      title: i.title,
      note: i.note,
      done: i.status === 'done',
      pill: i.status === 'done' ? '已发布' : '待创作',
      pillCls: i.status === 'done' ? 'mint' : 'gray'
    }));

    /* 发布记录：按日期倒序取前 30 条 */
    const pubs = DB.pubs.slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 30)
      .map(p => ({
        id: p.id,
        platform: p.platform,
        title: p.title,
        date: p.date,
        hits: p.hits || 0
      }));

    /* 近 8 周发布量柱状图 */
    const bars = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const range = u.weekRange(d);
      const cnt = DB.pubs.filter(p => p.date >= range[0] && p.date <= range[1]).length;
      const sd = u.parseD(range[0]);
      bars.push({
        v: cnt,
        label: (sd.getMonth() + 1) + '/' + sd.getDate(),
        cur: i === 0
      });
    }
    const max = Math.max.apply(null, bars.map(b => b.v).concat([1]));
    bars.forEach(b => {
      b.h = Math.max(Math.round(b.v / max * 100), b.v ? 6 : 2);
      b.bg = b.cur ? 'linear-gradient(180deg,#FFA6C8,#F2689A)' : 'linear-gradient(180deg,#CDB6F2,#B79BEF)';
    });

    this.setData({ pubN, monthPub, ideaTodo, hitsText, ideas, pubs, bars, pageStyle: T.pageStyle(store.currentTheme()) });
  },

  /* ========== 选题灵感 ========== */
  onToggleIdea(e) {
    const DB = store.getDB();
    const id = e.currentTarget.dataset.id;
    const it = DB.ideas.find(x => x.id === id);
    if (!it) return;
    it.status = it.status === 'done' ? 'todo' : 'done';
    store.save();
    this.refresh();
  },
  onDelIdea(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除灵感',
      content: '确定删除这条灵感吗？',
      confirmColor: '#F2689A',
      success: (res) => {
        if (!res.confirm) return;
        const DB = store.getDB();
        DB.ideas = DB.ideas.filter(x => x.id !== id);
        store.save();
        this.refresh();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },
  openIdea(i) {
    if (i && i.id) {
      this.setData({ showIdea: true, editIdIdea: i.id, form: { title: i.title, note: i.note || '' } });
    } else {
      this.setData({ showIdea: true, editIdIdea: '', form: { title: '', note: '' } });
    }
  },
  onEditIdea(e) {
    const id = e.currentTarget.dataset.id;
    const it = store.getDB().ideas.find(x => x.id === id);
    if (it) this.openIdea(it);
  },
  closeIdea() { this.setData({ showIdea: false }); },
  onFormIdeaTitle(e) { this.setData({ 'form.title': e.detail.value }); },
  onFormIdeaTitleBlur(e) { this.setData({ 'form.title': e.detail.value }); },
  onFormIdeaNote(e) { this.setData({ 'form.note': e.detail.value }); },
  onFormIdeaNoteBlur(e) { this.setData({ 'form.note': e.detail.value }); },
  submitIdea(e) {
    const fv = (e && e.detail && e.detail.value) || {};
    const f = Object.assign({}, this.data.form || {}, fv);
    const title = (f.title || '').trim();
    if (!title) { wx.showToast({ title: '请输入灵感标题', icon: 'none' }); return; }
    const DB = store.getDB();
    if (this.data.editIdIdea) {
      store.updateItem('ideas', this.data.editIdIdea, { title, note: (f.note || '').trim() });
      this.closeIdea();
      this.refresh();
      wx.showToast({ title: '已修改 ✓', icon: 'none' });
      return;
    }
    DB.ideas.push({
      id: u.uid(),
      title: title,
      note: (f.note || '').trim(),
      status: 'todo',
      created: u.today()
    });
    store.save();
    this.closeIdea();
    this.refresh();
    wx.showToast({ title: '灵感已记录 💡', icon: 'none' });
  },

  /* ========== 发布记录 ========== */
  onDelPub(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条发布记录吗？',
      confirmColor: '#F2689A',
      success: (res) => {
        if (!res.confirm) return;
        const DB = store.getDB();
        DB.pubs = DB.pubs.filter(x => x.id !== id);
        store.save();
        this.refresh();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  },
  openPub(p) {
    if (p && p.id) {
      this.setData({ showPub: true, editIdPub: p.id, form: { title: p.title, date: p.date, hits: String(p.hits || 0), pIdx: Math.max(0, PLATFORMS.indexOf(p.platform)) } });
    } else {
      this.setData({ showPub: true, editIdPub: '', form: { title: '', date: u.today(), hits: '', pIdx: 0 } });
    }
  },
  onEditPub(e) {
    const id = e.currentTarget.dataset.id;
    const p = store.getDB().pubs.find(x => x.id === id);
    if (p) this.openPub(p);
  },
  closePub() { this.setData({ showPub: false }); },
  onMaskTap(e) {
    if (e && e.target === e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.key) {
      const k = e.currentTarget.dataset.key;
      this.setData({ [k]: false });
    }
  },
  onFormPubTitle(e) { this.setData({ 'form.title': e.detail.value }); },
  onFormPubTitleBlur(e) { this.setData({ 'form.title': e.detail.value }); },
  onFormPubHits(e) { this.setData({ 'form.hits': e.detail.value }); },
  onFormPubHitsBlur(e) { this.setData({ 'form.hits': e.detail.value }); },
  /* 平台选择：兼容按钮组（dataset.i）与旧 picker（detail.value） */
  onPickPlat(e) {
    const raw = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.i !== undefined
      ? e.currentTarget.dataset.i
      : (e && e.detail && e.detail.value);
    const i = Number(raw);
    if (isNaN(i) || i < 0) return;
    this.setData({ 'form.pIdx': i });
  },
  onPickPubDate(e) { this.setData({ 'form.date': e.detail.value }); },
  submitPub(e) {
    const fv = (e && e.detail && e.detail.value) || {};
    const f = Object.assign({}, this.data.form || {}, fv);
    const title = (f.title || '').trim();
    if (!title) { wx.showToast({ title: '请输入发布标题', icon: 'none' }); return; }
    const DB = store.getDB();
    if (this.data.editIdPub) {
      store.updateItem('pubs', this.data.editIdPub, {
        platform: PLATFORMS[f.pIdx || 0],
        title: title,
        date: f.date || u.today(),
        hits: Math.max(0, Math.round(Number(f.hits) || 0))
      });
      this.closePub();
      this.refresh();
      wx.showToast({ title: '已修改 ✓', icon: 'none' });
      return;
    }
    DB.pubs.push({
      id: u.uid(),
      platform: PLATFORMS[f.pIdx || 0],
      title: title,
      date: f.date || u.today(),
      hits: Math.max(0, Math.round(Number(f.hits) || 0))
    });
    store.save();
    this.closePub();
    this.refresh();
    wx.showToast({ title: '发布已登记 🎬', icon: 'none' });
  },

  onShareAppMessage() { return { title: '小宝工作台', path: '/pages/home/home' }; }
});
