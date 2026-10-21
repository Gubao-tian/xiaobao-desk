const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');

/* 技能图标候选 */
const EMOJIS = ['🎸', '🎨', '💻', '🗣️', '📷', '🎹', '✍️', '🍳', '🧩', '🏹', '🎬', '🪄'];

Page({
  data: {
    pageStyle: '',
    skills: [],
    logs: [],
    emojis: EMOJIS,
    emoIdx: 0,
    form: {},
    showModal: false,
    modalTitle: '添加技能',
    editId: ''
  },

  onLoad() {},
  onUnload() { /* 无定时器需要清理 */ },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },

  refresh() {
    const DB = store.getDB();
    const t = u.today();
    const skills = (DB.skills || []).map(s => {
      const count = s.count || 0;
      const cells = [];
      for (let i = 0; i < 10; i++) cells.push(i < count % 10);
      return {
        id: s.id, name: s.name, emoji: s.emoji,
        count, lv: Math.floor(count / 10) + 1,
        cells, last: s.last || '', today: s.last === t
      };
    });
    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      skills,
      logs: (DB.skillLog || []).slice(-14).reverse()
    });
  },

  /* ============ 添加 / 编辑技能 ============ */
  openAdd(s) {
    if (s && s.id) {
      const ei = EMOJIS.indexOf(s.emoji);
      this.setData({
        showModal: true,
        modalTitle: '编辑技能',
        editId: s.id,
        emoIdx: ei < 0 ? 0 : ei,
        'form.name': s.name,
        'form.emoji': s.emoji
      });
    } else {
      this.setData({
        showModal: true,
        modalTitle: '添加技能',
        editId: '',
        emoIdx: 0,
        'form.name': '',
        'form.emoji': EMOJIS[0]
      });
    }
  },
  onEditSkill(e) {
    const id = e.currentTarget.dataset.id;
    const s = store.getDB().skills.find(x => x.id === id);
    if (s) this.openAdd(s);
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
  onPickEmo(e) {
    const i = Number(e.currentTarget.dataset.i) || 0;
    this.setData({ emoIdx: i, 'form.emoji': EMOJIS[i] });
  },
  submitModal(e) {
    const fv = (e && e.detail && e.detail.value) || {};
    const f = Object.assign({}, this.data.form || {}, fv);
    const name = (f.name || '').trim();
    if (!name) { wx.showToast({ title: '请输入技能名称', icon: 'none' }); return; }
    const DB = store.getDB();
    if (this.data.editId) {
      store.updateItem('skills', this.data.editId, { name, emoji: f.emoji || EMOJIS[0] });
      this.setData({ showModal: false, editId: '' });
      wx.showToast({ title: '已修改 ✓', icon: 'none' });
      this.refresh();
      return;
    }
    DB.skills.push({
      id: u.uid(),
      name,
      emoji: f.emoji || EMOJIS[0],
      count: 0,
      last: ''
    });
    store.save();
    this.setData({ showModal: false });
    wx.showToast({ title: '技能已创建 ' + (f.emoji || EMOJIS[0]), icon: 'none' });
    this.refresh();
  },

  /* ============ 练习 +1 ============ */
  onPractice(e) {
    const id = e.currentTarget.dataset.id;
    const DB = store.getDB();
    const s = DB.skills.find(x => x.id === id);
    if (!s) return;
    s.count = (s.count || 0) + 1;
    s.last = u.today();
    DB.skillLog.push({ id: s.id, name: s.name, date: u.today() });
    store.save();
    this.refresh();
    if (s.count % 10 === 0) {
      wx.showToast({ title: '🎉 升级！' + s.name + ' 到达 Lv.' + (s.count / 10 + 1), icon: 'none' });
    } else {
      wx.showToast({ title: s.emoji + ' ' + s.name + ' 练习 +1', icon: 'none' });
    }
  },
  onDelSkill(e) {
    const id = e.currentTarget.dataset.id;
    const DB = store.getDB();
    const s = DB.skills.find(x => x.id === id);
    wx.showModal({
      title: '删除技能',
      content: '确定删除「' + (s ? s.name : '') + '」及其练习记录吗？',
      confirmColor: '#F2689A',
      success: res => {
        if (!res.confirm) return;
        const i = DB.skills.findIndex(x => x.id === id);
        if (i > -1) DB.skills.splice(i, 1);
        store.save();
        wx.showToast({ title: '已删除', icon: 'none' });
        this.refresh();
      }
    });
  },

  onNav(e) { wx.reLaunch({ url: e.detail.url }); },
  onShareAppMessage() { return { title: '小宝工作台', path: '/pages/home/home' }; }
});
