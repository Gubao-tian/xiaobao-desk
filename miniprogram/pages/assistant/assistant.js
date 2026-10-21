const store = require('../../utils/store.js');
const u = require('../../utils/util.js');
const T = require('../../utils/theme.js');
const cloudMod = require('../../utils/cloud.js');
const sync = require('../../utils/sync.js');

const QUICK = [
  { k: 'today', t: '帮我安排今天', p: '根据我今天的任务和习惯，帮我排出优先级，给点可执行建议。' },
  { k: 'week', t: '总结这一周', p: '帮我总结这一周的打卡、任务、学习、运动情况，鼓励一下并指出可以改进的地方。' },
  { k: 'goal', t: '拆解一个目标', p: '帮我把一个模糊的大目标拆成这周就能做完的小步骤。' }
];

/* 把当前工作台数据压缩成助理的背景上下文 */
function buildContext() {
  const DB = store.getDB();
  const t = u.today();
  const plans = (DB.plans[t] || []).map(p => (p.done ? '[已完成] ' : '[待办] ') + p.name).join('；') || '（今天还没有安排）';
  const [ws, we] = u.weekRange();
  const days = u.lastNDays(7, we);
  const check = days.filter(d => DB.checkins[d]).length;
  const study = days.reduce((a, d) => a + (DB.studyLog[d] || 0), 0);
  const read = days.reduce((a, d) => a + (DB.readLog[d] || 0), 0);
  const wk = days.reduce((a, d) => a + (DB.workout[d] || []).reduce((x, y) => x + y.min, 0), 0);
  const streak = store.streak();
  return '你是「小宝工作台」里的贴心助理「小宝」，语气温柔、简短、以鼓励为主。\n' +
    '今天是 ' + t + '。用户当前的数据：\n' +
    '- 连续打卡 ' + streak + ' 天，本周打卡 ' + check + '/7 天\n' +
    '- 今日任务：' + plans + '\n' +
    '- 本周学习 ' + study + ' 分钟、阅读 ' + read + ' 分钟、运动 ' + wk + ' 分钟\n' +
    '请基于这些数据回答，中文，控制在 220 字以内，不要啰嗦。';
}

Page({
  data: {
    pageStyle: '',
    quick: QUICK,
    input: '',
    messages: [],
    sending: false,
    ready: false,
    tip: '连接云端后即可和小宝聊天'
  },

  onLoad() { this.refresh(); },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  onNav(e) { wx.reLaunch({ url: e.detail.url }); },

  refresh() {
    let ok = false;
    try { cloudMod.getCloud(); ok = sync.getState().loggedIn; } catch (e) { ok = false; }
    this.setData({
      pageStyle: T.pageStyle(store.currentTheme()),
      ready: ok,
      tip: ok ? '已连接，问我点什么吧～' : '需要连接云端（我的 → 立即同步）后，小宝才能回答你'
    });
  },

  onInput(e) { this.setData({ input: e.detail.value }); },
  onInputBlur(e) { this.setData({ input: e.detail.value }); },

  onQuick(e) {
    const k = e.currentTarget.dataset.k;
    const q = QUICK.filter(x => x.k === k)[0];
    if (q) { this.setData({ input: q.p }); this.onSend(); }
  },

  onClear() { this.setData({ messages: [] }); },

  onSend() {
    const text = (this.data.input || '').trim();
    if (!text) { wx.showToast({ title: '想问点什么呢？', icon: 'none' }); return; }
    if (this.data.sending) return;
    if (!this.data.ready) {
      wx.showToast({ title: '请先连接云端（我的 → 立即同步）', icon: 'none' });
      try { sync.syncNow().then(() => this.refresh()); } catch (e) { /* 忽略 */ }
      return;
    }
    const msgs = this.data.messages.slice();
    msgs.push({ role: 'me', text });
    msgs.push({ role: 'ai', text: '' });
    this.setData({ messages: msgs, input: '', sending: true });
    this._stream(text, msgs.length - 1);
  },

  /* 流式拉取回答，逐块追加到对应气泡 */
  _stream(text, idx) {
    const page = this;
    const append = (s) => {
      const key = 'messages[' + idx + '].text';
      const cur = page.data.messages[idx] || { role: 'ai', text: '' };
      page.setData({ [key]: (cur.text || '') + s });
    };
    (async () => {
      try {
        const cloud = cloudMod.getCloud();
        let modelId = page.data.modelId;
        if (!modelId) {
          const list = await cloud.llm.models.list();
          const m = (list || [])[0];
          modelId = m && (m.id || m.name || m.model);
          if (!modelId) throw new Error('云端没有可用模型');
          page.setData({ modelId });
        }
        const stream = await cloud.llm.chat.completions.create({
          model: modelId,
          stream: true,
          messages: [
            { role: 'system', content: buildContext() },
            { role: 'user', content: text }
          ]
        });
        const it = typeof stream[Symbol.asyncIterator] === 'function' ? stream[Symbol.asyncIterator]() : null;
        if (!it) throw new Error('云端未返回流式结果');
        let r = await it.next();
        while (!r.done) {
          const ch = r.value || {};
          const delta = ch.choices && ch.choices[0] && ch.choices[0].delta;
          const c = delta && (delta.content || delta.reasoning_content);
          if (c) append(c);
          r = await it.next();
        }
        if (!(page.data.messages[idx] || {}).text) append('（小宝暂时没想好，再问一次试试～）');
      } catch (e) {
        append('抱歉，小宝没能回答：' + ((e && e.message) || '网络异常'));
      } finally {
        page.setData({ sending: false });
      }
    })();
  },

  onShareAppMessage() { return { title: '小宝工作台 · AI 助理', path: '/pages/home/home' }; }
});
