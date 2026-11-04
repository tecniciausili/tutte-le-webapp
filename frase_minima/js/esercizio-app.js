/**
 * Frase Minima - Area Utente
 * AssistiveTech.it - Training Cognitivo
 *
 * L'utente compone la frase trascinando i tre pittogrammi nei box colorati,
 * rispettando la sequenza: soggetto (blu) -> predicato (rosso) -> complemento (verde).
 * Ogni parola inserita viene letta ad alta voce; a frase completa viene letta
 * l'intera frase. Il bottone "Ripeti la frase" la rilegge in qualsiasi momento.
 */

// Versione autonoma: un dispositivo = un utente, nessun login.
// Frasi e risultati stanno nel browser tramite js/archivio.js.

const RUOLI = ['soggetto', 'predicato', 'complemento'];

const ETICHETTE_RUOLO = {
    soggetto:    'box blu',
    predicato:   'box rosso',
    complemento: 'box verde'
};

const NOMI_RUOLO = {
    soggetto:    'soggetto',
    predicato:   'predicato',
    complemento: 'complemento'
};

const ERRORI_PER_AIUTO = 3;
const COOLDOWN_ERRORE = 700;

// Preferenze ricordate tra le frasi e tra le sessioni (chiavi con prefisso fm_)
const STORAGE_BORDI = Archivio.CHIAVI.bordi;
const STORAGE_FONT_TESTO = Archivio.CHIAVI.scalaTesto;
const STORAGE_IMPOSTAZIONI = Archivio.CHIAVI.impostazioni;

const state = {
    exercises: [],
    currentConfig: null,
    indiceCorrente: 0,     // quale elemento della frase va inserito adesso
    inserite: [],          // testi già collocati, in ordine
    errori: 0,
    completed: false,
    startTime: null,
    // impostazioni
    voceAbilitata: true,
    gender: 'M',
    rate: 0.9,
    aiutoAbilitato: true,
    autoAdvance: true,
    autoAdvanceTimer: null,
    // true = bordi colorati (indizio attivo); false = bordi neri
    bordiColorati: true
};

let currentDragTile = null;
let lastErrorTime = 0;

document.addEventListener('DOMContentLoaded', () => {
    caricaPreferenzaBordi();
    caricaPreferenzaFontTesto();
    caricaImpostazioni();
    initApp();
    setupSlots();
});

// ===== NAVIGAZIONE =====
// Casetta: torna all'inizio di questa app
function goHome() {
    window.location.href = window.RACCOLTA ? window.RACCOLTA.url : './';   // Tutte le Web App (indice della raccolta)
}

function goBack() {
    // Un livello sopra: dall'esercizio aperto alla scelta dell'esercizio, altrimenti alla pagina iniziale
    if (state.currentConfig) {
        backToChooser();
        return;
    }
    window.location.href = './';
}

// ===== INIT =====
function initApp() {
    loadExercisesList();
}

// ===== LISTA FRASI =====
function loadExercisesList() {
    try {
        state.exercises = Archivio.getConfigList();

        if (state.exercises.length === 0) {
            document.getElementById('exerciseChooser').classList.add('hidden');
            document.getElementById('exerciseArea').classList.add('hidden');
            document.getElementById('noConfigMessage').classList.remove('hidden');
            return;
        }

        document.getElementById('noConfigMessage').classList.add('hidden');
        renderChooser();
    } catch (e) {
        console.error('[Frasi] Errore:', e);
        showToast('Errore caricamento frasi', 'error');
    }
}

function renderChooser() {
    const container = document.getElementById('userExercisesList');
    document.getElementById('chooserCount').textContent = state.exercises.length;

    container.innerHTML = '';
    state.exercises.forEach(ex => {
        const card = document.createElement('button');
        card.className = 'user-exercise-card';
        card.type = 'button';
        card.setAttribute('aria-label', `Frase ${ex.frase}`);

        const immagini = (ex.elementi || [])
            .map(el => `<img class="r-${el.ruolo}" src="${el.url}" alt="${el.testo}">`)
            .join('');

        card.innerHTML = `
            <div class="uex-immagini">${immagini}</div>
            <div class="uex-frase">${ex.frase}</div>
        `;
        card.onclick = () => startExerciseFrom(ex);
        container.appendChild(card);
    });

    document.getElementById('exerciseArea').classList.add('hidden');
    document.getElementById('sideMenuToggle').classList.add('hidden');
    document.getElementById('exerciseChooser').classList.remove('hidden');
    document.querySelector('.app-main').classList.remove('hidden');
}

function backToChooser() {
    if ('speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    cancelAutoAdvance();
    state.currentConfig = null;
    state.completed = false;
    state.errori = 0;
    document.getElementById('celebrationOverlay').classList.remove('active');
    renderChooser();
}

// ===== AVVIO ESERCIZIO =====
function startExerciseFrom(config) {
    cancelAutoAdvance();

    state.currentConfig = config;
    state.indiceCorrente = 0;
    state.inserite = [];
    state.errori = 0;
    state.completed = false;
    state.startTime = Date.now();

    document.querySelector('.app-main').classList.add('hidden');
    document.getElementById('exerciseChooser').classList.add('hidden');
    document.getElementById('noConfigMessage').classList.add('hidden');
    document.getElementById('exerciseArea').classList.remove('hidden');
    document.getElementById('sideMenuToggle').classList.remove('hidden');
    document.getElementById('celebrationOverlay').classList.remove('active');
    document.getElementById('erroriCount').textContent = '0';

    // Svuota i tre box della frase
    RUOLI.forEach((ruolo, idx) => {
        const slot = document.getElementById(`slot-${idx}`);
        slot.classList.remove('riempito', 'drag-over', 'errore');
        slot.innerHTML = `
            <span class="slot-label">${['Chi?', 'Fa che cosa?', 'Che cosa?'][idx]}</span>
            <div class="slot-hint">
                <i class="bi bi-${idx + 1}-circle"></i>
                <span>${NOMI_RUOLO[ruolo].charAt(0).toUpperCase() + NOMI_RUOLO[ruolo].slice(1)}</span>
            </div>
        `;
    });

    // Costruisce i tre pittogrammi e li mescola
    const elementi = Array.isArray(config.elementi) ? [...config.elementi] : [];
    shuffleArray(elementi);

    const row = document.getElementById('pictosRow');
    row.innerHTML = '';
    elementi.forEach((el, idx) => row.appendChild(createPictoTile(el, idx, parseInt(config.mostra_testo) === 1)));

    applicaBordi();
    aggiornaSlotAttivo();
    aggiornaFraseTesto();

    setTimeout(() => speakConsegna(), 500);
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function resetExercise() {
    if (!state.currentConfig) {
        backToChooser();
        return;
    }
    startExerciseFrom(state.currentConfig);
}

/** Evidenzia il box da riempire adesso e blocca quelli successivi */
function aggiornaSlotAttivo() {
    RUOLI.forEach((ruolo, idx) => {
        const slot = document.getElementById(`slot-${idx}`);
        slot.classList.toggle('attivo', idx === state.indiceCorrente && !state.completed);
        slot.classList.toggle('bloccato', idx > state.indiceCorrente && !state.completed);
    });
}

/** Riga di testo con le parole già collocate e i posti ancora vuoti */
function aggiornaFraseTesto() {
    const el = document.getElementById('fraseTesto');
    if (!state.currentConfig) { el.innerHTML = ''; return; }

    const parti = state.currentConfig.elementi.map((elemento, idx) => {
        if (idx < state.indiceCorrente) {
            return `<span class="p-${elemento.ruolo}">${elemento.testo}</span>`;
        }
        return '<span class="parola-vuota">_____</span>';
    });

    el.innerHTML = parti.join(' ');
}

// ===== PITTOGRAMMI TRASCINABILI =====
function createPictoTile(elemento, idx, mostraTesto) {
    const tile = document.createElement('div');
    tile.className = `picto-tile picto-${elemento.ruolo}`;
    tile.draggable = true;
    tile.dataset.ruolo = elemento.ruolo;
    tile.dataset.idx = idx;
    tile.tabIndex = 0;
    tile.setAttribute('role', 'button');
    tile.setAttribute('aria-label', elemento.testo);

    tile.innerHTML = `
        <img src="${elemento.url}" alt="${elemento.testo}" draggable="false">
        ${mostraTesto ? `<div class="picto-word">${elemento.testo}</div>` : ''}
    `;

    let ghost = null;
    let touchStartX = 0, touchStartY = 0;
    let didTouchDrag = false;
    let suppressClickUntil = 0;

    const TAP_THRESHOLD = 8;

    // Tap/click: il pittogramma va nel box attivo (per chi non riesce a trascinare)
    tile.addEventListener('click', (e) => {
        if (Date.now() < suppressClickUntil) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (state.completed) return;
        valutaInserimento(tile, state.indiceCorrente);
    });

    tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!state.completed) valutaInserimento(tile, state.indiceCorrente);
        }
    });

    // ===== DRAG & DROP HTML5 (mouse) =====
    tile.addEventListener('dragstart', (e) => {
        if (state.completed) { e.preventDefault(); return; }
        tile.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
        currentDragTile = tile;
    });

    tile.addEventListener('dragend', () => {
        tile.classList.remove('dragging');
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('drag-over'));
        currentDragTile = null;
    });

    // ===== TOUCH (tablet/smartphone) =====
    tile.addEventListener('touchstart', (e) => {
        if (state.completed) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        didTouchDrag = false;

        const rect = tile.getBoundingClientRect();
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.innerHTML = tile.innerHTML;
        ghost.style.width = rect.width + 'px';
        ghost.style.height = rect.height + 'px';
        ghost.style.left = (touch.clientX - rect.width / 2) + 'px';
        ghost.style.top = (touch.clientY - rect.height / 2) + 'px';
        ghost.style.display = 'none';
        document.body.appendChild(ghost);
    }, { passive: true });

    tile.addEventListener('touchmove', (e) => {
        if (!ghost) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;

        if (!didTouchDrag && (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD)) {
            didTouchDrag = true;
            ghost.style.display = 'flex';
            tile.classList.add('dragging');
        }
        if (!didTouchDrag) return;

        e.preventDefault();
        const gw = ghost.offsetWidth, gh = ghost.offsetHeight;
        ghost.style.left = (touch.clientX - gw / 2) + 'px';
        ghost.style.top = (touch.clientY - gh / 2) + 'px';

        const slotSotto = slotDaPunto(touch.clientX, touch.clientY);
        document.querySelectorAll('.slot').forEach(s => {
            s.classList.toggle('drag-over', slotSotto !== null && s.id === `slot-${slotSotto}`);
        });
    }, { passive: false });

    tile.addEventListener('touchend', (e) => {
        if (!ghost) return;
        const touch = e.changedTouches[0];
        ghost.remove();
        ghost = null;
        tile.classList.remove('dragging');
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('drag-over'));

        if (didTouchDrag) {
            suppressClickUntil = Date.now() + 500;
            const slotSotto = slotDaPunto(touch.clientX, touch.clientY);
            if (slotSotto !== null) {
                valutaInserimento(tile, slotSotto);
            }
        }
        didTouchDrag = false;
    });

    tile.addEventListener('touchcancel', () => {
        if (ghost) { ghost.remove(); ghost = null; }
        tile.classList.remove('dragging');
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('drag-over'));
        if (didTouchDrag) suppressClickUntil = Date.now() + 500;
        didTouchDrag = false;
    });

    return tile;
}

/** Indice del box sotto le coordinate indicate, oppure null */
function slotDaPunto(x, y) {
    const el = document.elementFromPoint(x, y);
    const slot = el && el.closest('.slot');
    if (!slot) return null;
    return parseInt(slot.id.replace('slot-', ''));
}

// ===== BOX DI DESTINAZIONE =====
function setupSlots() {
    RUOLI.forEach((ruolo, idx) => {
        const slot = document.getElementById(`slot-${idx}`);

        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            slot.classList.add('drag-over');
        });

        slot.addEventListener('dragleave', (e) => {
            if (e.relatedTarget && slot.contains(e.relatedTarget)) return;
            slot.classList.remove('drag-over');
        });

        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');

            const tileIdx = e.dataTransfer.getData('text/plain');
            const tile = document.querySelector(`.picto-tile[data-idx="${tileIdx}"]`) || currentDragTile;
            if (tile) valutaInserimento(tile, idx);
        });
    });
}

// ===== VALUTAZIONE =====
function valutaInserimento(tile, indiceSlot) {
    if (state.completed || !state.currentConfig) return;
    if (tile.classList.contains('placed')) return;

    // La sequenza è rigida: si riempie un box alla volta, da sinistra
    if (indiceSlot !== state.indiceCorrente) {
        const atteso = RUOLI[state.indiceCorrente];
        segnalaErrore(
            tile,
            indiceSlot,
            'Non qui',
            `Prima riempi il ${ETICHETTE_RUOLO[atteso]}`,
            `No. Prima il ${ETICHETTE_RUOLO[atteso]}`
        );
        return;
    }

    const ruoloAtteso = RUOLI[state.indiceCorrente];

    if (tile.dataset.ruolo !== ruoloAtteso) {
        segnalaErrore(
            tile,
            indiceSlot,
            'Non è questo',
            `Nel ${ETICHETTE_RUOLO[ruoloAtteso]} va il ${NOMI_RUOLO[ruoloAtteso]}`,
            'No, riprova'
        );
        return;
    }

    inserisciCorretto(tile, indiceSlot, ruoloAtteso);
}

function inserisciCorretto(tile, indiceSlot, ruolo) {
    const elemento = state.currentConfig.elementi.find(el => el.ruolo === ruolo);
    const slot = document.getElementById(`slot-${indiceSlot}`);

    slot.classList.remove('attivo', 'errore');
    slot.classList.add('riempito');
    slot.innerHTML = `
        <span class="slot-label">${['Chi?', 'Fa che cosa?', 'Che cosa?'][indiceSlot]}</span>
        <img src="${elemento.url}" alt="${elemento.testo}">
        <div class="slot-word">${elemento.testo}</div>
    `;

    tile.classList.add('placed');
    document.querySelectorAll('.picto-tile').forEach(t => t.classList.remove('hint'));

    state.inserite.push(elemento.testo);
    state.indiceCorrente += 1;

    playPlaceSound();
    speak(elemento.testo);

    aggiornaFraseTesto();

    if (state.indiceCorrente >= RUOLI.length) {
        // Piccola pausa per non sovrapporre l'ultima parola alla frase intera
        setTimeout(() => fraseCompletata(), 900);
    } else {
        aggiornaSlotAttivo();
    }
}

function segnalaErrore(tile, indiceSlot, titolo, messaggio, vocale) {
    const now = Date.now();
    if (now - lastErrorTime < COOLDOWN_ERRORE) return;
    lastErrorTime = now;

    state.errori += 1;
    document.getElementById('erroriCount').textContent = state.errori;

    tile.classList.remove('shake');
    void tile.offsetWidth;
    tile.classList.add('shake');
    setTimeout(() => tile.classList.remove('shake'), 600);

    const slot = document.getElementById(`slot-${indiceSlot}`);
    if (slot) {
        slot.classList.add('errore');
        setTimeout(() => slot.classList.remove('errore'), 600);
    }

    playErrorSound();
    speak(vocale);
    showErrorOverlay(titolo, messaggio);

    // Aiuto: dopo N errori evidenzia il pittogramma giusto
    if (state.aiutoAbilitato && state.errori >= ERRORI_PER_AIUTO) {
        const ruoloAtteso = RUOLI[state.indiceCorrente];
        document.querySelectorAll('.picto-tile').forEach(t => {
            t.classList.toggle('hint', t.dataset.ruolo === ruoloAtteso && !t.classList.contains('placed'));
        });
    }
}

function fraseCompletata() {
    state.completed = true;
    aggiornaSlotAttivo();

    const frase = state.currentConfig.frase;
    const rinforzo = state.gender === 'F' ? 'Brava' : 'Bravo';

    playSuccessSound();
    launchConfetti();

    // Prima la frase intera, poi il rinforzo
    speak(frase);
    setTimeout(() => speak(`${rinforzo}!`), Math.max(1400, frase.length * 90));

    const tempo = Math.max(0, Math.round((Date.now() - state.startTime) / 1000));
    salvaRisultato(tempo, frase);

    document.getElementById('bravoText').textContent = `${rinforzo.toUpperCase()}!`;
    document.getElementById('fraseCompleta').textContent = frase;
    document.getElementById('celebrationDetail').textContent = state.errori === 0
        ? 'Frase completata senza errori!'
        : `Frase completata dopo ${state.errori} error${state.errori === 1 ? 'e' : 'i'}`;

    setTimeout(() => {
        document.getElementById('celebrationOverlay').classList.add('active');
        if (state.autoAdvance) {
            cancelAutoAdvance();
            state.autoAdvanceTimer = setTimeout(() => goToRandomExercise(), 6000);
        }
    }, 1200);
}

/**
 * Bottone "Ripeti la frase": enuncia la frase da comporre.
 * Serve all'utente che non l'ha capita bene, quindi ripete il modello da
 * costruire — non la consegna e non la parte già composta.
 */
function ripetiFrase() {
    if (!state.currentConfig) return;

    if (!state.voceAbilitata) setVoce(true);
    cancelAutoAdvance();

    speak(state.currentConfig.frase);
}

function salvaRisultato(tempoSecondi, frase) {
    if (!state.currentConfig) return;

    try {
        Archivio.salvaRisultato({
            id_config: state.currentConfig.id_config,
            frase: frase,
            errori: state.errori,
            tempo_secondi: tempoSecondi
        });
    } catch (e) {
        console.warn('[Risultato] Non salvato:', e);
        showToast(e.message || 'Risultato non salvato', 'error');
    }
}

// ===== AVANZAMENTO =====
function cancelAutoAdvance() {
    if (state.autoAdvanceTimer) {
        clearTimeout(state.autoAdvanceTimer);
        state.autoAdvanceTimer = null;
    }
}

function pickRandomExercise() {
    const list = state.exercises || [];
    if (list.length === 0) return null;
    if (list.length === 1) return list[0];

    let candidati = list;
    if (state.currentConfig) {
        const diversi = list.filter(ex => ex.id_config !== state.currentConfig.id_config);
        if (diversi.length > 0) candidati = diversi;
    }
    return candidati[Math.floor(Math.random() * candidati.length)];
}

function goToRandomExercise() {
    cancelAutoAdvance();
    document.getElementById('celebrationOverlay').classList.remove('active');
    const next = pickRandomExercise();
    if (next) {
        startExerciseFrom(next);
    } else {
        backToChooser();
    }
}

function closeCelebration() {
    cancelAutoAdvance();
    document.getElementById('celebrationOverlay').classList.remove('active');
    if (state.currentConfig) startExerciseFrom(state.currentConfig);
}

function closeCelebrationToChooser() {
    cancelAutoAdvance();
    backToChooser();
}

// ===== MENU IMPOSTAZIONI =====
function toggleSideMenu() {
    const menu = document.getElementById('sideMenu');
    const backdrop = document.getElementById('sideMenuBackdrop');
    if (!menu || !backdrop) return;

    const isOpen = menu.classList.contains('active');
    menu.classList.toggle('active', !isOpen);
    backdrop.classList.toggle('active', !isOpen);
}

function onGenderChange() {
    const checked = document.querySelector('input[name="genderRinforzo"]:checked');
    state.gender = checked ? checked.value : 'M';
}

function onRateChange() {
    const slider = document.getElementById('rateSlider');
    if (!slider) return;
    const v = parseInt(slider.value);
    state.rate = v / 100;

    const etichetta = v <= 75 ? 'Lenta' : (v >= 110 ? 'Veloce' : 'Normale');
    document.getElementById('rateValue').textContent = `${etichetta} (${v}%)`;
}

function onScaleChange() {
    const slider = document.getElementById('scaleSlider');
    if (!slider) return;
    let v = parseInt(slider.value);
    if (isNaN(v) || v < 70) v = 70;
    if (v > 130) v = 130;
    document.documentElement.style.setProperty('--scala-box', (v / 100).toFixed(2));
    document.getElementById('scaleValue').textContent = `${v}%`;
}

// Dimensione del testo (parola) nel box sotto le immagini
function applicaScalaTesto(v, salva) {
    if (isNaN(v) || v < 100) v = 100;
    if (v > 300) v = 300;
    document.documentElement.style.setProperty('--scala-testo', (v / 100).toFixed(2));
    const label = document.getElementById('fontTestoValue');
    if (label) label.textContent = `${v}%`;
    const slider = document.getElementById('fontTestoSlider');
    if (slider) slider.value = v;
    if (salva) {
        try { localStorage.setItem(STORAGE_FONT_TESTO, String(v)); } catch (e) {}
    }
}

function onFontTestoChange() {
    const slider = document.getElementById('fontTestoSlider');
    if (!slider) return;
    applicaScalaTesto(parseInt(slider.value), true);
}

function caricaPreferenzaFontTesto() {
    let v = 100;
    try {
        const salvato = localStorage.getItem(STORAGE_FONT_TESTO);
        if (salvato !== null) v = parseInt(salvato);
    } catch (e) {}
    applicaScalaTesto(v, false);
}

// ===== SALVATAGGIO/CARICAMENTO DI TUTTE LE IMPOSTAZIONI DEL MENU =====
function salvaImpostazioni() {
    const genderSel = document.querySelector('input[name="genderRinforzo"]:checked');
    const prefs = {
        scaleBox: document.getElementById('scaleSlider')?.value,
        scalaTesto: document.getElementById('fontTestoSlider')?.value,
        rate: document.getElementById('rateSlider')?.value,
        gender: genderSel ? genderSel.value : null,
        aiuto: document.getElementById('hintCheck')?.checked,
        autoAdvance: document.getElementById('autoAdvanceCheck')?.checked,
        voce: document.getElementById('voceCheck')?.checked,
        bordi: document.getElementById('bordiCheck')?.checked
    };
    try { localStorage.setItem(STORAGE_IMPOSTAZIONI, JSON.stringify(prefs)); } catch (e) {}
    showToast('Impostazioni salvate', 'success');
}

function caricaImpostazioni() {
    let prefs = null;
    try { prefs = JSON.parse(localStorage.getItem(STORAGE_IMPOSTAZIONI) || 'null'); } catch (e) {}
    if (!prefs) return;

    if (prefs.scaleBox != null) {
        const s = document.getElementById('scaleSlider');
        if (s) { s.value = prefs.scaleBox; onScaleChange(); }
    }
    if (prefs.scalaTesto != null) {
        const s = document.getElementById('fontTestoSlider');
        if (s) { s.value = prefs.scalaTesto; applicaScalaTesto(parseInt(prefs.scalaTesto), false); }
    }
    if (prefs.rate != null) {
        const s = document.getElementById('rateSlider');
        if (s) { s.value = prefs.rate; onRateChange(); }
    }
    if (prefs.gender != null) {
        const r = document.querySelector(`input[name="genderRinforzo"][value="${prefs.gender}"]`);
        if (r) { r.checked = true; onGenderChange(); }
    }
    if (prefs.aiuto != null) {
        const c = document.getElementById('hintCheck');
        if (c) { c.checked = prefs.aiuto; onHintChange(); }
    }
    if (prefs.autoAdvance != null) {
        const c = document.getElementById('autoAdvanceCheck');
        if (c) { c.checked = prefs.autoAdvance; onAutoAdvanceChange(); }
    }
    if (prefs.voce != null) {
        const c = document.getElementById('voceCheck');
        if (c) { c.checked = prefs.voce; onVoceCheckChange(); }
    }
    if (prefs.bordi != null) {
        setBordi(!!prefs.bordi);
    }
}

function onHintChange() {
    const check = document.getElementById('hintCheck');
    state.aiutoAbilitato = check ? check.checked : true;
    if (!state.aiutoAbilitato) {
        document.querySelectorAll('.picto-tile').forEach(t => t.classList.remove('hint'));
    }
}

function onAutoAdvanceChange() {
    const check = document.getElementById('autoAdvanceCheck');
    state.autoAdvance = check ? check.checked : true;
    if (!state.autoAdvance) cancelAutoAdvance();
}

function onVoceCheckChange() {
    const check = document.getElementById('voceCheck');
    setVoce(check ? check.checked : true);
}

// ===== INDIZIO COLORE DEI BORDI =====
function caricaPreferenzaBordi() {
    try {
        const salvato = localStorage.getItem(STORAGE_BORDI);
        // Default: bordi colorati (indizio presente per i principianti)
        state.bordiColorati = salvato === null ? true : salvato === '1';
    } catch (e) {
        state.bordiColorati = true;
    }
    applicaBordi();
    sincronizzaControlliBordi();
}

/** Applica lo stato alla board: la classe vive sul contenitore stabile */
function applicaBordi() {
    const board = document.getElementById('exerciseArea');
    if (board) board.classList.toggle('bordi-neutri', !state.bordiColorati);
}

/** Allinea bottone header e checkbox del menu allo stato corrente */
function sincronizzaControlliBordi() {
    const btn = document.getElementById('btnBordi');
    const icon = document.getElementById('iconBordi');
    const check = document.getElementById('bordiCheck');

    if (btn) {
        btn.classList.toggle('attivo', !state.bordiColorati);
        btn.title = state.bordiColorati
            ? 'Nascondi l\'indizio colore (bordi neri)'
            : 'Mostra l\'indizio colore (bordi colorati)';
    }
    if (icon) icon.className = state.bordiColorati ? 'bi bi-palette-fill' : 'bi bi-palette';
    if (check) check.checked = state.bordiColorati;
}

function setBordi(colorati) {
    state.bordiColorati = colorati;
    try { localStorage.setItem(STORAGE_BORDI, colorati ? '1' : '0'); } catch (e) {}
    applicaBordi();
    sincronizzaControlliBordi();
}

/** Bottone nell'header */
function toggleBordi() {
    setBordi(!state.bordiColorati);
    showToast(
        state.bordiColorati ? 'Bordi colorati: indizio attivo' : 'Bordi neri: senza indizio colore',
        'info'
    );
}

/** Checkbox nel menu impostazioni */
function onBordiCheckChange() {
    const check = document.getElementById('bordiCheck');
    setBordi(check ? check.checked : true);
}

// ===== VOCE =====
function toggleVoce() {
    setVoce(!state.voceAbilitata);
}

function setVoce(abilitata) {
    state.voceAbilitata = abilitata;

    const btn = document.getElementById('btnVoce');
    const icon = document.getElementById('iconVoce');
    const check = document.getElementById('voceCheck');

    if (btn)  btn.classList.toggle('muted', !abilitata);
    if (icon) icon.className = abilitata ? 'bi bi-volume-up-fill' : 'bi bi-volume-mute-fill';
    if (check) check.checked = abilitata;

    if (!abilitata && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
    }
}

function speak(text) {
    if (!state.voceAbilitata) return;
    if (!('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'it-IT';
        utter.rate = state.rate;
        utter.pitch = 1.05;
        utter.volume = 1.0;
        window.speechSynthesis.speak(utter);
    } catch (e) { console.warn('TTS errore:', e); }
}

/** Consegna parlata: annuncia la frase da comporre */
function speakConsegna(manualClick = false) {
    if (manualClick && !state.voceAbilitata) setVoce(true);

    if (state.currentConfig) {
        speak(`Componi la frase: ${state.currentConfig.frase}`);
        return;
    }

    speak('Componi la frase. Trascina le immagini nei box colorati');
}

// ===== OVERLAY ERRORE =====
function showErrorOverlay(titolo, messaggio) {
    const overlay = document.getElementById('errorOverlay');
    if (!overlay) return;

    if (titolo)    document.getElementById('errorTitle').textContent = titolo;
    if (messaggio) document.getElementById('errorMessage').textContent = messaggio;

    overlay.classList.add('active');
    clearTimeout(window.__errorOverlayTimer);
    window.__errorOverlayTimer = setTimeout(() => {
        overlay.classList.remove('active');
    }, 1600);
}

// ===== EFFETTI =====
function launchConfetti() {
    const colors = ['#1565C0', '#C62828', '#2E7D32', '#673AB7', '#FF9800', '#FFEB3B'];
    for (let i = 0; i < 60; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.className = 'confetti';
            c.style.left = Math.random() * 100 + 'vw';
            c.style.background = colors[Math.floor(Math.random() * colors.length)];
            c.style.animationDelay = (Math.random() * 0.5) + 's';
            c.style.animationDuration = (2 + Math.random() * 2) + 's';
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 4000);
        }, i * 30);
    }
}

/** Piccolo "clack" quando un pittogramma entra nel box */
function playPlaceSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.16, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.2);
        setTimeout(() => ctx.close(), 400);
    } catch (e) { /* ignora */ }
}

function playErrorSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.start(t);
        osc.stop(t + 0.34);
        setTimeout(() => ctx.close(), 600);
    } catch (e) { /* ignora */ }
}

function playSuccessSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [523.25, 659.25, 783.99, 1046.50];
        const startTime = ctx.currentTime;
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.connect(gain);
            gain.connect(ctx.destination);
            const t = startTime + i * 0.12;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.start(t);
            osc.stop(t + 0.32);
        });
        setTimeout(() => ctx.close(), 2000);
    } catch (e) { /* ignora */ }
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
    }, 2800);
}

// La freccia ← dice sempre dove porta (cambia quando si apre o si chiude un esercizio)
document.addEventListener('DOMContentLoaded', () => {
    const freccia = document.querySelector('.btn-back');
    if (!freccia) return;
    const aggiorna = () => {
        const testo = (state.currentConfig) ? 'Torna a: scelta dell\'esercizio' : 'Torna a: Frase minima';
        freccia.title = testo;
        freccia.setAttribute('aria-label', testo);
    };
    ['pointerenter', 'focus', 'pointerdown'].forEach(ev => freccia.addEventListener(ev, aggiorna));
    aggiorna();
});
