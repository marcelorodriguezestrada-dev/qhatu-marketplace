// Service worker de Clasi Click (app instalable). A propósito NO guarda
// páginas ni datos: todo se pide siempre al servidor (precios, stock y
// pedidos al día). Solo, si no hay internet, muestra /offline.
const CACHE = 'clasiclick-v1'
const OFFLINE = '/offline'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/icons/icon-192.png'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)))
})
