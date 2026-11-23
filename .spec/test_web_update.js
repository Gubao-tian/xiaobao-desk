/* 版本更新提示真实流程测试：
   本地 http 服务器托管仓库根目录，/sw.js 可动态换版本；
   验证「打开无提示 → SW 更新后提示条出现 → 点击刷新 → 新 SW 接管」。 */
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + name + (extra ? ' — ' + extra : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
let swVersion = 'v1.9.0'; // 服务器当前提供的 SW 版本（测试中途换成 v1.9.1）

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/sw.js') {
    const base = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const body = base.replace(/xiaobao-desk-v[\d.]+/, 'xiaobao-desk-' + swVersion);
    res.writeHead(200, { 'Content-Type': MIME['.js'] });
    res.end(body);
    return;
  }
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const PORT = server.address().port;
  const URLBASE = 'http://127.0.0.1:' + PORT + '/';

  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/manifest|ERR_FAILED/.test(m.text())) jsErrors.push(m.text()); });

  // 1. 首次打开：注册 SW、拿到控制权
  await page.goto(URLBASE, { waitUntil: 'load' });
  const controlled = await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15000 }).then(() => true).catch(() => false);
  t('首次打开后 SW 已接管页面（secure context + http 127.0.0.1）', controlled);
  await sleep(800);

  // 2. 打开应用时不应有更新提示条（首次安装不发提示）
  let bar = await page.$('#swUpdateBar');
  t('首次打开无更新提示条', !bar);
  t('首访无多余刷新（页面正常渲染）', await page.evaluate(() => document.querySelector('#page-home') && document.body.innerHTML.length > 1000));

  // 3. 侧边栏版本为静态 1.9.0
  const ver = await page.$eval('#webVer', el => el.textContent);
  t('侧边栏显示 Web v1.9.0', ver === '1.9.0', ver);

  // 4. 服务器换新版本 → 页面主动 reg.update() → 提示条出现
  swVersion = 'v1.9.1';
  await page.evaluate(() => navigator.serviceWorker.ready.then(r => r.update()));
  const barShown = await page.waitForFunction(() => !!document.querySelector('#swUpdateBar'), { timeout: 15000 }).then(() => true).catch(() => false);
  t('SW 检测到新版本后出现提示条', barShown);
  const barText = barShown ? await page.$eval('#swUpdateBar', el => el.textContent) : '';
  t('提示条文案含「发现新版本」', /发现新版本/.test(barText), barText);

  // 5. 点击提示条 → skip-waiting → controllerchange → 页面 reload → 新 SW 接管
  if (barShown) {
    await page.click('#swUpdateBar');
    await page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }).catch(() => {});
    await sleep(1200);
    const after = await page.evaluate(async () => {
      const cachesNow = await (window.caches ? caches.keys() : Promise.resolve([]));
      return {
        bar: !!document.querySelector('#swUpdateBar'),
        controlled: !!navigator.serviceWorker.controller,
        caches: cachesNow
      };
    });
    t('点击刷新后提示条消失（新会话无待更新）', !after.bar);
    t('刷新后新 SW 接管页面', after.controlled);
    t('旧缓存已清理、新缓存 v1.9.1 生效', after.caches.some(k => /v1\.9\.1/.test(k)) && !after.caches.some(k => /v1\.9\.0/.test(k)),
      after.caches.join(', '));
    t('刷新后页面功能正常', await page.evaluate(() => document.body.innerHTML.length > 1000 && typeof renderGallery === 'function'));
  }

  t('全程无 JS 报错', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));

  await browser.close();
  server.close();
  console.log('\n---- ' + pass + ' passed, ' + fail + ' failed ----');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('运行异常', e); try { server.close(); } catch (err) {} process.exit(1); });
