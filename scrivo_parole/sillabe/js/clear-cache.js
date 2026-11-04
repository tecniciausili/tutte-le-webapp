/**
 * Aggiorna l'app: scarica di nuovo i file dalla rete.
 *
 * ATTENZIONE: su questo dominio convivono più app (il sito della raccolta),
 * che condividono localStorage e la lista delle cache. Quindi qui si tocca SOLO
 * questa app:
 *   - NON si cancella localStorage: contiene gli esercizi e i risultati dell'utente.
 *   - Si cancellano solo le cache che iniziano con "scrivo_parole_sillabe_".
 *   - Si disattiva solo il service worker di questa app (per scope).
 */

async function clearCacheAndReload() {
    if (!confirm('Vuoi ricaricare l\'app con i file aggiornati?\n\nEsercizi, impostazioni e risultati salvati restano al loro posto.')) {
        return;
    }

    const PREFISSO = 'scrivo_parole_sillabe_';

    try {
        // Cancella solo le cache di questa app
        if ('caches' in window) {
            const nomi = await caches.keys();
            await Promise.all(
                nomi.filter((n) => n.startsWith(PREFISSO)).map((n) => caches.delete(n))
            );
        }

        // Disattiva solo il service worker di questa cartella
        if ('serviceWorker' in navigator) {
            const base = new URL('.', window.location.href).href;
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(
                registrations
                    .filter((reg) => (reg.scope || '').startsWith(base))
                    .map((reg) => reg.unregister())
            );
        }

        window.location.reload();
    } catch (error) {
        console.error('Errore durante l\'aggiornamento:', error);
        window.location.reload();
    }
}
