/* 批量注入「失焦提交」：为所有 input/textarea 的 bindinput 处理器添加对应的 onXBlur，
   并在 WXML 标签上添加 bindblur。
   根因：真机上输入最后一个字符后立刻点击按钮/打开选择器，该字符的 bindinput 可能
   尚未同步到 this.data，而 bindblur 事件携带输入框完整当前值——失焦时提交可避免
   名称/数字被截断（「添加结果不正确」缺陷）。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', 'miniprogram', 'pages');

/* 特殊处理器（非标准 setData 单行模式，手工补充） */
const SPECIAL_JS = {
  'read/read.js': [
    {
      after: "onPageInput(e) {\n    const id = e.currentTarget.dataset.id;\n    this.setData({ ['form.pages.' + id]: e.detail.value });\n  },",
      code: "\n  onPageBlur(e) {\n    const id = e.currentTarget.dataset.id;\n    this.setData({ ['form.pages.' + id]: e.detail.value });\n  },"
    }
  ],
  'profile/profile.js': [
    {
      after: "onName(e) { store.setProfile({ name: e.detail.value }); this.refresh(); },",
      code: "\n  onNameBlur(e) { store.setProfile({ name: e.detail.value }); this.refresh(); },"
    },
    {
      after: "onSign(e) { store.setProfile({ sign: e.detail.value }); this.refresh(); },",
      code: "\n  onSignBlur(e) { store.setProfile({ sign: e.detail.value }); this.refresh(); },"
    },
    {
      after: "onTagInput(e) { this.setData({ tagInput: e.detail.value }); },",
      code: "\n  onTagBlur(e) { this.setData({ tagInput: e.detail.value }); },"
    }
  ]
};

let jsChanged = 0, wxmlChanged = 0, added = [];

/* ---------- 1. JS：注入 onXBlur ---------- */
for (const dir of fs.readdirSync(ROOT)) {
  const jsPath = path.join(ROOT, dir, dir + '.js');
  const rel = dir + '/' + dir + '.js';
  if (!fs.existsSync(jsPath)) continue;
  let src = fs.readFileSync(jsPath, 'utf8');
  const before = src;

  /* 标准模式：onX(e) { this.setData({ 'path': e.detail.value }); }, */
  src = src.replace(
    /(\n(\s*)(on\w+)\(e\) \{ this\.setData\(\{ '([\w.]+)': e\.detail\.value \}\); \},)/g,
    (m, line, indent, name, p) => {
      if (src.includes(name + 'Blur(')) return m; // 已存在
      added.push(rel + ' → ' + name + 'Blur (' + p + ')');
      return line + '\n' + indent + name + 'Blur(e) { this.setData({ \'' + p + '\': e.detail.value }); },';
    }
  );

  /* 特殊模式 */
  (SPECIAL_JS[rel] || []).forEach(s => {
    if (src.includes(s.after) && !src.includes(s.code.trim().slice(0, 20))) {
      src = src.replace(s.after, s.after + s.code);
      added.push(rel + ' → ' + s.code.trim().split('(')[0].trim());
    }
  });

  if (src !== before) { fs.writeFileSync(jsPath, src, 'utf8'); jsChanged++; }
}

/* ---------- 2. WXML：为 bindinput 标签补 bindblur ---------- */
for (const dir of fs.readdirSync(ROOT)) {
  const wxmlPath = path.join(ROOT, dir, dir + '.wxml');
  const jsPath = path.join(ROOT, dir, dir + '.js');
  if (!fs.existsSync(wxmlPath) || !fs.existsSync(jsPath)) continue;
  let wxml = fs.readFileSync(wxmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');
  const before = wxml;

  wxml = wxml.replace(/bindinput="(on\w+)"/g, (m, name) => {
    const blurName = name + 'Blur';
    /* 只在该页面真的定义了 Blur 处理器时才绑定 */
    if (!js.includes(blurName + '(')) return m;
    return m + ' bindblur="' + blurName + '"';
  });

  if (wxml !== before) { fs.writeFileSync(wxmlPath, wxml, 'utf8'); wxmlChanged++; }
}

console.log('JS 文件修改: ' + jsChanged + '，WXML 文件修改: ' + wxmlChanged);
console.log('新增 blur 处理器 ' + added.length + ' 个:');
added.forEach(a => console.log('  + ' + a));
