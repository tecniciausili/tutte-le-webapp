/**
 * Parola-Immagine - Esercizi (Area Utente)
 * AssistiveTech.it - Training Cognitivo
 *
 * Un solo script per i due esercizi; la pagina sceglie con <body data-modo="...">:
 *   parola-immagine  → si vede (e si ascolta) la PAROLA, si sceglie tra due IMMAGINI
 *   immagine-parola  → si vede l'IMMAGINE, si sceglie tra due PAROLE
 *
 * Svolgimento (come nel portale): le coppie escono a caso senza ripetersi finché non sono
 * uscite tutte; target sopra o sotto a caso. Risposta giusta → «Bravo!» e prova successiva.
 * Risposta sbagliata → «Riprova»: al primo errore la stessa coppia torna con le posizioni
 * invertite, al secondo si passa alla prova successiva. Ogni risposta viene registrata
 * (js/archivio.js) e alla fine della sessione compare il riepilogo.
 */

const MODO = document.body.dataset.modo === 'immagine-parola' ? 'immagine-parola' : 'parola-immagine';
const PAROLA_IMMAGINE = MODO === 'parola-immagine';

// Valori iniziali del menu ☰ (come nel portale)
const SLIDER_DEFAULTS = PAROLA_IMMAGINE
    ? { fontSize: 48, imageSize: 200, gap: 24, colGap: 16 }
    : { fontSize: 36, imageSize: 240, gap: 24, colGap: 16 };

const DURATA_FEEDBACK = 2000;

const appState = {
    pairs: [],
    usedPairsIndices: [],
    lastPairIndex: -1,
    currentPair: null,
    targetPosition: null,       // 'top' o 'bottom'
    attemptCount: 0,

    sessionId: null,
    totalTrials: 10,
    currentTrial: 0,
    results: [],

    isStarted: false,
    isWaiting: false,
    trialStartTime: null,
    timerFeedback: null,

    testo: Archivio.TESTO_PREDEFINITO,
    display: { ...SLIDER_DEFAULTS },

    synth: window.speechSynthesis || null,
    selectedVoice: null,
    voiceEnabled: Archivio.voceAttiva()
};

// =====================================================
// AVVIO
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    initTTS();
    updateVoiceButton();

    const imp = Archivio.getImpostazioni();
    appState.totalTrials = imp.numero_prove;
    appState.testo = imp.testo;
    document.getElementById('totalTrials').textContent = appState.totalTrials;

    loadSliderPreferences();

    document.querySelectorAll('[data-posizione]').forEach((box) => {
        box.addEventListener('click', () => selectOption(box.dataset.posizione));
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectOption(box.dataset.posizione);
            }
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });

    try {
        appState.pairs = await Archivio.getCoppie();
    } catch (e) {
        console.error('[Coppie] Errore:', e);
        appState.pairs = [];
        showToast(e.message || 'Impossibile leggere le coppie', 'error');
    }
    mostraAttesa();
});

// Schermata prima dell'inizio (o dopo il riepilogo)
function mostraAttesa() {
    const testo = document.getElementById('placeholderTesto');
    const link = document.getElementById('linkEducatore');
    document.getElementById('exerciseArea').style.display = 'none';
    document.getElementById('exercisePlaceholder').style.display = 'block';
    document.getElementById('currentTrial').textContent = '0';
    setPulsanti({ start: appState.pairs.length > 0, ascolta: false, avanti: false });

    if (appState.pairs.length === 0) {
        testo.innerHTML = 'Non ci sono ancora esercizi.<br>L\'educatore crea le coppie parola-immagine nell\'<strong>Area Educatore</strong>.';
        link.hidden = false;
    } else {
        testo.innerHTML = 'Premi <strong>Inizia</strong> per cominciare l\'esercizio';
        link.hidden = true;
    }
}

function setPulsanti({ start, ascolta, avanti }) {
    document.getElementById('btnStart').disabled = !start;
    document.getElementById('btnRepeat').disabled = !ascolta;
    document.getElementById('btnNext').disabled = !avanti;
}

// =====================================================
// NAVIGAZIONE
// =====================================================
function confermaUscita() {
    return !appState.isStarted || confirm('Vuoi davvero uscire? La sessione in corso si interrompe.');
}

function goBack() {
    if (!confermaUscita()) return;
    window.location.href = './';              // pagina iniziale di Parola-Immagine
}

// =====================================================
// LOGICA ESERCIZIO
// =====================================================
function startExercise() {
    if (appState.pairs.length === 0) return;
    sbloccaVoce();
    clearTimeout(appState.timerFeedback);

    appState.isStarted = true;
    appState.currentTrial = 0;
    appState.results = [];
    appState.usedPairsIndices = [];
    appState.sessionId = `${MODO}_${Date.now()}`;

    document.getElementById('exercisePlaceholder').style.display = 'none';
    document.getElementById('exerciseArea').style.display = 'grid';
    setPulsanti({ start: false, ascolta: false, avanti: false });

    nextExercise();
}

function nextExercise() {
    appState.currentTrial++;
    if (appState.currentTrial > appState.totalTrials) {
        endSession();
        return;
    }
    document.getElementById('currentTrial').textContent = appState.currentTrial;

    const indice = getRandomUnusedPairIndex();
    if (indice < 0) {
        endSession();
        return;
    }
    appState.usedPairsIndices.push(indice);
    appState.lastPairIndex = indice;
    appState.currentPair = appState.pairs[indice];
    appState.targetPosition = Math.random() < 0.5 ? 'top' : 'bottom';
    appState.attemptCount = 0;

    mostraProva();
}

// Coppia a caso tra quelle non ancora uscite; finite tutte si ricomincia
// (evitando di riproporre subito l'ultima)
function getRandomUnusedPairIndex() {
    const n = appState.pairs.length;
    if (n === 0) return -1;
    if (appState.usedPairsIndices.length >= n) appState.usedPairsIndices = [];

    let disponibili = [];
    for (let i = 0; i < n; i++) {
        if (!appState.usedPairsIndices.includes(i)) disponibili.push(i);
    }
    if (disponibili.length > 1) disponibili = disponibili.filter((i) => i !== appState.lastPairIndex);
    return disponibili[Math.floor(Math.random() * disponibili.length)];
}

// Stessa coppia, posizioni invertite (dopo il primo errore)
function repeatExercise() {
    appState.targetPosition = appState.targetPosition === 'top' ? 'bottom' : 'top';
    mostraProva();
}

function testoParola(parola) {
    return appState.testo.maiuscolo ? String(parola).toLocaleUpperCase('it-IT') : String(parola);
}

function mostraProva() {
    const pair = appState.currentPair;
    const targetSopra = appState.targetPosition === 'top';

    if (PAROLA_IMMAGINE) {
        document.getElementById('wordText').textContent = testoParola(pair.parola_target);
        const sopra = document.getElementById('imgTop');
        const sotto = document.getElementById('imgBottom');
        sopra.src = targetSopra ? pair.url_immagine_target : pair.url_immagine_distrattore;
        sotto.src = targetSopra ? pair.url_immagine_distrattore : pair.url_immagine_target;
        document.getElementById('imageTop').setAttribute('aria-label', 'Immagine sopra');
        document.getElementById('imageBottom').setAttribute('aria-label', 'Immagine sotto');
    } else {
        const img = document.getElementById('targetImage');
        img.src = pair.url_immagine_target;
        img.alt = 'Immagine da riconoscere';
        document.getElementById('wordTextTop').textContent =
            testoParola(targetSopra ? pair.parola_target : pair.parola_distrattore);
        document.getElementById('wordTextBottom').textContent =
            testoParola(targetSopra ? pair.parola_distrattore : pair.parola_target);
    }

    document.querySelectorAll('[data-posizione]').forEach((b) => b.classList.remove('correct', 'wrong'));
    applicaTesto();
    reapplyDisplaySettings();

    // Il focus va sullo stimolo (non cliccabile): Spazio o Invio premuti per sbaglio
    // non scelgono una risposta
    const stimolo = document.getElementById(PAROLA_IMMAGINE ? 'wordDisplay' : 'imageDisplay');
    try { stimolo.focus({ preventScroll: true }); } catch (e) { stimolo.focus(); }

    appState.isWaiting = true;
    appState.trialStartTime = Date.now();
    setPulsanti({ start: false, ascolta: true, avanti: true });

    setTimeout(leggiStimolo, 300);
}

function leggiStimolo() {
    const pair = appState.currentPair;
    if (!pair) return;
    speakWord(PAROLA_IMMAGINE
        ? pair.parola_target
        : `Scegli: ${pair.parola_target} o ${pair.parola_distrattore}`);
}

function ascoltaDiNuovo() {
    if (appState.isWaiting) leggiStimolo();
}

function saltaProva() {
    if (!appState.isWaiting) return;
    appState.isWaiting = false;
    nextExercise();
}

// =====================================================
// RISPOSTA
// =====================================================
function selectOption(position) {
    if (!appState.isWaiting) return;
    appState.isWaiting = false;
    setPulsanti({ start: false, ascolta: false, avanti: false });

    const responseTime = Date.now() - appState.trialStartTime;
    const isCorrect = position === appState.targetPosition;
    const box = document.querySelector(`[data-posizione="${position}"]`);
    box.classList.add(isCorrect ? 'correct' : 'wrong');

    saveResult(isCorrect, responseTime);

    if (isCorrect) {
        showCelebration();
    } else {
        appState.attemptCount++;
        showError();
    }
}

function saveResult(isCorrect, responseTime) {
    const pair = appState.currentPair;
    appState.results.push({ parola: pair.parola_target, esito: isCorrect ? 'corretto' : 'errato' });
    try {
        Archivio.salvaRisultato({
            id_sessione: appState.sessionId,
            modo: MODO,
            id_coppia: pair.id_coppia,
            parola_target: pair.parola_target,
            esito: isCorrect ? 'corretto' : 'errato',
            tempo_risposta_ms: responseTime,
            numero_prova: appState.currentTrial,
            numero_prove_totali: appState.totalTrials
        });
    } catch (e) {
        console.error('[Risultati] Non salvato:', e);
    }
}

function showCelebration() {
    const modal = document.getElementById('celebrationModal');
    preparaFesta();
    modal.classList.add('active');
    speakWord('Bravo!');
    appState.timerFeedback = setTimeout(() => {
        modal.classList.remove('active');
        nextExercise();
    }, DURATA_FEEDBACK);
}

function showError() {
    const modal = document.getElementById('errorModal');
    modal.classList.add('active');
    speakWord('Riprova');
    appState.timerFeedback = setTimeout(() => {
        modal.classList.remove('active');
        if (appState.attemptCount < 2) repeatExercise();
        else nextExercise();
    }, DURATA_FEEDBACK);
}

// Coriandoli e stelle (al posto della GIF esterna del portale: funziona offline)
function preparaFesta() {
    const festa = document.getElementById('festa');
    if (!festa) return;
    const colori = ['#FF5252', '#FFC107', '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#00BCD4'];
    const pezzi = [];
    for (let i = 0; i < 28; i++) {
        const angolo = (360 / 28) * i + Math.random() * 10;
        const distanza = 90 + Math.random() * 90;
        const stella = i % 4 === 0;
        pezzi.push(`<span class="${stella ? 'stella' : 'coriandolo'}" style="--a:${angolo}deg;--d:${distanza}px;--c:${colori[i % colori.length]};--r:${Math.round(Math.random() * 360)}deg;--t:${(Math.random() * 0.25).toFixed(2)}s">${stella ? '★' : ''}</span>`);
    }
    festa.innerHTML = pezzi.join('');
}

// =====================================================
// FINE SESSIONE
// =====================================================
function endSession() {
    appState.isStarted = false;
    appState.isWaiting = false;
    setPulsanti({ start: false, ascolta: false, avanti: false });

    const correct = appState.results.filter((r) => r.esito === 'corretto').length;
    const wrong = appState.results.length - correct;
    const percent = appState.results.length ? Math.round((correct / appState.results.length) * 100) : 0;

    document.getElementById('statCorrect').textContent = correct;
    document.getElementById('statWrong').textContent = wrong;
    document.getElementById('statPercent').textContent = `${percent}%`;

    const perParola = new Map();
    appState.results.forEach((r) => {
        if (!perParola.has(r.parola)) perParola.set(r.parola, { correct: 0, wrong: 0 });
        perParola.get(r.parola)[r.esito === 'corretto' ? 'correct' : 'wrong']++;
    });

    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '';
    if (perParola.size === 0) {
        tbody.innerHTML = '<tr><td colspan="3">Nessuna risposta data in questa sessione</td></tr>';
    }
    perParola.forEach((s, parola) => {
        const pct = Math.round((s.correct / (s.correct + s.wrong)) * 100);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(testoParola(parola))}</strong></td>
            <td><span class="badge correct">${s.correct} ✓</span> <span class="badge wrong">${s.wrong} ✗</span></td>
            <td>${pct}%</td>`;
        tbody.appendChild(tr);
    });

    document.getElementById('summaryModal').classList.add('active');
    speakWord(`Esercizio completato. Hai risposto correttamente ${correct} ${correct === 1 ? 'volta' : 'volte'} su ${appState.results.length}.`);
}

function closeSummary() {
    document.getElementById('summaryModal').classList.remove('active');
    mostraAttesa();
}

// =====================================================
// ASPETTO DELLE PAROLE (impostato nell'Area Educatore)
// =====================================================
function applicaTesto() {
    const t = appState.testo;
    const parole = PAROLA_IMMAGINE
        ? [document.getElementById('wordText')]
        : [...document.querySelectorAll('.word-option')];
    const sfondi = PAROLA_IMMAGINE
        ? [document.getElementById('wordDisplay')]
        : [...document.querySelectorAll('.word-box')];

    parole.forEach((el) => {
        el.style.fontFamily = t.carattere;
        el.style.color = t.coloreTesto;
        el.style.fontWeight = t.grassetto ? '700' : '400';
        el.style.letterSpacing = `${t.spaziatura}em`;
        el.style.textTransform = 'none';   // il maiuscolo lo decide testoParola()
    });
    sfondi.forEach((el) => { el.style.backgroundColor = t.coloreSfondo; });
}

// =====================================================
// VOCE
// =====================================================
function initTTS() {
    if (!appState.synth) return;
    const scegli = () => {
        const voci = appState.synth.getVoices();
        appState.selectedVoice = voci.find((v) => /^it[-_]IT/i.test(v.lang) && v.localService)
            || voci.find((v) => /^it/i.test(v.lang))
            || null;
    };
    scegli();
    if (typeof appState.synth.addEventListener === 'function') {
        appState.synth.addEventListener('voiceschanged', scegli);
    }
}

// Su iPad/iPhone la voce parte solo se la prima lettura nasce da un tocco
function sbloccaVoce() {
    if (!appState.synth || !appState.voiceEnabled) return;
    try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        appState.synth.speak(u);
    } catch (e) { /* ignora */ }
}

function speakWord(text) {
    if (!appState.synth) return;
    appState.synth.cancel();
    if (!appState.voiceEnabled) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.rate = 0.9;
    u.pitch = 1.0;
    u.volume = 1.0;
    if (appState.selectedVoice) u.voice = appState.selectedVoice;
    appState.synth.speak(u);
}

function toggleVoice() {
    appState.voiceEnabled = !appState.voiceEnabled;
    Archivio.salvaVoce(appState.voiceEnabled);
    if (!appState.voiceEnabled && appState.synth) appState.synth.cancel();
    updateVoiceButton();
    showToast(appState.voiceEnabled ? 'Voce attivata' : 'Voce disattivata', 'info');
}

function updateVoiceButton() {
    const btn = document.getElementById('btnVoce');
    if (!btn) return;
    const on = appState.voiceEnabled;
    btn.innerHTML = `<i class="bi ${on ? 'bi-volume-up-fill' : 'bi-volume-mute-fill'}"></i>`;
    btn.title = on ? 'Voce attiva (tocca per disattivare)' : 'Voce disattivata (tocca per attivare)';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('voce-spenta', !on);
}

// =====================================================
// MENU ☰: DIMENSIONI (salvate per questo esercizio, su questo dispositivo)
// =====================================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function salvaPreferenza(chiave, valore) {
    appState.display[chiave] = parseInt(valore, 10);
    Archivio.salvaDisplay(MODO, appState.display);
}

function updateFontSize(value, salva = true) {
    const elementi = PAROLA_IMMAGINE
        ? [document.getElementById('wordText')]
        : [...document.querySelectorAll('.word-option')];
    elementi.forEach((el) => { el.style.fontSize = `${value}px`; });
    document.getElementById('fontValue').textContent = value;
    if (salva) salvaPreferenza('fontSize', value);
}

// Lo slider dimensiona il BOX; l'immagine si adatta dentro (max 100%)
function updateImageSize(value, salva = true) {
    const boxes = PAROLA_IMMAGINE
        ? [...document.querySelectorAll('.images-column .image-box')]
        : [document.getElementById('imageDisplay')];
    boxes.forEach((box) => {
        box.style.width = `${value}px`;
        box.style.height = `${value}px`;
        box.style.minHeight = `${value}px`;
    });
    document.getElementById('imageValue').textContent = value;
    if (salva) salvaPreferenza('imageSize', value);
}

function updateGap(value, salva = true) {
    const colonna = document.querySelector(PAROLA_IMMAGINE ? '.images-column' : '.words-column');
    if (colonna) colonna.style.gap = `${value}px`;
    document.getElementById('gapValue').textContent = value;
    if (salva) salvaPreferenza('gap', value);
}

function updateColumnGap(value, salva = true) {
    document.getElementById('exerciseArea').style.gap = `${value}px`;
    document.getElementById('colGapValue').textContent = value;
    if (salva) salvaPreferenza('colGap', value);
}

const SLIDER = [
    ['fontSlider', 'fontSize', updateFontSize],
    ['imageSlider', 'imageSize', updateImageSize],
    ['gapSlider', 'gap', updateGap],
    ['colGapSlider', 'colGap', updateColumnGap]
];

function applicaSlider(valori) {
    SLIDER.forEach(([id, chiave, aggiorna]) => {
        const slider = document.getElementById(id);
        const min = parseInt(slider.min, 10);
        const max = parseInt(slider.max, 10);
        let v = parseInt(valori[chiave], 10);
        if (!Number.isFinite(v)) v = SLIDER_DEFAULTS[chiave];
        v = Math.min(max, Math.max(min, v));
        slider.value = v;
        appState.display[chiave] = v;
        aggiorna(v, false);
    });
}

function loadSliderPreferences() {
    applicaSlider({ ...SLIDER_DEFAULTS, ...Archivio.getDisplay(MODO) });
}

function resetSliders() {
    Archivio.cancellaDisplay(MODO);
    applicaSlider(SLIDER_DEFAULTS);
    showToast('Impostazioni ripristinate', 'success');
}

// Riapplica le dimensioni correnti dopo ogni cambio di prova (senza risalvare)
function reapplyDisplaySettings() {
    SLIDER.forEach(([id, , aggiorna]) => aggiorna(document.getElementById(id).value, false));
}
