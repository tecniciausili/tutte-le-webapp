// Service Worker - Causa Effetto
// Strategia: prima la rete per i file dell'app (stessa origine), cache senza rete.
// I pittogrammi ARASAAC usati come oggetto restano in una cache a parte: se il
// server ARASAAC è lento o fermo, l'oggetto compare lo stesso.
// I dati (link, impostazioni, immagine caricata) NON passano di qui: stanno in
// localStorage e IndexedDB. YouTube va sempre in rete.
// Tutte le cache dell'app iniziano con PREFISSO: sullo stesso dominio (per esempio
// assistivetech.it/webapp/) ci sono altre app, e le loro cache non vanno toccate.
const PREFISSO = 'causa_effetto_';
const CACHE_NAME = `${PREFISSO}v1.0.7`;
const CACHE_ARASAAC = `${PREFISSO}arasaac`;
const URLS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/util.js',
  './js/archivio.js',
  './js/raccolta.js',
  './js/oggetto.js',
  './js/ritaglio.js',
  './js/riproduttore.js',
  './js/educatore.js',
  './js/utente.js',
  './js/app.js',
  './manifest.json',
  './assets/fonts/bootstrap-icons/bootstrap-icons.css',
  './assets/fonts/bootstrap-icons/bootstrap-icons.woff',
  './assets/fonts/bootstrap-icons/bootstrap-icons.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Si cancellano solo le versioni vecchie di questa app
      .then((nomi) => Promise.all(nomi
        .filter((n) => n.startsWith(PREFISSO) && n !== CACHE_NAME && n !== CACHE_ARASAAC)
        .map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Pittogramma dell'oggetto (500 px, chiesto con CORS dall'app): prima la cache,
// poi la rete. Le miniature della ricerca (300 px) non vengono conservate.
function pittogrammaArasaac(request) {
  return caches.open(CACHE_ARASAAC).then((cache) => cache.match(request).then((cached) => {
    if (cached) {
      return cached;
    }
    return fetch(request).then((response) => {
      if (response && response.ok && response.type === 'cors') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    });
  }));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);

  if (url.hostname === 'static.arasaac.org' && url.pathname.endsWith('_500.png')) {
    event.respondWith(pittogrammaArasaac(request));
    return;
  }

  // Altre origini (YouTube, miniature, API ARASAAC): gestione normale del browser
  if (url.origin !== self.location.origin) {
    return;
  }

  // Prima la rete: con la connessione si usano sempre i file aggiornati (niente
  // versioni vecchie dopo un aggiornamento); senza rete si usa la copia in cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && !response.redirected) {
          const copia = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) {
          return cached;
        }
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return Response.error();
      }))
  );
});
