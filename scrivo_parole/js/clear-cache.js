/**
 * Aggiorna l'app (pulsante ⟳ della pagina di scelta): scarica di nuovo i file dalla rete.
 *
 * «Scrivo parole» si installa come un'unica app fatta di tre parti: questa pagina di scelta,
 * lettere/ e sillabe/. Da qui si aggiornano tutte e tre in una volta.
 *
 * ATTENZIONE: sullo stesso dominio convivono più app (il sito della raccolta), che condividono
 * localStorage e la lista delle cache. Quindi qui si tocca SOLO «Scrivo parole»:
 *   - NON si cancella localStorage: contiene gli esercizi, le impostazioni e i risultati.
 *   - Si cancellano solo le cache che iniziano con i tre prefissi qui sotto.
 *   - Si disattivano solo i service worker di questa cartella e delle sue sottocartelle.
 * Senza connessione non si cancella nulla: l'app deve continuare a funzionare offline.
 */

async function clearCacheAndReload() {
    if (!confirm('Vuoi ricaricare l\'app con i file aggiornati?\n\n'
        + 'Si aggiornano sia «Con le lettere» sia «Con le sillabe».\n'
        + 'Esercizi, impostazioni e risultati salvati restano al loro posto.')) {
        return;
    }

    const PREFISSI = ['scrivo_parole_scelta_', 'scrivo_parole_con_le_lettere_', 'scrivo_parole_sillabe_'];
    const base = new URL('.', window.location.href).href;

    // Senza connessione non si cancella nulla: l'app deve continuare a funzionare offline.
    if (!(await reteDisponibile())) {
        alert('Per aggiornare serve la connessione a internet.\n\nNon è stato cambiato nulla: riprova quando c\'è la connessione.');
        return;
    }

    const pulsante = document.querySelector('.btn-refresh');
    if (pulsante) pulsante.disabled = true;   // l'aggiornamento dura qualche secondo: niente doppi tocchi

    try {
        let registrazioni = [];
        if ('serviceWorker' in navigator) {
            registrazioni = (await navigator.serviceWorker.getRegistrations())
                .filter((reg) => (reg.scope || '').startsWith(base));
        }
        // Le parti già in uso su questo dispositivo vanno riscaricate subito (vedi sotto)
        const daRiscaricare = PARTI.filter((parte) => registrazioni.some((reg) => reg.scope === base + parte.cartella));

        if ('caches' in window) {
            const nomi = await caches.keys();
            await Promise.all(
                nomi.filter((n) => PREFISSI.some((p) => n.startsWith(p))).map((n) => caches.delete(n))
            );
        }
        await Promise.all(registrazioni.map((reg) => reg.unregister()));

        // Lettere e sillabe si riscaricano adesso, senza aspettare che vengano riaperte:
        // così funzionano anche se poi il dispositivo resta senza connessione.
        // (La pagina di scelta si riscarica da sola con il ricaricamento qui sotto.)
        await Promise.all(daRiscaricare.map(riscaricaParte));
    } catch (error) {
        console.error('Errore durante l\'aggiornamento:', error);
    }
    window.location.reload();
}

// Le due app dentro «Scrivo parole»: cartella e service worker, come lo registrano le loro pagine
const PARTI = [
    { cartella: 'lettere/', sw: 'lettere/service-worker.js?v=3.0' },
    { cartella: 'sillabe/', sw: 'sillabe/service-worker.js?v=5.0' },
];

// Registra di nuovo il service worker di una parte e aspetta che abbia scaricato i suoi file
// (al massimo 20 secondi: se la rete è lenta finirà da solo dopo il ricaricamento).
async function riscaricaParte(parte) {
    const reg = await navigator.serviceWorker.register(parte.sw, { scope: parte.cartella });
    const sw = reg.installing || reg.waiting || reg.active;
    if (!sw || sw.state === 'activated') return;
    await new Promise((fatto) => {
        sw.addEventListener('statechange', () => {
            if (sw.state === 'activated' || sw.state === 'redundant') fatto();
        });
        setTimeout(fatto, 20000);
    });
}

// Chiede alla rete la pagina dell'app. La richiesta HEAD non passa dalla cache del
// service worker (che gestisce solo le GET): senza connessione fallisce davvero.
async function reteDisponibile() {
    try {
        const risposta = await fetch(`./?rete=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
        return risposta.ok;
    } catch (e) {
        return false;
    }
}
