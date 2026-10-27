/* ============================================================
 * sw.js — 离线支持（Service Worker）
 *
 * 策略（关键：不能让新增的 .md / .webp 被旧缓存挡住）
 *   · .md、页面导航   → 网络优先，失败才用缓存
 *                       新写的章节永远先拿最新的；断网时退回缓存
 *   · 其余静态资源    → 先用缓存，同时后台拉新
 *                       css/js/图片更新后，第二次打开就是新的
 *
 * 安装时会把「已完成的章节」一起预下载，所以第一次联网打开之后，
 * 整本书都能断网阅读；以后新增的章节不在清单里也没关系——联网看过
 * 一次就会被存下来，不会因为清单没更新而永远读不到。
 *
 * 改完 css/js 想立刻让老读者更新：把 CACHE 的版本号 +1 即可。
 * ============================================================ */
var CACHE = 'poke-trpg-v3';

// 外壳资源：缺一个都会导致界面错乱，所以用 addAll 强一致
var PRECACHE = [
    './',
    './index.html',
    './manifest.webmanifest',
    './assets/theme.css',
    './assets/app.js',
    './assets/type-data.js',
    './assets/favicon.svg',
    './assets/icons/icon-180.png',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './vendor/vue.css',
    './vendor/docsify.min.js',
    './vendor/sidebar-collapse.min.js',
    // 角色卡是独立页面，不缓存的话断网时点进侧栏就是一片空白
    './sheets.html',
    './assets/sheets.css',
    './assets/sheets.js'
];

// 正文内容：逐个下载，某一个还没上线（404）也照常安装，不影响其它章节
var PRE_MD = [
    './_sidebar.md',
    './README.md',
    './00-introduction.md',
    './01-marvelous-world.md',
    './02-system-explained.md',
    './03-character-creation.md',
    './typechart.md',
    './dice.md',
    './not-found.md',
    './assets/img/trainer-licence.webp',
    './assets/img/trainer-stats.webp',
    './assets/img/trainer-bag.webp',
    './assets/img/pokemon-dex.webp',
    './assets/img/pokemon-quickref.webp',
    './assets/img/pokemon-stats.webp',
    './assets/img/pokemon-social.webp'
];

self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE).then(function (c) {
            return c.addAll(PRECACHE).catch(function () {
                // 外壳里某个文件临时取不到也不能让整个安装失败
                return Promise.all(PRECACHE.map(function (u) {
                    return c.add(u).catch(function () { return null; });
                }));
            });
        }).then(function () {
            // 正文逐个补，失败不阻塞安装
            return caches.open(CACHE).then(function (c) {
                return Promise.all(PRE_MD.map(function (u) {
                    return c.add(u).catch(function () { return null; });
                }));
            });
        }).then(function () {
            return self.skipWaiting();
        }).catch(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) {
                return k === CACHE ? null : caches.delete(k);
            }));
        }).then(function () { return self.clients.claim(); })
    );
});

// 离线且没缓存过的章节：给一张能看懂的说明，而不是把首页 HTML 当正文渲染
function offlinePage(url) {
    return new Response(
        '# 这一章还没有离线缓存\n\n' +
        '你当前处于**离线状态**，而 `' + url + '` 还没有被下载过。\n\n' +
        '联网后打开一次，之后就能断网阅读了。\n',
        { status: 200, headers: { 'Content-Type': 'text/markdown; charset=utf-8' } }
    );
}

self.addEventListener('fetch', function (e) {
    var req = e.request;
    if (req.method !== 'GET') return;

    var url = new URL(req.url);
    if (url.origin !== self.location.origin) return;   // 外链一律不碰

    var isDoc = req.mode === 'navigate' ||
                /\.md$/i.test(url.pathname) ||
                url.pathname.slice(-1) === '/';

    if (isDoc) {
        // 网络优先：保证内容永远是最新的；断网时回落到缓存
        e.respondWith(
            fetch(req).then(function (res) {
                if (res && res.ok) {
                    var copy = res.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
                }
                return res;
            }).catch(function () {
                return caches.match(req, { ignoreSearch: true }).then(function (hit) {
                    if (hit) return hit;
                    if (req.mode === 'navigate') return caches.match('./index.html');
                    return offlinePage(url.pathname);
                });
            })
        );
        return;
    }

    // 静态资源：先用缓存，同时后台更新
    e.respondWith(
        caches.match(req, { ignoreSearch: true }).then(function (hit) {
            var network = fetch(req).then(function (res) {
                if (res && res.ok) {
                    var copy = res.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
                }
                return res;
            }).catch(function () { return hit; });
            return hit || network;
        })
    );
});
