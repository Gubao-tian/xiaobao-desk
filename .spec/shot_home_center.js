const puppeteer = require('puppeteer-core');
const fs = require('fs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 660 });
  await page.goto('file:///E:/work%20%20buddy/2026-10-20-18-11-03/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  const clock = await page.evaluate(() => {
    const c = document.querySelector('.clock-card');
    const t = document.querySelector('.clock-time');
    const cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect();
    return { cardL: cr.left, cardR: cr.right, textL: tr.left, textR: tr.right,
      offL: Math.abs(tr.left - cr.left), offR: Math.abs(cr.right - tr.right) };
  });
  console.log(`时钟文字居中: 左距=${clock.offL.toFixed(1)}px 右距=${clock.offR.toFixed(1)}px => ${Math.abs(clock.offL-clock.offR)<6 ? '对称 OK' : '不对称'}`);
  const qcn = await page.evaluate(() => {
    const c = document.querySelector('.quote-card');
    const t = document.querySelector('.quote-cn');
    const cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect();
    return { offL: Math.abs(tr.left - cr.left), offR: Math.abs(cr.right - tr.right) };
  });
  console.log(`日签文字居中: 左距=${qcn.offL.toFixed(1)}px 右距=${qcn.offR.toFixed(1)}px => ${Math.abs(qcn.offL-qcn.offR)<6 ? '对称 OK' : '不对称'}`);
  await page.screenshot({ path: '.spec/ev_home_center.png' });
  console.log('截图: .spec/ev_home_center.png');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
