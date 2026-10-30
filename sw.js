/* Bitworld service worker: jaringan dulu, cadangan offline. Tidak menyimpan /api. */
var CACHE = "bitworld-v1";
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(["/", "/icon-192.png"]); }).catch(function () {}));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.indexOf("/api/") === 0) return;
  e.respondWith(
    fetch(r).then(function (res) {
      if (res && res.ok && r.mode === "navigate") { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put("/", cp); }); }
      return res;
    }).catch(function () { return caches.match(r).then(function (m) { return m || caches.match("/"); }); })
  );
});
