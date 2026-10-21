const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');

const TPL_LIST = [
  { id: 'p_work', kind: 'plan', name: '工作日安排', emoji: '💼', desc: '专注工作 + 午休 + 复盘',
    items: [{ name: '晨间拉伸 10 分钟', prio: 'low' }, { name: '专注工作 2 小时', prio: 'high' }, { name: '午休 30 分钟', prio: 'low' }, { name: '今日复盘 10 分钟', prio: 'mid' }] },
  { id: 'p_weekend', kind: 'plan', name: '周末安排', emoji: '🌸', desc: '放松 + 整理 + 读书',
    items: [{ name: '睡到自然醒', prio: 'low' }, { name: '大扫除 30 分钟', prio: 'mid' }, { name: '读书 30 分钟', prio: 'mid' }, { name: '运动 30 分钟', prio: 'high' }] },
  { id: 'p_exam', kind: 'plan', name: '备考日', emoji: '📖', desc: '背单词 + 刷题 + 错题',
    items: [{ name: '背单词 30 分钟', prio: 'high' }, { name: '刷题 1 小时', prio: 'high' }, { name: '整理错题 20 分钟', prio: 'mid' }] },
  { id: 'p_morning', kind: 'plan', name: '自律晨间', emoji: '☀️', desc: '早起三件套',
    items: [{ name: '喝一杯温水', prio: 'low' }, { name: '运动 20 分钟', prio: 'mid' }, { name: '写下今天 3 件事', prio: 'high' }] },
  { id: 'p_money', kind: 'plan', name: '理财日', emoji: '💰', desc: '记账 + 复盘花销',
    items: [{ name: '记今天的账', prio: 'high' }, { name: '检查储蓄目标进度', prio: 'mid' }] },
  { id: 'r_week', kind: 'review', name: '复盘三段式', emoji: '🌙', desc: '做得好 / 可改进 / 下周目标',
    text: { good: '1. \n2. \n3. ', bad: '1. \n2. ', next: '1. \n2. \n3. ' } },
  { id: 'm_shop', kind: 'memo', name: '购物清单', emoji: '🛒', desc: '常买的几样先写好',
    memo: { title: '购物清单', body: '牛奶\n鸡蛋\n水果\n面包' } },
  { id: 'm_trip', kind: 'memo', name: '旅行清单', emoji: '🧳', desc: '出门前照着打勾',
    memo: { title: '旅行清单', body: '身份证/护照\n充电器\n换洗衣物\n常用药\n洗漱包' } },
  { id: 'm_week', kind: 'memo', name: '周计划便签', emoji: '🗒️', desc: '一周重点先列出来',
    memo: { title: '本周重点', body: '工作：\n学习：\n生活：\n想做：' } }
];

Page({
  data: {
    pageStyle: '',
    planTpl: [],
    reviewTpl: [],
    memoTpl: []
  },

  onLoad() { this.refresh(); },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  onNav(e) { wx.reLaunch({ url: e.detail.url }); },

  refresh() {
    const pick = k => TPL_LIST.filter(x => x.kind === k);
    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      planTpl: pick('plan'),
      reviewTpl: pick('review'),
      memoTpl: pick('memo')
    });
  },

  onApply(e) {
    const id = e.currentTarget.dataset.tpl;
    const tpl = TPL_LIST.filter(x => x.id === id)[0];
    if (!tpl) return;
    const DB = store.getDB();
    const t = u.today();
    if (tpl.kind === 'plan') {
      DB.plans[t] = DB.plans[t] || [];
      tpl.items.forEach(it => {
        DB.plans[t].push({ id: u.uid(), name: it.name, done: false, prio: it.prio });
      });
      store.save();
      wx.showToast({ title: '加了 ' + tpl.items.length + ' 条计划', icon: 'none' });
    } else if (tpl.kind === 'review') {
      const [ws] = u.weekRange();
      const cur = DB.reviews[ws] || { good: '', bad: '', next: '' };
      DB.reviews[ws] = {
        good: cur.good || tpl.text.good,
        bad: cur.bad || tpl.text.bad,
        next: cur.next || tpl.text.next,
        at: cur.at || t
      };
      store.save();
      wx.showToast({ title: '复盘模板已填好', icon: 'none' });
    } else {
      DB.memos.unshift({ id: u.uid(), title: tpl.memo.title, body: tpl.memo.body, color: '#FFF4F8', pin: false, created: t });
      store.save();
      wx.showToast({ title: '已新建便签', icon: 'none' });
    }
    this.refresh();
  },

  onShareAppMessage() { return { title: '小宝工作台 · 模板库', path: '/pages/home/home' }; }
});
