// Service worker mínimo: guarda el shell y los datos fijos para que la app abra sin red.
// Las llamadas al backend (/api, /mock o ?api=) no se cachean: pasan siempre a la red.
const CACHE = 'ciudadano-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  if (!u.pathname.startsWith(new URL('./', self.location).pathname)) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match(new URL('./', self.location).pathname))),
  );
});
