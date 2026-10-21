/* 小宝工作台 Service Worker
   策略：预缓存核心资源；请求时 cache-first + 后台更新（stale-while-revalidate），
   离线时直接读取缓存，保证断网也能正常使用全部功能。 */
const VERSION = 'xiaobao-desk-v1.6.0';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type !== 'opaque') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy).catch(() => {}));
          }
          return res;
        })
        .catch(() => hit || caches.match('./index.html'));
      return hit || net;
    })
  );
});

/* 用户点击「更新」消息时立即接管 */
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

/* 服务端推送（如微信/自建后端定时推送）：收到后弹出系统通知 */
self.addEventListener('push', (e) => {
  let data = { title: '小宝工作台', body: '到时间啦，记得看看你的计划 💗' };
  try { if (e.data) data = Object.assign(data, e.data.json()); } catch (err) { /* 忽略 */ }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: data.tag || 'xiaobao-remind',
      data: data.url || './'
    })
  );
});

/* 点击通知 -> 打开/聚焦页面 */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.data) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cls) => {
      for (const c of cls) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
