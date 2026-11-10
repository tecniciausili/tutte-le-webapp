/**
 * Menu ☰ della pagina iniziale — uguale in tutte le web app della raccolta.
 *
 * Voci: Esporta dati, Importa dati, Installa l'app, Aggiorna App.
 * Esporta/Importa servono a portare i dati su un altro dispositivo: stanno qui, prima di
 * entrare nelle aree, e non nell'Area Educatore.
 *
 * Uso: nella pagina iniziale dell'app mettere, nell'intestazione,
 *     <button class="btn-menu" data-menu-app
 *             data-nome="Nome dell'app"
 *             data-file="nome-del-file-esportato"
 *             data-cosa="Esercizi, impostazioni e risultati"
 *             aria-label="Menu" title="Menu">…</button>
 * e in fondo alla pagina, dopo js/archivio.js, js/installa.js e lo script di «Aggiorna l'app»:
 *     <script src="js/menu.js?v=1.0"></script>
 *
 * Si appoggia a ciò che l'app ha già:
 *   - Archivio.esportaDati() / Archivio.importaDati(oggetto)   (js/archivio.js)
 *   - il riquadro «Installa sul dispositivo»                    (js/installa.js)
 *   - clearCacheAndReload()                                     (Aggiorna l'app)
 * Non salva nulla per conto suo: non usa localStorage.
 */
(function () {
    'use strict';

    const STILE = `
.mnu-sfondo{position:fixed;inset:0;background:rgba(0,0,0,.5);opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s;z-index:9000}
.mnu-sfondo.mnu-aperto{opacity:1;visibility:visible}
.mnu-pannello{position:fixed;top:0;right:0;width:min(320px,88vw);height:100vh;height:100dvh;background:#fff;color:#263238;
  box-shadow:-2px 0 12px rgba(0,0,0,.25);transform:translateX(105%);visibility:hidden;
  transition:transform .3s ease,visibility .3s;z-index:9001;overflow-y:auto;font-family:inherit;text-align:left;box-sizing:border-box}
.mnu-pannello.mnu-aperto{transform:none;visibility:visible}
.mnu-testata{background:var(--mnu-colore);color:#fff;display:flex;justify-content:space-between;align-items:center;
  padding:1.4rem 1.5rem;padding-top:calc(1.4rem + env(safe-area-inset-top))}
.mnu-testata h2{margin:0;font-size:1.35rem;color:#fff}
.mnu-chiudi{width:44px;height:44px;border:none;border-radius:50%;background:rgba(255,255,255,.22);color:#fff;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;padding:0}
.mnu-chiudi:hover{background:rgba(255,255,255,.35)}
.mnu-elenco{list-style:none;margin:0;padding:.8rem 0}
.mnu-elenco button{width:100%;min-height:58px;padding:.9rem 1.5rem;border:none;background:none;text-align:left;cursor:pointer;
  display:flex;align-items:center;gap:14px;font:inherit;font-size:1.08rem;color:#263238}
.mnu-elenco button:hover{background:#f1f3f4}
.mnu-elenco button:focus-visible,.mnu-chiudi:focus-visible{outline:3px solid #263238;outline-offset:-3px}
.mnu-elenco .mnu-aggiorna{color:#e65100}
.mnu-pannello svg{width:26px;height:26px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.mnu-nota{margin:.2rem 1.5rem 1.5rem;padding-top:1rem;border-top:1px solid #e0e0e0;font-size:.9rem;line-height:1.45;color:#5f6b72}
.mnu-avviso{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);max-width:min(520px,92vw);
  background:#263238;color:#fff;padding:14px 20px;border-radius:14px;font-size:1rem;line-height:1.4;z-index:9002;
  box-shadow:0 6px 24px rgba(0,0,0,.3);text-align:center}
`;
    const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
    const ICONE = {
        esporta: svg('<path d="M12 15V4"/><path d="M7 9l5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
        importa: svg('<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
        installa: svg('<path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M12 8v6"/><path d="M9.5 11.5L12 14l2.5-2.5"/>'),
        aggiorna: svg('<path d="M21 4v6h-6"/><path d="M19.5 15a8 8 0 1 1-1.9-8.3L21 10"/>'),
        chiudi: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    };

    function dataPerNomeFile() {
        const d = new Date();
        const due = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
    }

    function avvia() {
        const pulsante = document.querySelector('[data-menu-app]');
        if (!pulsante) return;
        const nome = pulsante.dataset.nome || document.title;
        const file = pulsante.dataset.file || 'dati';
        const cosa = pulsante.dataset.cosa || 'Esercizi, impostazioni e risultati';
        const colore = document.querySelector('meta[name="theme-color"]')?.content || '#673AB7';
        const conArchivio = typeof Archivio !== 'undefined' && typeof Archivio.esportaDati === 'function';

        if (!document.getElementById('mnuStile')) {
            const st = document.createElement('style');
            st.id = 'mnuStile';
            st.textContent = STILE;
            document.head.appendChild(st);
        }

        const sfondo = document.createElement('div');
        sfondo.className = 'mnu-sfondo';
        const pannello = document.createElement('nav');
        pannello.className = 'mnu-pannello';
        pannello.id = 'mnuPannello';
        pannello.setAttribute('aria-label', 'Menu');
        pannello.style.setProperty('--mnu-colore', colore);
        pannello.innerHTML = `
            <div class="mnu-testata">
                <h2>Menu</h2>
                <button type="button" class="mnu-chiudi" aria-label="Chiudi menu">${ICONE.chiudi}</button>
            </div>
            <ul class="mnu-elenco">
                ${conArchivio ? `<li><button type="button" data-voce="esporta">${ICONE.esporta} Esporta dati</button></li>
                <li><button type="button" data-voce="importa">${ICONE.importa} Importa dati</button></li>` : ''}
                <li><button type="button" data-voce="installa">${ICONE.installa} Installa l'app</button></li>
                <li><button type="button" data-voce="aggiorna" class="mnu-aggiorna">${ICONE.aggiorna} Aggiorna App</button></li>
            </ul>
            ${conArchivio ? '<p class="mnu-nota"></p>' : ''}
            <input type="file" accept="application/json,.json" hidden>`;
        const nota = pannello.querySelector('.mnu-nota');
        if (nota) {
            nota.textContent = `${cosa} restano solo su questo dispositivo. Con «Esporta dati» ne salvi una copia in un file; `
                + 'con «Importa dati» la ricarichi qui o su un altro dispositivo.';
        }
        document.body.append(sfondo, pannello);
        const campoFile = pannello.querySelector('input[type="file"]');

        pulsante.setAttribute('aria-controls', 'mnuPannello');
        pulsante.setAttribute('aria-expanded', 'false');

        const aperto = () => pannello.classList.contains('mnu-aperto');
        function apri() {
            sfondo.classList.add('mnu-aperto');
            pannello.classList.add('mnu-aperto');
            pulsante.setAttribute('aria-expanded', 'true');
            pannello.querySelector('.mnu-chiudi').focus();
        }
        function chiudi() {
            if (!aperto()) return;
            sfondo.classList.remove('mnu-aperto');
            pannello.classList.remove('mnu-aperto');
            pulsante.setAttribute('aria-expanded', 'false');
            pulsante.focus();
        }

        // Messaggio breve in basso (resta qualche secondo)
        function avviso(testo) {
            document.querySelectorAll('.mnu-avviso').forEach((el) => el.remove());
            const el = document.createElement('div');
            el.className = 'mnu-avviso';
            el.setAttribute('role', 'status');
            el.textContent = testo;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 6000);
        }

        async function esporta() {
            chiudi();
            try {
                const dati = await Archivio.esportaDati();
                const nomeFile = `${file}-${dataPerNomeFile()}.json`;
                const url = URL.createObjectURL(new Blob([JSON.stringify(dati)], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = nomeFile;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                avviso(`Dati esportati nel file «${nomeFile}»: lo trovi fra i file scaricati.`);
            } catch (e) {
                alert(`Esportazione non riuscita: ${e.message}`);
            }
        }

        function importa() {
            chiudi();
            if (!confirm(`IMPORTA DATI\n\n${cosa} di questo dispositivo verranno sostituiti con quelli del file.\n\nContinuare?`)) {
                return;
            }
            campoFile.value = '';
            campoFile.click();
        }

        campoFile.addEventListener('change', async (e) => {
            const scelto = e.target.files && e.target.files[0];
            if (!scelto) return;
            try {
                let oggetto;
                try {
                    oggetto = JSON.parse(await scelto.text());
                } catch (err) {
                    throw new Error(`il file non è leggibile (serve il .json esportato da ${nome})`);
                }
                await Archivio.importaDati(oggetto);
                alert('Dati importati su questo dispositivo.');
            } catch (err) {
                alert(`Importazione non riuscita: ${err.message}`);
            }
        });

        // Usa il riquadro «Installa sul dispositivo» della pagina (js/installa.js)
        function installa() {
            chiudi();
            const p = document.querySelector('[data-installa] .inst-pulsante');
            if (p && !p.disabled) {
                p.click();
            } else if (p) {
                alert(`${nome} è già installata su questo dispositivo.`);
            }
        }

        function aggiorna() {
            chiudi();
            if (typeof clearCacheAndReload === 'function') clearCacheAndReload();
        }

        const AZIONI = { esporta, importa, installa, aggiorna };
        pulsante.addEventListener('click', () => (aperto() ? chiudi() : apri()));
        sfondo.addEventListener('click', chiudi);
        pannello.querySelector('.mnu-chiudi').addEventListener('click', chiudi);
        pannello.querySelectorAll('[data-voce]').forEach((b) => b.addEventListener('click', () => AZIONI[b.dataset.voce]()));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudi(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
    else avvia();
})();
