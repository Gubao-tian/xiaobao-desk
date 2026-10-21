# -*- coding: utf-8 -*-
"""给 11 个功能页面统一接入动态背景 pageStyle"""
import io, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'pages')
PAGES = ['home', 'plan', 'course', 'workout', 'exam', 'finance', 'media', 'read', 'skill', 'memo', 'review']
THEME_LINE = "const T = require('../../utils/theme.js');\n"

changed = []
for p in PAGES:
    # ---------- WXML ----------
    wxml_path = os.path.join(ROOT, p, p + '.wxml')
    with io.open(wxml_path, encoding='utf-8') as f:
        w = f.read()
    if 'class="page"' in w and '{{pageStyle}}' not in w:
        w = w.replace('<view class="page">', '<view class="page" style="{{pageStyle}}">', 1)
        with io.open(wxml_path, 'w', encoding='utf-8') as f:
            f.write(w)
        changed.append(p + '.wxml')

    # ---------- JS ----------
    js_path = os.path.join(ROOT, p, p + '.js')
    with io.open(js_path, encoding='utf-8') as f:
        s = f.read()

    # 1) 引入 theme 模块
    if "utils/theme.js" not in s:
        m = re.search(r"const u = require\('\.\./\.\./utils/util\.js'\);\n", s)
        if not m:
            print('[FAIL] %s: 未找到 util require' % p); sys.exit(1)
        s = s[:m.end()] + THEME_LINE + s[m.end():]

    # 2) data 中增加 pageStyle 初始值
    if re.search(r'\n\s*pageStyle:', s) is None:
        m = re.search(r'\n(\s*)data: \{\n', s)
        if not m:
            print('[FAIL] %s: 未找到 data{' % p); sys.exit(1)
        indent = m.group(1) + '  '
        s = s[:m.end()] + indent + "pageStyle: '',\n" + s[m.end():]

    # 3) refresh() 内首个 setData 注入 pageStyle
    rpos = s.index('refresh() {')
    spos = s.index('this.setData({', rpos)
    after = s[spos + len('this.setData({'):]
    if after.startswith('\n'):
        # 多行对象：在 { 后插入一行
        ins = spos + len('this.setData({')
        line = '      pageStyle: T.pageStyle(store.currentTheme()),\n'
        s = s[:ins] + line + s[ins:]
    else:
        # 单行对象：在 }); 前插入
        end = s.index('});', spos)
        s = s[:end] + ', pageStyle: T.pageStyle(store.currentTheme()) ' + s[end:]

    with io.open(js_path, 'w', encoding='utf-8') as f:
        f.write(s)
    changed.append(p + '.js')

print('OK:', len(changed))
for c in changed:
    print(' -', c)
