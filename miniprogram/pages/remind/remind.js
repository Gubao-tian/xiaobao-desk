const store = require('../../utils/store.js');
const TMPL = require('../../utils/subscribe.js').TMPL_IDS;

const WATER_OPTS = [30, 60, 90, 120, 180]; // 喝水间隔（分钟）

Page({
  data: {
    rPlanOn: true, rPlanTime: '09:00',
    rWorkOn: true, rWorkTime: '19:00',
    rWaterOn: false, rWaterInterval: 120,
    waterOpts: WATER_OPTS.map(m => m + ' 分钟'),
    waterIdx: 3,
    subGranted: false,
    subConfigured: TMPL.length > 0,
    subText: ''
  },

  onLoad() { this.sync(); },
  onShow() { this.sync(); },

  sync() {
    const r = store.getDB().reminders || {};
    const plan = r.plan || {}, work = r.workout || {}, water = r.water || {};
    const wi = water.interval || 120;
    this.setData({
      rPlanOn: !!plan.on,
      rPlanTime: plan.time || '09:00',
      rWorkOn: !!work.on,
      rWorkTime: work.time || '19:00',
      rWaterOn: !!water.on,
      rWaterInterval: wi,
      waterIdx: Math.max(0, WATER_OPTS.indexOf(wi)),
      subGranted: !!store.getDB().subGranted,
      subText: store.getDB().subGranted ? '已开启微信提醒 🔔' : '未开启'
    });
  },

  patch(which, p) {
    const r = JSON.parse(JSON.stringify(store.getDB().reminders || { plan: {}, workout: {}, water: {} }));
    r[which] = Object.assign({}, r[which] || {}, p);
    store.getDB().reminders = r;
    store.save();
    this.sync();
  },

  onTogglePlan(e) { this.patch('plan', { on: e.detail.value }); },
  onTimePlan(e) { this.patch('plan', { time: e.detail.value }); },
  onToggleWork(e) { this.patch('workout', { on: e.detail.value }); },
  onTimeWork(e) { this.patch('workout', { time: e.detail.value }); },
  onToggleWater(e) { this.patch('water', { on: e.detail.value }); },
  onIntervalWater(e) {
    const idx = Number(e.detail.value);
    this.patch('water', { interval: WATER_OPTS[idx] });
  },

  /* 开启微信订阅消息（后台推送）；未配置模板时降级提示，本地提醒仍生效 */
  onEnableSubscribe() {
    if (!TMPL.length) {
      wx.showModal({
        title: '暂未配置推送模板',
        content: '要开启「微信服务通知」推送（关掉小程序也能收到），需要先在微信公众平台申请订阅消息模板，并把模板 ID 填到 miniprogram/utils/subscribe.js。\n\n现在已用「本地提醒」（打开小程序时弹窗），照常帮你记得。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: TMPL,
      success: (res) => {
        const granted = TMPL.some(id => res[id] === 'accept');
        store.getDB().subGranted = granted;
        store.save();
        this.setData({ subGranted: granted, subText: granted ? '已开启微信提醒 🔔' : '未授权，已用本地提醒' });
        wx.showToast({ title: granted ? '已开启微信提醒 🔔' : '未授权，已用本地提醒', icon: 'none' });
      },
      fail: () => {
        wx.showToast({ title: '授权失败，已用本地提醒', icon: 'none' });
      }
    });
  },

  goBack() { wx.navigateBack({ delta: 1 }); }
});
