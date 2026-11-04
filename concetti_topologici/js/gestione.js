/**
 * Concetti topologici - Area Educatore (Web App autonoma)
 * AssistiveTech.it
 *
 * UN DISPOSITIVO = UN UTENTE: niente login, tutto resta su questo dispositivo.
 * L'educatore (o il familiare) prepara per l'utente:
 *   - le scene, raggruppate per coppia di opposti (sopra/sotto, dentro/fuori…): simboli del libro,
 *     scatola o cesto disegnati, pittogrammi ARASAAC o foto proprie; oppure un'immagine pronta;
 *   - le impostazioni dell'esercizio (coppie, modalità, pause per la LIS, parola scritta…);
 * e consulta i risultati. Tutto si salva da solo sul dispositivo; con la copia di sicurezza
 * si porta quanto preparato sul computer al tablet dell'utente (e viceversa).
 */
(function () {
    const C = CT.Concetti;
    const esc = (s) => CT.util.escapeHtml(s);
    const $ = (id) => document.getElementById(id);
    const parametri = new URLSearchParams(location.search);

    const stato = {
        profilo: null,
        scheda: parametri.get('scheda') || 'scene',
        timerSalva: null,
        daSalvare: false
    };

    document.addEventListener('DOMContentLoaded', avvia);

    async function avvia() {
        CT.registraServiceWorker();
        etichetteFisse();
        try {
            const p = CT.Archivio.profilo();
            stato.profilo = p.documento;
            $('statoSalvataggio').textContent = p.nuovo ? 'Scene di partenza del libro' : '';
            await CT.Archivio.precaricaFoto(stato.profilo);
            if (!p.nuovo) CT.Archivio.pulisciFoto(stato.profilo).catch(() => { /* non bloccante */ });
        } catch (e) { return errore(e); }
        pronto();
    }

    function etichetteFisse() {
        const schede = { scene: ['scene', 'Scene'], impostazioni: ['impostazioni', 'Impostazioni'], risultati: ['grafico', 'Risultati'] };
        document.querySelectorAll('.scheda').forEach(b => {
            const [ic, t] = schede[b.dataset.scheda];
            b.innerHTML = `${CT.icona(ic)} ${t}`;
            b.addEventListener('click', () => { stato.scheda = b.dataset.scheda; disegna(); });
        });
    }

    function errore(e) {
        $('pannello').innerHTML = `<div class="vuoto-stato">${CT.icona('errore')}<h3>Errore</h3><p class="nota">${esc(e.message)}</p>
            <a class="btn btn-primario" href="${esc(location.href)}">Riprova</a></div>`;
    }

    function pronto() {
        const prova = $('btnProva'), uso = $('btnUtente');
        prova.innerHTML = `${CT.icona('occhio')} Prova`;
        prova.title = 'Apre l\'esercizio come lo vede l\'utente, senza salvare i risultati';
        uso.innerHTML = `${CT.icona('gioca')} Area Utente`;
        uso.title = 'Apre l\'esercizio per l\'utente: i risultati vengono salvati su questo dispositivo';
        prova.href = 'gioca.html?prova=1';
        uso.href = 'gioca.html';
        // Prima di uscire verso l'esercizio, salva subito le modifiche in sospeso
        if (!stato.linkCollegati) {
            stato.linkCollegati = true;
            [prova, uso].forEach(a => a.addEventListener('click', async e => {
                if (!stato.daSalvare) return;
                e.preventDefault();
                await salvaOra();
                location.href = a.href;
            }));
        }
        disegna();
    }

    /* ---------- Salvataggio automatico ---------- */

    function modificato() {
        stato.daSalvare = true;
        $('statoSalvataggio').textContent = 'Modifiche da salvare…';
        clearTimeout(stato.timerSalva);
        stato.timerSalva = setTimeout(salvaOra, 700);
    }

    async function salvaOra() {
        clearTimeout(stato.timerSalva);
        if (!stato.daSalvare) return;
        stato.daSalvare = false;
        try {
            CT.Archivio.salvaProfilo(stato.profilo);
            const ora = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            $('statoSalvataggio').textContent = `Salvato sul dispositivo alle ${ora}`;
        } catch (e) {
            stato.daSalvare = true;
            $('statoSalvataggio').textContent = 'Non salvato';
            CT.util.toast(e.message, 'errore', 5000);
        }
    }
    window.addEventListener('beforeunload', e => {
        if (stato.daSalvare) salvaOra();   // il salvataggio locale è immediato: nessuna domanda
    });

    function disegna() {
        document.querySelectorAll('.scheda').forEach(b => b.setAttribute('aria-selected', String(b.dataset.scheda === stato.scheda)));
        if (stato.scheda === 'scene') disegnaScene();
        else if (stato.scheda === 'impostazioni') disegnaImpostazioni();
        else disegnaRisultati();
    }

    /* ---------- Scheda Scene ---------- */

    function disegnaScene() {
        const imp = stato.profilo.impostazioni;

        // Una riga per concetto: a sinistra la tessera e il nome, a destra le sue scene e «Crea scena»
        const rigaConcetto = (k) => {
            const scene = stato.profilo.scene.filter(s => s.concetto === k);
            return `<div class="riga-concetto">
                <div class="riga-concetto-testa">
                    <span class="tessera-mini" aria-hidden="true">${C.svgScena({ concetto: k, tipo: 'componi' }, { tessera: true })}</span>
                    <strong>${esc(C.nome(k))}</strong>
                    <span class="badge">${scene.filter(s => s.attiva !== false).length}/${scene.length}</span>
                </div>
                <div class="riga-concetto-scene">
                    ${scene.map(schedaScena).join('')}
                    <button type="button" class="scheda-nuova" data-nuova="${k}">${CT.icona('piu')}<span>Crea scena</span></button>
                </div>
            </div>`;
        };

        // Una sezione per coppia (la coppia è la domanda LIS): sempre visibile, con l'interruttore della coppia
        const sezione = (c) => {
            const accesa = imp.coppie.includes(c.id);
            const scene = stato.profilo.scene.filter(s => c.concetti.includes(s.concetto));
            return `<section class="gruppo-coppia ${accesa ? '' : 'spenta'}">
                <div class="gruppo-coppia-testa">
                    <span class="tessere-mini" aria-hidden="true">${c.concetti.map(k => `<span class="tessera">${C.tessera(k, { parola: false })}</span>`).join('')}</span>
                    <h3>${esc(C.titoloCoppia(c.id))}</h3>
                    <span class="badge">${scene.filter(s => s.attiva !== false).length} attive su ${scene.length}</span>
                    <label class="interruttore interruttore-coppia" title="Accendi o spegni tutta la coppia">
                        <input type="checkbox" data-coppia-onoff="${c.id}" ${accesa ? 'checked' : ''}><span>${accesa ? 'Proposta all\'utente' : 'Coppia spenta'}</span>
                    </label>
                </div>
                ${c.concetti.map(rigaConcetto).join('')}
            </section>`;
        };

        $('pannello').innerHTML = `
            <div class="sezione-titolo" style="margin-top:0"><h2>Scene dell'utente</h2></div>
            <p class="nota">I concetti sono in colonna; a destra le scene di ciascuno. <strong>Crea scena</strong> apre l'editor: riferimento e oggetto
            possono essere i simboli del libro, un pittogramma ARASAAC o una tua foto (la foto viene scontornata, e puoi ridimensionarla e spostarla
            trascinandola). L'interruttore <strong>Attiva</strong> sceglie quali scene proporre; quello della coppia accende o spegne tutta la domanda.</p>
            ${C.COPPIE.map(sezione).join('')}`;

        const pan = $('pannello');
        pan.querySelectorAll('[data-nuova]').forEach(b => b.addEventListener('click', () => apriEditor(null, b.dataset.nuova)));
        pan.querySelectorAll('[data-coppia-onoff]').forEach(ch => ch.addEventListener('change', () => {
            const id = ch.dataset.coppiaOnoff;
            let scelte = imp.coppie.filter(x => x !== id);
            if (ch.checked) scelte.push(id);
            if (!scelte.length) { ch.checked = true; CT.util.toast('Serve almeno una coppia accesa', 'info'); return; }
            imp.coppie = C.COPPIE.map(c => c.id).filter(x => scelte.includes(x));   // ordine stabile
            modificato();
            disegnaScene();
        }));
        pan.querySelectorAll('.scheda-scena').forEach(el => {
            const scena = stato.profilo.scene.find(s => s.id === el.dataset.id);
            el.querySelector('[data-a="attiva"]').addEventListener('change', e => { scena.attiva = e.target.checked; modificato(); disegnaScene(); });
            el.querySelector('[data-a="modifica"]').addEventListener('click', () => apriEditor(scena));
            el.querySelector('.anteprima').addEventListener('click', () => apriEditor(scena));
            el.querySelector('[data-a="duplica"]').addEventListener('click', () => {
                const copia = JSON.parse(JSON.stringify(scena));
                copia.id = CT.util.uid('sc');
                stato.profilo.scene.splice(stato.profilo.scene.indexOf(scena) + 1, 0, copia);
                modificato();
                disegnaScene();
            });
            el.querySelector('[data-a="elimina"]').addEventListener('click', async () => {
                const ok = await CT.util.conferma('Eliminare la scena?', `${C.nome(scena.concetto)}${scena.nota ? ' · ' + scena.nota : ''}`, { ok: 'Elimina', pericolo: true });
                if (!ok) return;
                stato.profilo.scene = stato.profilo.scene.filter(s => s !== scena);
                modificato();
                disegnaScene();
            });
        });
    }

    function schedaScena(s) {
        const attiva = s.attiva !== false;
        return `<article class="scheda-scena ${attiva ? '' : 'disattiva'}" data-id="${esc(s.id)}">
            ${s.tipo === 'pronta' ? '<span class="badge badge-angolo">immagine</span>' : ''}
            <div class="anteprima" role="button" title="Modifica">${C.svgScena(s)}</div>
            ${s.nota ? `<p class="nota">${esc(s.nota)}</p>` : ''}
            <div class="azioni">
                <label class="interruttore" title="Scegli se proporre questa scena"><input type="checkbox" data-a="attiva" ${attiva ? 'checked' : ''}><span>Attiva</span></label>
                <button type="button" class="btn-icona btn-icona-s" data-a="modifica" title="Modifica">${CT.icona('modifica')}</button>
                <button type="button" class="btn-icona btn-icona-s" data-a="duplica" title="Duplica">${CT.icona('duplica')}</button>
                <button type="button" class="btn-icona btn-icona-s" data-a="elimina" title="Elimina">${CT.icona('elimina')}</button>
            </div>
        </article>`;
    }

    /* ---------- Editor di una scena ---------- */

    const SIMBOLI_RIF = [
        { img: { tipo: 'simbolo', id: 'quadrato' }, nome: 'Quadrato del libro' },
        { img: { tipo: 'contenitore', id: 'scatola' }, nome: 'Scatola' },
        { img: { tipo: 'contenitore', id: 'cesto' }, nome: 'Cesto' }
    ];
    const SIMBOLI_OGG = [{ img: { tipo: 'simbolo', id: 'pallino' }, nome: 'Pallino del libro' }];
    const stessaImg = (a, b) => !!a && !!b && a.tipo === b.tipo && String(a.id || a.url) === String(b.id || b.url);

    /** Miniatura di un'immagine per i pulsanti di scelta */
    function miniatura(img) {
        const url = C.urlImmagine(img);
        if (url) return `<img src="${esc(url)}" alt="">`;
        if (C.eContenitore(img)) return C.svgScena({ concetto: 'dentro', tipo: 'componi', riferimento: img }, { concetto: null }).replace('viewBox="0 0 400 300"', 'viewBox="70 70 180 180"');
        const p = img.id === 'pallino' ? `<circle cx="20" cy="20" r="14" fill="#C8302A" stroke="#6E1512" stroke-width="2"/>` : `<rect x="6" y="6" width="28" height="28" rx="5" fill="#fff" stroke="#1F1F24" stroke-width="3"/>`;
        return `<svg viewBox="0 0 40 40">${p}</svg>`;
    }

    function apriEditor(scena, concettoIniziale) {
        const nuova = !scena;
        const bozza = nuova
            ? { id: CT.util.uid('sc'), concetto: concettoIniziale, tipo: 'componi', nota: '', attiva: true,
                riferimento: concettoIniziale === 'dentro' || concettoIniziale === 'fuori' ? { tipo: 'contenitore', id: 'scatola' } : { tipo: 'simbolo', id: 'quadrato' },
                oggetto: { tipo: 'simbolo', id: 'pallino' } }
            : JSON.parse(JSON.stringify(scena));
        if (!bozza.riferimento) bozza.riferimento = { tipo: 'simbolo', id: 'quadrato' };
        if (!bozza.oggetto) bozza.oggetto = { tipo: 'simbolo', id: 'pallino' };
        let crea = 'solo';            // solo | coppia | tutte (solo per una scena nuova)
        let ricerca = null;           // 'riferimento' | 'oggetto' | 'immagine' : pannello ARASAAC aperto
        let selezione = 'oggetto';    // elemento con la maniglia nell'anteprima: 'riferimento' | 'oggetto'
        const imp = stato.profilo.impostazioni;

        // Cambiando immagine (ARASAAC o foto) si conservano scala e spostamento già scelti per quel ruolo
        const conservaTrasf = (vecchia, nuova) => {
            if (vecchia) ['scala', 'dx', 'dy'].forEach(k => { if (typeof vecchia[k] === 'number') nuova[k] = vecchia[k]; });
            return nuova;
        };

        const m = CT.util.apriModale(`<h2 class="modale-titolo">${nuova ? 'Nuova scena' : 'Modifica scena'}</h2>
            <div class="editor-scena">
                <div class="editor-anteprima" id="edAnteprima"></div>
                <div id="edCampi"></div>
            </div>
            <div class="modale-azioni">
                <button type="button" class="btn btn-secondario" id="edAnnulla">Annulla</button>
                <button type="button" class="btn btn-primario" id="edSalva">${CT.icona('salva')} Salva</button>
            </div>
            <input type="file" accept="image/*" id="edFile" hidden>`, { larga: true });

        let destinoFoto = null;
        const fileInput = m.querySelector('#edFile');
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            fileInput.value = '';
            if (!file || !destinoFoto) return;
            const scontorna = destinoFoto !== 'immagine';   // l'immagine «pronta» è una scena intera: non si scontorna
            CT.util.toast(scontorna ? 'Scontorno della foto in corso… (la prima volta scarica un modello, poi è veloce)' : 'Caricamento della foto…', 'info', scontorna ? 6000 : 2000);
            try {
                const { id, scontornata } = await CT.Archivio.salvaFoto(file, { scontorna });
                bozza[destinoFoto] = conservaTrasf(bozza[destinoFoto], { tipo: 'foto', id, parola: file.name.replace(/\.[^.]+$/, '').slice(0, 60) });
                aggiorna();
                if (scontorna) CT.util.toast(scontornata ? 'Foto scontornata e inserita' : 'Foto inserita (sfondo non rimosso)', scontornata ? 'ok' : 'info', 3500);
            } catch (e) { CT.util.toast(e.message, 'errore', 5000); }
        });

        function anteprima() {
            const coppia = C.coppiaDi(bozza.concetto);
            const interattivo = bozza.tipo === 'componi';
            m.querySelector('#edAnteprima').innerHTML = `
                <div class="palco-edit">
                    <div class="palco" id="edPalco">${C.svgScena(bozza)}</div>
                    ${interattivo ? `<svg class="palco-overlay" id="edOverlay" viewBox="0 0 ${C.L} ${C.H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"></svg>` : ''}
                </div>
                <div class="tessere-coppia">${coppia.concetti.map(k => `<span class="tessera ${k === bozza.concetto ? 'giusta' : ''}">${C.tessera(k, { parola: imp.parola })}</span>`).join('')}</div>
                ${interattivo
                    ? `<p class="nota nota-piccola">In verde la tessera giusta. <strong>Trascina</strong> un'immagine per spostarla, usa la <strong>maniglia</strong> all'angolo per ingrandirla o rimpicciolirla.${coppia.specchia ? ' Nell\'esercizio la scena può comparire ribaltata.' : ''} <button type="button" class="btn btn-piccolo" id="edReset">Reimposta posizione</button></p>`
                    : `<p class="nota nota-piccola">Immagine pronta: riempie la scena. In verde la tessera giusta.</p>`}`;
            if (interattivo) {
                disegnaManiglie();
                collegaOverlay(m.querySelector('#edOverlay'));
                m.querySelector('#edReset').addEventListener('click', () => {
                    ['riferimento', 'oggetto'].forEach(r => { if (bozza[r]) { delete bozza[r].scala; delete bozza[r].dx; delete bozza[r].dy; } });
                    aggiorna();
                });
            }
        }

        /* ---------- Anteprima interattiva: sposta (trascina) e ridimensiona (maniglia) ---------- */

        /** Elementi modificabili con la posizione base del concetto (orientamento dell'editor, senza specchio) */
        function elementiModificabili() {
            const coppia = C.coppiaDi(bozza.concetto);
            const els = [];
            if (coppia.rif.length && bozza.riferimento) els.push({ ruolo: 'riferimento', base: coppia.rif[0] });
            const basO = C.posto(bozza.concetto, bozza.riferimento, false);
            if (basO) els.push({ ruolo: 'oggetto', base: basO });
            return els;
        }

        /** Riquadro (angolo alto-sinistra + lato) dell'elemento, con scala e spostamento applicati */
        function boxDi(el) {
            const img = bozza[el.ruolo] || {};
            const scala = (typeof img.scala === 'number' && img.scala > 0) ? img.scala : 1;
            const s = el.base.s * scala, half = s / 2;
            return { x: el.base.x + (img.dx || 0) - half, y: el.base.y + (img.dy || 0) - half, s };
        }

        /** Disegna i riquadri selezionabili e la maniglia sull'elemento selezionato (solo forme; i gestori stanno su #edOverlay) */
        function disegnaManiglie() {
            const ov = m.querySelector('#edOverlay');
            if (!ov) return;
            const els = elementiModificabili();
            if (!els.some(e => e.ruolo === selezione)) selezione = els.length ? els[els.length - 1].ruolo : 'oggetto';
            ov.innerHTML = els.map(e => {
                const b = boxDi(e), sel = e.ruolo === selezione;
                return `<g class="ov-el ${sel ? 'sel' : ''}" data-ruolo="${e.ruolo}">
                    <rect class="ov-hit" x="${b.x}" y="${b.y}" width="${b.s}" height="${b.s}"/>
                    ${sel ? `<rect class="ov-bordo" x="${b.x}" y="${b.y}" width="${b.s}" height="${b.s}"/>
                             <circle class="ov-maniglia" data-maniglia="${e.ruolo}" cx="${b.x + b.s}" cy="${b.y}" r="13"/>` : ''}
                </g>`;
            }).join('');
        }

        function puntoOv(ov, e) {
            const p = ov.createSVGPoint();
            p.x = e.clientX; p.y = e.clientY;
            return p.matrixTransform(ov.getScreenCTM().inverse());
        }

        /** Gestori su #edOverlay: trascina per spostare, maniglia per ridimensionare. Un overlay nuovo a ogni anteprima(), quindi niente accumulo. */
        function collegaOverlay(ov) {
            if (!ov) return;
            let azione = null;      // { tipo:'sposta'|'scala', ruolo, start, dx0, dy0 }
            ov.style.touchAction = 'none';
            ov.addEventListener('pointerdown', ev => {
                const g = ev.target.closest('.ov-maniglia, .ov-el');
                if (!g) return;
                const ruolo = g.dataset.maniglia || g.dataset.ruolo;
                const el = elementiModificabili().find(e => e.ruolo === ruolo);
                if (!el) return;
                ev.preventDefault();
                selezione = ruolo;
                const img = bozza[ruolo] || (bozza[ruolo] = {});
                ov.setPointerCapture(ev.pointerId);
                azione = { tipo: g.classList.contains('ov-maniglia') ? 'scala' : 'sposta', ruolo, start: puntoOv(ov, ev), dx0: img.dx || 0, dy0: img.dy || 0 };
                disegnaManiglie();
            });
            ov.addEventListener('pointermove', ev => {
                if (!azione) return;
                const el = elementiModificabili().find(e => e.ruolo === azione.ruolo);
                if (!el) return;
                const p = puntoOv(ov, ev), img = bozza[azione.ruolo];
                if (azione.tipo === 'sposta') {
                    img.dx = CT.util.clamp(Math.round(azione.dx0 + (p.x - azione.start.x)), -170, 170);
                    img.dy = CT.util.clamp(Math.round(azione.dy0 + (p.y - azione.start.y)), -130, 130);
                } else {
                    const cx = el.base.x + (img.dx || 0), cy = el.base.y + (img.dy || 0);
                    const half = Math.max(Math.abs(p.x - cx), Math.abs(p.y - cy));
                    img.scala = CT.util.clamp(Math.round((2 * half) / el.base.s * 100) / 100, 0.3, 3);
                }
                ridisegnaPalco();
                aggiornaManiglia(ov, el);
            });
            const fine = () => { if (azione) { azione = null; disegnaManiglie(); } };
            ov.addEventListener('pointerup', fine);
            ov.addEventListener('pointercancel', fine);
        }

        function ridisegnaPalco() {
            const palco = m.querySelector('#edPalco');
            if (palco) palco.innerHTML = C.svgScena(bozza);
        }

        /** Durante il trascinamento aggiorna solo gli attributi dell'elemento attivo, senza ricostruire l'overlay (per non perdere il pointer capture) */
        function aggiornaManiglia(ov, el) {
            const b = boxDi(el), g = ov.querySelector(`.ov-el[data-ruolo="${el.ruolo}"]`);
            if (!g) return;
            g.querySelectorAll('rect').forEach(r => { r.setAttribute('x', b.x); r.setAttribute('y', b.y); r.setAttribute('width', b.s); r.setAttribute('height', b.s); });
            const h = g.querySelector('.ov-maniglia');
            if (h) { h.setAttribute('cx', b.x + b.s); h.setAttribute('cy', b.y); }
        }

        function bottoniImmagine(ruolo, simboli) {
            const attuale = bozza[ruolo];
            const personale = attuale && (attuale.tipo === 'arasaac' || attuale.tipo === 'foto');
            return `<div class="scelte-immagine">
                ${simboli.map((s, i) => `<button type="button" class="btn-scelta" data-ruolo="${ruolo}" data-simbolo="${i}" aria-pressed="${stessaImg(attuale, s.img)}"><span class="miniatura">${miniatura(s.img)}</span>${esc(s.nome)}</button>`).join('')}
                <button type="button" class="btn-scelta" data-ruolo="${ruolo}" data-azione="arasaac" aria-pressed="${attuale?.tipo === 'arasaac'}">${attuale?.tipo === 'arasaac' ? `<span class="miniatura">${miniatura(attuale)}</span>` : CT.icona('cerca')}ARASAAC</button>
                <button type="button" class="btn-scelta" data-ruolo="${ruolo}" data-azione="foto" aria-pressed="${attuale?.tipo === 'foto'}">${attuale?.tipo === 'foto' ? `<span class="miniatura">${miniatura(attuale)}</span>` : CT.icona('carica')}Foto</button>
            </div>
            ${personale && attuale.parola ? `<p class="nota nota-piccola">Scelto: ${esc(attuale.parola)}</p>` : ''}
            ${ricerca === ruolo ? `<div class="pannello-cerca">
                <div class="riga"><input type="search" class="campo" id="edCerca" placeholder="Cerca un pittogramma (es. palla, scatola, tavolo)" autocomplete="off">
                <button type="button" class="btn" id="edCercaBtn">${CT.icona('cerca')} Cerca</button></div>
                <div class="risultati-arasaac" id="edRisultati"></div></div>` : ''}`;
        }

        function campi() {
            const coppia = C.coppiaDi(bozza.concetto);
            const senzaRif = coppia.rif.length === 0;
            const opposto = C.opposto(bozza.concetto);
            m.querySelector('#edCampi').innerHTML = `
                <div class="campo-gruppo">
                    <span class="etichetta-campo">Dove sta l'oggetto</span>
                    <div class="scelta-concetti">${C.COPPIE.map(c => `<div class="scelta-coppia">${c.concetti.map(k => `
                        <button type="button" class="btn-concetto" data-concetto="${k}" aria-pressed="${k === bozza.concetto}">${C.svgScena({ concetto: k, tipo: 'componi' }, { tessera: true })}${esc(C.nome(k))}</button>`).join('')}</div>`).join('')}</div>
                </div>
                <div class="campo-gruppo">
                    <span class="etichetta-campo">Tipo di scena</span>
                    <div class="segmenti">
                        <label class="segmento ${bozza.tipo === 'componi' ? 'attivo' : ''}"><input type="radio" name="edTipo" value="componi" ${bozza.tipo === 'componi' ? 'checked' : ''}>Due oggetti, messi dall'app</label>
                        <label class="segmento ${bozza.tipo === 'pronta' ? 'attivo' : ''}"><input type="radio" name="edTipo" value="pronta" ${bozza.tipo === 'pronta' ? 'checked' : ''}>Immagine pronta</label>
                    </div>
                </div>
                ${bozza.tipo === 'componi' ? `
                    ${senzaRif ? `<p class="nota">${CT.icona('info')} «In alto / in basso» non usa un riferimento: c'è solo l'oggetto.</p>` : `
                    <div class="campo-gruppo">
                        <span class="etichetta-campo">Riferimento (sta fermo)${coppia.id === 'dentro_fuori' ? ' — per dentro/fuori scegli un contenitore' : ''}</span>
                        ${bottoniImmagine('riferimento', SIMBOLI_RIF)}
                    </div>`}
                    <div class="campo-gruppo">
                        <span class="etichetta-campo">Oggetto (cambia posizione)</span>
                        ${bottoniImmagine('oggetto', SIMBOLI_OGG)}
                    </div>` : `
                    <div class="campo-gruppo">
                        <span class="etichetta-campo">Immagine che mostra già la posizione</span>
                        ${bottoniImmagine('immagine', [])}
                        <p class="nota nota-piccola">Per esempio la foto della palla vera dentro la scatola vera. Le immagini pronte si usano solo in «Riconosci».</p>
                    </div>`}
                <div class="campo-gruppo">
                    <label class="etichetta-campo" for="edNota">Nota per l'educatore</label>
                    <input type="text" class="campo" id="edNota" maxlength="120" value="${esc(bozza.nota || '')}" placeholder="es. palla e scatola">
                </div>
                ${nuova ? `<div class="campo-gruppo">
                    <span class="etichetta-campo">Crea</span>
                    <div class="opzioni-lista">
                        <label class="opzione-lista ${crea === 'solo' ? 'attiva' : ''}"><input type="radio" name="edCrea" value="solo" ${crea === 'solo' ? 'checked' : ''}><span>Solo questa scena<small>${esc(C.nome(bozza.concetto))}</small></span></label>
                        ${bozza.tipo === 'componi' ? `
                        <label class="opzione-lista ${crea === 'coppia' ? 'attiva' : ''}"><input type="radio" name="edCrea" value="coppia" ${crea === 'coppia' ? 'checked' : ''}><span>Questa e l'opposta<small>${esc(C.nome(bozza.concetto))} e ${esc(C.nome(opposto))}, con gli stessi oggetti</small></span></label>
                        <label class="opzione-lista ${crea === 'tutte' ? 'attiva' : ''}"><input type="radio" name="edCrea" value="tutte" ${crea === 'tutte' ? 'checked' : ''}><span>Per tutte le coppie accese<small>${imp.coppie.length * 2} scene con gli stessi oggetti (${esc(imp.coppie.map(C.titoloCoppia).join(', '))})</small></span></label>` : ''}
                    </div></div>` : ''}`;
            collegaCampi();
        }

        function collegaCampi() {
            const box = m.querySelector('#edCampi');
            box.querySelectorAll('.btn-concetto').forEach(b => b.addEventListener('click', () => {
                const prima = C.coppiaDi(bozza.concetto).id;
                bozza.concetto = b.dataset.concetto;
                // Passando a dentro/fuori con il quadrato del libro, proponi la scatola
                if (C.coppiaDi(bozza.concetto).id === 'dentro_fuori' && prima !== 'dentro_fuori' && stessaImg(bozza.riferimento, SIMBOLI_RIF[0].img)) {
                    bozza.riferimento = { tipo: 'contenitore', id: 'scatola' };
                }
                aggiorna();
            }));
            box.querySelectorAll('input[name="edTipo"]').forEach(r => r.addEventListener('change', () => {
                bozza.tipo = r.value;
                if (bozza.tipo === 'pronta' && crea !== 'solo') crea = 'solo';
                ricerca = null;
                aggiorna();
            }));
            box.querySelectorAll('input[name="edCrea"]').forEach(r => r.addEventListener('change', () => { crea = r.value; campi(); }));
            box.querySelector('#edNota').addEventListener('input', e => { bozza.nota = e.target.value; });
            box.querySelectorAll('.btn-scelta').forEach(b => b.addEventListener('click', () => {
                const ruolo = b.dataset.ruolo;
                if (b.dataset.simbolo !== undefined) {
                    const elenco = ruolo === 'riferimento' ? SIMBOLI_RIF : SIMBOLI_OGG;
                    bozza[ruolo] = JSON.parse(JSON.stringify(elenco[parseInt(b.dataset.simbolo, 10)].img));
                    ricerca = null;
                    aggiorna();
                } else if (b.dataset.azione === 'arasaac') {
                    ricerca = ricerca === ruolo ? null : ruolo;
                    campi();
                    const campo = box.querySelector('#edCerca');
                    if (campo) {
                        campo.focus();
                        const vai = () => cercaArasaac(campo.value, ruolo);
                        box.querySelector('#edCercaBtn').addEventListener('click', vai);
                        campo.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); vai(); } });
                    }
                } else if (b.dataset.azione === 'foto') {
                    destinoFoto = ruolo;
                    fileInput.click();
                }
            }));
        }

        async function cercaArasaac(testo, ruolo) {
            const out = m.querySelector('#edRisultati');
            if (!out) return;
            if (String(testo).trim().length < 2) { out.innerHTML = '<p class="nota">Scrivi almeno due lettere.</p>'; return; }
            out.innerHTML = '<p class="nota">Ricerca…</p>';
            try {
                const risultati = await CT.Archivio.cercaArasaac(testo);
                if (!risultati.length) { out.innerHTML = '<p class="nota">Nessun pittogramma trovato.</p>'; return; }
                out.innerHTML = risultati.map(r => `<button type="button" data-id="${r.id}" data-parola="${esc(r.parola)}" title="${esc(r.parola)}"><img src="${esc(r.url)}" alt="${esc(r.parola)}" loading="lazy"><small>${esc(r.parola)}</small></button>`).join('');
                out.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
                    bozza[ruolo] = conservaTrasf(bozza[ruolo], { tipo: 'arasaac', id: parseInt(b.dataset.id, 10), parola: b.dataset.parola });
                    ricerca = null;
                    aggiorna();
                }));
            } catch (e) { out.innerHTML = `<p class="nota">${esc(e.message)}</p>`; }
        }

        function notaAutomatica() {
            if (bozza.nota) return bozza.nota;
            const nomeImg = (img) => img?.parola || (img?.tipo === 'contenitore' ? img.id : img?.tipo === 'simbolo' ? null : null);
            if (bozza.tipo === 'pronta') return nomeImg(bozza.immagine) || '';
            const parti = [nomeImg(bozza.oggetto) || (bozza.oggetto?.id === 'pallino' ? 'pallina' : ''), C.coppiaDi(bozza.concetto).rif.length ? nomeImg(bozza.riferimento) : ''].filter(Boolean);
            return parti.length ? parti.join(' e ') : 'Simboli del libro';
        }

        function aggiorna() { anteprima(); campi(); }
        aggiorna();

        m.querySelector('#edAnnulla').addEventListener('click', () => CT.util.chiudiModale());
        m.querySelector('#edSalva').addEventListener('click', () => {
            if (bozza.tipo === 'pronta' && !C.urlImmagine(bozza.immagine)) { CT.util.toast('Scegli l\'immagine pronta (ARASAAC o foto)', 'errore'); return; }
            const pulita = (s) => {
                const o = { id: s.id, concetto: s.concetto, tipo: s.tipo, nota: notaAutomatica(), attiva: s.attiva !== false };
                if (s.tipo === 'pronta') o.immagine = s.immagine;
                else { o.riferimento = s.riferimento; o.oggetto = s.oggetto; }
                return o;
            };
            const principale = pulita(bozza);
            if (!nuova) {
                const i = stato.profilo.scene.findIndex(s => s.id === bozza.id);
                if (i >= 0) stato.profilo.scene[i] = principale;
            } else {
                let concetti = [bozza.concetto];
                if (crea === 'coppia') concetti = C.coppiaDi(bozza.concetto).concetti.slice();
                if (crea === 'tutte') concetti = C.COPPIE.filter(c => imp.coppie.includes(c.id)).flatMap(c => c.concetti);
                if (!concetti.includes(bozza.concetto)) concetti.unshift(bozza.concetto);
                concetti.forEach(k => {
                    const s = k === bozza.concetto ? principale : Object.assign({}, principale, { id: CT.util.uid('sc'), concetto: k });
                    // Per dentro/fuori il quadrato del libro va bene; negli altri concetti un contenitore resta com'è
                    stato.profilo.scene.push(JSON.parse(JSON.stringify(s)));
                });
                if (!imp.coppie.includes(C.coppiaDi(bozza.concetto).id)) {
                    CT.util.toast(`La coppia ${C.titoloCoppia(C.coppiaDi(bozza.concetto).id)} è spenta: accendila per proporla`, 'info', 5000);
                }
            }
            modificato();
            CT.util.chiudiModale();
            disegnaScene();
        });
    }

    /* ---------- Scheda Impostazioni ---------- */

    function disegnaImpostazioni() {
        const imp = stato.profilo.impostazioni;
        const radio = (nome, valore, attuale, testo, sotto) => `<label class="opzione-lista ${valore === attuale ? 'attiva' : ''}"><input type="radio" name="${nome}" value="${valore}" ${valore === attuale ? 'checked' : ''}><span>${testo}${sotto ? `<small>${sotto}</small>` : ''}</span></label>`;
        const pausaHtml = (chiave, titolo, spiegazione) => {
            const p = imp[chiave];
            return `<div class="campo-gruppo"><span class="etichetta-campo">${titolo}</span>
                <p class="nota nota-piccola" style="margin-top:0">${spiegazione}</p>
                <div class="segmenti">
                    ${[['tocco', 'Tocco Avanti'], ['tempo', 'Dopo alcuni secondi'], ['nessuna', 'Nessuna pausa']].map(([v, t]) => `<label class="segmento ${p.tipo === v ? 'attivo' : ''}"><input type="radio" name="${chiave}" value="${v}" ${p.tipo === v ? 'checked' : ''}>${t}</label>`).join('')}
                </div>
                ${p.tipo === 'tempo' ? `<div class="riga-secondi"><label for="${chiave}Sec">Secondi</label><input type="number" class="campo" id="${chiave}Sec" min="1" max="30" value="${p.secondi}"></div>` : ''}
            </div>`;
        };
        $('pannello').innerHTML = `<div class="impostazioni-griglia">
            <div class="riquadro">
                <h3>${CT.icona('scene')} Coppie da allenare</h3>
                <p class="nota">La domanda in LIS è sempre una coppia di opposti: «dov'è? sopra o sotto?». Le prime quattro sono quelle del libro.</p>
                <div class="elenco-coppie">${C.COPPIE.map(c => `<label class="opzione-coppia ${imp.coppie.includes(c.id) ? 'attiva' : ''}">
                    <input type="checkbox" data-coppia="${c.id}" ${imp.coppie.includes(c.id) ? 'checked' : ''}>${esc(C.titoloCoppia(c.id))}
                    <span class="mini" aria-hidden="true">${c.concetti.map(k => C.svgScena({ concetto: k, tipo: 'componi' }, { tessera: true })).join('')}</span></label>`).join('')}</div>
            </div>
            <div class="riquadro">
                <h3>${CT.icona('gioca')} Modalità</h3>
                <div class="opzioni-lista">
                    ${radio('modalita', 'riconosci', imp.modalita, 'Riconosci', 'Vede la scena e tocca la tessera giusta fra le due')}
                    ${radio('modalita', 'esegui', imp.modalita, 'Esegui', 'Vede la tessera e porta l\'oggetto nel posto giusto (trascina o tocca il posto)')}
                    ${radio('modalita', 'alterna', imp.modalita, 'Alterna', 'Una scena Riconosci, una Esegui')}
                </div>
            </div>
            <div class="riquadro">
                <h3>${CT.icona('mano')} Pause per la LIS</h3>
                ${pausaHtml('pausaPrima', 'Prima della risposta', 'Si vede la scena senza le tessere: fai la domanda in LIS, poi avanti.')}
                ${pausaHtml('pausaDopo', 'Dopo la risposta', 'Il rinforzo resta sullo schermo: conferma in LIS, poi avanti.')}
                <p class="nota nota-piccola">«Tocco Avanti»: il pulsante in alto a destra (o Spazio sulla tastiera) è per l'educatore.</p>
            </div>
            <div class="riquadro">
                <h3>${CT.icona('occhio')} Tessere</h3>
                <label class="interruttore"><input type="checkbox" id="impParola" ${imp.parola ? 'checked' : ''}> Parola scritta sotto le tessere (SOPRA, DENTRO…)</label>
                <label class="interruttore"><input type="checkbox" id="impScambia" ${imp.scambiaTessere ? 'checked' : ''}> La tessera giusta cambia lato a caso</label>
                <label class="interruttore"><input type="checkbox" id="impSpecchia" ${imp.specchia ? 'checked' : ''}> Ribalta a caso le scene a destra/sinistra (non per destra/sinistra)</label>
                <div class="avvio-tessere" style="justify-content:flex-start;margin:10px 0 0">${['sopra', 'sotto'].map(k => `<span class="tessera" style="width:110px">${C.tessera(k, { parola: imp.parola })}</span>`).join('')}</div>
            </div>
            <div class="riquadro">
                <h3>${CT.icona('timer')} Sessione</h3>
                <div class="campo-gruppo"><span class="etichetta-campo">Ordine delle scene</span>
                    <div class="segmenti">
                        <label class="segmento ${imp.ordine === 'casuale' ? 'attivo' : ''}"><input type="radio" name="ordine" value="casuale" ${imp.ordine === 'casuale' ? 'checked' : ''}>${CT.icona('mescola')} A caso</label>
                        <label class="segmento ${imp.ordine === 'ordine' ? 'attivo' : ''}"><input type="radio" name="ordine" value="ordine" ${imp.ordine === 'ordine' ? 'checked' : ''}>Come nell'elenco</label>
                    </div></div>
                <div class="campo-gruppo"><label class="etichetta-campo" for="impQuante">Scene per sessione</label>
                    <select class="campo" id="impQuante">${[0, 4, 6, 8, 10, 12, 16, 20].map(n => `<option value="${n}" ${imp.scenePerSessione === n ? 'selected' : ''}>${n === 0 ? 'Tutte le scene attive' : n}</option>`).join('')}</select></div>
                <div class="campo-gruppo"><span class="etichetta-campo">Dopo un errore</span>
                    <div class="opzioni-lista">
                        ${radio('dopoErrore', 'riprova', imp.dopoErrore, 'Riprova', 'La tessera sbagliata si spegne, la giusta lampeggia: l\'utente la tocca')}
                        ${radio('dopoErrore', 'mostra', imp.dopoErrore, 'Mostra la giusta e vai avanti', 'La risposta giusta si illumina, poi pausa LIS')}
                    </div></div>
            </div>
            <div class="riquadro">
                <h3>${CT.icona('salva')} Copia di sicurezza</h3>
                <p class="nota">Tutto resta su questo dispositivo. La copia è un file con scene, foto, impostazioni e risultati:
                tienila al sicuro e, per passare dal computer al tablet dell'utente, ripristinala sul tablet.</p>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                    <button type="button" class="btn btn-primario" id="btnEsporta">${CT.icona('scarica')} Scarica la copia</button>
                    <button type="button" class="btn" id="btnImporta">${CT.icona('carica')} Ripristina una copia</button>
                    <input type="file" id="fileCopia" accept=".json,application/json" hidden>
                </div>
                <p class="nota nota-piccola">Ripristinando, scene e impostazioni di questo dispositivo vengono sostituite; i risultati della copia si aggiungono a quelli già presenti.</p>
            </div>
        </div>`;

        const p = $('pannello');
        p.querySelectorAll('[data-coppia]').forEach(c => c.addEventListener('change', () => {
            const scelte = [...p.querySelectorAll('[data-coppia]:checked')].map(x => x.dataset.coppia);
            if (!scelte.length) { c.checked = true; CT.util.toast('Serve almeno una coppia', 'info'); return; }
            imp.coppie = scelte;
            modificato(); disegnaImpostazioni();
        }));
        p.querySelectorAll('input[name="modalita"]').forEach(r => r.addEventListener('change', () => { imp.modalita = r.value; modificato(); disegnaImpostazioni(); }));
        p.querySelectorAll('input[name="ordine"]').forEach(r => r.addEventListener('change', () => { imp.ordine = r.value; modificato(); disegnaImpostazioni(); }));
        p.querySelectorAll('input[name="dopoErrore"]').forEach(r => r.addEventListener('change', () => { imp.dopoErrore = r.value; modificato(); disegnaImpostazioni(); }));
        ['pausaPrima', 'pausaDopo'].forEach(k => {
            p.querySelectorAll(`input[name="${k}"]`).forEach(r => r.addEventListener('change', () => { imp[k].tipo = r.value; modificato(); disegnaImpostazioni(); }));
            const sec = $(`${k}Sec`);
            if (sec) sec.addEventListener('change', () => { imp[k].secondi = CT.util.clamp(parseInt(sec.value, 10) || 4, 1, 30); sec.value = imp[k].secondi; modificato(); });
        });
        $('impParola').addEventListener('change', e => { imp.parola = e.target.checked; modificato(); disegnaImpostazioni(); });
        $('impScambia').addEventListener('change', e => { imp.scambiaTessere = e.target.checked; modificato(); });
        $('impSpecchia').addEventListener('change', e => { imp.specchia = e.target.checked; modificato(); });
        $('impQuante').addEventListener('change', e => { imp.scenePerSessione = parseInt(e.target.value, 10) || 0; modificato(); });
        $('btnEsporta').addEventListener('click', esporta);
        $('btnImporta').addEventListener('click', () => $('fileCopia').click());
        $('fileCopia').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importa(f); });
    }

    async function esporta() {
        try {
            await salvaOra();
            const dati = await CT.Archivio.esportaDati();
            const blob = new Blob([JSON.stringify(dati)], { type: 'application/json' });
            const d = new Date(), p = n => String(n).padStart(2, '0');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `concetti-topologici-copia-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            CT.util.toast(`Copia scaricata: ${dati.profilo.scene.length} scene, ${Object.keys(dati.foto).length} foto, ${dati.risultati.length} risposte`, 'ok', 4500);
        } catch (e) { CT.util.toast(`Copia non riuscita: ${e.message}`, 'errore', 5000); }
    }

    async function importa(file) {
        let dati;
        try { dati = JSON.parse(await file.text()); } catch (e) { CT.util.toast('Il file non è leggibile', 'errore'); return; }
        if (!dati || dati.formato !== 'concetti_topologici-copia') { CT.util.toast('Il file non è una copia di Concetti topologici', 'errore'); return; }
        const n = Array.isArray(dati.profilo?.scene) ? dati.profilo.scene.length : 0;
        const ok = await CT.util.conferma('Ripristinare la copia?', `La copia ha ${n} scene. Scene e impostazioni di questo dispositivo verranno sostituite; i risultati si sommano.`, { ok: 'Ripristina' });
        if (!ok) return;
        try {
            const esito = await CT.Archivio.importaDati(dati);
            stato.profilo = CT.Archivio.profilo().documento;
            await CT.Archivio.precaricaFoto(stato.profilo);
            stato.daSalvare = false;
            $('statoSalvataggio').textContent = 'Copia ripristinata';
            CT.util.toast(`Ripristinata: ${esito.scene} scene, ${esito.foto} foto, ${esito.risultati} risposte aggiunte${esito.fotoMancanti ? ` (${esito.fotoMancanti} foto mancanti nel file)` : ''}`, 'ok', 6000);
            disegna();
        } catch (e) { CT.util.toast(`Ripristino non riuscito: ${e.message}`, 'errore', 6000); }
    }

    /* ---------- Scheda Risultati ---------- */

    async function disegnaRisultati() {
        const p = $('pannello');
        p.innerHTML = '<div class="vuoto-stato">Caricamento dei risultati…</div>';
        let dati;
        try { dati = await CT.Archivio.risultati(); } catch (e) { return errore(e); }
        if (stato.scheda !== 'risultati') return;
        if (!dati.sessioni.length) {
            p.innerHTML = `<div class="vuoto-stato">${CT.icona('grafico')}<h3>Ancora nessun risultato</h3><p class="nota">Compaiono qui dopo che l'utente ha svolto l'esercizio dall'Area Utente di questo dispositivo. Le prove non vengono salvate.</p></div>`;
            return;
        }
        // Per concetto: unisce le due modalità, ma le mostra anche separate
        const perConcetto = {};
        dati.per_concetto.forEach(r => {
            const x = perConcetto[r.concetto] || (perConcetto[r.concetto] = { proposte: 0, giuste: 0, modi: {} });
            x.proposte += r.proposte; x.giuste += r.giuste; x.modi[r.modalita] = r;
        });
        const pct = (g, t) => t ? Math.round(100 * g / t) : 0;
        const nomeModo = { riconosci: 'Riconosci', esegui: 'Esegui' };
        const durata = (ms) => ms ? `${(ms / 1000).toFixed(1).replace('.', ',')} s` : '—';
        p.innerHTML = `
            <h2 style="font-size:24px;margin-bottom:6px">Per concetto</h2>
            <p class="nota">Ultimi 60 giorni, solo la prima risposta a ogni scena.</p>
            <div class="barre-concetti">${Object.keys(C.CONCETTI).filter(k => perConcetto[k]).map(k => {
                const x = perConcetto[k];
                return `<div class="barra-concetto">${C.svgScena({ concetto: k, tipo: 'componi' }, { tessera: true })}
                    <div><strong>${esc(C.nome(k))}</strong><div class="traccia"><div class="pieno" style="width:${pct(x.giuste, x.proposte)}%"></div></div>
                    <small>${Object.values(x.modi).map(m => `${nomeModo[m.modalita]} ${m.giuste}/${m.proposte}`).join(' · ')}</small></div>
                    <strong>${pct(x.giuste, x.proposte)}%</strong></div>`;
            }).join('')}</div>
            <h2 style="font-size:24px;margin:26px 0 10px">Sessioni</h2>
            <div class="contenitore-tabella"><table class="tabella">
                <thead><tr><th>Data</th><th>Modalità</th><th>Scene</th><th>Giuste al primo tentativo</th><th>Errori</th><th>Tempo medio</th></tr></thead>
                <tbody>${dati.sessioni.map(s => `<tr data-sessione="${esc(s.sessione)}" title="Dettaglio">
                    <td>${esc(s.data_ora)}</td><td>${esc(String(s.modalita).split(',').map(m => nomeModo[m] || m).join(' + '))}</td>
                    <td>${s.scene}</td><td><strong>${s.giuste_subito}</strong> / ${s.scene} (${pct(s.giuste_subito, s.scene)}%)</td><td>${s.errori}</td><td>${durata(s.tempo_medio)}</td></tr>`).join('')}</tbody>
            </table></div>
            <p style="margin-top:18px"><button type="button" class="btn btn-piccolo" id="btnCancellaRisultati">${CT.icona('elimina')} Cancella i risultati</button>
            <span class="nota">Prima, se servono, scarica la copia di sicurezza (Impostazioni).</span></p>`;
        p.querySelectorAll('tr[data-sessione]').forEach(tr => tr.addEventListener('click', () => dettaglio(tr.dataset.sessione)));
        $('btnCancellaRisultati').addEventListener('click', async () => {
            const ok = await CT.util.conferma('Cancellare tutti i risultati?', 'Le risposte salvate su questo dispositivo verranno eliminate. Scene e impostazioni restano.', { ok: 'Cancella', pericolo: true });
            if (!ok) return;
            await CT.Archivio.cancellaRisultati();
            disegnaRisultati();
        });
    }

    async function dettaglio(idSessione) {
        let righe;
        try { righe = await CT.Archivio.dettaglioSessione(idSessione); } catch (e) { CT.util.toast(e.message, 'errore'); return; }
        const scene = Object.fromEntries(stato.profilo.scene.map(s => [s.id, s]));
        CT.util.apriModale(`<h2 class="modale-titolo">Dettaglio della sessione</h2>
            <div class="contenitore-tabella"><table class="tabella">
                <thead><tr><th>Scena</th><th>Modalità</th><th>Giusta</th><th>Risposta</th><th>Tentativo</th><th>Tempo</th></tr></thead>
                <tbody>${righe.map(r => `<tr>
                    <td>${scene[r.id_scena] ? esc(scene[r.id_scena].nota || r.tipo_scena) : `<span class="nota">${esc(r.tipo_scena)} (scena eliminata)</span>`}</td>
                    <td>${r.modalita === 'esegui' ? 'Esegui' : 'Riconosci'}</td>
                    <td>${esc(C.nome(r.concetto))}</td>
                    <td class="${String(r.corretto) === '1' ? 'esito-ok' : 'esito-no'}">${esc(C.nome(r.risposta))}</td>
                    <td>${r.tentativo}</td><td>${(r.tempo_ms / 1000).toFixed(1).replace('.', ',')} s</td></tr>`).join('')}</tbody>
            </table></div>
            <div class="modale-azioni"><button type="button" class="btn btn-primario" id="detChiudi">Chiudi</button></div>`, { larga: true });
        $('detChiudi').addEventListener('click', () => CT.util.chiudiModale());
    }
})();
