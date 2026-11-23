# 小宝工作台 (MY COZY DESK) v1.8.0

本次升级新增**「相册」模块**：在网页版里上传并管理本地照片和视频，全部数据保存在你自己的浏览器中，不上传任何云端。

## 新增功能：相册
- **上传**：从手机 / 电脑多选照片和视频（`image/*` + `video/*`），单文件上限 200MB
- **本地存储**：IndexedDB 本地媒体库（`gubao_media_v1`），容量可达数百 MB，PWA 安装后同样可用；不支持 IndexedDB 的环境会给出明确提示
- **浏览**：网格展示（手机 2 列 / 桌面自适应列数），照片缩略图 + 视频首帧（▶ 标记），「全部 / 照片 / 视频」筛选
- **统计**：文件数、总体积、浏览器存储占用（`navigator.storage.estimate`）
- **查看**：点文件弹出大图或可直接播放的视频
- **删除**：弹窗内删除 + 卡片右上角删除（触屏可达、常显），均有不可撤销确认

## 端侧
- 导航新增「相册」项（现共 17 项），插入在日历之后
- 版本升级 1.7.0 → 1.8.0；Service Worker 缓存版本同步 `xiaobao-desk-v1.8.0`
- 旧用户需强刷一次（Ctrl+F5）或重装 PWA 获取新版本；已有数据不受影响

## 质量保障
- 新增 `test_web_gallery.js`（26 断言）：页面内 canvas 生成 PNG、MediaRecorder 录制 WebM，经 DataTransfer 注入文件输入框，走与用户手选完全相同的上传 → IndexedDB 流程
- 全量回归全绿：lunar 45/45 · calendar 24/24 · profile 16/16 · robust 10/10 · daydetail 10/10 · all-modules 42/42（0 JS 错误）· gallery 26/26 · validate 0 issues

## 已知取舍
- 相册数据按浏览器隔离：手机浏览器与电脑浏览器各自保存，互不同步（本地存储设计；如需跨设备同步需引入云存储，暂为非目标）

## 运行方式
- 线上站点：https://gubao-tian.github.io/xiaobao-desk/
- 或本地静态托管根目录 `index.html`；数据全部存于浏览器本地，无需后端
