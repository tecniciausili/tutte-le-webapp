/**
 * Parola-Immagine - funzioni comuni a tutte le pagine.
 *
 * Aggiorna l'app (pulsante ⟳ nell'header): scarica di nuovo i file dalla rete.
 * ATTENZIONE: sullo stesso dominio convivono più app, che condividono localStorage e
 * la lista delle cache. Quindi qui si tocca SOLO questa app:
 *   - NON si cancella localStorage né IndexedDB: contengono coppie, risultati e impostazioni.
 *   - Si cancellano solo le cache che iniziano con "parola_immagine_".
 *   - Si disattiva solo il service worker di questa cartella (per scope).
 * Senza connessione non si cancella nulla: l'app deve continuare a funzionare offline.
 */

const PREFISSO_CACHE = 'parola_immagine_';

async function clearCacheAndReload() {
    if (!confirm('Vuoi ricaricare l\'app con i file aggiornati?\n\nCoppie, impostazioni e risultati salvati restano al loro posto.')) {
        return;
    }
    // Senza connessione non si cancella nulla: l'app deve continuare a funzionare offline.
    if (!(await reteDisponibile())) {
        alert('Per aggiornare serve la connessione a internet.\n\nNon è stato cambiato nulla: riprova quando c\'è la connessione.');
        return;
    }
    try {
        if ('caches' in window) {
            const nomi = await caches.keys();
            await Promise.all(nomi.filter((n) => n.startsWith(PREFISSO_CACHE)).map((n) => caches.delete(n)));
        }
        if ('serviceWorker' in navigator) {
            const base = new URL('.', window.location.href).href;
            const registrazioni = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrazioni
                .filter((reg) => (reg.scope || '').startsWith(base))
                .map((reg) => reg.unregister()));
        }
    } catch (e) {
        console.error('Errore durante l\'aggiornamento:', e);
    }
    window.location.reload();
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

function escapeHtml(testo) {
    return String(testo ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-x-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        info: 'bi-info-circle-fill'
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span></span>`;
    toast.querySelector('span').textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// Indirizzo dell'indice della raccolta (js/raccolta.js), oppure la pagina iniziale dell'app
function indirizzoCasa() {
    return window.RACCOLTA ? window.RACCOLTA.url : './';
}

// Service worker: rende l'app installabile e utilizzabile senza rete
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .catch((err) => console.warn('Service Worker non registrato:', err));
    });
}
