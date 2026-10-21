// 微信云函数：发送订阅消息（可选部署）
// ============================================================
// 作用：小程序关闭后，由服务端在提醒时间点调用本函数，向用户推送「微信服务通知」。
//
// 部署步骤：
//   1. cd miniprogram/cloudfunctions/reminder && npm install
//   2. 在微信开发者工具右键本目录 -> 上传并部署（云端安装依赖）
//   3. 在微信公众平台申请订阅消息模板，把模板 ID 填到下方 TEMPLATE_ID
//   4. 把 miniprogram/utils/subscribe.js 的 TMPL_IDS 也改成同一个 ID
//
// 注意：微信订阅消息是「用户授权一次 → 才能发一条」，所以小程序端每天首次
// 打开时会再次 wx.requestSubscribeMessage 拉授权；本函数只负责「发」。
//
// 字段名（thing1 / time2 等）必须与你在公众平台申请的模板一一对应，
// 这里只是示例，请按实际模板调整。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const TEMPLATE_ID = process.env.TEMPLATE_ID || 'YOUR_TEMPLATE_ID';

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { type, time } = event || {};
  const conf = {
    plan:    { title: '今日计划提醒', kw1: '你今天还有计划没完成，去看看吧', kw2: time || '' },
    workout: { title: '锻炼提醒',     kw1: '该动一动啦，今天的运动打卡还没完成', kw2: time || '' },
    water:   { title: '喝水提醒',     kw1: '记得喝杯水，给身体补点水',         kw2: time || '' }
  };
  const c = conf[type] || conf.plan;
  if (!TEMPLATE_ID || TEMPLATE_ID === 'YOUR_TEMPLATE_ID') {
    return { ok: false, err: 'TEMPLATE_ID 未配置' };
  }
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: OPENID,
      templateId: TEMPLATE_ID,
      page: '/pages/home/home',
      data: {
        thing1: { value: c.title },
        thing2: { value: c.kw1 },
        time2:  { value: c.kw2 }
      }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, err: e.message };
  }
};
