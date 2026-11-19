/**
 * Le app NON tornano all'elenco di tutte le Web App.
 *
 * L'elenco (indice della raccolta) serve al tecnico: da lì sceglie quali app installare sul
 * dispositivo di ogni utente. L'utente deve restare dentro la sua app: per questo RACCOLTA è null
 * e nelle pagine non ci sono né l'icona della casa né frecce che portano all'elenco.
 *
 * Rete di sicurezza per eventuali elementi rimasti nelle pagine:
 *   data-senza-raccolta="nascondi"            → l'elemento viene nascosto
 *   data-casa="./" data-casa-nome="Nome app"   → porta alla pagina indicata (dentro l'app), mai all'elenco
 */
window.RACCOLTA = null;

(function () {
    'use strict';
    function applica() {
        const r = window.RACCOLTA;
        document.querySelectorAll('[data-senza-raccolta="nascondi"]').forEach((el) => {
            if (!r) el.style.display = 'none';
        });
        document.querySelectorAll('[data-casa]').forEach((el) => {
            const url = r ? r.url : el.dataset.casa;
            const testo = 'Torna a: ' + (r ? r.nome : el.dataset.casaNome);
            el.title = testo;
            el.setAttribute('aria-label', testo);
            if (el.tagName === 'A') el.setAttribute('href', url);
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applica);
    else applica();
})();
