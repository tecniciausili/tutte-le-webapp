/**
 * Concetti topologici - Esercizio (Area Utente)
 * AssistiveTech.it - Web App autonoma (un dispositivo = un utente, nessun server)
 *
 * L'utente è sordo: nessuna domanda scritta o parlata, nessun suono. Per ogni scena:
 *   1. pausa LIS «prima»: si vede la scena (o la consegna in Esegui); l'educatore segna
 *      «dov'è l'oggetto? sopra o sotto?» e tocca Avanti (oppure parte da sola dopo N secondi);
 *   2. risposta: Riconosci → si tocca una delle due tessere; Esegui → si porta l'oggetto nel posto giusto;
 *   3. rinforzo visivo (stella, scena illuminata) oppure aiuto visivo dopo l'errore;
 *   4. pausa LIS «dopo»: l'educatore conferma in LIS e tocca Avanti.
 *
 * URL:  gioca.html           → Area Utente: risultati salvati sul dispositivo
 *       gioca.html?prova=1   → prova dall'Area Educatore (nulla salvato)
 */
(function () {
    const C = CT.Concetti;
    const esc = (s) => CT.util.escapeHtml(s);
    const $ = (id) => document.getElementById(id);
    const parametri = new URLSearchParams(location.search);

    const stato = {
        prova: parametri.get('prova') === '1',
        profilo: null,
        coda: [],
        indice: 0,
        esiti: [],
        sessione: '',
        avvisoSalvataggio: false
    };

    document.addEventListener('DOMContentLoaded', avvia);

    async function avvia() {
        CT.registraServiceWorker();
        document.addEventListener('keydown', tastiera);
        try {
            stato.profilo = CT.Archivio.profilo().documento;
            await CT.Archivio.precaricaFoto(stato.profilo);
        } catch (e) {
            return messaggio('Errore', e.message, [{ testo: 'Riprova', href: location.href }]);
        }
        schermoInizio();
    }

    /* ---------- Schermate ---------- */

    function messaggio(titolo, testo, azioni = []) {
        $('gioco').innerHTML = `<div class="schermo-centro"><div class="vuoto-stato" style="max-width:560px">${CT.icona('info')}<h3>${esc(titolo)}</h3><p class="nota">${esc(testo)}</p>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px">${azioni.map(a => `<a class="btn ${a.secondario ? '' : 'btn-primario'}" href="${esc(a.href)}">${esc(a.testo)}</a>`).join('')}</div></div></div>`;
    }

    /** Le scene da proporre: attive, delle coppie accese, adatte alla modalità */
    function preparaCoda() {
        const imp = stato.profilo.impostazioni;
        let scene = stato.profilo.scene.filter(s => s.attiva !== false && imp.coppie.includes(C.CONCETTI[s.concetto]?.coppia));
        if (imp.modalita === 'esegui') scene = scene.filter(s => s.tipo !== 'pronta');
        if (imp.ordine === 'casuale') scene = CT.util.mescola(scene);
        if (imp.scenePerSessione > 0) scene = scene.slice(0, imp.scenePerSessione);
        return scene;
    }

    function barraSinistra() {
        const sx = $('barraSx');
        if (stato.prova) {
            sx.innerHTML = `<a class="btn btn-piccolo btn-esci-prova" href="gestione.html">${CT.icona('indietro')} Torna all'Area Educatore</a>`;
            return;
        }
        // Utente: lucchetto, si esce tenendolo premuto 2 secondi (o con Esc dal computer)
        sx.innerHTML = `<button type="button" class="btn-blocco" id="btnBlocco" aria-label="Tieni premuto per uscire">${CT.icona('blocco')}
            <svg class="anello" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28"/></svg></button>`;
        const b = $('btnBlocco');
        let timer = null;
        const via = () => { clearTimeout(timer); b.classList.remove('premuto'); };
        b.addEventListener('pointerdown', e => {
            e.preventDefault();
            b.classList.add('premuto');
            timer = setTimeout(() => { via(); menuEducatore(); }, 2000);
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, via));
        b.addEventListener('contextmenu', e => e.preventDefault());
    }

    function menuEducatore() {
        const m = CT.util.apriModale(`
            <h2 class="modale-titolo">Menu dell'educatore</h2>
            <div class="scelte-esporta">
                <button type="button" class="scelta" data-a="continua">${CT.icona('gioca')}<span><strong>Continua</strong><small>Torna all'esercizio</small></span></button>
                <a class="scelta" href="./" style="text-decoration:none;color:inherit">${CT.icona('esci')}<span><strong>Pagina iniziale</strong><small>Scelta fra Area Educatore e Area Utente</small></span></a>
                <button type="button" class="scelta" data-a="ricomincia">${CT.icona('indietro')}<span><strong>Ricomincia</strong><small>Nuova sessione dall'inizio</small></span></button>
                <a class="scelta" href="gestione.html" style="text-decoration:none;color:inherit">${CT.icona('modifica')}<span><strong>Area Educatore</strong><small>Scene, impostazioni e risultati</small></span></a>
            </div>`, { piccola: true });
        m.querySelector('[data-a="continua"]').addEventListener('click', () => CT.util.chiudiModale());
        m.querySelector('[data-a="ricomincia"]').addEventListener('click', () => { CT.util.chiudiModale(); schermoInizio(); });
    }

    function schermoInizio() {
        annullaPausa();
        barraSinistra();
        $('avanzamento').innerHTML = '';
        $('lisBox').innerHTML = '';
        stato.coda = preparaCoda();
        if (!stato.coda.length) {
            return messaggio('Nessuna scena da proporre', 'Nell\'Area Educatore attiva almeno una scena di una coppia accesa (in Esegui servono scene composte, non immagini pronte).',
                [{ testo: 'Area Educatore', href: 'gestione.html' }]);
        }
        const imp = stato.profilo.impostazioni;
        const coppie = imp.coppie.map(id => C.COPPIA[id]).filter(Boolean);
        $('gioco').innerHTML = `<div class="schermo-centro">
            <div class="anteprima-coppie" aria-hidden="true">${coppie.map(c => c.concetti.map(k => `<span class="tessera">${C.tessera(k, { parola: imp.parola })}</span>`).join('')).join('')}</div>
            <button type="button" class="btn-grande" id="btnInizia" aria-label="Inizia">${CT.icona('gioca')}</button>
            <p class="nota-educatore">${stato.coda.length} scene · ${{ riconosci: 'Riconosci', esegui: 'Esegui', alterna: 'Riconosci ed Esegui alternati' }[imp.modalita]}${stato.prova ? ' · prova: i risultati non vengono salvati' : ''}.
            ${imp.pausaPrima.tipo === 'tocco' || imp.pausaDopo.tipo === 'tocco' ? 'Il pulsante <strong>Avanti</strong> in alto a destra è per te: fai il segno LIS, poi toccalo (o premi Spazio).' : ''}</p>
        </div>`;
        $('btnInizia').addEventListener('click', () => {
            if (matchMedia('(pointer: coarse)').matches && document.documentElement.requestFullscreen && !document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => { /* non permesso: si continua */ });
            }
            stato.indice = 0;
            stato.esiti = [];
            stato.sessione = CT.util.uid('s');
            disegnaAvanzamento();
            mostraScena();
        });
    }

    function disegnaAvanzamento() {
        $('avanzamento').innerHTML = stato.coda.map((s, i) => {
            const e = stato.esiti[i];
            const cl = e ? (e.subito ? 'giusta' : 'fatta') : (i === stato.indice ? 'attuale' : '');
            return `<i class="${cl}"></i>`;
        }).join('');
    }

    /* ---------- Pause per la LIS ---------- */

    let pausaAttiva = null;
    function annullaPausa() {
        if (pausaAttiva) { pausaAttiva.annulla(); pausaAttiva = null; }
    }
    /** Attende l'educatore: pulsante Avanti (tocco), conto alla rovescia (tempo) o niente */
    function pausa(conf) {
        annullaPausa();
        return new Promise(risolvi => {
            const box = $('lisBox');
            let timer = null;
            const fine = () => {
                clearTimeout(timer);
                box.innerHTML = '';
                pausaAttiva = null;
                risolvi(true);
            };
            pausaAttiva = { avanza: fine, annulla: () => { clearTimeout(timer); box.innerHTML = ''; risolvi(false); } };
            if (!conf || conf.tipo === 'nessuna') { timer = setTimeout(fine, 350); return; }
            box.innerHTML = `<button type="button" class="pausa-lis" id="btnAvanti">${CT.icona('mano')} Avanti</button>`;
            $('btnAvanti').addEventListener('click', fine);
            if (conf.tipo === 'tempo') {
                const ms = Math.max(1, conf.secondi) * 1000;
                box.insertAdjacentHTML('afterbegin', `<svg class="conto-lis" viewBox="0 0 64 64" aria-hidden="true"><circle class="fondo" cx="32" cy="32" r="28"/><circle class="avanzo" cx="32" cy="32" r="28" style="stroke-dashoffset:0"/></svg>`);
                const anello = box.querySelector('.avanzo');
                requestAnimationFrame(() => requestAnimationFrame(() => { anello.style.transition = `stroke-dashoffset ${ms}ms linear`; anello.style.strokeDashoffset = '176'; }));
                timer = setTimeout(fine, ms);
            }
        });
    }

    function tastiera(e) {
        if (CT.util.modaleAperta()) return;
        if (e.key === 'Escape' && !stato.prova) { menuEducatore(); return; }
        if (pausaAttiva && [' ', 'Enter', 'ArrowRight'].includes(e.key) && !e.target.closest('.tessera-scelta, .posto')) {
            e.preventDefault();
            pausaAttiva.avanza();
        }
    }

    /* ---------- Una scena ---------- */

    function modoScena(scena, i) {
        const m = stato.profilo.impostazioni.modalita;
        let modo = m === 'alterna' ? (i % 2 === 0 ? 'riconosci' : 'esegui') : m;
        if (modo === 'esegui' && scena.tipo === 'pronta') modo = 'riconosci';
        return modo;
    }

    function tipoScena(scena) {
        if (scena.tipo === 'pronta') return 'immagine';
        const simbolo = (img) => !img || img.tipo === 'simbolo';
        return simbolo(scena.riferimento) && simbolo(scena.oggetto) ? 'simboli' : 'oggetti';
    }

    async function mostraScena() {
        const imp = stato.profilo.impostazioni;
        const scena = stato.coda[stato.indice];
        const modo = modoScena(scena, stato.indice);
        const coppia = C.coppiaDi(scena.concetto);
        const specchia = imp.specchia && coppia.specchia && Math.random() < 0.5;
        const ordine = imp.scambiaTessere && Math.random() < 0.5 ? coppia.concetti.slice().reverse() : coppia.concetti.slice();
        const sc = { scena, modo, specchia, ordine, tentativo: 0, t0: 0, attiva: false, esclusi: new Set() };
        stato.scena = sc;
        disegnaAvanzamento();

        const lato = modo === 'riconosci'
            ? ordine.map(k => `<button type="button" class="tessera-scelta" data-concetto="${k}" aria-label="${esc(C.nome(k))}" disabled>${C.tessera(k, { parola: imp.parola, specchia })}</button>`).join('')
            : `<div class="consegna" aria-label="${esc(C.nome(scena.concetto))}">${C.tessera(scena.concetto, { parola: imp.parola, specchia })}</div>`;

        $('gioco').innerHTML = `<div class="gioco-area">
            <div class="palco-box"><div class="palco posti-nascosti" id="palco"></div><div class="premio" id="premio"></div></div>
            <div class="lato ${modo === 'riconosci' ? 'nascosto' : ''}" id="lato">${lato}</div>
        </div>`;
        disegnaPalco(modo === 'esegui' ? { inVassoio: true } : {});

        // 1. pausa LIS prima della risposta
        const avanti = await pausa(imp.pausaPrima);
        if (!avanti || stato.scena !== sc) return;

        // 2. risposta
        sc.attiva = true;
        sc.t0 = performance.now();
        $('lato').classList.remove('nascosto');
        $('palco').classList.remove('posti-nascosti');
        if (modo === 'riconosci') {
            document.querySelectorAll('.tessera-scelta').forEach(b => {
                b.disabled = false;
                b.addEventListener('click', () => rispondi(b.dataset.concetto));
            });
        } else {
            attivaTrascinamento();
        }
    }

    /** Disegna il palco con l'oggetto dove serve (nel vassoio, in un posto, nella scena) */
    function disegnaPalco({ inVassoio = false, concetto } = {}) {
        const sc = stato.scena;
        const esegui = sc.modo === 'esegui';
        const posti = esegui ? sc.ordine.filter(k => !sc.esclusi.has(k) && k !== concetto) : [];
        $('palco').innerHTML = C.svgScena(sc.scena, {
            specchia: sc.specchia,
            esegui,
            inVassoio,
            concetto: concetto === undefined ? sc.scena.concetto : concetto,
            posti: inVassoio ? posti : [],
            etichetta: 'Scena'
        });
        if (esegui && inVassoio) collegaPosti();
    }

    /* ---------- Modalità Esegui: trascina o tocca il posto ---------- */

    function puntoSvg(svg, e) {
        const p = svg.createSVGPoint();
        p.x = e.clientX; p.y = e.clientY;
        return p.matrixTransform(svg.getScreenCTM().inverse());
    }

    function collegaPosti() {
        const palco = $('palco');
        palco.querySelectorAll('.posto').forEach(g => {
            g.addEventListener('pointerup', e => { if (!stato.trascina && stato.scena.attiva) { e.stopPropagation(); rispondi(g.dataset.concetto); } });
            g.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && stato.scena.attiva) { e.preventDefault(); rispondi(g.dataset.concetto); } });
        });
    }

    function attivaTrascinamento() {
        const palco = $('palco');
        const svg = palco.querySelector('svg');
        const ogg = palco.querySelector('.oggetto-vassoio');
        if (!svg || !ogg) return;
        const sc = stato.scena;
        const rif = sc.scena.riferimento;

        ogg.addEventListener('pointerdown', e => {
            if (!sc.attiva) return;
            e.preventDefault();
            ogg.setPointerCapture(e.pointerId);
            const inizio = puntoSvg(svg, e);
            stato.trascina = { inizio, mosso: false };
            ogg.classList.add('trascinando');
        });
        ogg.addEventListener('pointermove', e => {
            if (!stato.trascina) return;
            const p = puntoSvg(svg, e);
            const dx = p.x - stato.trascina.inizio.x, dy = p.y - stato.trascina.inizio.y;
            if (Math.hypot(dx, dy) > 6) stato.trascina.mosso = true;
            ogg.setAttribute('transform', `translate(${dx} ${dy})`);
            const vicino = postoVicino(p, rif);
            palco.querySelectorAll('.posto').forEach(g => g.classList.toggle('vicino', g.dataset.concetto === vicino));
        });
        const lascia = e => {
            if (!stato.trascina) return;
            const p = puntoSvg(svg, e);
            const mosso = stato.trascina.mosso;
            stato.trascina = null;
            ogg.classList.remove('trascinando');
            const vicino = mosso ? postoVicino(p, rif) : null;
            if (vicino) rispondi(vicino);
            else ogg.removeAttribute('transform');
            palco.querySelectorAll('.posto.vicino').forEach(g => g.classList.remove('vicino'));
        };
        ogg.addEventListener('pointerup', lascia);
        ogg.addEventListener('pointercancel', lascia);
    }

    /** Il posto più vicino al punto (entro una distanza ragionevole), fra quelli ancora disponibili */
    function postoVicino(p, rif) {
        const sc = stato.scena;
        let migliore = null, distMin = Infinity;
        sc.ordine.filter(k => !sc.esclusi.has(k)).forEach(k => {
            const q = C.posto(k, rif, sc.specchia);
            const d = Math.hypot(p.x - q.x, p.y - q.y);
            if (d < distMin) { distMin = d; migliore = k; }
        });
        return distMin < 95 ? migliore : null;
    }

    /* ---------- Risposta e rinforzo ---------- */

    async function rispondi(scelta) {
        const sc = stato.scena;
        if (!sc || !sc.attiva || sc.esclusi.has(scelta)) return;
        sc.attiva = false;
        sc.tentativo++;
        const giusta = scelta === sc.scena.concetto;
        const tempo = Math.round(performance.now() - sc.t0);
        registra({
            sessione: stato.sessione, modalita: sc.modo, id_scena: sc.scena.id, tipo_scena: tipoScena(sc.scena),
            concetto: sc.scena.concetto, risposta: scelta, tentativo: sc.tentativo, tempo_ms: tempo
        });

        const imp = stato.profilo.impostazioni;
        if (giusta) {
            await rinforzo(scelta);
            stato.esiti[stato.indice] = { subito: sc.tentativo === 1 };
            return dopoLaRisposta(sc);
        }

        // Errore: niente segnali forti, solo visivi e gentili
        if (sc.modo === 'riconosci') {
            const b = document.querySelector(`.tessera-scelta[data-concetto="${scelta}"]`);
            b.classList.add('sbagliata');
            b.disabled = true;
        } else {
            disegnaPalco({ concetto: scelta });     // l'oggetto resta un attimo dove l'ha messo
        }
        sc.esclusi.add(scelta);
        await CT.util.attesa(900);
        if (stato.scena !== sc) return;

        if (imp.dopoErrore === 'mostra') {
            await rinforzo(sc.scena.concetto, { aiuto: true });
            stato.esiti[stato.indice] = { subito: false };
            return dopoLaRisposta(sc);
        }

        // Riprova: resta solo la risposta giusta, che lampeggia per guidare
        if (sc.modo === 'riconosci') {
            const giustaBtn = document.querySelector(`.tessera-scelta[data-concetto="${sc.scena.concetto}"]`);
            giustaBtn.classList.remove('indica');
            void giustaBtn.offsetWidth;
            giustaBtn.classList.add('indica');
        } else {
            disegnaPalco({ inVassoio: true });
            $('palco').classList.remove('posti-nascosti');
            attivaTrascinamento();
        }
        sc.attiva = true;
        sc.t0 = performance.now();
    }

    /** Rinforzo visivo: tessera o posto evidenziati, oggetto che salta, stella grande (solo se non è un aiuto) */
    async function rinforzo(concetto, { aiuto = false } = {}) {
        const sc = stato.scena;
        if (sc.modo === 'riconosci') {
            const b = document.querySelector(`.tessera-scelta[data-concetto="${concetto}"]`);
            document.querySelectorAll('.tessera-scelta').forEach(x => { x.disabled = true; });
            b.classList.remove('indica');
            b.classList.add(aiuto ? 'indica' : 'giusta');
            if (!aiuto) b.insertAdjacentHTML('beforeend', `<span class="segno" aria-hidden="true">${CT.icona('spunta')}</span>`);
        } else {
            disegnaPalco({ concetto });
            $('palco').classList.add('posti-nascosti');
        }
        const ogg = document.querySelector('#palco .oggetto');
        if (ogg) ogg.classList.add('salta');
        if (!aiuto) {
            $('palco').classList.add('ok');
            $('premio').innerHTML = `<div class="stellona">${CT.icona('stella')}</div>`;
        }
        await CT.util.attesa(aiuto ? 1600 : 1400);
    }

    async function dopoLaRisposta(sc) {
        if (stato.scena !== sc) return;
        disegnaAvanzamento();
        // 4. pausa LIS dopo la risposta: l'educatore conferma il concetto
        const avanti = await pausa(stato.profilo.impostazioni.pausaDopo);
        if (!avanti || stato.scena !== sc) return;
        stato.indice++;
        if (stato.indice < stato.coda.length) mostraScena();
        else schermoFine();
    }

    function registra(risposta) {
        if (stato.prova) return;
        CT.Archivio.registraRisposta(risposta).catch(e => {
            console.warn('[Concetti topologici] Risposta non salvata:', e);
            if (!stato.avvisoSalvataggio) {
                stato.avvisoSalvataggio = true;
                CT.util.toast('Risultati non salvati sul dispositivo: ' + e.message, 'errore', 5000);
            }
        });
    }

    function schermoFine() {
        stato.scena = null;
        annullaPausa();
        disegnaAvanzamento();
        const giuste = stato.esiti.filter(e => e && e.subito).length;
        $('gioco').innerHTML = `<div class="schermo-centro">
            <div class="stelle-finali" aria-hidden="true">${stato.coda.map((s, i) => {
                const piena = stato.esiti[i] && stato.esiti[i].subito;
                return CT.icona('stella', piena ? 'piena' : '').replace('<svg', `<svg style="animation-delay:${i * 120}ms"`);
            }).join('')}</div>
            <div class="azioni-fine">
                <button type="button" class="btn-grande giallo" id="btnAncora" aria-label="Ricomincia">${CT.icona('indietro')}</button>
            </div>
            <p class="riassunto-educatore">${giuste} su ${stato.coda.length} giuste al primo tentativo${stato.prova ? ' (prova, non salvata)' : ''}.</p>
        </div>`;
        $('btnAncora').addEventListener('click', schermoInizio);
    }
})();
