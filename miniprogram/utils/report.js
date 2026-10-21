/* 自动成长报告：把一周各模块的数据汇总成一段可读的总结（含与上周对比） */
const u = require('./util.js');

function weekStats(DB, ws) {
  const we = u.dateAdd(ws, 6);
  const days = u.lastNDays(7, we);
  let check = 0, planDone = 0, planTotal = 0, study = 0, read = 0, workout = 0, burn = 0;
  days.forEach(d => {
    if (DB.checkins[d]) check++;
    const pl = DB.plans[d] || [];
    planDone += pl.filter(x => x.done).length;
    planTotal += pl.length;
    study += DB.studyLog[d] || 0;
    read += DB.readLog[d] || 0;
    workout += (DB.workout[d] || []).reduce((a, b) => a + (+b.min || 0), 0);
    burn += (DB.workout[d] || []).reduce((a, b) => a + (+b.burn || 0), 0);
  });
  const inRange = s => s >= ws && s <= we;
  const income = (DB.finance || []).filter(f => f.type === 'income' && inRange(f.date)).reduce((a, b) => a + (+b.amount || 0), 0);
  const expense = (DB.finance || []).filter(f => f.type !== 'income' && inRange(f.date)).reduce((a, b) => a + (+b.amount || 0), 0);
  const pubs = (DB.pubs || []).filter(p => inRange(p.date));
  const hits = pubs.reduce((a, b) => a + (+b.hits || 0), 0);
  const skill = (DB.skillLog || []).filter(s => inRange(s.date)).length;
  const pages = days.reduce((a, d) => a + (DB.readLog[d] || 0), 0);
  return { check, planDone, planTotal, study, read: pages, workout, burn, income, expense, pubN: pubs.length, hits, skill };
}

const delta = (a, b) => a - b;

function buildGrowthReport(DB, ws) {
  const cur = weekStats(DB, ws);
  const prev = weekStats(DB, u.dateAdd(ws, -7));
  const d = {
    check: delta(cur.check, prev.check),
    planDone: delta(cur.planDone, prev.planDone),
    study: delta(cur.study, prev.study),
    read: delta(cur.read, prev.read),
    workout: delta(cur.workout, prev.workout),
    pubN: delta(cur.pubN, prev.pubN),
    skill: delta(cur.skill, prev.skill)
  };
  const trend = n => (n > 0 ? '↑' + n : n < 0 ? '↓' + Math.abs(n) : '持平');
  const stats = [
    { l: '打卡', v: cur.check, u: '天', d: d.check },
    { l: '完成任务', v: cur.planDone, u: '项', d: d.planDone },
    { l: '学习', v: cur.study, u: '分钟', d: d.study },
    { l: '阅读', v: cur.read, u: '分钟', d: d.read },
    { l: '运动', v: cur.workout, u: '分钟', d: d.workout },
    { l: '技能练习', v: cur.skill, u: '次', d: d.skill },
    { l: '发布', v: cur.pubN, u: '条', d: d.pubN }
  ];
  const lines = [];
  lines.push('这一周打卡 ' + cur.check + ' 天（' + trend(d.check) + '），完成计划 ' + cur.planDone + '/' + cur.planTotal + ' 项。');
  lines.push('学习 ' + cur.study + ' 分钟（' + trend(d.study) + '），阅读 ' + cur.read + ' 分钟（' + trend(d.read) + '）。');
  lines.push('运动 ' + cur.workout + ' 分钟，消耗约 ' + Math.round(cur.burn) + ' 千卡（' + trend(d.workout) + '）。');
  if (cur.pubN || cur.skill) lines.push('自媒体发布 ' + cur.pubN + ' 条、累计曝光 ' + cur.hits + '，技能练习 ' + cur.skill + ' 次。');
  if (cur.income || cur.expense) lines.push('本周收入 ¥' + cur.income + '、支出 ¥' + cur.expense + '。');
  const up = Object.keys(d).filter(k => d[k] > 0);
  const down = Object.keys(d).filter(k => d[k] < 0);
  if (up.length) lines.push('比上周进步的地方：' + up.map(nameOf).join('、') + '。');
  if (down.length) lines.push('可以再加把劲：' + down.map(nameOf).join('、') + '。');
  return { stats, text: lines.join(''), cur, prev, d };
}

function nameOf(k) {
  return ({
    check: '打卡', planDone: '任务完成', study: '学习', read: '阅读',
    workout: '运动', pubN: '发布', skill: '技能练习'
  })[k] || k;
}

module.exports = { buildGrowthReport, weekStats };
