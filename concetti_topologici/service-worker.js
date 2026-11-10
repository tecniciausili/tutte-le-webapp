// Service Worker - Concetti topologici (web app autonoma)
// - File dell'app (stessa origine): precaricati all'installazione; poi prima la rete (con la
//   connessione si usano sempre i file aggiornati), senza rete la copia in cache.
// - Pittogrammi ARASAAC: cache prima, poi rete (sono immutabili): quelli già visti funzionano offline.
// - Scontorno delle foto: runtime onnxruntime-web (jsDelivr, versione fissata) e modello
//   modelli/u2netp.onnx (~4,5 MB): scaricati al primo uso, poi dalla cache (anche offline).
// - I dati (profilo, foto, risultati) NON passano di qui: stanno in localStorage e IndexedDB.
// Tutte le cache dell'app iniziano con PREFISSO: sullo stesso dominio (assistivetech.it/webapp/)
// ci sono altre app, e le loro cache non vanno toccate.
const PREFISSO = 'concetti_topologici_';
const CACHE_NAME = `${PREFISSO}v1.1.5`;
const CACHE_ARASAAC = `${PREFISSO}arasaac`;
const CACHE_MODELLI = `${PREFISSO}modelli`;
const LIMITE_ARASAAC = 800;
const URLS_TO_CACHE = [
  './',
  './index.html',
  './gestione.html',
  './gioca.html',
  './manifest.json',
  './js/raccolta.js?v=1.0',
  './css/styles.css?v=1.1.5',
  './css/gioco.css?v=1.1.5',
  './js/comune.js?v=1.1.5',
  './js/concetti.js?v=1.1.5',
  './js/archivio.js?v=1.1.5',
  './js/gestione.js?v=1.1.5',
  './js/gioca.js?v=1.1.5',
  './assets/fonts/fonts.css',
  './assets/fonts/atkinson-hyperlegible-400-latin.woff2',
  './assets/fonts/atkinson-hyperlegible-400-latin-ext.woff2',
  './assets/fonts/atkinson-hyperlegible-700-latin.woff2',
  './assets/fonts/atkinson-hyperlegible-700-latin-ext.woff2',
  './assets/fonts/bricolage-grotesque-500-latin.woff2',
  './assets/fonts/bricolage-grotesque-500-latin-ext.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
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
      // Si cancellano solo le versioni vecchie dei file di questa app (non i pittogrammi)
      .then((nomi) => Promise.all(nomi
        .filter((n) => n.startsWith(PREFISSO) && n !== CACHE_NAME && n !== CACHE_ARASAAC && n !== CACHE_MODELLI)
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

  // Pittogrammi ARASAAC: cache prima (immutabili)
  if (url.hostname === 'static.arasaac.org') {
    event.respondWith(cachePrima(request));
    return;
  }

  // Scontorno: runtime (CDN, versione fissata) e modello locale, immutabili → cache prima
  if ((url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/onnxruntime-web@'))
      || (url.origin === self.location.origin && url.pathname.includes('/modelli/'))) {
    event.respondWith(cachePrima(request, CACHE_MODELLI, 0));
    return;
  }

  // Altre origini (ricerca ARASAAC): gestione normale del browser
  if (url.origin !== self.location.origin) {
    return;
  }

  // Prima la rete, senza rete la cache
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

async function cachePrima(request, nomeCache = CACHE_ARASAAC, limite = LIMITE_ARASAAC) {
  const cache = await caches.open(nomeCache);
  const inCache = await cache.match(request, { ignoreVary: true });
  if (inCache) {
    return inCache;
  }
  const risposta = await fetch(request);
  if (risposta && (risposta.ok || risposta.type === 'opaque')) {
    cache.put(request, risposta.clone());
    cache.keys().then((chiavi) => {
      if (limite && chiavi.length > limite) {
        chiavi.slice(0, chiavi.length - limite).forEach((k) => cache.delete(k));
      }
    });
  }
  return risposta;
}
