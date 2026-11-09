/**
 * Blocco tocchi involontari nelle pagine degli esercizi (LIM, tablet):
 * niente menu contestuale, niente zoom a pizzico o doppio tocco, niente selezione del testo.
 * L'Area Educatore NON lo usa: lì serve poter selezionare e scrivere.
 */
(function () {
    'use strict';
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
        vp.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
    const st = document.createElement('style');
    st.textContent = 'html,body{touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;}';
    document.head.appendChild(st);

    const blocca = (e) => e.preventDefault();
    document.addEventListener('contextmenu', blocca, { passive: false });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, blocca, { passive: false }));
    document.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
    });
})();
