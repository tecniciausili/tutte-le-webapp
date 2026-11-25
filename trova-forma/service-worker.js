/* Trova Forma - service worker: guscio dell'app in cache (uso offline della configurazione).
   YouTube richiede comunque la rete: senza connessione il gioco prosegue senza rinforzo.

   Sullo stesso indirizzo ci sono le altre app della raccolta: le cache di Trova Forma hanno il
   prefisso «trova_forma_» e all'attivazione si cancellano SOLO le sue versioni vecchie, mai le
   cache delle altre app. Strategia «prima la rete»: online si usa sempre l'ultima versione. */
const PREFISSO = 'trova_forma_';
const CACHE_NAME = `${PREFISSO}v1.1.0`;
const SHELL = [
  './', './index.html', './manifest.json', './css/style.css?v=1.1.0',
  './js/installa.js?v=2.1',
  './js/config.js', './js/touch-guard.js', './js/youtube.js', './js/game.js', './js/ui.js', './js/main.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './assets/img/logo-lega-filo-oro.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomi) => Promise.all(nomi
        .filter((n) => n.startsWith(PREFISSO) && n !== CACHE_NAME)
        .map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // YouTube & co.: rete diretta
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
