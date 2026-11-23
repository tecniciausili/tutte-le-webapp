/**
 * Apertura di «Scrivo parole» (pagina di scelta, lettere/ e sillabe/).
 *
 * Obiettivo: l'utente non deve passare dalla schermata iniziale né dalla parte dell'educatore.
 *   - esercizio pronto     → si apre direttamente la pagina dell'esercizio (che ha il tasto «Configurazione»);
 *   - esercizio non pronto → si apre la «Configurazione» (che ha il tasto «Vai all'esercizio»).
 *
 * «Esercizio pronto»:
 *   - lettere: in spl_config c'è almeno un esercizio non archiviato con parola e lettere disponibili;
 *   - sillabe: in sps_config c'è almeno un esercizio con parole target e sillabe disponibili.
 * Nessuna delle due ha esercizi di serie: all'inizio sono vuote.
 *
 * Pagina di scelta (scrivo_parole/): apre la variante usata l'ultima volta se è pronta, altrimenti
 * quella pronta; se nessuna è pronta, la Configurazione dell'ultima usata; la prima volta in assoluto
 * (nessuna variante mai aperta) resta la pagina di scelta: lettere o sillabe lo decide l'educatore.
 *
 * Con ?menu (pagina iniziale di una variante) o ?scelta (pagina di scelta) la pagina resta dov'è:
 * il vecchio menu (Esporta/Importa, Installa) si raggiunge con la freccia ←.
 * I reindirizzamenti usano location.replace: il tasto Indietro del browser non resta intrappolato.
 * Legge soltanto i dati delle due varianti; scrive solo la chiave scrivo_parole_variante.
 */
(function () {
    'use strict';

    const CHIAVE_VARIANTE = 'scrivo_parole_variante';   // 'lettere' | 'sillabe': ultima variante usata
    const VARIANTI = ['lettere', 'sillabe'];

    function lista(chiave) {
        try {
            const v = JSON.parse(localStorage.getItem(chiave));
            return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];
        } catch (e) {
            return [];
        }
    }

    function nonVuota(arr) {
        return Array.isArray(arr) && arr.some((x) => String(x ?? '').trim() !== '');
    }

    // C'è almeno un esercizio utilizzabile nella variante?
    function pronta(variante) {
        if (variante === 'lettere') {
            return lista('spl_config').some((c) => c.stato !== 'archiviata'
                && String(c.parola_target ?? '').trim() !== '' && nonVuota(c.lettere_disponibili));
        }
        if (variante === 'sillabe') {
            return lista('sps_config').some((c) => nonVuota(c.parole_target) && nonVuota(c.sillabe_disponibili));
        }
        return false;
    }

    function ultima() {
        try {
            const v = localStorage.getItem(CHIAVE_VARIANTE);
            return VARIANTI.includes(v) ? v : null;
        } catch (e) {
            return null;
        }
    }

    function ricorda(variante) {
        try { localStorage.setItem(CHIAVE_VARIANTE, variante); } catch (e) { /* non essenziale */ }
    }

    // Pagina con cui aprire una variante
    function paginaDi(variante) {
        return pronta(variante) ? 'esercizio.html' : 'gestione.html';
    }

    // Variante da aprire dalla pagina di scelta (null = mostrare la scelta)
    function varianteDaAprire() {
        const u = ultima();
        if (u && pronta(u)) return u;
        const pronte = VARIANTI.filter(pronta);
        if (pronte.length) return pronte[0];
        return u;
    }

    // ?menu / ?scelta: la pagina iniziale resta visibile (raggiunta con la freccia ←)
    function restaQui() {
        return /[?&](menu|scelta)(=|&|$)/.test(location.search);
    }

    // Pagina iniziale di una variante: ricorda la variante e va all'esercizio o alla Configurazione
    function apriVariante(variante) {
        ricorda(variante);
        if (!restaQui()) location.replace(paginaDi(variante));
    }

    // Pagina di scelta: va alla variante giusta, se c'è
    function apriDallaScelta() {
        if (restaQui()) return;
        const v = varianteDaAprire();
        if (v) {
            location.replace(v + '/' + paginaDi(v));
            return;
        }
        // Resta la scelta: la sua voce nella cronologia diventa ?scelta, così il tasto Indietro
        // del browser, dalla variante scelta, torna qui e non viene rimandato avanti.
        try { history.replaceState(history.state, '', location.pathname + '?scelta'); } catch (e) { /* non essenziale */ }
    }

    window.ScrivoApertura = { pronta, ultima, ricorda, paginaDi, varianteDaAprire, apriVariante, apriDallaScelta };
})();
