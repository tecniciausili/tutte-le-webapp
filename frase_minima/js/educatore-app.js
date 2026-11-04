/**
 * Frase Minima - Area Educatore
 * AssistiveTech.it - Training Cognitivo
 *
 * L'educatore compone una frase minima con tre elementi in sequenza:
 * soggetto (blu), predicato (rosso), complemento (verde).
 * Per ognuno sceglie un pittogramma ARASAAC o carica un'immagine dal dispositivo,
 * e scrive la parola che il sintetizzatore vocale leggerà.
 *
 * Versione autonoma: un dispositivo = un utente, nessun login, i dati stanno
 * nel browser tramite js/archivio.js. Le immagini vengono incorporate nella
 * frase (data URL), così l'esercizio funziona anche senza rete.
 */

const RUOLI = ['soggetto', 'predicato', 'complemento'];

// Lato massimo delle immagini incorporate: basta per i box e non riempie lo spazio del browser
const LATO_MAX_IMMAGINE = 600;

const appState = {
    elementi: {
        soggetto:    { url: null, id_arasaac: null, fonte: 'arasaac' },
        predicato:   { url: null, id_arasaac: null, fonte: 'arasaac' },
        complemento: { url: null, id_arasaac: null, fonte: 'arasaac' }
    },
    exercises: [],
    risultati: [],
    // true quando l'educatore ha corretto la frase a mano: da quel momento
    // non viene più sovrascritta dalla concatenazione delle tre parole
    fraseModificata: false
};

document.addEventListener('DOMContentLoaded', () => {
    loadExercises();
    loadRisultati();
    caricaPerSessione();
    document.getElementById('fileImporta')?.addEventListener('change', alFileImporta);
});

// ===== NAVIGAZIONE =====
// Casetta: torna all'inizio di questa app
function goHome() {
    window.location.href = window.RACCOLTA ? window.RACCOLTA.url : './';   // Tutte le Web App (indice della raccolta)
}

function goBack() {
    window.location.href = './';   // pagina iniziale di Frase minima
}

function goToExercise() {
    window.location.href = 'esercizio.html';
}

// ===== FONTE IMMAGINE: ARASAAC o COMPUTER =====
function setFonte(ruolo, fonte) {
    appState.elementi[ruolo].fonte = fonte;

    document.querySelectorAll(`#card-${ruolo} .el-fonti button`).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.fonte === fonte);
    });

    document.getElementById(`search-${ruolo}`).classList.toggle('hidden', fonte !== 'arasaac');
    document.getElementById(`upload-${ruolo}`).classList.toggle('hidden', fonte !== 'upload');
}

// ===== RICERCA ARASAAC =====
function onSearchArasaac(ruolo) {
    const query = document.getElementById(`input-search-${ruolo}`).value.trim();
    const resultsBox = document.getElementById(`results-${ruolo}`);

    if (query.length < 2) {
        resultsBox.innerHTML = '';
        return;
    }

    arasaacService.searchWithDebounce(query, (pictograms) => {
        renderArasaacResults(ruolo, pictograms);
    });
}

function renderArasaacResults(ruolo, pictograms) {
    const resultsBox = document.getElementById(`results-${ruolo}`);
    resultsBox.innerHTML = '';

    if (!pictograms || pictograms.length === 0) {
        resultsBox.innerHTML = '<p class="empty-message" style="grid-column: 1/-1; padding: 10px;">Nessun pittogramma trovato</p>';
        return;
    }

    pictograms.forEach(pic => {
        const item = document.createElement('div');
        item.className = 'arasaac-result-item';
        const label = (pic.keywords[0]?.keyword) || `#${pic.id}`;
        item.innerHTML = `
            <img src="${pic.thumbnail}" alt="${label}" loading="lazy">
            <span>${label}</span>
        `;
        item.onclick = () => selectArasaac(ruolo, pic, item, label);
        resultsBox.appendChild(item);
    });
}

function selectArasaac(ruolo, pic, itemEl, label) {
    document.querySelectorAll(`#results-${ruolo} .arasaac-result-item`).forEach(i => i.classList.remove('selected'));
    itemEl.classList.add('selected');

    appState.elementi[ruolo].url = pic.url;
    appState.elementi[ruolo].id_arasaac = pic.id;

    mostraAnteprima(ruolo, pic.url, label);

    // Precompila la parola solo se il campo è ancora vuoto: l'educatore
    // deve poter scrivere "MANGIO" al posto di "mangiare".
    const inputTesto = document.getElementById(`testo-${ruolo}`);
    if (!inputTesto.value.trim()) {
        inputTesto.value = label.toUpperCase();
    }

    onTestoChange();
}

// ===== UPLOAD DAL COMPUTER =====
async function onUploadFile(ruolo, input) {
    const file = input.files && input.files[0];
    if (!file) return;

    const label = document.getElementById(`upload-${ruolo}`);
    const testoOriginale = label.innerHTML;
    label.innerHTML = '<i class="bi bi-hourglass-split"></i> Caricamento in corso...';

    try {
        if (!file.type.startsWith('image/')) {
            showToast('Il file scelto non è un\'immagine', 'error');
            return;
        }
        const originale = await leggiFileComeDataUrl(file);
        const dataUrl = await immagineComeDataUrl(originale);

        appState.elementi[ruolo].url = dataUrl;
        appState.elementi[ruolo].id_arasaac = null;

        mostraAnteprima(ruolo, dataUrl, file.name);
        showToast('Immagine caricata', 'success');
        onTestoChange();
    } catch (e) {
        console.error(e);
        showToast('Immagine non leggibile: prova con un altro file (JPG o PNG)', 'error');
    } finally {
        label.innerHTML = testoOriginale;
        input.value = '';
    }
}

function leggiFileComeDataUrl(file) {
    return new Promise((resolve, reject) => {
        const lettore = new FileReader();
        lettore.onload = () => resolve(lettore.result);
        lettore.onerror = () => reject(new Error('File non leggibile'));
        lettore.readAsDataURL(file);
    });
}

// Ridimensiona un'immagine (src = URL o data URL) e la restituisce come data URL.
// Serve a incorporarla nella frase: funziona offline e finisce nell'esportazione.
function immagineComeDataUrl(src, latoMax = LATO_MAX_IMMAGINE) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const scala = Math.min(1, latoMax / Math.max(img.naturalWidth, img.naturalHeight));
                const w = Math.max(1, Math.round(img.naturalWidth * scala));
                const h = Math.max(1, Math.round(img.naturalHeight * scala));
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                // Se c'è trasparenza (pittogrammi, PNG ritagliati) serve il PNG: col JPEG
                // le parti trasparenti diventerebbero nere. Le foto vanno in JPEG, più leggero.
                const alfa = ctx.getImageData(0, 0, w, h).data;
                let trasparente = false;
                for (let i = 3; i < alfa.length; i += 4) {
                    if (alfa[i] < 250) { trasparente = true; break; }
                }
                resolve(trasparente ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85));
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => reject(new Error('Immagine non leggibile'));
        img.src = src;
    });
}

function mostraAnteprima(ruolo, url, alt) {
    const preview = document.getElementById(`preview-${ruolo}`);
    preview.innerHTML = `<img src="${url}" alt="${alt || ruolo}">`;
}

// ===== TESTI E FRASE =====
function testoDi(ruolo) {
    return document.getElementById(`testo-${ruolo}`).value.trim();
}

/**
 * SEPARATORE DELLE TRE PARTI
 * Nel campo "Frase letta" soggetto, predicato e complemento sono divisi da un
 * trattino con spazi (" - "). Serve perche' ogni parte puo' contenere piu' parole
 * ("il bambino - mangia - la mela"): senza separatore il sistema non saprebbe
 * dove finisce il soggetto e dove inizia il predicato.
 * Il trattino con spazi non spezza le parole composte (es. "porta-penne").
 */
const SEPARATORE = ' - ';
const REGEX_SEPARATORE = /\s+[-–—]\s+/;

/** Frase mostrata nel campo: le tre parti separate dal trattino */
function fraseAutomatica() {
    return RUOLI.map(testoDi).filter(t => t !== '').join(SEPARATORE);
}

/** Frase che verrà effettivamente letta: quella nel campo, o l'automatica */
function fraseCorrente() {
    const scritta = document.getElementById('inputFrase').value.trim();
    return scritta !== '' ? scritta : fraseAutomatica();
}

/**
 * Frase da leggere ad alta voce e da salvare: senza i trattini, che servono solo
 * all'educatore per separare le tre parti (la voce non deve pronunciarli).
 */
function frasePulita(frase) {
    return String(frase || '').split(REGEX_SEPARATORE).map(p => p.trim()).filter(p => p !== '').join(' ');
}

/** Le tre parole sono cambiate: aggiorna la frase se non è stata corretta a mano */
function onTestoChange() {
    if (!appState.fraseModificata) {
        document.getElementById('inputFrase').value = fraseAutomatica();
    }
}

/** L'educatore ha scritto nel campo frase: da ora comanda lui */
function onFraseModificata() {
    const campo = document.getElementById('inputFrase');
    appState.fraseModificata = campo.value.trim() !== fraseAutomatica();
    document.getElementById('btnRipristinaFrase').classList.toggle('hidden', !appState.fraseModificata);
}

/**
 * La frase corretta a mano comanda anche sulle tre parole: le ridistribuisce nei
 * campi soggetto/predicato/complemento, cosi' l'utente vede e sente sotto ogni
 * immagine esattamente le parti scritte dall'educatore (e non la dicitura del
 * pittogramma ARASAAC, che e' solo il suggerimento iniziale).
 *
 * La divisione segue i TRATTINI: "il bambino - mangia - la mela"
 *   -> soggetto "il bambino" | predicato "mangia" | complemento "la mela"
 * Senza trattini si divide solo se le parole sono esattamente tre (una per parte);
 * altrimenti i campi restano invariati e l'educatore viene avvisato.
 * Ritorna true se la divisione e' andata a buon fine.
 */
function distribuisciFraseSuiTesti(avvisa = false) {
    if (!appState.fraseModificata) return true;

    const frase = document.getElementById('inputFrase').value.trim();
    if (frase === '') return true;

    let parti = frase.split(REGEX_SEPARATORE).map(p => p.trim()).filter(p => p !== '');

    if (parti.length !== 3) {
        // Nessun trattino (o numero sbagliato): si divide solo se ci sono 3 parole esatte
        const parole = frase.split(/\s+/).filter(p => p !== '');
        if (parole.length === 3 && parti.length === 1) {
            parti = parole;
        } else {
            if (avvisa) {
                showToast('Separa le tre parti con un trattino, es. "il bambino - mangia - la mela"', 'error');
            }
            return false;
        }
    }

    RUOLI.forEach((ruolo, i) => {
        const campo = document.getElementById(`testo-${ruolo}`);
        if (campo) campo.value = parti[i];
    });
    return true;
}

/** Torna alla frase composta dalle tre parole */
function ripristinaFraseAutomatica() {
    appState.fraseModificata = false;
    document.getElementById('inputFrase').value = fraseAutomatica();
    document.getElementById('btnRipristinaFrase').classList.add('hidden');
    showToast('Frase ricomposta dalle tre parti', 'success');
}

function ascoltaFrase() {
    // I trattini separano le parti solo nel campo: la voce legge la frase pulita
    const frase = frasePulita(fraseCorrente());

    if (!frase) {
        showToast('Scrivi almeno una parola per ascoltare la frase', 'error');
        return;
    }

    if (!('speechSynthesis' in window)) {
        showToast('Voce non disponibile su questo browser', 'error');
        return;
    }

    try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(frase);
        utter.lang = 'it-IT';
        utter.rate = 0.9;
        utter.pitch = 1.05;
        window.speechSynthesis.speak(utter);
    } catch (e) {
        console.warn('TTS errore:', e);
    }
}

// ===== SALVATAGGIO FRASE =====
async function addFrase() {
    // Se l'educatore ha corretto la frase e salva senza uscire dal campo, le tre
    // parti vanno comunque riallineate alla sua versione. Se la frase non e'
    // divisibile (trattini mancanti) il salvataggio si ferma con un avviso.
    if (!distribuisciFraseSuiTesti(true)) return;

    const etichette = {
        soggetto: 'soggetto (blu)',
        predicato: 'predicato (rosso)',
        complemento: 'complemento (verde)'
    };

    for (const ruolo of RUOLI) {
        if (!appState.elementi[ruolo].url) {
            showToast(`Scegli l'immagine del ${etichette[ruolo]}`, 'error');
            return;
        }
        if (!testoDi(ruolo)) {
            showToast(`Scrivi la parola del ${etichette[ruolo]}`, 'error');
            return;
        }
    }

    const payload = {
        frase: frasePulita(fraseCorrente()),   // salvata senza trattini: e' quella che viene letta
        mostra_testo: document.getElementById('inputMostraTesto').checked ? 1 : 0
    };

    RUOLI.forEach(ruolo => {
        payload[ruolo] = {
            testo: testoDi(ruolo),   // come l'ha scritta l'educatore (niente maiuscolo forzato)
            url: appState.elementi[ruolo].url,
            id_arasaac: appState.elementi[ruolo].id_arasaac
        };
    });

    const btn = document.getElementById('btnAddFrase');
    if (btn) btn.disabled = true;
    try {
        // I pittogrammi ARASAAC vengono scaricati e incorporati, così la frase
        // funziona anche offline. Se il download non riesce resta il link.
        for (const ruolo of RUOLI) {
            const el = payload[ruolo];
            if (el.id_arasaac && !String(el.url).startsWith('data:')) {
                try {
                    el.url = await immagineComeDataUrl(el.url);
                } catch (e) {
                    console.warn(`[ARASAAC] ${ruolo}: immagine non incorporata, resta il link`, e);
                }
            }
        }

        const data = Archivio.salvaConfig(payload);

        if (data.success) {
            showToast(`Frase salvata: ${data.data?.frase || ''}`, 'success');
            resetForm();
            loadExercises();
        } else {
            showToast(data.message || 'Errore salvataggio', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Errore nel salvataggio', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function resetForm() {
    RUOLI.forEach(ruolo => {
        appState.elementi[ruolo] = { url: null, id_arasaac: null, fonte: 'arasaac' };

        document.getElementById(`preview-${ruolo}`).innerHTML =
            '<div class="el-vuoto"><i class="bi bi-image"></i>Nessuna immagine</div>';
        document.getElementById(`testo-${ruolo}`).value = '';
        document.getElementById(`input-search-${ruolo}`).value = '';
        document.getElementById(`results-${ruolo}`).innerHTML = '';

        setFonte(ruolo, 'arasaac');
    });

    document.getElementById('inputMostraTesto').checked = true;
    appState.fraseModificata = false;
    document.getElementById('inputFrase').value = '';
    document.getElementById('btnRipristinaFrase').classList.add('hidden');
    onTestoChange();
}

// ===== LISTA FRASI =====
function loadExercises() {
    appState.exercises = Archivio.getConfigList();
    renderExercisesList();
}

function renderExercisesList() {
    const container = document.getElementById('exercisesList');
    document.getElementById('exerciseCount').textContent = appState.exercises.length;

    if (appState.exercises.length === 0) {
        container.innerHTML = '<p class="empty-message">Nessuna frase creata</p>';
        return;
    }

    container.innerHTML = '';
    appState.exercises.forEach(ex => {
        const card = document.createElement('div');
        card.className = 'exercise-card';

        const immagini = (ex.elementi || [])
            .map(el => `<img class="ex-img r-${el.ruolo}" src="${el.url}" alt="${el.testo}" title="${el.testo}">`)
            .join('');

        card.innerHTML = `
            <div class="ex-immagini">${immagini}</div>
            <div class="ex-info">
                <div class="ex-frase">${ex.frase}</div>
                <div class="ex-meta">
                    ${ex.mostra_testo ? 'parole visibili' : 'solo immagini'} ·
                    ${ex.data_creazione || ''}
                </div>
            </div>
            <button class="btn-delete" title="Elimina frase" aria-label="Elimina frase">
                <i class="bi bi-trash3"></i>
            </button>
        `;
        card.querySelector('.btn-delete').onclick = () => deleteFrase(ex.id_config, ex.frase);
        container.appendChild(card);
    });
}

function deleteFrase(id_config, frase) {
    if (!confirm(`Eliminare la frase "${frase}"?`)) return;

    try {
        Archivio.eliminaConfig(id_config);
        showToast('Frase eliminata', 'success');
        loadExercises();
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Errore eliminazione', 'error');
    }
}

// ===== RISULTATI =====
function loadRisultati() {
    appState.risultati = Archivio.getRisultati(30);
    renderRisultati();
}

function renderRisultati() {
    const wrap = document.getElementById('risultatiWrap');
    document.getElementById('risultatiCount').textContent = appState.risultati.length;

    if (appState.risultati.length === 0) {
        wrap.innerHTML = '<p class="empty-message">Nessuna frase ancora composta</p>';
        return;
    }

    const righe = appState.risultati.map(r => {
        const errori = parseInt(r.errori) || 0;
        const classe = errori === 0 ? 'esito-ok' : 'esito-warn';
        const esito = errori === 0 ? 'Senza errori' : `${errori} error${errori === 1 ? 'e' : 'i'}`;
        return `
            <tr>
                <td>${r.data_esecuzione || '-'}</td>
                <td>${r.frase || '-'}</td>
                <td class="${classe}">${esito}</td>
                <td>${r.tempo_secondi || 0} sec</td>
            </tr>
        `;
    }).join('');

    wrap.innerHTML = `
        <table class="risultati-table">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Frase</th>
                    <th>Esito</th>
                    <th>Tempo</th>
                </tr>
            </thead>
            <tbody>${righe}</tbody>
        </table>
    `;
}


// ===== SESSIONE DI LAVORO =====
// Quanti frasi fa l'utente in una sessione (0 = libera). Salvato subito alla scelta.
const SCELTE_PER_SESSIONE = [0, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];

function caricaPerSessione() {
    const campo = document.getElementById('inputPerSessione');
    if (!campo) return;
    const attuale = Archivio.getImpostazioniSessione().per_sessione;
    const scelte = SCELTE_PER_SESSIONE.includes(attuale)
        ? SCELTE_PER_SESSIONE
        : [...SCELTE_PER_SESSIONE, attuale].sort((a, b) => a - b);
    campo.innerHTML = scelte.map(n => `<option value="${n}"${n === attuale ? ' selected' : ''}>${
        n === 0 ? 'Libera (nessun numero fisso)' : n
    }</option>`).join('');
}

function salvaPerSessione() {
    const campo = document.getElementById('inputPerSessione');
    if (!campo) return;
    try {
        const imp = Archivio.salvaImpostazioniSessione({ per_sessione: campo.value });
        showToast(imp.per_sessione === 0
            ? 'Sessione libera: nessun numero fisso di frasi'
            : `Sessione di lavoro: ${imp.per_sessione} frasi`, 'success');
    } catch (e) {
        showToast('Impostazione non salvata: ' + e.message, 'error');
    }
}

// ===== COPIA DEI DATI (ESPORTA / IMPORTA) =====
// I dati stanno solo in questo browser: l'esportazione ne salva una copia in un
// file JSON; l'importazione la rimette qui (o su un altro dispositivo).
function dataPerNomeFile() {
    const d = new Date();
    const due = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

function esportaBackup() {
    try {
        const dati = Archivio.esportaDati();
        const blob = new Blob([JSON.stringify(dati)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `frase-minima-${dataPerNomeFile()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(`Dati esportati (${(dati.config || []).length} frasi)`, 'success');
    } catch (e) {
        showToast('Esportazione non riuscita: ' + e.message, 'error');
    }
}

function importaBackup() {
    if (!confirm('IMPORTA DATI\n\nFrasi, risultati e impostazioni di questo dispositivo verranno '
        + 'sostituiti con quelli del file.\n\nContinuare?')) {
        return;
    }
    const campo = document.getElementById('fileImporta');
    if (!campo) return;
    campo.value = '';
    campo.click();
}

async function alFileImporta(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
        const oggetto = JSON.parse(await file.text());
        const esito = Archivio.importaDati(oggetto);
        showToast(`Importate ${esito.config} frasi. Ricarico...`, 'success');
        setTimeout(() => window.location.reload(), 900);
    } catch (err) {
        showToast('Importazione non riuscita: ' + err.message, 'error');
    }
}

// ===== TOAST =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle-fill' : type === 'error' ? 'x-circle-fill' : 'info-circle-fill';
    toast.innerHTML = `<i class="bi bi-${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}
