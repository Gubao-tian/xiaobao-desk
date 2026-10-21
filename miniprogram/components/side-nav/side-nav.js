const { MODULES, PAGE_PATH } = require('../../utils/nav.js');
const store = require('../../utils/store.js');
const { today } = require('../../utils/util.js');

Component({
  properties: {
    active: { type: String, value: 'home' }
  },
  data: {
    modules: MODULES,
    open: false,
    badges: {},
    version: '1.5.0'
  },
  lifetimes: {
    attached() {
      // 版本号从全局读取，保证单一数据源
      try {
        const app = getApp();
        if (app && app.globalData && app.globalData.version) {
          this.setData({ version: app.globalData.version });
        }
      } catch (e) { /* 忽略 */ }
      this.refreshBadges();
      this._timer = setInterval(() => this.refreshBadges(), 5000);
    },
    detached() {
      this._timer && clearInterval(this._timer);
    }
  },
  pageLifetimes: {
    show() { this.refreshBadges(); }
  },
  methods: {
    refreshBadges() {
      const DB = store.getDB();
      const t = today();
      const b = {};
      const undone = (DB.plans[t] || []).filter(x => !x.done).length;
      if (undone) b.plan = undone > 99 ? '99+' : String(undone);
      const pinned = DB.memos.filter(m => m.pin).length;
      if (pinned) b.memo = String(pinned);
      this.setData({ badges: b });
    },
    toggle() { this.setData({ open: !this.data.open }); },
    close() { this.setData({ open: false }); },
    onTap(e) {
      const id = e.currentTarget.dataset.id;
      this.setData({ open: false });
      if (id === this.properties.active) return;
      this.triggerEvent('navigate', { id, url: PAGE_PATH(id) });
    }
  }
});
