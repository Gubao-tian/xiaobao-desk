/* 左侧纵向导航配置：12 项（桌面 + 10 个功能菜单 + 我的） */
const MODULES = [
  { id: 'home', name: '桌面', icon: '🏠' },
  { id: 'plan', name: '每日计划', icon: '📅' },
  { id: 'course', name: '课程学习', icon: '📚' },
  { id: 'workout', name: '锻炼身体', icon: '🏃' },
  { id: 'exam', name: '备考计划', icon: '📖' },
  { id: 'finance', name: '理财', icon: '💰' },
  { id: 'media', name: '自媒体', icon: '🎬' },
  { id: 'read', name: '阅读', icon: '📖' },
  { id: 'skill', name: '技能训练', icon: '⭐' },
  { id: 'memo', name: '备忘录', icon: '🗒️' },
  { id: 'review', name: '周复盘', icon: '🌙' },
  { id: 'timeline', name: '日历时间轴', icon: '🗓️' },
  { id: 'assistant', name: 'AI 小宝', icon: '🤖' },
  { id: 'templates', name: '模板库', icon: '📋' },
  { id: 'profile', name: '我的', icon: '🪄' }
];
const PAGE_PATH = id => '/pages/' + id + '/' + id;
module.exports = { MODULES, PAGE_PATH };
