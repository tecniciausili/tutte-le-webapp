// Service Worker - Parola-Immagine
// Strategia: prima la rete per i file dell'app (stessa origine), poi la cache quando si è
// offline. I dati (coppie, risultati, impostazioni) NON passano di qui: stanno in IndexedDB
// e localStorage. Le richieste ad ARASAAC (altra origine) non sono intercettate: la ricerca
// dei pittogrammi richiede la rete; le immagini scelte vengono copiate nella coppia.
// Tutte le cache iniziano con PREFISSO: sullo stesso dominio ci sono altre app, e le loro
// cache non vanno toccate.
// Quando si modifica l'app: aumentare la versione qui (e i ?v= nelle pagine).
const PREFISSO = 'parola_immagine_';
const CACHE_NAME = `${PREFISSO}v3.0.1`;

const URLS_TO_CACHE = [
  './',
  './index.html',
  './gestione.html',
  './esercizio.html',
  './esercizio-immagine-parola.html',
  './manifest.json',
  './css/styles.css?v=3.0.1',
  './js/raccolta.js?v=1.0',
  './js/installa.js?v=1.0',
  './js/comune.js?v=3.0.1',
  './js/archivio.js?v=3.0.1',
  './js/educatore.js?v=3.0.1',
  './js/esercizio.js?v=3.0.1',
  './js/blocco-tocco.js?v=3.0.1',
  './assets/fonts/bootstrap-icons/bootstrap-icons.css',
  './assets/fonts/bootstrap-icons/bootstrap-icons.woff',
  './assets/fonts/bootstrap-icons/bootstrap-icons.woff2',
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-384.png',
  './assets/icons/icon-512.png',
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
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Solo i file di questa app; le richieste esterne (ARASAAC) passano direttamente
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(self.registration.scope)) return;

  event.respondWith(
    fetch(request)
      .then((risposta) => {
        // Copia in cache le risposte valide, per l'uso offline successivo
        if (risposta && risposta.status === 200 && risposta.type === 'basic') {
          const copia = risposta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
        }
        return risposta;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        // Prima la richiesta esatta, poi la stessa senza ?v=… (o con un ?v= diverso)
        const hit = await cache.match(request) || await cache.match(request, { ignoreSearch: true });
        if (hit) return hit;
        // Per una navigazione andata a vuoto, mostra almeno la home dell'app
        if (request.mode === 'navigate') return cache.match('./index.html');
        return Response.error();
      })
  );
});
