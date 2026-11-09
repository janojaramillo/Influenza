/* Influenza Perinatal · CDSS — service worker v1.1
   - Guarda la app completa al instalarse: funciona sin internet.
   - La página intenta la red solo 3 s; si tarda más, abre la copia guardada (no se queda girando).
   - Las tipografías se guardan al vuelo y nunca bloquean la carga. */
const VERSION = 'influenza-perinatal-v1.1-2026-11-09';
const CORE = ['./', './index.html', './manifest.json', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Página: red con tope de 3 s; si no responde, copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const net = fetch(req).then(r => { if (r && r.ok) cache.put('./index.html', r.clone()); return r; });
      try {
        return await Promise.race([net, timeout(3000)]);
      } catch (err) {
        const hit = await cache.match('./index.html');
        if (hit) { net.catch(() => {}); return hit; }
        return net; // primera visita sin copia: esperar a la red
      }
    })());
    return;
  }

  // Tipografías de Google: copia guardada primero; si no hay red, respuesta vacía (usa letra del sistema).
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r;
      }).catch(() => new Response('', { status: 200, headers: { 'Content-Type': url.hostname === 'fonts.googleapis.com' ? 'text/css' : 'font/woff2' } })))
    );
    return;
  }

  // Resto del mismo origen (íconos, manifiesto): copia guardada primero.
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return r;
    })));
  }
});
