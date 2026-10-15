/* 吉他调音器 Service Worker —— 基础离线缓存
 * 改完 index.html / manifest.json 后，把 VERSION 加一，用户下次联网打开即会用到新版。
 */
const VERSION = 'v1';
const CACHE = 'guitar-tuner-' + VERSION;
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 逐个缓存：个别文件缺失也不会导致整个安装失败
    await Promise.all(ASSETS.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function put(req, res) {
  if (!res || !res.ok || res.type !== 'basic') return;
  caches.open(CACHE).then((cache) => cache.put(req, res)).catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 只接管同源请求

  // 页面导航：优先联网拿最新版，断网时回退到缓存的首页
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        put(req, res.clone());
        return res;
      } catch (err) {
        return (await caches.match('./index.html')) ||
               (await caches.match('./')) ||
               Response.error();
      }
    })());
    return;
  }

  // 其它静态资源：缓存优先，命中后后台顺带更新
  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) {
      fetch(req).then((res) => put(req, res)).catch(() => {});
      return hit;
    }
    try {
      const res = await fetch(req);
      put(req, res.clone());
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});
