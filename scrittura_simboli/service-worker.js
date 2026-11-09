// Service Worker - Scrittura con Simboli
// Strategia: prima la rete per i file dell'app (stessa origine), cache senza rete.
// Tutto è sullo stesso dominio, anche i font e le emoji: l'app funziona offline.
// I dati (testo, simboli scelti, foto) NON passano di qui: stanno in localStorage e IndexedDB.
// Tutte le cache dell'app iniziano con PREFISSO: sullo stesso dominio (assistivetech.it/webapp/)
// ci sono altre app, e le loro cache non vanno toccate.
const PREFISSO = 'scrittura_simboli_';
const CACHE_NAME = `${PREFISSO}v1.5.1`;
// Pittogrammi ARASAAC (facoltativi, da static.arasaac.org): cache a parte, che resta tra le versioni
const CACHE_ARASAAC = `${PREFISSO}arasaac`;
const HOST_ARASAAC = 'static.arasaac.org';
// Simboli Mulberry (assets/mulberry/, circa 10 MB): non si mettono in cache all'installazione,
// ma quando l'utente li attiva (js/mulberry.js li scarica tutti); cache a parte, resta tra le versioni
const CACHE_MULBERRY = `${PREFISSO}mulberry`;
const CARTELLA_MULBERRY = '/assets/mulberry/';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/lessico.js',
  './js/raccolta.js',
  './js/util.js',
  './js/archivio.js',
  './js/voce.js',
  './js/simboli.js',
  './js/arasaac.js',
  './js/mulberry-dati.js',
  './js/mulberry.js',
  // Convertitore delle foto HEIC dell'iPhone (3 MB): incluso perché l'app funzioni anche offline
  './assets/vendor/heic-to/heic-to.js',
  './js/editor.js',
  './js/app.js',
  './manifest.json',
  './assets/fonts/simboli/atkinson-12.woff2',
  './assets/fonts/simboli/atkinson-13.woff2',
  './assets/fonts/simboli/atkinson-14.woff2',
  './assets/fonts/simboli/atkinson-15.woff2',
  './assets/fonts/simboli/emoji-01.woff2',
  './assets/fonts/simboli/emoji-02.woff2',
  './assets/fonts/simboli/emoji-03.woff2',
  './assets/fonts/simboli/emoji-04.woff2',
  './assets/fonts/simboli/emoji-05.woff2',
  './assets/fonts/simboli/emoji-06.woff2',
  './assets/fonts/simboli/emoji-07.woff2',
  './assets/fonts/simboli/emoji-08.woff2',
  './assets/fonts/simboli/emoji-09.woff2',
  './assets/fonts/simboli/emoji-10.woff2',
  './assets/fonts/simboli/emoji-11.woff2',
  './assets/fonts/simboli/material-symbols.woff2',
  './assets/fonts/simboli/simboli.css',
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
        .filter((n) => n.startsWith(PREFISSO) && n !== CACHE_NAME && n !== CACHE_ARASAAC && n !== CACHE_MULBERRY)
        .map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  // Pittogrammi ARASAAC: non cambiano, quindi prima la cache (così si vedono anche offline).
  // Si salvano solo le risposte CORS complete (le <img> hanno crossorigin="anonymous").
  if (url.hostname === HOST_ARASAAC) {
    event.respondWith(
      caches.open(CACHE_ARASAAC).then((cache) => cache.match(request).then((cached) => cached
        || fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'cors') {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })))
    );
    return;
  }
  if (url.origin !== self.location.origin) {
    return;
  }
  // Simboli Mulberry: prima la cache dedicata (i file non cambiano dentro una versione del set)
  if (url.pathname.includes(CARTELLA_MULBERRY)) {
    event.respondWith(
      caches.open(CACHE_MULBERRY).then((cache) => cache.match(request, { ignoreSearch: true }).then((cached) => cached
        || fetch(request).then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })))
    );
    return;
  }
  // Prima la rete: con la connessione si usano sempre i file aggiornati;
  // senza rete si usa la copia in cache.
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
