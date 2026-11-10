// Service Worker - Frase Minima
// Strategia: prima la rete per i file dell'app (stessa origine), poi la cache
// quando si è offline. I dati (frasi, risultati, impostazioni) NON passano di
// qui: stanno in localStorage. Le richieste ad ARASAAC (altra origine) non sono
// intercettate: la ricerca dei pittogrammi richiede la rete; i pittogrammi
// scelti vengono incorporati nella frase al salvataggio.
// Tutte le cache iniziano con PREFISSO: sullo stesso dominio ci sono altre app,
// e le loro cache non vanno toccate.
const PREFISSO = 'frase_minima_';
const CACHE_NAME = `${PREFISSO}v2.0.7`;

const URLS_TO_CACHE = [
  './',
  './index.html',
  './esercizio.html',
  './gestione.html',
  './css/styles.css',
  './js/clear-cache.js',
  './js/archivio.js',
  './js/arasaac-service.js',
  './js/esercizio-app.js',
  './js/educatore-app.js',
  './manifest.json',
  './js/raccolta.js?v=1.0',
  './js/installa.js?v=1.0',
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
  // Solo file di questa origine; le richieste esterne passano direttamente
  if (url.origin !== self.location.origin) return;

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
      .catch(() => caches.match(request).then((hit) => {
        if (hit) return hit;
        // Per una navigazione andata a vuoto, mostra almeno la home dell'app
        if (request.mode === 'navigate') return caches.match('./index.html');
        return undefined;
      }))
  );
});
