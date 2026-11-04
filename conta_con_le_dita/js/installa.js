/**
 * Riquadro «Installa sul dispositivo» — uguale in tutte le web app della raccolta.
 *
 * Uso: nella pagina iniziale dell'app mettere
 *     <div data-installa data-nome="Nome dell'app"></div>
 *     <script src="js/installa.js?v=1.0"></script>
 * Facoltativi: data-icona="percorso icona" (altrimenti quella di apple-touch-icon),
 *              data-nota="testo sotto il titolo".
 *
 * Il pulsante è sempre visibile (non solo l'icona nella barra dell'indirizzo):
 * - Chrome, Edge, Android: il browser manda «beforeinstallprompt»; lo teniamo e lo apriamo al tocco.
 * - Safari su iPad/iPhone (e i browser che non lo mandano): il tocco mostra i passi da fare.
 * - App già installata (aperta dalla sua icona) o appena installata: «App installata».
 * Nessun dato salvato: non usa localStorage.
 */
(function () {
    'use strict';

    let richiesta = null;   // evento beforeinstallprompt conservato
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        richiesta = e;
    });

    const STILE = `
.inst-riquadro{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:20px auto 0;max-width:1100px;
  padding:16px 18px;background:#fff;border:2px solid var(--inst-colore);border-radius:18px;
  box-shadow:0 4px 14px rgba(0,0,0,.08);font-family:inherit;color:#263238;text-align:left;box-sizing:border-box}
.inst-icona{width:56px;height:56px;border-radius:14px;flex-shrink:0;object-fit:cover}
.inst-testo{flex:1;min-width:200px}
.inst-testo strong{display:block;font-size:1.1rem;margin-bottom:2px}
.inst-testo p{margin:0;font-size:.92rem;color:#5f6b72;line-height:1.4}
.inst-pulsante{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border:none;border-radius:999px;
  background:var(--inst-colore);color:#fff;font:inherit;font-weight:700;font-size:1rem;cursor:pointer;min-height:48px}
.inst-pulsante:hover{filter:brightness(1.08)}
.inst-pulsante:focus-visible{outline:3px solid #263238;outline-offset:3px}
.inst-pulsante[disabled]{background:#2e7d32;cursor:default;filter:none}
.inst-pulsante svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.inst-sfondo{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;
  padding:16px;z-index:10000}
.inst-modale{background:#fff;color:#263238;border-radius:18px;max-width:460px;width:100%;padding:22px 22px 18px;
  box-shadow:0 12px 40px rgba(0,0,0,.3);font-family:inherit;text-align:left}
.inst-modale h2{margin:0 0 6px;font-size:1.3rem;color:var(--inst-colore)}
.inst-modale p{margin:0 0 10px;color:#5f6b72;font-size:.95rem}
.inst-modale ol{margin:0 0 16px;padding-left:1.3rem;line-height:1.55}
.inst-modale li{margin:4px 0}
.inst-modale .inst-pulsante{float:right}
.inst-modale::after{content:"";display:block;clear:both}
`;
    const ICONA_SCARICA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';
    const ICONA_SPUNTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

    function installata() {
        return matchMedia('(display-mode: standalone)').matches
            || matchMedia('(display-mode: fullscreen)').matches
            || navigator.standalone === true;
    }

    function passi(nome) {
        const ua = navigator.userAgent;
        const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (iOS) {
            return ['Apri questa pagina in <strong>Safari</strong>',
                'Tocca il pulsante <strong>Condividi</strong> (il quadrato con la freccia verso l\'alto)',
                'Scegli <strong>Aggiungi alla schermata Home</strong>, poi <strong>Aggiungi</strong>'];
        }
        if (/Android/i.test(ua)) {
            return ['Apri questa pagina in <strong>Chrome</strong>',
                'Tocca il menu <strong>⋮</strong> in alto a destra',
                'Scegli <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong>'];
        }
        return ['Apri questa pagina in <strong>Chrome</strong> o <strong>Edge</strong>',
            `Clicca l'icona di installazione a destra nella barra dell'indirizzo, oppure menu <strong>⋮</strong> → <strong>Installa ${nome}</strong>`,
            'Conferma con <strong>Installa</strong>'];
    }

    function mostraPassi(nome, colore) {
        const sfondo = document.createElement('div');
        sfondo.className = 'inst-sfondo';
        sfondo.style.setProperty('--inst-colore', colore);   // la finestra sta fuori dal riquadro
        sfondo.innerHTML = `<div class="inst-modale" role="dialog" aria-modal="true" aria-labelledby="instTitolo">
            <h2 id="instTitolo">Installa ${nome}</h2>
            <p>Il browser non ha mostrato la richiesta automatica: si fa in tre passi.</p>
            <ol>${passi(nome).map(p => `<li>${p}</li>`).join('')}</ol>
            <button type="button" class="inst-pulsante">Ho capito</button></div>`;
        const chiudi = () => { sfondo.remove(); document.removeEventListener('keydown', esc); };
        const esc = (e) => { if (e.key === 'Escape') chiudi(); };
        sfondo.addEventListener('click', (e) => { if (e.target === sfondo) chiudi(); });
        sfondo.querySelector('button').addEventListener('click', chiudi);
        document.addEventListener('keydown', esc);
        document.body.appendChild(sfondo);
        sfondo.querySelector('button').focus();
    }

    function avvia() {
        const box = document.querySelector('[data-installa]');
        if (!box) return;
        const nome = box.dataset.nome || document.title;
        const colore = document.querySelector('meta[name="theme-color"]')?.content || '#673AB7';
        const icona = box.dataset.icona
            || document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')
            || 'assets/icons/icon-192.png';
        const nota = box.dataset.nota
            || 'Si apre a tutto schermo come un\'app, con la sua icona sulla schermata Home, e funziona anche senza connessione.';

        if (!document.getElementById('instStile')) {
            const st = document.createElement('style');
            st.id = 'instStile';
            st.textContent = STILE;
            document.head.appendChild(st);
        }
        box.className = 'inst-riquadro';
        box.style.setProperty('--inst-colore', colore);
        box.innerHTML = `<img class="inst-icona" alt="" src="${icona}">
            <div class="inst-testo"><strong>Installa sul dispositivo</strong><p class="inst-nota"></p></div>
            <button type="button" class="inst-pulsante">${ICONA_SCARICA} Installa sul dispositivo</button>`;
        const testoNota = box.querySelector('.inst-nota');
        const pulsante = box.querySelector('.inst-pulsante');
        testoNota.textContent = nota;

        const segnaInstallata = (testo) => {
            pulsante.innerHTML = `${ICONA_SPUNTA} App installata`;
            pulsante.disabled = true;
            testoNota.textContent = testo;
        };
        if (installata()) segnaInstallata(`Stai già usando ${nome} come app installata su questo dispositivo.`);

        window.addEventListener('appinstalled', () => {
            richiesta = null;
            segnaInstallata(`Installata: trovi ${nome} sulla schermata Home, con la sua icona.`);
        });

        pulsante.addEventListener('click', async () => {
            if (richiesta) {
                const r = richiesta;
                richiesta = null;
                r.prompt();
                const scelta = await r.userChoice.catch(() => null);
                if (!scelta || scelta.outcome !== 'accepted') richiesta = r;   // si può riprovare
                return;
            }
            mostraPassi(nome, colore);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
    else avvia();
})();
