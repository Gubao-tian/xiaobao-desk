// 小宝工作台 · 小程序入口
const store = require('./utils/store.js');

App({
  onLaunch() {
    // 启动时检查跨天：日期键自动翻页，历史记录全部保留
    store.initDay();
    // 应用用户自选背景主题（内置预设或自定义调色）
    try {
      require('./utils/theme.js').applyTheme(store.currentTheme());
    } catch (e) { /* 主题模块缺失时忽略 */ }
    // 云同步：静默微信登录 → 拉取云端最新快照 → 推送本地修改（失败不阻塞本地使用）
    try {
      require('./utils/sync.js').bootstrap();
    } catch (e) { /* 云服务未接入时保持本地模式 */ }
  },
  onShow() {
    store.initDay();
    try {
      require('./utils/theme.js').applyTheme(store.currentTheme());
    } catch (e) { /* 忽略 */ }
    // 回到前台：未登录则重试登录，已登录则拉取一次云端最新数据
    try {
      require('./utils/sync.js').onForeground();
    } catch (e) { /* 忽略 */ }
    // 本地兜底提醒：到达设定时间时弹窗（关闭小程序后由订阅消息负责推送）
    try {
      require('./utils/remind.js').checkLocalReminders();
    } catch (e) { /* 忽略 */ }
  },
  globalData: {
    theme: 'day',
    // 构建版本号：每次发布新版都在此 +1，并让侧边导航显示，方便在真机上确认当前运行的是哪次构建
    version: '1.5.0'
  }
});
