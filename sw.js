/* CDSS Influenza Perinatal: guarda la app en el teléfono para usarla sin internet.
   Al publicar un cambio en index.html, suba la versión (flu-v1.3.1, flu-v1.3.2...). */
const VERSION = "flu-v1.3.0";
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(["./", "./index.html"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const wait = ms => new Promise((_, no) => setTimeout(() => no(new Error("lento")), ms));
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Página: red con tope de 3 s; si no responde o no hay red, la copia guardada (nunca se queda girando).
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const net = fetch(req).then(r => { if (r && r.ok) cache.put("./index.html", r.clone()); return r; });
      try { return await Promise.race([net, wait(3000)]); }
      catch (_) { const hit = await cache.match("./index.html"); if (hit) { net.catch(() => {}); return hit; } return net; }
    })());
    return;
  }
  // Tipografías: copia guardada; sin red, la app usa la letra del sistema.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      const c = r.clone(); caches.open(VERSION).then(k => k.put(req, c)); return r;
    }).catch(() => new Response("", { status: 200, headers: { "Content-Type": url.hostname === "fonts.googleapis.com" ? "text/css" : "font/woff2" } }))));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
});
