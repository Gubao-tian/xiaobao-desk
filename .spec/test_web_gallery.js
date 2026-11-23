/* 相册页（本地上传照片/视频）真实浏览器测试：移动视口 390×844
   上传通过页面内构造 PNG（canvas）与 WebM（MediaRecorder）后注入 #galInput，
   走的是与用户手选文件完全相同的 onchange → galleryAdd → IndexedDB 流程。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const FILE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

let pass = 0, fail = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + name + (extra ? ' — ' + extra : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/manifest|ERR_FAILED/.test(m.text())) jsErrors.push(m.text()); });

  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await sleep(900);

  // 0. 拦截删除确认弹窗（自动确认），并检查 IndexedDB 可用性
  await page.evaluate(() => { window.confirm = () => true; });
  const idbOk = await page.evaluate(() => !!window.indexedDB);
  t('当前环境支持 IndexedDB', idbOk);

  // 1. 导航里有「相册」
  const hasNav = await page.$$eval('#nav .nav-item', els => els.some(e => e.textContent.includes('相册') && e.dataset.go === 'gallery'));
  t('侧边导航有「相册」项', hasNav);

  // 2. 进入相册页
  await page.evaluate(() => go('gallery'));
  await sleep(600);
  const rendered = await page.$eval('#page-gallery', el => el.innerHTML.length);
  t('相册页渲染出内容', rendered > 300, rendered + ' 字符');

  // 3. 初始为空态
  const empty = await page.evaluate(() => {
    const el = document.querySelector('#page-gallery');
    return { items: el.querySelectorAll('.gal-item').length, hasEmpty: /还没有照片或视频/.test(el.textContent), hasInput: !!el.querySelector('#galInput') };
  });
  t('初始空态提示正确', empty.hasEmpty && empty.items === 0);
  const acc = await page.evaluate(() => {
    const i = document.querySelector('#galInput');
    return i ? { accept: i.getAttribute('accept') || '', multiple: i.hasAttribute('multiple') } : null;
  });
  t('input accept 含 image/* 与 video/* 且可多选', !!acc && /image\/\*/.test(acc.accept) && /video\/\*/.test(acc.accept) && acc.multiple,
    acc ? acc.accept : '无 input');

  // 4. 上传一张 PNG（canvas 生成，走真实 change 流程）
  const pngSize = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 320;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 320, 320);
    g.addColorStop(0, '#FF8FB8'); g.addColorStop(1, '#B79BEF');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 320);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.fillText('小宝', 108, 172);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], '小宝的图片.png', { type: 'image/png' }));
    const input = document.querySelector('#galInput');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return blob.size;
  });
  await sleep(700);
  const afterPhoto = await page.evaluate(() => ({
    items: document.querySelectorAll('#page-gallery .gal-item').length,
    photoChip: /照片 1/.test(document.querySelector('#page-gallery').textContent),
    name: (document.querySelector('#page-gallery .gal-name') || {}).textContent || ''
  }));
  t('PNG 上传成功（>0 字节）', pngSize > 0, pngSize + ' B');
  t('上传后网格出现 1 个文件', afterPhoto.items === 1, '实际 ' + afterPhoto.items);
  t('照片筛选计数 = 照片 1', afterPhoto.photoChip);
  t('文件名正确显示', afterPhoto.name === '小宝的图片.png', afterPhoto.name);

  // 5. 上传一段 WebM 视频（MediaRecorder 录 canvas；不支持时降级为裸 webm Blob）
  const videoAdded = await page.evaluate(async () => {
    try {
      let blob;
      const c = document.createElement('canvas'); c.width = 240; c.height = 240;
      const ctx = c.getContext('2d');
      if (window.MediaRecorder && c.captureStream) {
        const stream = c.captureStream(30);
        const rec = new MediaRecorder(stream);
        const chunks = [];
        rec.ondataavailable = e => chunks.push(e.data);
        rec.start();
        let h = 0;
        const iv = setInterval(() => { h = (h + 6) % 360; ctx.fillStyle = `hsl(${h},70%,70%)`; ctx.fillRect(0, 0, 240, 240); }, 50);
        await new Promise(r => setTimeout(r, 600));
        clearInterval(iv);
        rec.stop();
        await new Promise(r => { rec.onstop = r; });
        blob = new Blob(chunks, { type: 'video/webm' });
      } else {
        blob = new Blob(['fake-webm'], { type: 'video/webm' });
      }
      if (!blob.size) return false;
      const dt = new DataTransfer();
      dt.items.add(new File([blob], '小宝的视频.webm', { type: 'video/webm' }));
      const input = document.querySelector('#galInput');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { return 'skip:' + e.message; }
  });
  await sleep(700);
  const afterVideo = await page.evaluate(() => ({
    items: document.querySelectorAll('#page-gallery .gal-item').length,
    videoChip: /视频 1/.test(document.querySelector('#page-gallery').textContent),
    stat: (document.querySelector('#page-gallery .gal-stat') || {}).textContent || '',
    kinds: [...document.querySelectorAll('#page-gallery .gal-badge')].map(e => e.textContent)
  }));
  t('WebM 视频上传成功', videoAdded === true, String(videoAdded));
  t('上传后共 2 个文件', afterVideo.items === 2, '实际 ' + afterVideo.items);
  t('视频筛选计数 = 视频 1', afterVideo.videoChip);
  t('统计条显示 共 2 个文件', /共 2 个文件/.test(afterVideo.stat), afterVideo.stat);
  t('两张卡片类型徽标正确', afterVideo.kinds.join(',') === '视频,照片', afterVideo.kinds.join(','));

  // 6. 筛选：点「视频」只显示 1 个
  await page.evaluate(() => document.querySelector('#page-gallery .gal-chip[data-gf="video"]').click());
  await sleep(400);
  const filtered = await page.evaluate(() => document.querySelectorAll('#page-gallery .gal-item').length);
  t('视频筛选只显示 1 个', filtered === 1, '实际 ' + filtered);
  await page.evaluate(() => document.querySelector('#page-gallery .gal-chip[data-gf="all"]').click());
  await sleep(400);

  // 7. 点文件弹出查看弹窗（视频应可播放），弹窗内可删除
  await page.evaluate(() => document.querySelector('#page-gallery .gal-item[data-gid]').click());
  await sleep(400);
  const view = await page.evaluate(() => {
    const on = document.querySelector('#modalMask').classList.contains('on');
    const gv = document.querySelector('#modalBox .gal-view');
    const media = gv ? (gv.querySelector('img') || gv.querySelector('video')) : null;
    const okBtn = document.querySelector('#mOk');
    return { on, hasView: !!gv, isVideo: media ? media.tagName === 'VIDEO' : false, okText: okBtn ? okBtn.textContent : '' };
  });
  t('点文件弹出查看弹窗', view.on && view.hasView);
  t('视频文件用 video 播放', view.isVideo);
  t('弹窗确认按钮为「删除」', view.okText === '删除', view.okText);
  await page.evaluate(() => document.querySelector('#mOk').click()); // confirm 已被拦截为 true
  await sleep(600);
  const afterDel = await page.evaluate(() => document.querySelectorAll('#page-gallery .gal-item').length);
  t('弹窗内删除生效（剩 1 个）', afterDel === 1, '实际 ' + afterDel);

  // 8. 卡片上的删除按钮直接删除（移动端常显）
  const delBtnVisible = await page.evaluate(() => {
    const b = document.querySelector('#page-gallery .gal-del');
    return !!b && getComputedStyle(b).display !== 'none';
  });
  t('移动端删除按钮常显（hover:none 兜底）', delBtnVisible);
  await page.evaluate(() => document.querySelector('#page-gallery .gal-del').click());
  await sleep(600);
  const afterDelAll = await page.evaluate(() => ({
    items: document.querySelectorAll('#page-gallery .gal-item').length,
    empty: /还没有照片或视频/.test(document.querySelector('#page-gallery').textContent)
  }));
  t('卡片删除后回到空态', afterDelAll.items === 0 && afterDelAll.empty);

  // 9. 重新上传照片，检查移动端布局（2 列、不溢出）+ 截图
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 300;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFC2D8'; ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = '#F2689A'; ctx.beginPath(); ctx.arc(150, 150, 80, 0, Math.PI * 2); ctx.fill();
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], '布局检查.png', { type: 'image/png' }));
    dt.items.add(new File([blob.slice(0, 200)], '第二张.png', { type: 'image/png' }));
    const input = document.querySelector('#galInput');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(700);
  const layout = await page.evaluate(() => {
    const grid = document.querySelector('#page-gallery .gal-grid');
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const r = grid.getBoundingClientRect();
    return { cols, right: Math.round(r.right), vw: window.innerWidth, items: grid.querySelectorAll('.gal-item').length };
  });
  t('移动端网格 2 列', layout.cols === 2, '实际 ' + layout.cols);
  t('移动端网格不横向溢出', layout.right <= layout.vw, layout.right + ' ≤ ' + layout.vw);
  t('一次多选上传 2 个文件', layout.items === 2, '实际 ' + layout.items);

  // 10. 桌面宽度自适应列数 ≥3
  await page.setViewport({ width: 1280, height: 900 });
  await sleep(400);
  const desk = await page.evaluate(() => {
    const grid = document.querySelector('#page-gallery .gal-grid');
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
  });
  t('桌面宽度下列数 ≥3（自适应）', desk >= 3, '实际 ' + desk + ' 列');

  t('全程无 JS 报错', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));

  // 11. 移动端截图证据
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => go('gallery'));
  await sleep(600);
  await page.screenshot({ path: path.resolve(__dirname, 'ev_gallery_mobile.png'), fullPage: true });

  await browser.close();
  console.log('\n---- ' + pass + ' passed, ' + fail + ' failed ----');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('运行异常', e); process.exit(1); });
