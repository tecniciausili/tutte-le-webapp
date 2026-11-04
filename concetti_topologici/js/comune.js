/**
 * Concetti topologici - Icone e utilità comuni
 * AssistiveTech.it - Web App autonoma (un dispositivo = un utente, nessun server)
 */
window.CT = window.CT || {};

CT.VERSIONE = '1.1.2';
CT.APP_NAME = 'concetti_topologici';

/* ---------- Icone SVG inline (tratti a 2px su griglia 24x24) ---------- */
(function () {
    const P = (d) => `<path d="${d}"/>`;
    const tracciati = {
        home:     P('M3 11l9-7 9 7') + P('M5 10v10h14V10') + P('M10 20v-6h4v6'),
        indietro: P('M9 14L4 9l5-5') + P('M4 9h11a5 5 0 0 1 0 10h-3'),
        esci:     P('M15 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9') + P('M10 12h11') + P('M17 8l4 4-4 4'),
        modifica: P('M4 20h4l11-11a2.1 2.1 0 0 0-3-3L5 17v3z') + P('M13.5 6.5l3 3'),
        impostazioni: P('M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0') + P('M16 4v4M10 10v4M18 16v4'),
        chiudi:   P('M6 6l12 12M18 6L6 18'),
        piu:      P('M12 5v14M5 12h14'),
        cerca:    P('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z') + P('M21 21l-5-5'),
        carica:   P('M12 16V4') + P('M7 9l5-5 5 5') + P('M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'),
        scarica:  P('M12 4v12') + P('M7 11l5 5 5-5') + P('M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'),
        immagine: P('M3 5h18v14H3z') + P('M8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z') + P('M21 15l-5-5-9 9'),
        blocco:   P('M6 11h12v10H6z') + P('M8 11V7a4 4 0 0 1 8 0v4'),
        duplica:  P('M8 8h12v12H8z') + P('M16 8V4H4v12h4'),
        elimina:  P('M4 7h16') + P('M9 7V4h6v3') + P('M6 7l1 13h10l1-13'),
        utente:   P('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z') + P('M4 21c0-4 3.6-7 8-7s8 3 8 7'),
        utenti:   P('M8 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 8 11z') + P('M16.5 11.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z') + P('M2 20c0-3.5 2.7-6 6-6s6 2.5 6 6') + P('M14 20c0-2.6 1.6-4.6 4-5 1.8.4 3.5 2 3.5 4.5'),
        freccia:  P('M5 12h14') + P('M13 6l6 6-6 6'),
        gioca:    P('M7 5v14l11-7z'),
        info:     P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z') + P('M12 11v6') + P('M12 7.5v.5'),
        occhio:   P('M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z') + P('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'),
        mano:     P('M8 13V6a2 2 0 1 1 4 0v5') + P('M12 11V9.5a2 2 0 1 1 4 0V12') + P('M16 12a2 2 0 1 1 4 0v3a6 6 0 0 1-6 6h-2a5 5 0 0 1-4-2l-3.5-4.5a1.6 1.6 0 0 1 2.4-2.1L8 13'),
        timer:    P('M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z') + P('M12 9v4l3 2') + P('M9 3h6'),
        spunta:   P('M5 12l5 5 9-10'),
        salva:    P('M5 4h11l3 3v13H5z') + P('M8 4v5h7V4') + P('M8 20v-6h8v6'),
        ok:       P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z') + P('M8 12l3 3 5-6'),
        errore:   P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z') + P('M9 9l6 6M15 9l-6 6'),
        stella:   P('M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z'),
        grafico:  P('M4 20V4') + P('M4 20h16') + P('M8 16v-4M12 16V8M16 16v-6'),
        scene:    P('M3 5h18v14H3z') + P('M7 15h4v-4H7z') + P('M16 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'),
        mescola:  P('M4 7h3c4 0 6 10 10 10h3') + P('M4 17h3c1.5 0 2.6-1.4 3.6-3.2M13.4 10.2C14.4 8.4 15.5 7 17 7h3') + P('M18 4l3 3-3 3M18 14l3 3-3 3'),
        sposta:   P('M12 3v18M3 12h18') + P('M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3')
    };
    CT.icona = function (nome, classe = '') {
        const d = tracciati[nome] || tracciati.info;
        return `<svg class="icona ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
    };
})();

/* ---------- Utilità ---------- */
CT.util = {
    uid(prefisso = 'sc') {
        return `${prefisso}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    },
    escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    clamp(v, min, max) { return Math.min(max, Math.max(min, v)); },
    attesa(ms) { return new Promise(r => setTimeout(r, ms)); },
    mescola(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
    },
    /** fetch JSON con controllo di success; lancia Error con message leggibile */
    async fetchJson(url, opzioni = {}) {
        const risposta = await fetch(url, opzioni);
        let json = null;
        try { json = await risposta.json(); } catch (e) { /* corpo non JSON */ }
        if (!json) throw new Error(`Risposta non valida dal server (${risposta.status})`);
        if (!json.success) {
            const err = new Error(json.message || 'Operazione non riuscita');
            err.dati = json.data;
            err.status = risposta.status;
            throw err;
        }
        return json;
    },
    toast(messaggio, tipo = 'info', durata = 3200) {
        let cont = document.getElementById('toast');
        if (!cont) {
            cont = document.createElement('div');
            cont.id = 'toast';
            cont.className = 'toast-contenitore';
            document.body.appendChild(cont);
        }
        const el = document.createElement('div');
        el.className = `toast toast-${tipo}`;
        el.setAttribute('role', 'status');
        el.textContent = messaggio;
        cont.appendChild(el);
        requestAnimationFrame(() => el.classList.add('visibile'));
        setTimeout(() => { el.classList.remove('visibile'); setTimeout(() => el.remove(), 300); }, durata);
    },
    conferma(titolo, testo, { ok = 'Conferma', annulla = 'Annulla', pericolo = false } = {}) {
        return new Promise(risolvi => {
            const esc = CT.util.escapeHtml;
            const m = CT.util.apriModale(`
                <h2 class="modale-titolo">${esc(titolo)}</h2>
                <p class="modale-testo">${esc(testo)}</p>
                <div class="modale-azioni">
                    <button type="button" class="btn btn-secondario" data-ris="0">${esc(annulla)}</button>
                    <button type="button" class="btn ${pericolo ? 'btn-pericolo' : 'btn-primario'}" data-ris="1">${esc(ok)}</button>
                </div>`, { piccola: true });
            m.querySelectorAll('[data-ris]').forEach(b => b.addEventListener('click', () => {
                risolvi(b.dataset.ris === '1');
                CT.util.chiudiModale();
            }));
            m.addEventListener('ct:chiusa', () => risolvi(false), { once: true });
        });
    },
    apriModale(html, { piccola = false, larga = false, chiudibile = true } = {}) {
        CT.util.chiudiModale();
        const sfondo = document.createElement('div');
        sfondo.className = 'modale-sfondo';
        sfondo.id = 'modaleAttiva';
        const box = document.createElement('div');
        box.className = 'modale' + (piccola ? ' modale-piccola' : '') + (larga ? ' modale-larga' : '');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.innerHTML = (chiudibile ? `<button type="button" class="modale-chiudi btn-icona" aria-label="Chiudi">${CT.icona('chiudi')}</button>` : '') + html;
        sfondo.appendChild(box);
        document.body.appendChild(sfondo);
        document.body.classList.add('con-modale');
        if (chiudibile) {
            box.querySelector('.modale-chiudi').addEventListener('click', () => CT.util.chiudiModale());
            sfondo.addEventListener('pointerdown', e => { if (e.target === sfondo) CT.util.chiudiModale(); });
        }
        requestAnimationFrame(() => sfondo.classList.add('visibile'));
        return box;
    },
    chiudiModale() {
        const s = document.getElementById('modaleAttiva');
        if (!s) return;
        const box = s.querySelector('.modale');
        if (box) box.dispatchEvent(new CustomEvent('ct:chiusa'));
        s.remove();
        document.body.classList.remove('con-modale');
    },
    modaleAperta() { return !!document.getElementById('modaleAttiva'); }
};

CT.registraServiceWorker = function () {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('[Concetti topologici] Service worker non registrato:', err));
    });
};
