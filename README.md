# 小宝工作台 · MY COZY DESK

一个把 15 类日常记录收敛到同一入口的个人效率工作台，双端交付：**微信小程序** + **单文件 Web / PWA**。

记录 → 可视化 → 回顾，形成自我管理闭环。

## 产品能力

| 层级 | 能力 |
| --- | --- |
| 记录层 | 15 个模块：桌面、每日计划、课程学习、锻炼身体、备考计划、理财、自媒体、阅读、技能训练、备忘录、周复盘、日历时间轴、AI 小宝、模板库、我的 |
| 组织层 | 全模块编辑与删除、模板库、优先级与状态管理 |
| 回顾层 | 日历热力图、日历时间轴、自动成长报告、全局搜索 |
| 激励层 | 打卡连续天数、战绩卡片、彩带动效 |
| 提醒层 | 计划 / 锻炼 / 喝水本地提醒，微信订阅消息（待配置模板） |
| 智能层 | AI 小宝助理（小程序云端大模型 / Web 端本地规则降级） |
| 数据层 | 本地优先存储、JSON 备份导出与恢复、可选云同步 |

## 目录结构

```
.
├── index.html                    # Web / PWA 单文件应用（无构建依赖）
├── sw.js                         # Service Worker（离线缓存）
├── manifest.webmanifest          # PWA 安装清单
├── icon-*.png, apple-touch-icon.png
├── miniprogram/                  # 微信小程序
│   ├── app.js / app.json / app.wxss
│   ├── pages/                    # 16 个页面
│   ├── components/side-nav/      # 侧边导航抽屉
│   ├── utils/                    # store / search / report / remind / theme
│   └── cloudfunctions/           # 云函数（可选）
├── docs/
│   ├── PRD.md                    # 产品需求文档（Markdown）
│   ├── PRD.html                  # PRD 阅读版
│   ├── README.md                 # 项目总览与使用说明
│   └── 项目总览.html
└── .spec/                        # 测试与规格
    ├── PAGES_SPEC.md             # 页面规格说明
    ├── validate.js               # 工程静态校验
    └── test_*.js                 # 冒烟 / 回归测试
```

## 运行 Web 端

`index.html` 是自包含单文件，直接双击即可用；也可起一个静态服务以获得 PWA 安装与离线能力：

```bash
python -m http.server 8080
# 打开 http://localhost:8080
```

> 改动后请 `Ctrl + F5` 强刷。Web 端注册了 Service Worker，普通刷新可能仍在跑旧缓存。

## 运行小程序端

1. 用微信开发者工具导入 `miniprogram/` 目录
2. 填写自己的 AppID（或使用测试号）
3. 编译预览；改动后需重新**上传体验版**才会在手机上生效

## 测试

需要本地 Chrome 与 puppeteer-core。测试脚本运行在真实 Chrome、移动视口 390×844 下。

```bash
# 静态校验：结构 / 约定 / rpx 单位 / 数据层单测 / 页面冒烟
node .spec/validate.js

# 小程序逻辑测试
node .spec/test_all_form_submit.js
node .spec/test_edit_delete.js
node .spec/test_mask_tap.js
node .spec/test_picker_fallback.js
node .spec/test_real_timing.js
node .spec/repro_read_skill.js

# Web 端真实浏览器测试（需先装 puppeteer-core）
npm i puppeteer-core
node .spec/test_web_all_modules_mobile.js
node .spec/test_web_search.js
node .spec/test_web_daydetail.js
```

已覆盖 29 个测试脚本、350+ 条断言。

## 设计约束（踩过的坑）

| 约束 | 方案 |
| --- | --- |
| 真机 setData 异步 + blur/tap 时序不确定 | 弹层全面使用 `<form bindsubmit>` |
| 点输入框导致弹层消失（事件冒泡） | 遮罩关闭用 `e.target === e.currentTarget` 判定 |
| 半透明遮罩被感知为界面重叠 | 小程序弹层遮罩改为完全不透明 |
| 旧缓存让用户看到过期界面 | 版本号可见 + Service Worker 版本号升级 |
| 小程序无法打开外部浏览器 | 「联网搜书」改为复制关键词到剪贴板 |
| picker 在部分环境不可交互 | 枚举选择改为内联按钮组 |

## 数据与隐私

默认**不上传任何数据**。Web 端数据存在 `localStorage`（键 `gubao_desk_v1`），小程序端存在本地 Storage。云端同步需用户主动登录触发。

## 文档

- [产品需求文档（PRD）](docs/PRD.md)
- [项目总览](docs/README.md)

## 在线体验

- Web 版（PWA，可直接安装到手机桌面）：https://gubao-tian.github.io/xiaobao-desk/

> 首次打开若显示旧界面，请强刷一次（`Ctrl/Cmd + Shift + R`）。Service Worker 会在后台更新缓存。

## License

[MIT](LICENSE) © 2026 Gubao-tian
