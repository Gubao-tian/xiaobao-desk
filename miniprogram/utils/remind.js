/* 本地提醒：小程序没有后台定时器，无法在关闭后弹出系统通知；
   这里在每次「打开/回到前台」时检查是否到了提醒时间，用弹窗兜底。
   已授权微信订阅消息的用户，会由云函数负责真正的后台推送（见 cloudfunctions/reminder）。 */
const store = require('./store.js');
const u = require('./util.js');

function checkLocalReminders() {
  try {
    const DB = store.getDB();
    const r = DB.reminders || {};
    const now = new Date();
    const hhmm = u.pad(now.getHours()) + ':' + u.pad(now.getMinutes());
    const t = u.today();
    const log = DB.reminderLog || (DB.reminderLog = {});
    const due = [];

    if (r.plan && r.plan.on && hhmm >= r.plan.time && log.plan !== t) {
      due.push({ key: 'plan', title: '今日计划提醒', body: '今天还有计划没完成，打开小宝工作台看看吧 ☀️' });
    }
    if (r.workout && r.workout.on && hhmm >= r.workout.time && log.workout !== t) {
      due.push({ key: 'workout', title: '锻炼提醒', body: '该动一动啦，今天的运动打卡还没完成 💪' });
    }
    if (r.water && r.water.on) {
      const last = log.water ? new Date(log.water) : null;
      const gap = (r.water.interval || 120) * 60 * 1000;
      if (!last || (now - last) >= gap) {
        due.push({ key: 'water', title: '喝水提醒', body: '记得喝杯水，给身体补点水 💧' });
      }
    }

    if (!due.length) return;
    const first = due[0];
    // 标记已提醒，避免重复打扰
    if (first.key === 'water') log.water = now.toISOString();
    else log[first.key] = t;
    DB.reminderLog = log;
    store.save();

    wx.showModal({
      title: first.title,
      content: first.body,
      showCancel: true,
      cancelText: '稍后',
      confirmText: '去看看',
      success(res) {
        if (res.confirm) {
          try { wx.reLaunch({ url: '/pages/home/home' }); } catch (e) { /* 忽略 */ }
        }
      }
    });
  } catch (e) {
    console.warn('本地提醒检查失败', e);
  }
}

module.exports = { checkLocalReminders };
