/* 背景主题：7 套预设 + 自定义 RGB 调色
   背景通过 pageStyle 内联到每个页面的根节点，并同步导航栏/窗口背景色 */
const THEMES = [
  { id: 'pink', name: '甜粉气泡', emoji: '🌸', bg: '#FFF4F8', bg2: '#F5EEFF', accent: '#F2689A', accentSoft: '#FFD6E7', navBg: '#FFEAF4' },
  { id: 'lavender', name: '薰衣草', emoji: '💜', bg: '#F6F1FC', bg2: '#EDE6FB', accent: '#9B7BD8', accentSoft: '#E3D8F8', navBg: '#EDE3FA' },
  { id: 'mint', name: '薄荷气泡', emoji: '🍃', bg: '#EFFBF6', bg2: '#E4F5F7', accent: '#4FB79A', accentSoft: '#C9EDE1', navBg: '#DFF5EC' },
  { id: 'sky', name: '晴空', emoji: '💙', bg: '#EFF6FE', bg2: '#E7F0FA', accent: '#5B9BD5', accentSoft: '#CFE7FA', navBg: '#DDEBF9' },
  { id: 'cream', name: '奶油', emoji: '🧁', bg: '#FFFAF0', bg2: '#FFF1DC', accent: '#E8A33D', accentSoft: '#FFE2B0', navBg: '#FBEED6' },
  { id: 'dusk', name: '暮霞', emoji: '🌇', bg: '#FFF3EE', bg2: '#F3ECFB', accent: '#E5836B', accentSoft: '#FFD9CB', navBg: '#FBE7DE' },
  { id: 'night', name: '暗夜护眼', emoji: '🌙', bg: '#F1EEF8', bg2: '#E9E3F4', accent: '#8F6FD4', accentSoft: '#DCD2F2', navBg: '#E7E0F5' }
];

const AVATARS = ['💗', '🌸', '🐱', '🐰', '⭐', '🍓', '🎀', '🦄', '🐻', '🌷', '🍡', '✨'];
const TAG_SUGGEST = ['终身学习者', '早起星人', '爱猫', '健身中', '存钱ing', '自媒体人', '书虫', '备考中', '手冲咖啡', '极简生活', '夜跑选手', '插画爱好者'];

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return {
    r: parseInt(v.slice(0, 2), 16) || 0,
    g: parseInt(v.slice(2, 4), 16) || 0,
    b: parseInt(v.slice(4, 6), 16) || 0
  };
}
function rgbToHex(r, g, b) {
  const p = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + p(r) + p(g) + p(b);
}
/* 由主色派生浅色背景/深色强调，保证可读性 */
function deriveTheme(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lighten = (n, k) => Math.round(n + (255 - n) * k);
  const darken = (n, k) => Math.round(n * (1 - k));
  const bg = rgbToHex(lighten(r, 0.955), lighten(g, 0.955), lighten(b, 0.955));
  const bg2 = rgbToHex(lighten(r, 0.88), lighten(g, 0.88), lighten(b, 0.88));
  const accent = rgbToHex(darken(r, 0.18), darken(g, 0.18), darken(b, 0.18));
  const accentSoft = rgbToHex(lighten(r, 0.62), lighten(g, 0.62), lighten(b, 0.62));
  const navBg = rgbToHex(lighten(r, 0.9), lighten(g, 0.9), lighten(b, 0.9));
  return { id: 'custom', name: '自定义', emoji: '🎨', bg, bg2, accent, accentSoft, navBg };
}

/* 页面根节点内联样式：动态背景 + 主题色 CSS 变量 */
function pageStyle(theme) {
  const t = theme || THEMES[0];
  return '--accent:' + t.accent + ';--accent-soft:' + t.accentSoft + ';' +
    'background:linear-gradient(165deg,' + t.bg + ' 0%,' + t.bg2 + ' 100%);min-height:100%;';
}

/* 全局应用：窗口背景色 + 导航栏颜色 */
function applyTheme(theme) {
  const t = theme || THEMES[0];
  try {
    wx.setBackgroundColor({ backgroundColor: t.bg, backgroundColorTop: t.bg2 });
  } catch (e) { /* 低版本忽略 */ }
  try {
    wx.setNavigationBarColor({ frontColor: '#000000', backgroundColor: t.navBg, animation: { duration: 200, timingFunc: 'linear' } });
  } catch (e) { /* 低版本忽略 */ }
}

function themeById(id) {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

module.exports = { THEMES, AVATARS, TAG_SUGGEST, hexToRgb, rgbToHex, deriveTheme, pageStyle, applyTheme, themeById };
