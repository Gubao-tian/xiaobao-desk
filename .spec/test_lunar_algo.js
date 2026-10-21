/* 阴阳历与节气算法单测：直接从 index.html 抽取函数体执行，保证测的是线上同一份代码 */
const fs=require('fs');
const html=fs.readFileSync('E:/work  buddy/2026-10-20-18-11-03/index.html','utf8');

function slice(startMark,endMark){
  const a=html.indexOf(startMark); const b=html.indexOf(endMark);
  if(a<0||b<0) throw new Error('抽取失败: '+startMark);
  return html.slice(a,b);
}
const code=[
  "const pad = n=>String(n).padStart(2,'0');",
  "function parseD(s){return new Date(s+'T00:00:00');}",
  slice('const LUNAR_INFO=[','let calYear=null')
].join('\n');

const mod={};
new Function('exports', code+'\nexports.lunarOf=lunarOf;exports.solarTermOf=solarTermOf;exports.daySubLabel=daySubLabel;exports.dayFullLabel=dayFullLabel;exports.lunarYearDays=lunarYearDays;')(mod);

let pass=0,fail=0;
const eq=(name,got,want)=>{ if(String(got)===String(want)){pass++;console.log('✓ '+name+' = '+got);} else {fail++;console.log('✗ '+name+' 期望 '+want+' 实际 '+got);} };

/* 已知农历日期（对照权威万年历） */
const cases=[
  ['2026-10-21','九月十二'],   // 2026 正月初一 2/17，八月 29 天 → 九月初一 10/10
  ['2026-01-01','冬月十三'],
  ['2025-01-29','正月初一'],   // 2025 春节
  ['2026-02-17','正月初一'],   // 2026 春节
  ['2025-10-06','八月十五'],   // 2025 中秋
  ['2025-05-31','五月初五'],   // 2025 端午
  ['2024-02-10','正月初一'],   // 2024 春节
  ['2020-01-25','正月初一'],   // 2020 春节
  ['2023-01-22','正月初一'],   // 2023 春节
  ['2023-03-22','闰二月初一'], // 2023 闰二月
  ['2025-01-01','腊月初二'],
  ['2026-09-25','八月十五']    // 2026 中秋
];
cases.forEach(([ds,want])=>{
  const l=mod.lunarOf(ds);
  eq(ds+' 农历', l?(l.monthCn+l.dayCn):'null', want);
});

/* 生肖与干支 */
eq('2026 干支', mod.lunarOf('2026-02-17').ganzhi, '丙午');
eq('2026 生肖', mod.lunarOf('2026-02-17').zodiac, '马');
eq('2025 生肖', mod.lunarOf('2025-02-01').zodiac, '蛇');
eq('2024 生肖', mod.lunarOf('2024-02-10').zodiac, '龙');

/* 节气（对照权威日期） */
const terms=[
  ['2026-02-04','立春'],['2026-04-05','清明'],['2026-06-21','夏至'],
  ['2026-09-23','秋分'],['2026-12-22','冬至'],['2026-01-05','小寒'],
  ['2025-02-03','立春'],['2025-04-04','清明'],['2025-06-21','夏至'],
  ['2025-09-23','秋分'],['2025-12-21','冬至'],['2025-01-20','大寒'],
  ['2024-02-04','立春'],['2024-04-04','清明'],['2024-12-21','冬至'],
  ['2024-06-21','夏至'],['2024-09-22','秋分'],['2024-11-07','立冬'],
  ['2024-04-19','谷雨'],['2024-08-07','立秋'],['2028-02-04','立春'],['2028-12-21','冬至']
];
terms.forEach(([ds,want])=>eq(ds+' 节气', mod.solarTermOf(ds), want));

/* 非节气应返回空 */
eq('2026-10-21 非节气', mod.solarTermOf('2026-10-21'), '');
eq('2026-03-15 非节气', mod.solarTermOf('2026-03-15'), '');

/* 节日优先于节气 */
eq('2026-10-01 节日', mod.daySubLabel('2026-10-01'), '国庆节');
eq('2026-02-17 春节', mod.daySubLabel('2026-02-17'), '春节');
eq('2026-05-31? 端午', mod.daySubLabel('2026-06-19'), '端午节'); // 2026 端午：五月初五
eq('2026-09-25 中秋', mod.daySubLabel('2026-09-25'), '中秋节'); // 2026 中秋：八月十五

/* 每月天数合理性 */
eq('2026 农历年天数', mod.lunarYearDays(2026)>350&&mod.lunarYearDays(2026)<390, true);

console.log('\n---- '+pass+' passed, '+fail+' failed ----');
process.exit(fail?1:0);
