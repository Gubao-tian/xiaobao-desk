# 小宝工作台 · 项目文档

> MY COZY DESK｜一个「记录生活 + 自我管理」的个人工作台
> 支持 **微信小程序** 与 **Web / PWA（可安装到手机当 App）** 双端
> 文档更新时间：2026-10-21

---

## 一、快速了解

| 项目 | 说明 |
| --- | --- |
| 应用名 | 小宝工作台（MY COZY DESK） |
| 形态 | 微信小程序 + 单文件 Web 应用（PWA，可安装到桌面/手机） |
| 当前版本 | 小程序 **v1.5.0** ｜ Web **v1.6.0** |
| 主要技术 | 小程序原生框架（WXML/WXSS/JS）+ 原生 HTML/CSS/JS（无打包依赖） |
| 数据存储 | 本地优先（localStorage / Storage）+ 云端同步（可选） |
| 代码片段 | `index.html` 约 3630 行；小程序 16 个页面 + 11 个工具模块 |
| 测试状况 | 29 个测试脚本、**350+ 条断言全绿**（见「测试体系」章节） |

**一句话定位**：把每天的计划、课程、运动、备考、花销、自媒体、读书、技能、便签、周复盘放在一起，配合日历热力图、时间轴、成长报告和自动提醒。

---

## 二、目录结构

```
项目根目录/
├── index.html                  # Web / PWA 全量应用（单文件，含全部 15 个模块）
├── sw.js                       # Service Worker（离线缓存、推送占位）
├── manifest.webmanifest        # PWA 清单（可安装为 App）
├── icon-*.png / apple-touch-icon.png
├── 证据报告.html                # 可视化证据报告（添加流程截图）
├── miniprogram/
│   ├── app.js / app.json / app.wxss
│   ├── pages/                  # 16 个页面
│   │   ├── home/               # 桌面（打卡+日历+搜索）
│   │   ├── plan/               # 每日计划
│   │   ├── course/             # 课程学习
│   │   ├── workout/            # 锻炼身体
│   │   ├── exam/               # 备考计划
│   │   ├── finance/            # 理财（含储蓄目标）
│   │   ├── media/              # 自媒体（灵感 + 发布）
│   │   ├── read/               # 阅读（书架 + 摘抄）
│   │   ├── skill/              # 技能训练
│   │   ├── memo/               # 备忘录
│   │   ├── review/             # 周复盘 + 自动成长报告
│   │   ├── timeline/           # 日历时间轴
│   │   ├── assistant/          # AI 小宝
│   │   ├── templates/          # 模板库
│   │   ├── profile/            # 我的（名片/主题/备份/战绩卡）
│   │   └── remind/             # 提醒与通知设置（二级页）
│   ├── components/side-nav/    # 侧边导航抽屉 + 导航按钮
│   ├── utils/                  # 通用逻辑（见下表）
│   ├── cloudfunctions/reminder/ # 微信订阅消息云函数模板
│   └── node_modules/@tencent-ai/workbuddy-cloud-sdk
├── .spec/                      # 测试与诊断脚本（29 个）
│   ├── validate.js             # 工程静态校验（16 页面 × 多项约定）
│   ├── test_*.js               # 功能/回归测试
│   ├── repro_*.js              # 复现脚本
│   ├── probe_*.js / shot*.js   # 探针与截图脚本
│   └── PAGES_SPEC.md           # 页面规格说明
└── .workbuddy/memory/          # 项目工作日志（按日期）
```

### 工具模块（`miniprogram/utils/`）

| 文件 | 职责 |
| --- | --- |
| `store.js` | 数据层：DB 读写、默认结构、日切、通用增删改 helper |
| `util.js` | 日期/格式化/周计算等基础工具 |
| `theme.js` | 主题与自定义背景 |
| `nav.js` | 侧边导航模块清单 |
| `search.js` | 全局搜索（跨模块检索） |
| `report.js` | 自动成长报告生成 |
| `remind.js` | 本地提醒兜底（打开/回前台时检查） |
| `subscribe.js` | 微信订阅消息模板配置 |
| `sync.js` | 云端登录与数据同步 |
| `cloud.js` | 云端 SDK 初始化 |
| `workbuddy-cloud-diagnostics.js` | 云端诊断 |

---

## 三、功能模块清单（15 个）

| # | 模块 | 小程序页面 | 能力要点 |
| --- | --- | --- | --- |
| 1 | 🏠 桌面 | `pages/home` | 打卡签到、连续天数、日历热力图、今日日程、全局搜索、时钟问候 + 每日一句 |
| 2 | 📅 每日计划 | `pages/plan` | 增删的计划项、优先级、勾选完成、今日进度 |
| 3 | 📚 课程学习 | `pages/course` | 课程名称/颜色/章节进度、记录学习时长 |
| 4 | 🏃 锻炼身体 | `pages/workout` | 内置运动类型 + 自定义运动、时长与消耗、今日打卡 |
| 5 | 📖 备考计划 | `pages/exam` | 科目、考试日期倒计时、单元进度 |
| 6 | 💰 理财 | `pages/finance` | 收入/支出记录、分类环形图、月度支出、储蓄目标 |
| 7 | 🎬 自媒体 | `pages/media` | 灵感池（待创作/已创作）、发布登记（平台/标题/曝光） |
| 8 | 📖 阅读 | `pages/read` | 书架进度（**累加页数**）、联网搜书、阅读时长、摘抄本 |
| 9 | ⭐ 技能训练 | `pages/skill` | 技能列表、练习打卡与次数 |
| 10 | 🗒️ 备忘录 | `pages/memo` | 便签、置顶、颜色 |
| 11 | 🌙 周复盘 | `pages/review` | 三段式复盘（做得好/待改进/下周）+ **自动成长报告** |
| 12 | 🗓️ 日历时间轴 | `pages/timeline` | 选某一天，汇总当天全部模块记录 |
| 13 | 🤖 AI 小宝 | `pages/assistant` | 快捷问题 + 自由追问（小程序走云端大模型，Web 为本地规则） |
| 14 | 📋 模板库 | `pages/templates` | 5 个计划模板 + 1 个复盘模板 + 3 个便签模板，一键套用 |
| 15 | 🪄 我的 | `pages/profile` | 名片、标签、头像、背景主题、数据备份、战绩卡片、云同步 |
| — | 🔔 提醒与通知 | `pages/remind` | 二级设置页：计划/锻炼按时间点、喝水按间隔 |

---

## 四、本轮新增的 10 项能力

| 编号 | 能力 | 实现要点 |
| --- | --- | --- |
| P0-1 | **全模块编辑 + 删除** | `store.js` 新增 `removeItem/updateItem/removeDayItem/updateDayItem`；15 模块双端均支持「编辑」，且不产生重复条目 |
| P0-2 | **提醒 / 通知** | 小程序：本地弹窗兜底 + 订阅消息授权 + 云函数模板；Web：浏览器 Notification + Service Worker 推送占位 |
| P0-3 | **数据导出 / 备份** | Web：整库 JSON 下载与恢复；小程序：复制 JSON + 生成文件分享 |
| P1-4 | **全局搜索** | 跨 12 类数据检索，结果可一键跳转到对应模块（Web 支持 Ctrl/Cmd+K） |
| P1-5 | **日历热力图** | 按当天「任务/运动/学习/阅读」活跃度着色（lv1~lv3），打卡日强色高亮 |
| P1-6 | **日历时间轴** | 新增模块：任意一天的全部记录聚合视图 |
| P1-7 | **自动成长报告** | 自动汇总本周数据、对比上周升降，可一键写进复盘 |
| P2-8 | **AI 小宝助理** | 小程序接云端大模型（流式输出、带数据上下文）；Web 提供本地规则建议 |
| P2-9 | **模板库** | 9 个模板一键套用，分别落到计划 / 复盘 / 便签 |
| P2-10 | **战绩卡片** | Canvas 绘制数据卡片，小程序存相册转发，Web 下载 PNG |

---

## 五、数据模型

Web 端 localStorage 键：`gubao_desk_v1`（小程序同结构）
加载时以默认结构补齐缺失字段，因此**老数据升级不会丢**。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `v` / `createdAt` | number / string | 数据版本与创建日 |
| `theme` / `themeCfg` | string / object | 日/夜模式与自定义背景 |
| `profile` | object | 昵称、签名、头像、标签 |
| `checkins` | map | 日期 → `{at}` 打卡记录 |
| `plans` | map | 日期 → `[{id,name,done,prio}]` |
| `courses` | array | 课程（名称/进度/备注） |
| `studyLog` / `readLog` | map | 日期 → 分钟数 |
| `workout` | map | 日期 → `[{id,type,min,burn}]` |
| `exam` | array | 备考科目 |
| `finance` | array | 收支流水 `{type,amount,cat,note,date}` |
| `goals` | array | 储蓄目标 `{name,target,saved}` |
| `ideas` / `pubs` | array | 自媒体灵感 / 发布记录 |
| `books` / `quotes` | array | 书架 / 摘抄 |
| `skills` / `skillLog` | array | 技能 / 练习记录 |
| `memos` | array | 便签 |
| `reviews` | map | 周起始日 → `{good,bad,next,at}` |
| `reminders` | object | `plan/workout`（时间点）与 `water`（间隔） |
| `notifEnabled` / `reminderLog` | bool / map | 通知授权与去重记录 |

---

## 六、双端差异对照

| 主题 | 小程序 | Web / PWA |
| --- | --- | --- |
| 数据存放 | 微信本地 Storage | 浏览器 localStorage（`gubao_desk_v1`） |
| 数据互通 | ⚠️ **两端数据不互通**，需各自录入或用「备份 JSON」搬运 | 同左 |
| AI 助理 | 云端大模型（需登录） | 本地规则建议（无网可用） |
| 提醒 | 打开小程序时弹窗；订阅消息需公众号模板 | 浏览器通知（需授权） |
| 备份 | 复制 JSON / 生成文件分享 | 导出与导入 JSON |
| 表单 | `<form bindsubmit>`（规避真机 setData 时序问题） | 原生 DOM 弹层 |
| 弹层遮罩 | **完全不透明**（避免"看到上一层"的错觉） | 半透明 + 模糊 |
| 导航按钮 | 左上角轻量卡片按钮，抽屉打开时隐藏 | 同样：左上角，抽屉打开时隐藏 |
| 每次修改后 | 需**重新发布试用小程序**才在真机生效 | 浏览器刷新即可（必要时 Ctrl+F5） |

---

## 七、测试体系

所有脚本在 `.spec/`，运行前需设置依赖路径：

```bash
export NODE_PATH="C:/Users/GUBAO/.workbuddy/binaries/node/workspace/node_modules"
node .spec/validate.js          # 工程静态校验（建议每次改动后先跑）
node .spec/test_web_regress.js  # Web 快速回归
```

> Web 类脚本使用本机 Chrome（puppeteer-core）：`C:/Program Files/Google/Chrome/Application/chrome.exe`，手机视口 390×844。

### 当前通过情况（2026-10-21 实测全绿）

| 分类 | 脚本 | 结果 |
| --- | --- | --- |
| 工程校验 | `validate.js` | **0 问题**（16 页面 × 约定检查） |
| 表单提交 | `test_all_form_submit.js` | 16/16 |
| 编辑删除 | `test_edit_delete.js` | 19/19 |
| 遮罩点击 | `test_mask_tap.js` | 20/20 |
| 选择器降级 | `test_picker_fallback.js` | 33/33 |
| 真机时序 | `test_real_timing.js` | 8/8 |
| 失焦提交 | `test_plan_blur_commit.js` | ALL PASS |
| 云同步 | `test_cloud_sync.js` | 0 问题 |
| 理财复现 | `repro_finance_cat.js` | 24/24 |
| 阅读+技能复现 | `repro_read_skill.js` | 36/36 |
| 计划复现 | `repro_mp_plan.js` / `repro_plan_add.js` / `repro_plan_incorrect.js` | 19/19 · 通过 · 15/15 |
| Web 回归 | `test_web_regress.js` | 8/8 |
| Web 我的 | `test_web_profile.js` | 16/16 |
| Web 全模块（手机端） | `test_web_all_modules_mobile.js` | 42/42 |
| Web 搜索 | `test_web_search.js` | 14/14 |
| Web 提醒 | `test_web_reminders.js` | 6/6 |
| Web 备份 | `test_web_backup.js` | 7/7 |
| Web 时间轴 | `test_web_timeline.js` | 7/7 |
| Web 成长报告 | `test_web_report.js` | 6/6 |
| Web AI 助理 | `test_web_assistant.js` | 6/6 |
| Web 模板库 | `test_web_templates.js` | 5/5 |
| Web 战绩卡 | `test_web_sharecard.js` | 5/5 |
| Web 搜书 | `test_web_booksearch.js` | 7/7 |
| Web 日历详情 | `test_web_daydetail.js` | 10/10 |
| Web 累加页数 | `test_web_pageadd.js` | 6/6 |
| Web 健壮性 | `test_web_robust.js` | 10/10 |
| Web 导航按钮 | `probe_collapse.js` | 7/7 |

> 注：全模块测试中的 4 条 console 提示为 `file://` 打开时 manifest 的跨域警告，属本地打开方式限制，**不影响任何功能**；用 http(s) 方式访问不会出现。

---

## 八、常用操作说明

| 想做的事 | 小程序路径 | Web 路径 |
| --- | --- | --- |
| 看今天/某天做了什么 | 桌面 → 点日历任意一天 | 桌面 → 点日历格子（弹窗显示当天全部记录） |
| 记当次读了几页 | 阅读 → 书架 → 输入本次页数 → 累加 | 同左（点「累加页数」） |
| 找某个关键词 | 桌面顶部搜索框 | 顶栏「🔍 搜索」或 Ctrl/Cmd+K |
| 改错一本书的信息 | 阅读 → 书籍「✎ 编辑」 | 同左 |
| 查书籍信息（作者/页数） | 添加书籍时点「🔍 搜书」→ 复制到浏览器搜 | 同左 → 直接打开豆瓣/必应搜索 |
| 一键生成周总结 | 周复盘 → 生成成长报告 → 写进"做得好" | 同左 |
| 备份数据 | 我的 → 数据备份 → 复制 JSON | 我的 → 导出备份 JSON（可导入恢复） |
| 换背景 | 我的 → 主题/自定义背景 | 同左 |
| 分享成就感 | 我的 → 生成战绩卡片 → 存相册 | 我的 → 下载卡片 PNG |

---

## 九、部署与使用方式

### Web / PWA
1. 双击 `index.html` 即可使用（数据保存在打开它的那个浏览器里）
2. 想安装成 App / 离线使用：用浏览器打开后点侧边栏「安装到手机（App）」
3. 改动后**务必 Ctrl+F5 强制刷新**（侧边栏底部显示 `Web v1.6.0` 即为最新）

### 微信小程序
1. 用微信开发者工具打开 `miniprogram/` 目录
2. 「上传」→ 在微信公众平台把该版本设为**体验版 / 提交审核**
3. 用户重新扫码后，侧边抽屉底部应显示 `v1.5.0` 即表示已更新

### 云同步（可选）
在「我的」页执行「立即同步」，会走 `utils/sync.js` 的登录与推拉逻辑；未登录时所有功能不受影响，仅云同步不可用。

---

## 十、待办与已知事项

| 事项 | 状态 | 说明 |
| --- | --- | --- |
| 微信订阅消息后台推送 | ⏳ 需配置 | 要在公众平台申请模板，把模板 ID 填进 `utils/subscribe.js` 的 `TMPL_IDS`，并部署 `cloudfunctions/reminder`。未配置时本地提醒（打开小程序弹窗 / 浏览器通知）照常工作 |
| 两端数据互通 | ⚠️ 暂不支持 | 小程序与 Web 各自本地存储，跨端搬运请用「备份 JSON」 |
| AI 助理（Web） | ℹ️ 降级实现 | Web 无云端 SDK，使用本地规则建议；完整大模型体验在小程序端 |
| 小程序真机验证 | ⏳ 需你操作 | 本机未安装微信开发者工具，小程序依靠冒烟测试覆盖，**UI 需你在真机确认** |
| 每次改版后 | ⏳ 需你操作 | 小程序必须重新发布试用版才会生效 |

---

## 十一、本轮开发时间线（2026-10-21）

| 阶段 | 内容 |
| --- | --- |
| 第一阶段~ | picker 改为内联按钮组（预览面板不可交互问题）、12 模块手机端 42/42 实测 |
| 第十阶段 | 真机「不能添加图书」：全弹层改 `<form bindsubmit>`，规避 blur/tap 时序问题 |
| 第十一~十三阶段 | 解决弹层「重叠/点输入框消失」：半透明遮罩 → 不透明、**tap 冒泡」用 `target===currentTarget` 精准拦截（v1.4.0） |
| 证据阶段 | 产出「证据报告.html」（真实 Chrome 逐步截图，证明添加与全模块可用） |
| 功能阶段 | 完成 P0-1 ~ P2-10 共 10 项能力（双端），版本升至 v1.5.0 |
| 反馈优化 ① | 首页时钟/日签内容居中 |
| 反馈优化 ② | 添加书籍支持「联网搜书」提示（豆瓣 + 必应） |
| 反馈优化 ③ | 模板库空白加固：渲染兜底卡 + 版本号可见 + PWA 缓存版本升级 |
| 反馈优化 ④ | 日历点一天 → 查看当天全部记录（首版误做成补打卡，按澄清重做） |
| 反馈优化 ⑤ | 书架页码从「覆盖」改为「累加」 |
| 反馈优化 ⑥ | 导航按钮移到左上角 + 打开抽屉时隐藏 + 样式融合（先 Web 后小程序） |
| 反馈优化 ⑦ | 全局搜索盲区修复：便签正文、储蓄目标、课程备注纳入检索 |

---

### 附：容易踩的坑（写给未来的自己）

1. **测试注入数据时不要 reload** —— 应用有 `beforeunload` 落盘机制，会把内存数据写回，覆盖注入；测试请直接操作内存 `DB`。
2. **`<image>` 必须自闭合** —— 写成 `<image></image>` 会被静态校验判为标签不配平。
3. **有 `bindinput` 的 input 必须配 `bindblur`** —— 缓存校验约定。
4. **新页面若在侧边导航里**，需要同时登记 `utils/nav.js`、`app.json`，并遵循页面约定（side-nav / onNav / refresh / pageStyle / 无 px 单位）。
5. **只读聚合页与二级设置页**可加入 `READONLY_PAGES` / `SETTINGS_PAGES` 豁免约定的检查项。
6. **用户看到旧界面**时，先让他确认版本号（小程序抽屉底部 / Web 侧边栏底部），再排查。
