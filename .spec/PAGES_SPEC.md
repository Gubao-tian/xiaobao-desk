# 小程序页面实现规范（必读，所有页面必须严格遵守）

## 工程信息
- 项目根：`E:/work  buddy/2026-10-20-18-11-03/miniprogram`
- 已有可参考的完整范例页面：`pages/home/home.{json,js,wxml,wxss}` —— **先读它，照它的风格写**
- 设计系统：`app.wxss`（已定义 CSS 变量与通用类），**不要重新定义主题色，直接用 var(--xxx)**
- 工具：`utils/util.js`、`utils/store.js`、`utils/nav.js`（先读这三个文件，只用里面已有的函数）

## 硬性规则
1. 单位一律用 `rpx`，禁止 `px`；不要写 SVG，图标统一用 emoji。
2. 每个页面 4 个文件：`<page>.json / .js / .wxml / .wxss`，放在 `miniprogram/pages/<id>/` 下。
3. 页面 json 固定格式：
```json
{
  "navigationBarTitleText": "<页面名>",
  "enablePullDownRefresh": true,
  "usingComponents": { "side-nav": "/components/side-nav/side-nav" }
}
```
4. 每个页面 WXML 第一行必须是：
```xml
<side-nav active="<页面id>" bind:navigate="onNav" />
```
5. 每个页面 JS 必须实现：
```js
const store = require('../../utils/store.js');
const u = require('../../utils/util.js');

Page({
  data: { /* ... */ },
  onLoad() {},
  onUnload() { /* 清理定时器 */ },
  onShow() { store.initDay(); this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  refresh() { /* 从 store.getDB() 读取数据，计算后 setData */ },
  onNav(e) { wx.reLaunch({ url: e.detail.url }); }
});
```
注意：`store.getDB()` 返回的是**同一个对象引用**，直接改它的属性后调用 `store.save()` 即可持久化，然后 `this.refresh()` 刷新界面。**禁止给 DB 重新赋值**。
6. 所有数据只能来自 `store.getDB()`，禁止再建第二套存储。
7. 用户反馈统一用 `wx.showToast({ title, icon: 'none' })`；删除等危险操作先用 `wx.showModal({ title, content, confirmColor: '#F2689A' })` 确认。
8. 弹层（添加/编辑表单）统一用底部抽屉，结构与样式：
```xml
<view class="mask" wx:if="{{showModal}}" bindtap="closeModal">
  <view class="sheet" catchtap="">
    <view class="sheet-title">{{modalTitle}}</view>
    <view class="field"><text class="fl">名称</text><input class="inp" value="{{form.name}}" placeholder="请输入" bindinput="onFormName" /></view>
    ...
    <view class="row" style="gap:16rpx;margin-top:24rpx">
      <button class="btn ghost" style="flex:1" bindtap="closeModal">取消</button>
      <button class="btn primary" style="flex:1" bindtap="submitModal">保存</button>
    </view>
  </view>
</view>
```
WXSS 里补 `.mask{position:fixed;inset:0;background:rgba(92,68,80,.32);z-index:200;display:flex;align-items:flex-end;}` `.sheet-title{font-size:32rpx;font-weight:800;text-align:center;margin-bottom:24rpx}` `.fl{display:block;font-size:22rpx;font-weight:700;color:var(--text-2);margin-bottom:8rpx}`。
注意 `input` 必须绑定 `bindinput` 到 `this.form.xxx`（在 data 里初始化 `form:{}`），不要用 `data-*` 取值。
9. 可用通用类（app.wxss 已定义，直接使用，勿重复造）：
   `card / row / between / wrap / grow / mt / mt8 / mt12 / muted / tiny / center / sec-title（内含 .dot）/ grid2 / grid3 / grid4 / btn(.primary .ghost .sm .block) / pill(.mint .sky .lemon .purple .gray) / bar(.thin) 内嵌 view 宽度百分比 / check(.done) / titem(.done) 内含 .tname .tmeta / stat 内含 .lbl .val .ico / empty 内含 .emo / avatar / inp / picker / mask / sheet / field`
10. 柱状图用 view + 高度百分比实现（参考 home 页不适用，可参考下列写法）：
```xml
<view class="chart">
  <view class="cbar" wx:for="{{bars}}" wx:key="index" style="height:{{item.h}}%;background:{{item.bg}}">
    <text class="cv">{{item.v}}</text>
  </view>
</view>
```
`.chart{display:flex;align-items:flex-end;gap:10rpx;height:240rpx;padding-top:20rpx}` `.cbar{flex:1;display:flex;align-items:flex-start;justify-content:center;border-radius:12rpx 12rpx 6rpx 6rpx;min-height:8rpx;position:relative}` `.cv{font-size:18rpx;color:#fff;font-weight:700;margin-top:6rpx}`
11. 进度环形（如需要）用 `conic-gradient` 实现，参考 home 页 `.ring` 写法。
12. 删除/清空等批量操作后必须 `store.save()` + `this.refresh()`。
13. 每个页面 JS 末尾追加：
```js
onShareAppMessage() { return { title: '小宝的可爱工作台', path: '/pages/home/home' }; }
```
14. 日期一律用 `u.today() / u.dateAdd(s,n) / u.pad(n) / u.lastNDays(n) / u.weekRange() / u.daysBetween(a,b) / u.WEEK_CN`。

## 数据结构（已由 store.js 定义，直接使用）
- `DB.plans[日期] = [{id,name,done,prio}]`  prio: high|mid|low
- `DB.courses = [{id,name,color,total,progress,note}]`  color 从 ['#FF8FB8','#B79BEF','#8ED8C0','#9ECDF5','#FFD98E','#FFA98F'] 选
- `DB.studyLog[日期] = 分钟`
- `DB.workout[日期] = [{id,type,min,burn,custom}]`
- `DB.exam = [{id,name,examDate,total,done,unit}]`
- `DB.finance = [{id,type:'income'|'expense',amount,cat,note,date}]`
- `DB.goals = [{id,name,target,saved}]`
- `DB.ideas = [{id,title,note,status:'todo'|'done',created}]`
- `DB.pubs = [{id,platform,title,date,hits}]`
- `DB.books = [{id,title,author,total,page,status:'reading'|'todo'|'done'}]`
- `DB.readLog[日期] = 分钟`
- `DB.quotes = [{id,text,date}]`
- `DB.skills = [{id,name,emoji,count,last}]`，`DB.skillLog = [{id,name,date}]`
- `DB.memos = [{id,title,body,color:'pink'|'mint'|'sky'|'lemon',pin,created}]`
- `DB.reviews[周一日] = {good,bad,next,at}`

## 各页面功能要求（与 Web 版一致）

### plan 每日计划（每日重置）
输入框 + 优先级 picker（重要/普通/简单）+ 添加按钮；回车即添加（用 `confirm-type` 不需要，bindconfirm 即可）。任务列表：圆形勾选（点击切换 done）、优先级 pill、删除按钮。顶部进度条 + 完成数/百分比。右侧/下方统计卡：已完成、待完成、优先级分布（三项带色点）。时间轴：取前 8 条，固定时段标签 08:00/10:00/12:00/14:00/16:00/18:00/20:00/21:30，已完成划掉。底部按钮：清除已完成（确认后过滤掉 done）、把未完成搬到明天（`u.dateAdd(u.today(),1)`，拷贝未完成项，done=false，新 id）。

### course 课程学习（累积）
顶部 4 个 stat：课程总数（门）、今日学习（分钟，来自 studyLog[today]）、累计投入（小时，`Math.round(total/60)`）、平均进度（%）。课程列表每行：avatar（首字+课程色）、名称、进度条、`共 N 节 · 备注`、按钮组（− 减一节进度、+ 加一节进度、删除）。加进度公式 `clamp(c.progress + Math.round(100/c.total),0,100)`，到 100 时 toast 恭喜。添加课程弹层：名称、总节数（数字）、备注、颜色选择（6 色圆点，选中带白边+粉圈）。近 7 天学习时长柱状图（`u.lastNDays(7)`，今天用深粉渐变）。两个小统计：本周累计分钟、连续学习天数（从 today 或昨天往前数 studyLog>0）。

### workout 锻炼身体（每日重置）
顶部 4 个 stat：今日运动（分钟）、今日消耗（千卡）、本周累计（分钟，`u.weekRange()` 内累加）、连续运动（天）。运动类型九宫格（grid3 或自定义 flex）：散步🚶3、跑步🏃9、瑜伽🧘4、力量🏋️7、骑行🚴7、游泳🏊8、跳绳🪢11、跳舞💃6、拉伸🤸2.5、球类🏸7，每格显示今日已记录次数，选中态高亮。分钟输入 + 「记录一次运动」按钮（burn = min × 系数），「自定义运动」按钮弹层（名称+分钟，burn=min×5）。今日记录列表（emoji、名称、分钟、千卡、删除）。近 30 天热力图：`u.lastNDays(30)`，按分钟数分 5 级背景色，小方块显示日期数字，下图例。

### exam 备考计划（累积）
科目卡片列表：名称、剩余天数 pill（≤7 天粉色强调）、`已学 N / M 章`、进度条、考试日期、按钮（−、+、删除）。+1 时 done++，达到 total 时 toast 恭喜。添加科目弹层：名称、考试日期（`<picker mode="date">`，默认 `u.dateAdd(u.today(),60)`）、总章节数、单位（默认「章」）。右侧倒计时卡：按 examDate 排序取前 3 个，显示剩余天数大字。总完成度环形：`conic-gradient(#F2689A {{pct}}%, #FFEFF6 0)`，中心显示百分比。

### finance 理财（累积）
顶部 4 个 stat：本月收入 ¥、本月支出 ¥、本月结余（正负）、累计结余。按钮：+ 收入（绿）、+ 支出（粉）。明细列表（按日期倒序取前 30）：avatar（入/出）、分类名、金额（收入绿 +¥、支出粉 −¥）、日期+备注、删除。记收入/支出弹层：金额（digit 键盘）、分类 picker（收入：工资/兼职/理财/红包/其他；支出：餐饮/交通/购物/居住/娱乐/学习/医疗/人情/其他）、日期 picker（默认今天）、备注。本月支出分类占比：用横向条列表（分类名 + 金额 + 百分比条），按金额降序，取前 6；中央显示本月支出总额。储蓄目标：卡片网格，每张显示名称、`¥saved / ¥target`、进度条（mint）、百分比、+ 存入按钮（弹层输入金额）、删除按钮；底部添加目标输入（名称 + 金额 + 按钮）。

### media 自媒体（累积）
顶部 4 个 stat：累计发布（条）、本月发布（条）、灵感库存（个，未创作数）、累计曝光（≥10000 显示 x.xw）。选题灵感库：列表项含勾选圈（切换 todo/done）、标题、备注、状态 pill、删除；「+ 记录灵感」按钮弹层（标题 + 想法补充 textarea）。发布记录：「+ 登记一条发布」按钮弹层（平台 picker：小红书/抖音/B站/公众号/视频号/知乎/微博、标题、日期 picker、曝光数字）；列表项显示平台 pill、标题、日期、曝光、删除。近 8 周发布量柱状图：循环 8 周（`new Date(); d.setDate(d.getDate()-i*7); u.weekRange(d)`），统计落在区间内的 pubs 数量，本周用深粉。

### read 阅读（累积）
书架列表：书名、作者、状态 pill（在读/想读/已读完）、`page / total 页`、进度条、页码输入（number，语义为「本次读了几页」）+ 累加按钮（叠加到当前页码、封顶总页数）、标记读完/未读按钮、删除。累加后若 ≥ total 自动置为已读完并 toast。添加书籍弹层：书名、作者、总页数、状态 picker。阅读统计卡：已读完（本）、在读（本）、今日累计（分钟）+「+ 记录时长」按钮（聚焦输入框）、输入框 + 「快速 +30 分钟」按钮（bindconfirm 也提交）。摘抄本：textarea + 收录按钮 + 摘抄列表（文本、日期、删除）。

### skill 技能训练（累积）
说明行：「每次练习 +1，满 10 次升级」。技能卡片网格（grid2）：emoji、名称、`Lv.N · 共 M 次`、10 个小格进度（`count%10` 个高亮）、上次日期、「练习 +1」按钮、删除。+1 时 count++、last=today、skillLog push，每 10 次 toast 升级并提示。添加技能弹层：名称 + emoji 选择（🎸🎨💻🗣️📷🎹✍️🍳🧩🏹🎬🪄，选中粉底）。练习日志列表：取 `DB.skillLog.slice(-14).reverse()`，显示技能名 pill + 日期。

### memo 备忘录（长期）
顶部工具栏：搜索输入（bindinput 实时过滤标题+内容，大小写不敏感）、颜色 tabs（全部/粉/绿/蓝/黄，选中态）、「+ 新建便签」按钮。便签网格（grid2， Masonry 效果用普通 flex wrap 即可）：置顶的排前面（pin 优先），其余按 created 倒序；每张显示标题（置顶加 📌）、内容（white-space:pre-wrap）、创建日期、「置顶/取消置顶」「编辑」文字按钮、删除图标按钮。颜色背景：pink #FFF0F6 / mint #EFFBF6 / sky #EFF7FE / lemon #FFFAEF，边框对应深一档。新建/编辑弹层：标题、内容 textarea、4 色选择圆点。空状态有提示。

### review 周复盘（每周归档）
周标签：`u.weekRange()` 起止日期。本周数据概览 4 个 stat：打卡（/7 天）、完成任务（项）、学习（分钟）、运动（分钟）。本周打卡完成度进度条（checkN/7）。本周每日任务完成数柱状图（7 天，`(DB.plans[d]||[]).filter(x=>x.done).length`，今天用粉色，其他紫色，底部显示星期）。复盘表单三个 textarea：做得好的三件事、可以改进的地方、下周的三个小目标 + 「保存本周复盘」按钮（保存到 `DB.reviews[weekStart]`，含 at=today，保存后 toast）。历史复盘列表（按周倒序）：三段内容（有才显示）、保存日期、删除按钮；空状态提示。

## 验收标准
- 所有交互可用，数据改动后刷新界面正确
- 无 `px` 单位、无未定义变量、WXML 标签闭合
- 与 home 页视觉风格一致（粉色、圆角、卡片）
