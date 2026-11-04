/**
 * Concetti topologici - Concetti, coppie, geometria e disegno delle scene (SVG)
 * AssistiveTech.it - Web App autonoma
 *
 * Ogni scena è disegnata in un SVG con viewBox 400×300 (più una striscia «vassoio» sotto
 * nella modalità Esegui). Le posizioni sono fisse per coppia: così, in Esegui, i due posti
 * della coppia (es. sopra e sotto) sono intorno allo stesso riferimento.
 *
 * Tessere: stile del libro di CAA (quadrato bianco = riferimento, pallino rosso = oggetto),
 * ottenute disegnando la stessa geometria con i simboli.
 */
window.CT = window.CT || {};

CT.Concetti = (function () {
    const L = 400, H = 300, H_ESEGUI = 392;

    /** Concetti: nome per l'educatore e per la parola scritta sotto la tessera */
    const CONCETTI = {
        sopra:    { nome: 'Sopra',    coppia: 'sopra_sotto' },
        sotto:    { nome: 'Sotto',    coppia: 'sopra_sotto' },
        dentro:   { nome: 'Dentro',   coppia: 'dentro_fuori' },
        fuori:    { nome: 'Fuori',    coppia: 'dentro_fuori' },
        davanti:  { nome: 'Davanti',  coppia: 'davanti_dietro' },
        dietro:   { nome: 'Dietro',   coppia: 'davanti_dietro' },
        accanto:  { nome: 'Accanto',  coppia: 'accanto_in_mezzo' },
        in_mezzo: { nome: 'In mezzo', coppia: 'accanto_in_mezzo' },
        destra:   { nome: 'Destra',   coppia: 'destra_sinistra' },
        sinistra: { nome: 'Sinistra', coppia: 'destra_sinistra' },
        vicino:   { nome: 'Vicino',   coppia: 'vicino_lontano' },
        lontano:  { nome: 'Lontano',  coppia: 'vicino_lontano' },
        alto:     { nome: 'In alto',  coppia: 'alto_basso' },
        basso:    { nome: 'In basso', coppia: 'alto_basso' }
    };

    /**
     * Coppie di opposti: è la domanda che l'educatore fa in LIS («dov'è? sopra o sotto?»).
     * rif: riferimenti fissi; posti: dove sta l'oggetto per ciascun concetto.
     * z: 'davanti' (sopra a tutto, default), 'dietro' (sotto il riferimento), 'dentro' (fra le pareti del contenitore).
     * specchia: la scena si può ribaltare a destra/sinistra senza cambiare significato.
     */
    const COPPIE = [
        { id: 'sopra_sotto', concetti: ['sopra', 'sotto'], libro: true, specchia: false,
          rif: [{ x: 200, y: 150, s: 110 }],
          posti: { sopra: { x: 200, y: 58, s: 70 }, sotto: { x: 200, y: 242, s: 70 } } },
        { id: 'dentro_fuori', concetti: ['dentro', 'fuori'], libro: true, specchia: true, contenitore: true,
          rif: [{ x: 160, y: 165, s: 160 }],
          posti: { dentro: { x: 160, y: 165, s: 72, z: 'dentro', yContenitore: 132 }, fuori: { x: 320, y: 209, s: 72 } } },
        { id: 'davanti_dietro', concetti: ['davanti', 'dietro'], libro: true, specchia: true,
          rif: [{ x: 200, y: 150, s: 130 }],
          posti: { davanti: { x: 150, y: 198, s: 86 }, dietro: { x: 252, y: 100, s: 86, z: 'dietro' } } },
        { id: 'accanto_in_mezzo', concetti: ['accanto', 'in_mezzo'], libro: true, specchia: true,
          rif: [{ x: 90, y: 150, s: 92 }, { x: 260, y: 150, s: 92 }],
          posti: { accanto: { x: 345, y: 150, s: 64 }, in_mezzo: { x: 175, y: 150, s: 64 } } },
        { id: 'destra_sinistra', concetti: ['destra', 'sinistra'], libro: false, specchia: false,
          rif: [{ x: 200, y: 150, s: 110 }],
          posti: { destra: { x: 336, y: 150, s: 76 }, sinistra: { x: 64, y: 150, s: 76 } } },
        { id: 'vicino_lontano', concetti: ['vicino', 'lontano'], libro: false, specchia: true,
          rif: [{ x: 92, y: 150, s: 100 }],
          posti: { vicino: { x: 182, y: 150, s: 66 }, lontano: { x: 352, y: 150, s: 66 } } },
        { id: 'alto_basso', concetti: ['alto', 'basso'], libro: false, specchia: false, cornice: true,
          rif: [],
          posti: { alto: { x: 200, y: 50, s: 72 }, basso: { x: 200, y: 250, s: 72 } } }
    ];
    const COPPIA = Object.fromEntries(COPPIE.map(c => [c.id, c]));

    const COLORI = { inchiostro: '#1F1F24', pallino: '#C8302A', pallinoBordo: '#6E1512' };
    const esc = (s) => CT.util.escapeHtml(s);

    const nome = (concetto) => CONCETTI[concetto]?.nome || concetto;
    const coppiaDi = (concetto) => COPPIA[CONCETTI[concetto]?.coppia];
    const opposto = (concetto) => coppiaDi(concetto)?.concetti.find(c => c !== concetto);
    const titoloCoppia = (id) => (COPPIA[id]?.concetti || []).map(nome).join(' / ');

    /** URL di un'immagine della scena (null per simboli e contenitori disegnati) */
    function urlImmagine(img) {
        if (!img) return null;
        if (img.tipo === 'arasaac' && img.id) return `https://static.arasaac.org/pictograms/${img.id}/${img.id}_500.png`;
        // Foto caricata dall'educatore: sta in IndexedDB, qui serve l'object URL già precaricato
        if (img.tipo === 'foto' && img.id) return CT.Archivio ? CT.Archivio.urlFoto(img.id) : null;
        return null;
    }

    const eContenitore = (img) => img && img.tipo === 'contenitore' && ['scatola', 'cesto'].includes(img.id);

    /* ---------- Disegno dei singoli elementi ---------- */

    function quadrato(p) {
        const r = p.s * 0.14;
        return `<rect x="${p.x - p.s / 2}" y="${p.y - p.s / 2}" width="${p.s}" height="${p.s}" rx="${r}" fill="#fff" stroke="${COLORI.inchiostro}" stroke-width="4"/>`;
    }
    function pallino(p) {
        return `<circle cx="${p.x}" cy="${p.y}" r="${p.s * 0.45}" fill="${COLORI.pallino}" stroke="${COLORI.pallinoBordo}" stroke-width="2.5"/>`;
    }
    function immagine(p, url) {
        return `<image href="${esc(url)}" x="${p.x - p.s / 2}" y="${p.y - p.s / 2}" width="${p.s}" height="${p.s}" preserveAspectRatio="xMidYMid meet"/>`;
    }

    /** Scatola di cartone aperta: [parte dietro, parte davanti] */
    function scatola(p) {
        const w = p.s, Lx = p.x - w / 2, T = p.y - w / 2;
        const X = f => (Lx + f * w).toFixed(1), Y = f => (T + f * w).toFixed(1);
        const tratto = `stroke="#5B3A1A" stroke-width="3" stroke-linejoin="round"`;
        const dietro = `
            <polygon points="${X(.10)},${Y(.24)} ${X(.90)},${Y(.24)} ${X(.84)},${Y(.03)} ${X(.16)},${Y(.03)}" fill="#C98B4B" ${tratto}/>
            <polygon points="${X(.10)},${Y(.24)} ${X(.90)},${Y(.24)} ${X(1)},${Y(.40)} ${X(0)},${Y(.40)}" fill="#7A4A22" ${tratto}/>`;
        const davanti = `
            <polygon points="${X(0)},${Y(.40)} ${X(.10)},${Y(.24)} ${X(-.06)},${Y(.15)} ${X(-.12)},${Y(.33)}" fill="#E0AA6E" ${tratto}/>
            <polygon points="${X(1)},${Y(.40)} ${X(.90)},${Y(.24)} ${X(1.06)},${Y(.15)} ${X(1.12)},${Y(.33)}" fill="#E0AA6E" ${tratto}/>
            <rect x="${X(0)}" y="${Y(.40)}" width="${w}" height="${(w * .60).toFixed(1)}" rx="5" fill="#D9A066" ${tratto}/>
            <rect x="${X(.42)}" y="${Y(.40)}" width="${(w * .16).toFixed(1)}" height="${(w * .22).toFixed(1)}" fill="#F1D3A6" opacity=".85"/>`;
        return [dietro, davanti];
    }

    /** Cesto di vimini con manico: [parte dietro, parte davanti] */
    function cesto(p) {
        const w = p.s, Lx = p.x - w / 2, T = p.y - w / 2;
        const X = f => (Lx + f * w).toFixed(1), Y = f => (T + f * w).toFixed(1);
        const bordo = .45;
        const dietro = `
            <path d="M${X(.14)},${Y(bordo)} C${X(.14)},${Y(-.08)} ${X(.86)},${Y(-.08)} ${X(.86)},${Y(bordo)}" fill="none" stroke="#5B3A1A" stroke-width="13" stroke-linecap="round"/>
            <path d="M${X(.14)},${Y(bordo)} C${X(.14)},${Y(-.08)} ${X(.86)},${Y(-.08)} ${X(.86)},${Y(bordo)}" fill="none" stroke="#B9813F" stroke-width="7" stroke-linecap="round"/>
            <ellipse cx="${p.x}" cy="${Y(bordo)}" rx="${(w * .45).toFixed(1)}" ry="${(w * .09).toFixed(1)}" fill="#6B4220" stroke="#5B3A1A" stroke-width="3"/>`;
        let trama = '';
        for (let i = 1; i <= 3; i++) {
            const f = bordo + i * (1 - bordo) / 4;
            const k = (f - bordo) / (1 - bordo);           // il cesto si stringe verso il fondo
            const sx = .05 + k * .13;
            trama += `<path d="M${X(sx)},${Y(f)} Q${X(.5)},${Y(f + .05)} ${X(1 - sx)},${Y(f)}" fill="none" stroke="#8C5A2B" stroke-width="2.5"/>`;
        }
        for (let i = 1; i <= 5; i++) {
            const fx = i / 6;
            const xb = .18 + fx * .64, xt = .05 + fx * .90;
            trama += `<line x1="${X(xt)}" y1="${Y(bordo + .06)}" x2="${X(xb)}" y2="${Y(.99)}" stroke="#8C5A2B" stroke-width="2.5"/>`;
        }
        const davanti = `
            <path d="M${X(.05)},${Y(bordo)} Q${X(.5)},${Y(bordo + .18)} ${X(.95)},${Y(bordo)} L${X(.82)},${Y(1)} Q${X(.5)},${Y(1.04)} ${X(.18)},${Y(1)} Z" fill="#D6A15E" stroke="#5B3A1A" stroke-width="3" stroke-linejoin="round"/>
            ${trama}
            <path d="M${X(.05)},${Y(bordo)} Q${X(.5)},${Y(bordo + .18)} ${X(.95)},${Y(bordo)}" fill="none" stroke="#A8743A" stroke-width="9" stroke-linecap="round"/>
            <path d="M${X(.05)},${Y(bordo)} Q${X(.5)},${Y(bordo + .18)} ${X(.95)},${Y(bordo)}" fill="none" stroke="#5B3A1A" stroke-width="2"/>`;
        return [dietro, davanti];
    }

    /** Disegno di un elemento: restituisce [parte dietro, parte davanti] (la parte dietro serve solo ai contenitori) */
    function elemento(img, p, ruolo) {
        if (eContenitore(img)) return img.id === 'cesto' ? cesto(p) : scatola(p);
        const url = urlImmagine(img);
        if (url) return ['', immagine(p, url)];
        // Simboli del libro (default): quadrato bianco per il riferimento, pallino rosso per l'oggetto
        const simbolo = img?.id || (ruolo === 'oggetto' ? 'pallino' : 'quadrato');
        return ['', simbolo === 'pallino' ? pallino(p) : quadrato(p)];
    }

    const specchiaP = (p, si) => si ? Object.assign({}, p, { x: L - p.x }) : p;

    /** Posto dell'oggetto per un concetto, tenendo conto del contenitore e dello specchio */
    function posto(concetto, riferimento, specchia) {
        const c = coppiaDi(concetto);
        if (!c) return null;
        let p = Object.assign({}, c.posti[concetto]);
        if (p.yContenitore && eContenitore(riferimento)) p.y = p.yContenitore;
        return specchiaP(p, specchia && c.specchia);
    }

    /**
     * Applica alla posizione la scala e lo spostamento scelti dall'educatore per quell'immagine.
     * scala: fattore sulla dimensione (1 = come il concetto); dx/dy: spostamento in unità del viewBox,
     * definiti nell'orientamento dell'editor (quando la scena è specchiata, dx si ribalta con lei).
     * Lo scalaggio è centrato: cambiando solo `s`, quadrato/pallino/immagine restano centrati su (x, y).
     */
    function trasforma(p, img, specchia) {
        if (!p || !img) return p;
        const scala = (typeof img.scala === 'number' && img.scala > 0) ? img.scala : 1;
        const dx = (typeof img.dx === 'number') ? img.dx : 0;
        const dy = (typeof img.dy === 'number') ? img.dy : 0;
        if (scala === 1 && dx === 0 && dy === 0) return p;
        return Object.assign({}, p, {
            x: p.x + (specchia ? -dx : dx),
            y: p.y + dy,
            s: p.s * scala
        });
    }

    /** Frecce del libro per DENTRO e FUORI (solo nelle tessere) */
    function frecce(concetto, specchia) {
        const sx = x => specchia ? L - x : x;
        const marker = `<defs><marker id="pf_${concetto}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COLORI.inchiostro}"/></marker></defs>`;
        if (concetto === 'dentro') return marker + `<path d="M${sx(300)},${75} Q${sx(245)},${8} ${sx(176)},${72}" fill="none" stroke="${COLORI.inchiostro}" stroke-width="9" stroke-linecap="round" marker-end="url(#pf_${concetto})"/>`;
        if (concetto === 'fuori') return marker + `<path d="M${sx(190)},${70} Q${sx(285)},${0} ${sx(318)},${150} " fill="none" stroke="${COLORI.inchiostro}" stroke-width="9" stroke-linecap="round" marker-end="url(#pf_${concetto})"/>`;
        return '';
    }

    /**
     * SVG di una scena.
     * opzioni:
     *   concetto      dove mettere l'oggetto (default: scena.concetto); null = oggetto non nella scena
     *   specchia      ribalta la scena (solo per le coppie che lo permettono)
     *   esegui        aggiunge il vassoio sotto (modalità Esegui)
     *   inVassoio     l'oggetto è nel vassoio
     *   posti         concetti di cui disegnare il posto tratteggiato (Esegui)
     *   tessera       disegno da tessera del libro (simboli + frecce, niente sfondo)
     *   etichetta     aria-label
     */
    function svgScena(scena, opzioni = {}) {
        const c = coppiaDi(scena.concetto);
        if (!c) return '';
        const specchia = !!opzioni.specchia && c.specchia;
        const altezza = opzioni.esegui ? H_ESEGUI : H;
        const etichetta = opzioni.etichetta ? ` role="img" aria-label="${esc(opzioni.etichetta)}"` : ' aria-hidden="true"';
        const classe = opzioni.classe ? ` class="${esc(opzioni.classe)}"` : '';

        if (scena.tipo === 'pronta' && !opzioni.tessera) {
            const url = urlImmagine(scena.immagine);
            return `<svg viewBox="0 0 ${L} ${H}" xmlns="http://www.w3.org/2000/svg"${classe}${etichetta}>
                ${url ? `<image href="${esc(url)}" x="0" y="0" width="${L}" height="${H}" preserveAspectRatio="xMidYMid meet"/>` : ''}</svg>`;
        }

        const rifImg = opzioni.tessera ? { tipo: 'simbolo', id: 'quadrato' } : (scena.riferimento || { tipo: 'simbolo', id: 'quadrato' });
        const oggImg = opzioni.tessera ? { tipo: 'simbolo', id: 'pallino' } : (scena.oggetto || { tipo: 'simbolo', id: 'pallino' });
        const concetto = opzioni.concetto === undefined ? scena.concetto : opzioni.concetto;

        // Riferimenti (possono essere due: «in mezzo»). Nelle tessere i simboli non si trasformano.
        const rif = c.rif.map(p => elemento(rifImg, opzioni.tessera ? specchiaP(p, specchia) : trasforma(specchiaP(p, specchia), rifImg, specchia), 'riferimento'));
        const rifDietro = rif.map(r => r[0]).join('');
        const rifDavanti = rif.map(r => r[1]).join('');

        // Oggetto nella scena
        let oggDietro = '', oggDentro = '', oggDavanti = '';
        if (concetto && !opzioni.inVassoio) {
            const p = opzioni.tessera ? posto(concetto, rifImg, specchia) : trasforma(posto(concetto, rifImg, specchia), oggImg, specchia);
            const disegno = `<g class="oggetto" data-concetto="${concetto}">${elemento(oggImg, p, 'oggetto')[1]}</g>`;
            if (p.z === 'dietro') oggDietro = disegno;
            else if (p.z === 'dentro' && eContenitore(rifImg)) oggDentro = disegno;   // fra le pareti della scatola o del cesto
            else oggDavanti = disegno;
        }

        // Posti tratteggiati (Esegui): si disegnano sopra a tutto, così si possono toccare
        let posti = '';
        (opzioni.posti || []).forEach(k => {
            const p = posto(k, rifImg, specchia);
            const r = p.s / 2 + 10;
            posti += `<g class="posto" data-concetto="${k}" tabindex="0" role="button" aria-label="Posto ${esc(nome(k))}">
                <rect x="${p.x - r}" y="${p.y - r}" width="${2 * r}" height="${2 * r}" rx="18" class="posto-area"/>
            </g>`;
        });

        // Cornice per alto/basso (senza riferimento serve un «dove»)
        const cornice = c.cornice
            ? `<rect x="${opzioni.tessera ? 132 : 110}" y="6" width="${opzioni.tessera ? 136 : 180}" height="288" rx="22" fill="${opzioni.tessera ? '#fff' : 'rgba(255,255,255,.55)'}" stroke="${COLORI.inchiostro}" stroke-width="4" ${opzioni.tessera ? '' : 'stroke-dasharray="2 12" stroke-linecap="round"'}/>`
            : '';

        // Vassoio della modalità Esegui
        let vassoio = '';
        if (opzioni.esegui) {
            vassoio = `<g class="vassoio"><rect x="140" y="${H + 8}" width="120" height="${H_ESEGUI - H - 14}" rx="20" class="vassoio-area"/></g>`;
            if (concetto && opzioni.inVassoio) {
                const scala = (oggImg && typeof oggImg.scala === 'number' && oggImg.scala > 0) ? oggImg.scala : 1;
                const s = CT.util.clamp(64 * scala, 36, 120);   // nel vassoio solo la scala, centrato
                const p = { x: 200, y: H + 8 + (H_ESEGUI - H - 14) / 2, s };
                vassoio += `<g class="oggetto oggetto-vassoio" data-concetto="">${elemento(oggImg, p, 'oggetto')[1]}</g>`;
            }
        }

        const extra = opzioni.tessera ? frecce(scena.concetto, specchia) : '';

        return `<svg viewBox="0 0 ${L} ${altezza}" xmlns="http://www.w3.org/2000/svg"${classe}${etichetta}>
            ${cornice}${oggDietro}${rifDietro}${oggDentro}${rifDavanti}${oggDavanti}${extra}${vassoio}${posti}</svg>`;
    }

    /** Tessera del libro per un concetto (simboli), con la parola facoltativa */
    function tessera(concetto, { parola = true, specchia = false } = {}) {
        const svg = svgScena({ concetto, tipo: 'componi' }, { tessera: true, specchia, concetto });
        return `<span class="tessera-disegno">${svg}</span>${parola ? `<span class="tessera-parola">${esc(nome(concetto).toUpperCase())}</span>` : ''}`;
    }

    /* ---------- Profilo predefinito ---------- */

    const IMPOSTAZIONI_DEFAULT = {
        modalita: 'riconosci',          // riconosci | esegui | alterna
        coppie: COPPIE.filter(c => c.libro).map(c => c.id),
        parola: true,                   // parola scritta sotto le tessere
        pausaPrima: { tipo: 'tocco', secondi: 4 },   // LIS dell'educatore prima: tocco | tempo | nessuna
        pausaDopo: { tipo: 'tocco', secondi: 4 },    // LIS dell'educatore dopo la risposta
        ordine: 'casuale',              // casuale | ordine
        scenePerSessione: 0,            // 0 = tutte
        dopoErrore: 'riprova',          // riprova | mostra
        specchia: true,                 // varia il lato dove possibile
        scambiaTessere: true            // la tessera giusta non sta sempre dallo stesso lato
    };

    /** Scene di partenza: per ogni coppia del libro, entrambe le posizioni con i simboli; dentro/fuori anche con la scatola */
    function scenePredefinite() {
        const scene = [];
        COPPIE.forEach(c => c.concetti.forEach(k => scene.push({
            id: `base_${k}`, concetto: k, tipo: 'componi', nota: 'Simboli del libro',
            riferimento: { tipo: 'simbolo', id: 'quadrato' }, oggetto: { tipo: 'simbolo', id: 'pallino' }
        })));
        ['dentro', 'fuori'].forEach(k => scene.push({
            id: `base_scatola_${k}`, concetto: k, tipo: 'componi', nota: 'Pallina e scatola',
            riferimento: { tipo: 'contenitore', id: 'scatola' }, oggetto: { tipo: 'simbolo', id: 'pallino' }
        }));
        return scene;
    }

    function profiloPredefinito() {
        return { schema: 1, impostazioni: JSON.parse(JSON.stringify(IMPOSTAZIONI_DEFAULT)), scene: scenePredefinite() };
    }

    /** Completa un profilo letto dal server con i valori mancanti */
    function normalizzaProfilo(doc) {
        const base = profiloPredefinito();
        if (!doc || typeof doc !== 'object') return base;
        const imp = Object.assign({}, base.impostazioni, doc.impostazioni || {});
        imp.pausaPrima = Object.assign({}, base.impostazioni.pausaPrima, imp.pausaPrima || {});
        imp.pausaDopo = Object.assign({}, base.impostazioni.pausaDopo, imp.pausaDopo || {});
        imp.coppie = (Array.isArray(imp.coppie) ? imp.coppie : base.impostazioni.coppie).filter(id => COPPIA[id]);
        const scene = Array.isArray(doc.scene) ? doc.scene.filter(s => s && CONCETTI[s.concetto]) : base.scene;
        return { schema: 1, impostazioni: imp, scene };
    }

    return {
        L, H, H_ESEGUI, CONCETTI, COPPIE, COPPIA,
        nome, coppiaDi, opposto, titoloCoppia, urlImmagine, eContenitore,
        svgScena, tessera, posto,
        IMPOSTAZIONI_DEFAULT, profiloPredefinito, scenePredefinite, normalizzaProfilo
    };
})();
