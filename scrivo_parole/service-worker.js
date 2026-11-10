/**
 * Service worker della PAGINA DI SCELTA di «Scrivo parole».
 *
 * Il suo ambito (/scrivo_parole/) contiene anche lettere/ e sillabe/, ma quelle hanno il loro
 * service worker, più specifico, che il browser usa al posto di questo. Qui si gestiscono SOLO
 * i file della pagina di scelta: tutte le altre richieste passano senza essere toccate.
 * Strategia: prima la rete, la cache serve quando non c'è connessione.
 */
const PREFISSO = 'scrivo_parole_scelta_';
const CACHE_NAME = `${PREFISSO}v1.0.6`;

const FILE_PAGINA = [
    './',
    './index.html',
    './manifest.json',
    './js/raccolta.js?v=1.0',
    './js/installa.js?v=1.0',
    './js/clear-cache.js?v=1.1',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './lettere/css/styles.css?v=3.0',
    './lettere/assets/fonts/bootstrap-icons/bootstrap-icons.css',
    './lettere/assets/fonts/bootstrap-icons/bootstrap-icons.woff2?2ab2cbbe07fcebb53bdaa7313bb290f2',
    './lettere/assets/fonts/bootstrap-icons/bootstrap-icons.woff?2ab2cbbe07fcebb53bdaa7313bb290f2',
];
const URL_PAGINA = new Set(FILE_PAGINA.map(f => new URL(f, self.registration.scope).href));

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => Promise.all(FILE_PAGINA.map(f => cache.add(f).catch(() => {}))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(nomi => Promise.all(nomi
                .filter(n => n.startsWith(PREFISSO) && n !== CACHE_NAME)
                .map(n => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    url.hash = '';
    // Solo i file della pagina di scelta; per la pagina, anche con ?query
    const soloPercorso = url.origin + url.pathname;
    const nostra = URL_PAGINA.has(url.href) || URL_PAGINA.has(soloPercorso) && req.mode === 'navigate';
    if (!nostra) return;

    event.respondWith(
        fetch(req)
            .then(risposta => {
                if (risposta.ok) {
                    const copia = risposta.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, copia));
                }
                return risposta;
            })
            .catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }))
    );
});
