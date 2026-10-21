/* 云服务客户端：全小程序唯一初始化处
   publicConfig 来自 workbuddy_cloud_service 激活结果，是小程序端可安全内置的全部配置 */
const publicConfig = {
  endpoint: 'https://mp-api.app.workbuddy.host',
  publishableKey: 'wbpk_ZcCFIKSesfyiQjzc3gNjkn_fuCVKBBXPs8eUSisobBKxpEU2ERO6xlM'
};

let cloud = null;

/* 惰性创建客户端：未安装/未构建 npm 时不会在加载期抛错，本地模式照常可用 */
function getCloud() {
  if (cloud) return cloud;
  const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram');
  const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics');
  cloud = createMiniProgramWorkBuddyCloud({
    endpoint: publicConfig.endpoint,
    publishableKey: publicConfig.publishableKey,
    wx: createDiagnosticWx(wx)
  });
  return cloud;
}

/* 云数据库表名：每个用户一行，data 列保存整个工作台快照 */
const TABLE = 'workspace_data';

module.exports = { publicConfig, getCloud, TABLE };
