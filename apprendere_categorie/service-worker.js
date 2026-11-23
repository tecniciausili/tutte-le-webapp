// Service Worker - Apprendere Categorie
// Strategia: prima la rete per i file dell'app (stessa origine), cache senza rete.
// I dati (griglie, celle, immagini) NON passano di qui: stanno in IndexedDB.
// Le immagini ARASAAC scelte vengono salvate dentro i dati, quindi servono anche senza rete.
// YouTube e la ricerca ARASAAC vanno sempre in rete.
// Tutte le cache dell'app iniziano con PREFISSO: sullo stesso indirizzo ci sono altre app,
// e le loro cache non vanno toccate.
const PREFISSO = 'apprendere_categorie_';
const CACHE_NAME = `${PREFISSO}v1.0.1`;
const URLS_TO_CACHE = [
  './',
  './index.html',
  './js/raccolta.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/img/logo-lega-filo-oro.png',
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
        .filter((n) => n.startsWith(PREFISSO) && n !== CACHE_NAME)
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

  // Altre origini (YouTube, ARASAAC): gestione normale del browser
  if (url.origin !== self.location.origin) {
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
