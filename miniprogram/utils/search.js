/* 全局搜索：跨模块检索（与 Web 版 searchAll 保持一致） */
function searchAll(DB, q) {
  const s = String(q || '').toLowerCase().trim();
  const out = [];
  if (!s) return out;
  const hit = (mod, text, sub) => {
    if (String(text || '').toLowerCase().includes(s)) out.push({ mod, text: String(text), sub: sub || '' });
  };
  for (const d in DB.plans || {}) (DB.plans[d] || []).forEach(p => hit('plan', p.name, d));
  (DB.courses || []).forEach(c => hit('course', c.name, c.note));
  for (const d in DB.workout || {}) (DB.workout[d] || []).forEach(w => hit('workout', w.type || '', d + ' · ' + w.min + ' 分钟'));
  (DB.exam || []).forEach(e => hit('exam', e.name, e.unit || ''));
  (DB.finance || []).forEach(f => hit('finance', f.note || f.cat || '', (f.type === 'income' ? '收入' : '支出') + ' ¥' + (f.amount || 0)));
  (DB.ideas || []).forEach(i => hit('media', i.title, i.note));
  (DB.pubs || []).forEach(p => hit('media', p.title, p.platform));
  (DB.books || []).forEach(b => hit('read', b.title, b.author));
  (DB.skills || []).forEach(k => hit('skill', k.name, '练习 ' + (k.count || 0) + ' 次'));
  (DB.memos || []).forEach(m => hit('memo', m.title, m.body));
  (DB.quotes || []).forEach(x => hit('read', x.text, '摘抄'));
  for (const w in DB.reviews || {}) {
    const r = DB.reviews[w] || {};
    [r.good, r.bad, r.next].forEach(v => { if (v) hit('review', v, '周复盘 ' + w); });
  }
  return out;
}
module.exports = { searchAll };
