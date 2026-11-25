/**
 * Installazione dell'app sul dispositivo — uguale in tutte le web app della raccolta (versione 2.1).
 *
 * Due modi:
 *  1. BARRA in basso, fissa e ben visibile, nelle pagine dove l'app si apre (Configurazione ed esercizio):
 *         <script src="js/installa.js?v=2.1" data-nome="Nome dell'app"></script>
 *     Facoltativi sullo stesso <script>: data-colore (altrimenti il theme-color), data-icona.
 *  2. RIQUADRO dentro la pagina, se la pagina ha un elemento
 *         <div data-installa data-nome="Nome dell'app"></div>
 *     (facoltativi data-icona e data-nota). In quella pagina la barra non compare.
 *
 * La barra compare solo quando serve:
 *  - non compare se l'app è già installata e aperta dalla sua icona, né dentro le app native
 *    (Mastertutor Windows, APK Android);
 *  - Chrome, Edge, Android (Samsung Internet compreso): compare quando il browser dice che l'app si
 *    può installare («beforeinstallprompt»), e il pulsante apre subito la richiesta di installazione;
 *  - Safari su iPad/iPhone/Mac e gli altri browser: compare subito e il pulsante mostra i passi da fare;
 *  - la ✕ la nasconde fino alla prossima apertura dell'app (sessionStorage);
 *  - appena installata la barra lo dice e sparisce;
 *  - si nasconde durante l'esercizio a schermo intero e durante il gioco (body.playing).
 */
(function () {
    'use strict';

    const script = document.currentScript;
    let richiesta = null;   // evento beforeinstallprompt conservato
    let alArrivo = null;    // chi aspetta l'evento (la barra)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        richiesta = e;
        if (alArrivo) alArrivo();
    });

    const CHIAVE_RINVIO = 'installa_rinviata';

    const STILE = `
.inst-riquadro{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:20px auto 0;max-width:1100px;
  padding:16px 18px;background:#fff;border:2px solid var(--inst-colore);border-radius:18px;
  box-shadow:0 4px 14px rgba(0,0,0,.08);font-family:inherit;color:#263238;text-align:left;box-sizing:border-box}
.inst-icona{width:56px;height:56px;border-radius:14px;flex-shrink:0;object-fit:cover}
.inst-testo{flex:1;min-width:200px}
.inst-testo strong{display:block;font-size:1.1rem;margin-bottom:2px}
.inst-testo p{margin:0;font-size:.92rem;color:#5f6b72;line-height:1.4}
.inst-pulsante{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 22px;border:none;
  border-radius:999px;background:var(--inst-colore);color:#fff;font:inherit;font-weight:700;font-size:1rem;cursor:pointer;
  min-height:48px;white-space:nowrap}
.inst-pulsante:hover{filter:brightness(1.08)}
.inst-pulsante:focus-visible,.inst-chiudi:focus-visible{outline:3px solid #263238;outline-offset:3px}
.inst-pulsante[disabled]{background:#2e7d32;cursor:default;filter:none}
.inst-pulsante svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.inst-barra{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9000;box-sizing:border-box;
  width:min(640px,calc(100% - 24px));display:flex;align-items:center;gap:12px;padding:10px 10px 10px 12px;
  background:#fff;color:#263238;border:3px solid var(--inst-colore);border-radius:20px;
  box-shadow:0 10px 30px rgba(0,0,0,.25);font-family:inherit;text-align:left;
  animation:inst-entra .35s ease-out}
@keyframes inst-entra{from{transform:translate(-50%,120%);opacity:0}to{transform:translate(-50%,0);opacity:1}}
@media (prefers-reduced-motion:reduce){.inst-barra{animation:none}}
.inst-barra .inst-icona{width:48px;height:48px;border-radius:12px}
.inst-barra .inst-testo{min-width:0}
.inst-barra .inst-testo strong{font-size:1.02rem;line-height:1.25}
.inst-barra .inst-testo p{font-size:.85rem;line-height:1.3}
.inst-chiudi{flex-shrink:0;width:40px;height:40px;border:none;border-radius:50%;background:#eef2f1;color:#37474f;
  font:inherit;font-size:1.25rem;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.inst-chiudi:hover{background:#dde5e3}
@media (max-width:560px){
  .inst-barra{flex-wrap:wrap;bottom:10px;gap:8px 10px}
  .inst-barra .inst-icona{width:40px;height:40px}
  .inst-barra .inst-testo{flex:1 1 calc(100% - 110px)}
  .inst-barra .inst-testo p{display:none}
  .inst-barra .inst-pulsante{order:3;flex:1 1 100%;min-height:44px;padding:10px 16px}
}
@media print{.inst-barra{display:none}}
.inst-barra[hidden],body.playing .inst-barra{display:none}
.inst-sfondo{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;
  padding:16px;z-index:10000}
.inst-modale{background:#fff;color:#263238;border-radius:18px;max-width:460px;width:100%;padding:22px 22px 18px;
  box-shadow:0 12px 40px rgba(0,0,0,.3);font-family:inherit;text-align:left;box-sizing:border-box}
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
            || matchMedia('(display-mode: minimal-ui)').matches
            || navigator.standalone === true;
    }

    // Dentro Mastertutor Windows (Electron) e negli APK (Capacitor) l'app è già installata
    function appNativa() {
        return !!window.Capacitor?.isNativePlatform?.() || /\bElectron\//.test(navigator.userAgent);
    }

    // Chrome, Edge, Samsung Internet: il browser manda «beforeinstallprompt» quando si può installare
    function browserConRichiesta() {
        return 'onbeforeinstallprompt' in window;
    }

    function rinviata() {
        try {
            return sessionStorage.getItem(CHIAVE_RINVIO) === '1';
        } catch (e) {
            return false;
        }
    }

    function rinvia() {
        try {
            sessionStorage.setItem(CHIAVE_RINVIO, '1');
        } catch (e) { /* senza sessionStorage la barra torna alla prossima pagina */ }
    }

    function escapeHtml(testo) {
        return String(testo).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
        if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) {
            return ['In <strong>Safari</strong> apri il menu <strong>File</strong> (oppure il pulsante <strong>Condividi</strong>)',
                'Scegli <strong>Aggiungi al Dock</strong>',
                'Conferma con <strong>Aggiungi</strong>'];
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
        const chiudi = () => { sfondo.remove(); document.removeEventListener('keydown', esc, true); };
        // In cattura e fermato: Esc chiude solo questa finestra, non quelle dell'app sotto
        const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); chiudi(); } };
        sfondo.addEventListener('click', (e) => { if (e.target === sfondo) chiudi(); });
        sfondo.querySelector('button').addEventListener('click', chiudi);
        document.addEventListener('keydown', esc, true);
        document.body.appendChild(sfondo);
        sfondo.querySelector('button').focus();
    }

    // Apre la richiesta del browser, se c'è; altrimenti i passi
    async function installa(nome, colore) {
        if (richiesta) {
            const r = richiesta;
            richiesta = null;
            r.prompt();
            const scelta = await r.userChoice.catch(() => null);
            if (!scelta || scelta.outcome !== 'accepted') richiesta = r;   // si può riprovare
            return;
        }
        mostraPassi(nome, colore);
    }

    function aggiungiStile() {
        if (!document.getElementById('instStile')) {
            const st = document.createElement('style');
            st.id = 'instStile';
            st.textContent = STILE;
            document.head.appendChild(st);
        }
    }

    function datiApp(box) {
        const dal = (k) => box?.dataset[k] || script?.dataset[k] || '';
        return {
            nome: escapeHtml(dal('nome') || document.title),
            colore: dal('colore') || document.querySelector('meta[name="theme-color"]')?.content || '#673AB7',
            icona: dal('icona')
                || document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')
                || 'assets/icons/icon-192.png',
        };
    }

    // ==================== RIQUADRO nella pagina ====================

    function riquadro(box) {
        const { nome, colore, icona } = datiApp(box);
        const nota = box.dataset.nota
            || 'Si apre a tutto schermo come un\'app, con la sua icona sulla schermata Home, e funziona anche senza connessione.';
        box.className = 'inst-riquadro';
        box.style.setProperty('--inst-colore', colore);
        box.innerHTML = `<img class="inst-icona" alt="" src="${escapeHtml(icona)}">
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
        if (installata() || appNativa()) segnaInstallata(`Stai già usando ${box.dataset.nome || document.title} come app installata su questo dispositivo.`);

        window.addEventListener('appinstalled', () => {
            richiesta = null;
            segnaInstallata(`Installata: trovi ${box.dataset.nome || document.title} sulla schermata Home, con la sua icona.`);
        });
        pulsante.addEventListener('click', () => installa(nome, colore));
    }

    // ==================== BARRA in basso ====================

    function barra() {
        if (installata() || appNativa() || rinviata()) return;
        const { nome, colore, icona } = datiApp(null);
        let el = null;

        const mostra = () => {
            if (el || rinviata()) return;
            el = document.createElement('div');
            el.className = 'inst-barra';
            el.setAttribute('role', 'region');
            el.setAttribute('aria-label', `Installa ${nome}`);
            el.style.setProperty('--inst-colore', colore);
            el.innerHTML = `<img class="inst-icona" alt="" src="${escapeHtml(icona)}">
                <div class="inst-testo"><strong>Installa ${nome} su questo dispositivo</strong>
                  <p>Si apre a tutto schermo con la sua icona, anche senza connessione.</p></div>
                <button type="button" class="inst-pulsante">${ICONA_SCARICA} Installa</button>
                <button type="button" class="inst-chiudi" aria-label="Non ora" title="Non ora">✕</button>`;
            el.querySelector('.inst-pulsante').addEventListener('click', () => installa(nome, colore));
            el.querySelector('.inst-chiudi').addEventListener('click', () => {
                rinvia();
                el.remove();
            });
            document.body.appendChild(el);
            nascondiSeSchermoIntero();
        };

        // Durante l'esercizio a schermo intero la barra non deve coprire niente
        const nascondiSeSchermoIntero = () => {
            if (el) el.hidden = !!(document.fullscreenElement || document.webkitFullscreenElement);
        };
        document.addEventListener('fullscreenchange', nascondiSeSchermoIntero);
        document.addEventListener('webkitfullscreenchange', nascondiSeSchermoIntero);

        window.addEventListener('appinstalled', () => {
            richiesta = null;
            if (!el) return;
            const pulsante = el.querySelector('.inst-pulsante');
            pulsante.innerHTML = `${ICONA_SPUNTA} Installata`;
            pulsante.disabled = true;
            el.querySelector('.inst-testo strong').textContent = 'Installata: la trovi con la sua icona';
            setTimeout(() => el?.remove(), 5000);
        });

        if (browserConRichiesta()) {
            // Chrome/Edge: solo quando il browser conferma che si può installare
            // (se l'app è già installata l'evento non arriva e la barra non disturba)
            if (richiesta) mostra();
            else alArrivo = mostra;
        } else {
            mostra();
        }
    }

    function avvia() {
        aggiungiStile();
        const box = document.querySelector('[data-installa]');
        if (box) riquadro(box);
        else barra();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
    else avvia();
})();
