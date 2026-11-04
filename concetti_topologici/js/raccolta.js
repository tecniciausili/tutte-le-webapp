/**
 * Versione GitHub / Azure (raccolta «tutte-le-webapp»): le frecce 🏠 portano all'indice della raccolta.
 *
 * Nelle pagine:
 *   data-senza-raccolta="nascondi"            → l'elemento sparisce solo se RACCOLTA fosse null
 *   data-casa="./" data-casa-nome="Nome app"   → 🏠 porta a RACCOLTA.url e lo dice nel suggerimento
 */
window.RACCOLTA = { url: '../', nome: 'Tutte le Web App' };

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
