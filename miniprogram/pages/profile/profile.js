const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');
const sync = require('../../utils/sync.js');

/* 战绩卡片绘制：把关键数据画成一张可分享的图（小程序 canvas 2d / Web canvas 通用逻辑） */
function drawCard(c, W, H) {
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#FFF4F8'); g.addColorStop(1, '#F5EEFF');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#FFFFFF';
  c.beginPath();
  if (c.roundRect) c.roundRect(20, 24, W - 40, H * 0.2, 18); else c.rect(20, 24, W - 40, H * 0.2);
  c.fill();
  c.textAlign = 'center';
  c.fillStyle = '#F2689A'; c.font = 'bold ' + Math.round(W * 0.07) + 'px sans-serif';
  c.fillText('🏆 小宝工作台', W / 2, H * 0.09);
  c.fillStyle = '#8a8290'; c.font = Math.round(W * 0.038) + 'px sans-serif';
  c.fillText('MY COZY DESK · 我的成长战绩', W / 2, H * 0.135);
  const DB = store.getDB();
  const p = DB.profile || {};
  if (p.name) {
    c.fillStyle = '#2b2330'; c.font = 'bold ' + Math.round(W * 0.045) + 'px sans-serif';
    c.fillText(p.name + ' 的战绩', W / 2, H * 0.175);
  }
  const t = u.today();
  const [ws, we] = u.weekRange();
  const days = u.lastNDays(7, we);
  const stats = [
    { l: '连续打卡', v: store.streak(), un: '天' },
    { l: '累计打卡', v: Object.keys(DB.checkins).length, un: '天' },
    { l: '本周完成', v: days.reduce((a, d) => a + (DB.plans[d] || []).filter(x => x.done).length, 0), un: '项' },
    { l: '本周运动', v: days.reduce((a, d) => a + (DB.workout[d] || []).reduce((x, y) => x + y.min, 0), 0), un: '分' },
    { l: '本周学习', v: days.reduce((a, d) => a + (DB.studyLog[d] || 0), 0), un: '分' },
    { l: '本周阅读', v: days.reduce((a, d) => a + (DB.readLog[d] || 0), 0), un: '分' }
  ];
  const cols = 2, cw = (W - 40) / cols, ch = H * 0.11, top = H * 0.25;
  stats.forEach(function (s, i) {
    const x = 20 + (i % cols) * cw, y = top + Math.floor(i / cols) * (ch + H * 0.015);
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    if (c.roundRect) c.roundRect(x + 4, y, cw - 12, ch, 14); else c.rect(x + 4, y, cw - 12, ch);
    c.fill();
    c.textAlign = 'left';
    c.fillStyle = '#8a8290'; c.font = Math.round(W * 0.032) + 'px sans-serif';
    c.fillText(s.l, x + 20, y + ch * 0.35);
    c.fillStyle = '#F2689A'; c.font = 'bold ' + Math.round(W * 0.07) + 'px sans-serif';
    const v = String(s.v);
    c.fillText(v, x + 20, y + ch * 0.82);
    const nw = c.measureText(v).width;
    c.fillStyle = '#8a8290'; c.font = Math.round(W * 0.032) + 'px sans-serif';
    c.fillText(s.un, x + 26 + nw, y + ch * 0.82);
  });
  const q = u.quoteOfDay(t)[0];
  c.textAlign = 'center';
  c.fillStyle = '#8a8290'; c.font = Math.round(W * 0.035) + 'px sans-serif';
  c.fillText(q.slice(0, 20), W / 2, H - H * 0.07);
  c.fillStyle = '#B9A9BE'; c.font = Math.round(W * 0.03) + 'px sans-serif';
  c.fillText(t + ' · 小宝工作台', W / 2, H - H * 0.03);
}

/* 云端状态文案与时间格式化（WXML 表达式能力有限，统一在 JS 侧算好） */
function cloudStatusText(cs) {
  if (cs.syncing) return '同步中…';
  if (!cs.ready) return '本地模式';
  if (!cs.loggedIn) return '未连接云端';
  return '已同步到云端';
}
function fmtTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = function (n) { return n < 10 ? '0' + n : '' + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

Page({
  data: {
    pageStyle: '',
    profile: { name: '', sign: '', avatar: '💗', tags: [] },
    avatars: T.AVATARS,
    themes: T.THEMES,
    activeThemeId: 'pink',
    tagInput: '',
    suggest: T.TAG_SUGGEST,
    /* 自定义调色 */
    customR: 255,
    customG: 143,
    customB: 184,
    customPreview: '#FF8FB8',
    customActive: false,
    /* 数据概览 */
    stats: [
      { lbl: '累计打卡', val: 0, unit: '天' },
      { lbl: '连续打卡', val: 0, unit: '天' },
      { lbl: '今日待办', val: 0, unit: '项' },
      { lbl: '在读/想读', val: 0, unit: '本' }
    ],
    /* 云同步状态 */
    cloud: { ready: false, loggedIn: false, syncing: false, statusText: '', lastSyncAt: '', lastError: '' },
    /* 战绩卡片 */
    cardPath: '',
    cardTip: '生成后可以保存到相册，再分享给朋友'
  },

  onLoad() {
    const rgb = T.hexToRgb(T.THEMES[0].accent);
    this.setData({ customR: rgb.r, customG: rgb.g, customB: rgb.b, customPreview: T.THEMES[0].accent });
  },
  onShow() {
    store.initDay();
    this.refresh();
  },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  onNav(e) { wx.reLaunch({ url: e.detail.url }); },

  refresh() {
    const DB = store.getDB();
    const theme = store.currentTheme();
    const t = u.today();
    const books = DB.books.filter(b => b.status !== 'done').length;
    this.setData({
      pageStyle: T.pageStyle(theme),
      profile: DB.profile,
      activeThemeId: theme.id,
      customActive: theme.id === 'custom',
      stats: [
        { lbl: '累计打卡', val: Object.keys(DB.checkins).length, unit: '天' },
        { lbl: '连续打卡', val: store.streak(), unit: '天' },
        { lbl: '今日待办', val: (DB.plans[t] || []).filter(x => !x.done).length, unit: '项' },
        { lbl: '在读/想读', val: books, unit: '本' }
      ],
      cloud: (function () {
        const cs = sync.getState();
        return {
          ready: cs.ready,
          loggedIn: cs.loggedIn,
          syncing: cs.syncing,
          statusText: cloudStatusText(cs),
          lastSyncAt: cs.lastSyncAt ? fmtTime(cs.lastSyncAt) : '',
          lastError: cs.lastError || ''
        };
      })()
    });
  },

  /* ---------- 个人资料 ---------- */
  onName(e) { store.setProfile({ name: e.detail.value }); this.refresh(); },
  onNameBlur(e) { store.setProfile({ name: e.detail.value }); this.refresh(); },
  onSign(e) { store.setProfile({ sign: e.detail.value }); this.refresh(); },
  onSignBlur(e) { store.setProfile({ sign: e.detail.value }); this.refresh(); },
  onPickAvatar(e) {
    store.setProfile({ avatar: e.currentTarget.dataset.av });
    this.refresh();
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  onTagInput(e) { this.setData({ tagInput: e.detail.value }); },
  onTagInputBlur(e) { this.setData({ tagInput: e.detail.value }); },
  onTagBlur(e) { this.setData({ tagInput: e.detail.value }); },
  onAddTag() {
    const v = (this.data.tagInput || '').trim();
    if (!v) { wx.showToast({ title: '先输入标签内容', icon: 'none' }); return; }
    const tags = this.data.profile.tags.slice();
    if (tags.length >= 8) { wx.showToast({ title: '最多 8 个标签哦', icon: 'none' }); return; }
    if (tags.includes(v)) { wx.showToast({ title: '这个标签已经有啦', icon: 'none' }); return; }
    tags.push(v);
    store.setProfile({ tags });
    this.setData({ tagInput: '' });
    this.refresh();
  },
  onDelTag(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const tags = this.data.profile.tags.slice();
    tags.splice(idx, 1);
    store.setProfile({ tags });
    this.refresh();
  },
  onQuickTag(e) {
    const v = e.currentTarget.dataset.tag;
    const tags = this.data.profile.tags.slice();
    if (tags.includes(v)) { wx.showToast({ title: '这个标签已经有啦', icon: 'none' }); return; }
    if (tags.length >= 8) { wx.showToast({ title: '最多 8 个标签哦', icon: 'none' }); return; }
    tags.push(v);
    store.setProfile({ tags });
    this.refresh();
  },

  /* ---------- 背景主题 ---------- */
  onPickTheme(e) {
    const id = e.currentTarget.dataset.id;
    const theme = T.themeById(id);
    store.setTheme(theme);
    this.setData({ activeThemeId: id, customActive: false });
    wx.showToast({ title: '已换成「' + theme.name + '」' + theme.emoji, icon: 'none' });
  },

  onSlider(e) {
    const key = e.currentTarget.dataset.k;
    const val = e.detail.value;
    this.setData({ [key]: val });
    this.updateCustomPreview();
  },
  updateCustomPreview() {
    const hex = T.rgbToHex(this.data.customR, this.data.customG, this.data.customB);
    this.setData({ customPreview: hex });
  },
  onUseCustom() {
    const hex = this.data.customPreview;
    const theme = T.deriveTheme(hex);
    store.setTheme(theme);
    this.setData({ activeThemeId: 'custom', customActive: true });
    wx.showToast({ title: '自定义背景已应用 🎨', icon: 'none' });
  },

  onShareAppMessage() { return { title: '小宝工作台', path: '/pages/home/home' }; },

  /* ---------- 云同步 ---------- */
  onSyncNow() {
    sync.syncNow().then(() => this.refresh());
  },

  /* ---------- 提醒与通知 ---------- */
  goRemind() {
    wx.navigateTo({ url: '/pages/remind/remind' });
  },

  /* ---------- 战绩卡片 ---------- */
  onGenCard() {
    if (typeof wx.createSelectorQuery !== 'function') {
      wx.showToast({ title: '当前环境不支持生成卡片', icon: 'none' });
      return;
    }
    const page = this;
    wx.createSelectorQuery().in(this).select('#shareCanvas').fields({ node: true, size: true }).exec(function (res) {
      const info = res && res[0];
      if (!info || !info.node) { wx.showToast({ title: '画布初始化失败', icon: 'none' }); return; }
      const canvas = info.node;
      const ctx = canvas.getContext('2d');
      let dpr = 2;
      try { dpr = wx.getSystemInfoSync().pixelRatio || 2; } catch (e) { /* 忽略 */ }
      canvas.width = info.width * dpr;
      canvas.height = info.height * dpr;
      ctx.scale(dpr, dpr);
      drawCard(ctx, info.width, info.height);
      wx.canvasToTempFilePath({
        canvas: canvas,
        success(r) {
          page.setData({ cardPath: r.tempFilePath, cardTip: '已生成，保存到相册就能分享给朋友啦 📷' });
          wx.showToast({ title: '战绩卡片已生成 🏆', icon: 'none' });
        },
        fail() { wx.showToast({ title: '生成失败，再试一次', icon: 'none' }); }
      });
    });
  },
  onSaveCard() {
    const p = this.data.cardPath;
    if (!p) { wx.showToast({ title: '先生成卡片哦', icon: 'none' }); return; }
    wx.saveImageToPhotosAlbum({
      filePath: p,
      success() { wx.showToast({ title: '已保存到相册 📷', icon: 'none' }); },
      fail() { wx.showToast({ title: '保存失败，请授权相册权限', icon: 'none' }); }
    });
  },

  /* ---------- 数据备份 ---------- */
  onBackupExport() {
    const store = require('../../utils/store.js');
    const data = JSON.stringify(store.getDB());
    wx.setClipboardData({
      data,
      success: () => {
        wx.showToast({ title: '已复制整库 JSON 到剪贴板', icon: 'none' });
        // 同时生成文件，便于转发/长期保存
        try {
          const fs = wx.getFileSystemManager();
          const u = require('../../utils/util.js');
          const path = `${wx.env.USER_DATA_PATH}/xiaobao_backup_${u.today()}.json`;
          fs.writeFile({
            filePath: path, data, encoding: 'utf8',
            success: () => {
              if (typeof wx.shareFileMessage === 'function') {
                wx.shareFileMessage({ filePath: path, fileName: '小宝工作台备份.json' });
              }
            },
            fail: () => { /* 文件生成失败不阻塞（剪贴板已成功） */ }
          });
        } catch (e) { /* 忽略文件相关异常 */ }
      },
      fail: () => { wx.showToast({ title: '复制失败', icon: 'none' }); }
    });
  }
});
