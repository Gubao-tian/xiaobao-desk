# 小宝工作台 · MY COZY DESK

一个把 16 类日常记录收敛到同一入口的个人效率工作台。

**自 v1.7.0 起以 Web / PWA 为主**（手机浏览器 + 电脑浏览器都能用，可添加到主屏幕或桌面，离线可用）；小程序源码保留在 `miniprogram/` 但不再迭代。

记录 → 可视化 → 回顾，形成自我管理闭环。

## 产品能力

| 层级 | 能力 |
| --- | --- |
| 记录层 | 16 个模块：桌面、每日计划、课程学习、锻炼身体、备考计划、理财、自媒体、阅读、技能训练、备忘录、周复盘、**日历（阴阳历）**、日历时间轴、AI 小宝、模板库、我的 |
| 组织层 | 全模块编辑与删除、模板库、优先级与状态管理 |
| 回顾层 | 日历热力图、日历时间轴、自动成长报告、全局搜索 |
| 激励层 | 打卡连续天数、战绩卡片、彩带动效 |
| 提醒层 | 计划 / 锻炼 / 喝水本地提醒，微信订阅消息（待配置模板） |
| 智能层 | AI 小宝助理（云端大模型 / 本地规则降级） |
| 数据层 | 本地优先存储、JSON 备份导出与恢复、可选云同步 |

## 日历（阴阳历）

- 月视图网格：公历大字 + 农历小字，今天高亮，打卡日与有记录日分级着色
- 农历 1900–2100 本地算法，含闰月，并显示干支与生肖
- 二十四节气用**太阳视黄经天文算法**精确计算（经验公式在闰年会整体偏移一天）
- 农历节日（春节、元宵、端午、七夕、中秋、重阳、腊八等）与公历节日
- 点任意一天弹出当天全部记录；底部有本月节气与节日清单

## 添加到主屏幕 / 桌面

打开「我的」页 → 点 **「添加到桌面 / 主屏幕」**：

- iPhone：按引导用 Safari 的「分享 → 添加到主屏幕」
- 安卓 / 电脑 Chrome：直接调起安装，装完可全屏运行、断网也能用

## 目录结构

```
.
├── index.html                    # Web / PWA 单文件应用（无构建依赖）
├── sw.js                         # Service Worker（离线缓存）
├── manifest.webmanifest          # PWA 安装清单
├── icon-*.png, apple-touch-icon.png
├── miniprogram/                  # 微信小程序（v1.7.0 起不再迭代，仅保留源码）
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

## 小程序端（已停止迭代）

`miniprogram/` 保留 v1.5.0 源码。如需运行：用微信开发者工具导入该目录、填写 AppID、编译预览。
后续新功能（如阴阳历日历）只在 Web / PWA 端提供。

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
node .spec/test_web_calendar.js      # 日历页：阴阳历 / 节气 / 节日 / 点天看记录
node .spec/test_web_search.js
node .spec/test_web_daydetail.js

# 农历与节气算法单测（直接抽取 index.html 中的函数执行）
node .spec/test_lunar_algo.js
```

已覆盖 31 个测试脚本、470+ 条断言。

## 设计约束（踩过的坑）

| 约束 | 方案 |
| --- | --- |
| 真机 setData 异步 + blur/tap 时序不确定 | 弹层全面使用 `<form bindsubmit>` |
| 点输入框导致弹层消失（事件冒泡） | 遮罩关闭用 `e.target === e.currentTarget` 判定 |
| 半透明遮罩被感知为界面重叠 | 小程序弹层遮罩改为完全不透明 |
| 旧缓存让用户看到过期界面 | 版本号可见 + Service Worker 版本号升级 |
| 小程序无法打开外部浏览器 | 「联网搜书」改为复制关键词到剪贴板 |
| picker 在部分环境不可交互 | 枚举选择改为内联按钮组 |
| 节气经验公式（寿星公式）在闰年整体偏移一天 | 改用太阳视黄经天文算法二分求交点，按北京时间取值 |
| 农历日「初十以上」格式化易错 | 三十天名称改为查表，不再拼接 |

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
