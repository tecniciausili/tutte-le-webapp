/**
 * Scrivo Parole con le Lettere - Area Utente (Esercizio)
 * AssistiveTech.it - Training Cognitivo
 */

// =====================================================
// CONFIGURAZIONE
// =====================================================
// App autonoma: nessun server, nessun login. Un dispositivo = un utente.
// Esercizi, impostazioni e risultati stanno in localStorage (vedi js/archivio.js).

// =====================================================
// STATO APPLICAZIONE
// =====================================================
let appState = {
    // Font config (taratura del portale: qui non c'è, si usano i default + menu laterale)
    fontConfig: null,
    
    // Esercizi disponibili
    exercises: [],
    usedExercisesIndices: [], // Per evitare ripetizioni
    currentExercise: null,
    currentExerciseIndex: -1,
    
    // Impostazioni
    settings: {
        numero_prove: 10,
        tasto_cancella_visibile: false,
        genere_feedback: 'maschile'
    },
    
    // Sessione
    sessionId: null,
    totalTrials: 10,
    currentTrial: 0,
    results: [],
    
    // Risposta corrente
    currentAnswer: [],
    
    // Stato
    isStarted: false,
    trialStartTime: null,
    
    // TTS
    synth: window.speechSynthesis,
    selectedVoice: null
};

// =====================================================
// INIZIALIZZAZIONE
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Esercizio] Inizializzazione...');
    avviaApp();
    initTTS();
    loadSavedPreferences();
    initKeyboardInput();
});

function initTTS() {
    if (!appState.synth) {
        console.warn('[TTS] Speech Synthesis non supportato');
        return;
    }
    
    const loadVoices = () => {
        const voices = appState.synth.getVoices();
        appState.selectedVoice = voices.find(v => v.lang.startsWith('it')) || voices[0];
        console.log('[TTS] Voce:', appState.selectedVoice?.name);
    };
    
    if (appState.synth.getVoices().length > 0) {
        loadVoices();
    } else {
        appState.synth.addEventListener('voiceschanged', loadVoices);
    }
}

// =====================================================
// NAVIGAZIONE
// =====================================================
function goHome() {
    if (appState.isStarted && !confirm('Vuoi davvero uscire? I progressi saranno persi.')) {
        return;
    }
    window.location.href = window.RACCOLTA ? window.RACCOLTA.url : '../';   // Tutte le Web App (indice della raccolta)
}

function goBack() {
    if (appState.isStarted && !confirm('Vuoi davvero uscire? I progressi saranno persi.')) {
        return;
    }
    window.location.href = './';   // pagina iniziale di Scrivo parole con le lettere
}

// =====================================================
// AVVIO (niente scelta utente: un dispositivo = un utente)
// =====================================================
function avviaApp() {
    appState.fontConfig = null;
    loadSettings();
    loadExercises();

    if (appState.exercises.length === 0) {
        document.getElementById('noExercisesMessage').style.display = 'block';
        hideExerciseArea();
        return;
    }
    document.getElementById('noExercisesMessage').style.display = 'none';
    showExerciseArea();
}

function applyFontConfig() {
    const stimulusDisplay = document.getElementById('stimulusDisplay');
    const stimulusWord = document.querySelector('.stimulus-word');

    if (stimulusDisplay) {
        if (appState.fontConfig) {
            stimulusDisplay.style.backgroundColor = appState.fontConfig.colore_sfondo || '#FFFFFF';
        } else {
            stimulusDisplay.style.backgroundColor = '#FFFFFF';
        }
    }

    // Applica font solo se c'è testo (nessuna immagine)
    if (stimulusWord) {
        if (appState.fontConfig) {
            const config = appState.fontConfig;
            stimulusWord.style.fontFamily = config.font_family || 'Arial';
            stimulusWord.style.fontSize = `${config.font_size_pt || 36}pt`;
            stimulusWord.style.fontWeight = config.font_weight || 'bold';
            stimulusWord.style.color = config.colore_testo || '#000000';
            stimulusWord.style.letterSpacing = `${config.letter_spacing_em || 0.15}em`;
        } else {
            stimulusWord.style.fontFamily = 'Arial, sans-serif';
            stimulusWord.style.fontSize = '3rem';
            stimulusWord.style.fontWeight = 'bold';
            stimulusWord.style.color = 'var(--primary-color)';
            stimulusWord.style.textTransform = 'uppercase';
        }
    }
}

// =====================================================
// CARICAMENTO IMPOSTAZIONI E ESERCIZI
// =====================================================
function loadSettings() {
    const s = Archivio.getImpostazioni();
    appState.settings = {
        numero_prove: s.numero_prove || 10,
        tasto_cancella_visibile: s.tasto_cancella_visibile == 1,
        genere_feedback: s.genere_feedback === 'femminile' ? 'femminile' : 'maschile'
    };
    appState.totalTrials = appState.settings.numero_prove;

    document.getElementById('totalTrials').textContent = appState.totalTrials;

    // Mostra/nascondi tasto cancella
    const btnBackspace = document.getElementById('btnBackspace');
    if (btnBackspace) {
        btnBackspace.style.display = appState.settings.tasto_cancella_visibile ? 'inline-block' : 'none';
    }
}

function loadExercises() {
    appState.exercises = Archivio.getConfigList();
    console.log(`[Exercises] Caricati ${appState.exercises.length} esercizi`);
}

// =====================================================
// UI HELPERS
// =====================================================
function showExerciseArea() {
    annullaAvanzamentoAutomatico();
    document.getElementById('exerciseToolbar').style.display = 'flex';
    document.getElementById('exercisePlaceholder').style.display = 'block';
    document.getElementById('exerciseArea').style.display = 'none';
    
    appState.isStarted = false;
    appState.currentTrial = 0;
    appState.results = [];
    appState.usedExercisesIndices = [];
    appState.sessionId = `session_lettere_${Date.now()}`;
    
    document.getElementById('currentTrial').textContent = '0';
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnNext').disabled = true;
}

function hideExerciseArea() {
    document.getElementById('exerciseToolbar').style.display = 'none';
    document.getElementById('exercisePlaceholder').style.display = 'none';
    document.getElementById('exerciseArea').style.display = 'none';
}

// =====================================================
// LOGICA ESERCIZIO
// =====================================================
function startExercise() {
    appState.isStarted = true;
    appState.currentTrial = 0;
    appState.results = [];
    appState.usedExercisesIndices = [];
    
    document.getElementById('btnStart').disabled = true;
    document.getElementById('exercisePlaceholder').style.display = 'none';
    document.getElementById('exerciseArea').style.display = 'flex';
    
    // Applica configurazione font
    applyFontConfig();
    
    nextExercise();
}

// =====================================================
// AVANZAMENTO AUTOMATICO (timer tra un esercizio e il prossimo)
// =====================================================
const AUTO_ADVANCE_DEFAULT = 3;   // secondi
const AUTO_ADVANCE_MIN = 2;
const AUTO_ADVANCE_MAX = 10;
let autoAdvanceIntervalId = null;

// Attivo di default: solo un esplicito '0' in localStorage lo disattiva
function isAutoAdvanceEnabled() {
    return localStorage.getItem('scrivo_auto_advance_enabled') !== '0';
}

function getAutoAdvanceSeconds() {
    const v = parseInt(localStorage.getItem('scrivo_auto_advance'), 10);
    if (!Number.isFinite(v)) return AUTO_ADVANCE_DEFAULT;
    return Math.min(AUTO_ADVANCE_MAX, Math.max(AUTO_ADVANCE_MIN, v));
}

// Mostra il conto alla rovescia sul bottone "Avanti"
function aggiornaCountdownAvanti(secondi) {
    const badge = document.getElementById('btnNextCountdown');
    if (badge) badge.textContent = (secondi && secondi > 0) ? ` (${secondi})` : '';
}

function annullaAvanzamentoAutomatico() {
    if (autoAdvanceIntervalId) {
        clearInterval(autoAdvanceIntervalId);
        autoAdvanceIntervalId = null;
    }
    aggiornaCountdownAvanti(null);
}

// Avvia il conto alla rovescia: allo scadere passa al prossimo esercizio
function avviaAvanzamentoAutomatico() {
    annullaAvanzamentoAutomatico();
    if (!isAutoAdvanceEnabled()) return;

    let rimasti = getAutoAdvanceSeconds();
    aggiornaCountdownAvanti(rimasti);
    autoAdvanceIntervalId = setInterval(() => {
        rimasti--;
        if (rimasti <= 0) {
            annullaAvanzamentoAutomatico();
            nextExercise();
        } else {
            aggiornaCountdownAvanti(rimasti);
        }
    }, 1000);
}

// Handler dello slider (durata 2-10 sec) nel menu impostazioni
function updateAutoAdvance(value) {
    const v = Math.min(AUTO_ADVANCE_MAX, Math.max(AUTO_ADVANCE_MIN,
        parseInt(value, 10) || AUTO_ADVANCE_DEFAULT));
    localStorage.setItem('scrivo_auto_advance', v);
    const label = document.getElementById('autoAdvanceValue');
    if (label) label.textContent = v;
}

// Handler del toggle "Avanzamento Automatico" nel menu impostazioni
function toggleAutoAdvance() {
    const chk = document.getElementById('chkAutoAdvance');
    const menu = document.getElementById('autoAdvanceMenu');
    const attivo = chk ? chk.checked : true;
    localStorage.setItem('scrivo_auto_advance_enabled', attivo ? '1' : '0');
    if (menu) menu.style.display = attivo ? 'block' : 'none';
    if (!attivo) annullaAvanzamentoAutomatico();
}

function nextExercise() {
    annullaAvanzamentoAutomatico();
    appState.currentTrial++;
    
    if (appState.currentTrial > appState.totalTrials) {
        endSession();
        return;
    }
    
    document.getElementById('currentTrial').textContent = appState.currentTrial;
    document.getElementById('btnNext').disabled = true;
    
    // Seleziona esercizio random non ancora usato
    appState.currentExerciseIndex = getRandomUnusedExerciseIndex();
    appState.currentExercise = appState.exercises[appState.currentExerciseIndex];
    appState.usedExercisesIndices.push(appState.currentExerciseIndex);
    
    // Reset risposta
    appState.currentAnswer = [];
    appState.tentativi = 0;
    appState.correzioneInCorso = false;
    appState.trialStartTime = Date.now();
    
    displayExercise();
}

function getRandomUnusedExerciseIndex() {
    // Se tutti gli esercizi sono stati usati, reset
    if (appState.usedExercisesIndices.length >= appState.exercises.length) {
        console.log('[Exercises] Tutti usati, reset');
        appState.usedExercisesIndices = [];
    }
    
    // Trova indici disponibili
    const availableIndices = [];
    for (let i = 0; i < appState.exercises.length; i++) {
        if (!appState.usedExercisesIndices.includes(i)) {
            availableIndices.push(i);
        }
    }
    
    const randomIndex = Math.floor(Math.random() * availableIndices.length);
    return availableIndices[randomIndex];
}

function displayExercise() {
    const exercise = appState.currentExercise;
    const stimulusContent = document.getElementById('stimulusContent');

    // Mostra immagine o parola in base al tipo
    if (exercise.tipo_immagine === 'arasaac' && exercise.id_arasaac) {
        // Pittogramma incorporato al salvataggio (offline); altrimenti dal sito ARASAAC
        const url = exercise.url_immagine
            || `https://static.arasaac.org/pictograms/${exercise.id_arasaac}/${exercise.id_arasaac}_500.png`;
        stimulusContent.innerHTML = `<img src="${url}" class="stimulus-image" alt="${exercise.parola_target}">`;
    } else if (exercise.tipo_immagine === 'upload' && exercise.url_immagine) {
        stimulusContent.innerHTML = `<img src="${exercise.url_immagine}" class="stimulus-image" alt="${exercise.parola_target}">`;
    } else {
        // Solo testo - mostra parola grande in maiuscolo
        stimulusContent.innerHTML = `<div class="stimulus-word">${exercise.parola_target}</div>`;
    }

    // Crea box risposta con placeholder hint
    const answerBoxes = document.getElementById('answerBoxes');
    answerBoxes.innerHTML = '';
    const hintVisible = document.getElementById('chkHint') && document.getElementById('chkHint').checked;

    for (let i = 0; i < exercise.parola_target.length; i++) {
        const box = document.createElement('div');
        box.className = 'answer-box';
        box.dataset.index = i;
        box.dataset.hint = exercise.parola_target[i];
        // Cursore lampeggiante sulla prima casella (solo se attivato)
        if (i === 0 && cursorEnabled) box.classList.add('active-cursor');
        // Aggiungi span hint
        const hint = document.createElement('span');
        hint.className = 'answer-hint';
        hint.textContent = exercise.parola_target[i];
        if (!hintVisible) hint.style.display = 'none';
        box.appendChild(hint);
        answerBoxes.appendChild(box);
    }

    // Mostra lettere disponibili (mescolate) con drag and drop
    const availableLetters = document.getElementById('availableLetters');
    const shuffledLetters = shuffleArray([...exercise.lettere_disponibili]);

    availableLetters.innerHTML = '';
    shuffledLetters.forEach(letter => {
        const btn = document.createElement('button');
        btn.className = 'letter-btn';
        btn.textContent = letter;
        btn.draggable = true;
        btn.dataset.letter = letter;

        // Click
        btn.onclick = () => selectLetter(letter);

        // Drag events (desktop)
        btn.addEventListener('dragstart', handleDragStart);
        btn.addEventListener('dragend', handleDragEnd);

        // Touch events (mobile/tablet)
        btn.addEventListener('touchstart', handleTouchStart, { passive: false });
        btn.addEventListener('touchmove', handleTouchMove, { passive: false });
        btn.addEventListener('touchend', handleTouchEnd);

        availableLetters.appendChild(btn);
    });

    // Configura drop zone sui box risposta
    setupDropZones();

    // Applica font config
    applyFontConfig();

    // Applica preferenze salvate (colori, dimensioni)
    applySavedPreferencesToExercise();

    // Leggi parola con TTS
    setTimeout(() => {
        speakWord(exercise.parola_target);
    }, 500);
}

function applySavedPreferencesToExercise() {
    // Font scale
    const fontScale = localStorage.getItem('scrivo_font_scale');
    if (fontScale) {
        updateFontSize(fontScale);
    }

    // Background color (sia answer box che letter buttons)
    const bgColor = localStorage.getItem('scrivo_bg_color');
    if (bgColor) {
        document.querySelectorAll('.answer-box').forEach(box => {
            box.style.backgroundColor = bgColor;
        });
        document.querySelectorAll('.letter-btn').forEach(btn => {
            btn.style.background = `linear-gradient(135deg, ${bgColor}, ${adjustColor(bgColor, -20)})`;
        });
    }

    // Text color
    const textColor = localStorage.getItem('scrivo_text_color');
    if (textColor) {
        document.querySelectorAll('.answer-box').forEach(box => {
            box.style.color = textColor;
        });
        document.querySelectorAll('.letter-btn').forEach(btn => {
            btn.style.color = textColor;
        });
    }

    // Hint visibility e intensity
    const hintEnabled = localStorage.getItem('scrivo_hint_enabled') === '1';
    const hintIntensity = localStorage.getItem('scrivo_hint_intensity');

    document.querySelectorAll('.answer-hint').forEach(hint => {
        hint.style.display = hintEnabled ? '' : 'none';
        if (hintEnabled && hintIntensity) {
            const intensity = Math.round((hintIntensity / 100) * 255);
            const gray = 255 - intensity;
            hint.style.color = `rgb(${gray}, ${gray}, ${gray})`;
        }
    });
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// =====================================================
// DRAG AND DROP
// =====================================================
let draggedLetter = null;
let draggedElement = null;
let touchClone = null;
let touchStartX = 0;
let touchStartY = 0;
const TAP_THRESHOLD = 10; // pixel di tolleranza per distinguere tap da drag

function setupDropZones() {
    const answerArea = document.querySelector('.answer-area');

    // Drop su tutta l'area risposta (desktop)
    answerArea.addEventListener('dragover', handleDragOver);
    answerArea.addEventListener('drop', handleDrop);
    answerArea.addEventListener('dragleave', handleDragLeave);
}

// --- DESKTOP DRAG EVENTS ---
function handleDragStart(e) {
    draggedLetter = e.target.dataset.letter;
    draggedElement = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedLetter);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.answer-box').forEach(box => {
        box.classList.remove('drag-over');
    });
    draggedLetter = null;
    draggedElement = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Evidenzia il prossimo box vuoto
    const nextEmptyIndex = primaCasellaVuota();
    const boxes = document.querySelectorAll('.answer-box');
    boxes.forEach((box, i) => {
        box.classList.toggle('drag-over', i === nextEmptyIndex);
    });
}

function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
        document.querySelectorAll('.answer-box').forEach(box => {
            box.classList.remove('drag-over');
        });
    }
}

function handleDrop(e) {
    e.preventDefault();
    const letter = e.dataTransfer.getData('text/plain') || draggedLetter;
    if (letter) {
        selectLetter(letter);
    }
    document.querySelectorAll('.answer-box').forEach(box => {
        box.classList.remove('drag-over');
    });
}

// --- TOUCH EVENTS (MOBILE/TABLET) ---
function handleTouchStart(e) {
    const touch = e.touches[0];
    draggedElement = e.target;
    draggedLetter = e.target.dataset.letter;

    // Salva posizione iniziale per distinguere tap da drag
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    // Non creare subito il clone: lo creiamo solo se c'e' movimento (drag)
    touchClone = null;

    draggedElement.classList.add('dragging');
    e.preventDefault();
}

function handleTouchMove(e) {
    if (!draggedElement) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Crea il clone visivo solo quando il movimento supera la soglia (drag reale)
    if (!touchClone && distance > TAP_THRESHOLD) {
        touchClone = draggedElement.cloneNode(true);
        touchClone.classList.add('touch-dragging');
        touchClone.style.position = 'fixed';
        touchClone.style.zIndex = '9999';
        touchClone.style.pointerEvents = 'none';
        touchClone.style.opacity = '0.8';
        touchClone.style.transform = 'scale(1.1)';
        document.body.appendChild(touchClone);
    }

    if (touchClone) {
        updateTouchClonePosition(touch);

        // Evidenzia drop zone
        const answerArea = document.querySelector('.answer-area');
        const rect = answerArea.getBoundingClientRect();
        const isOverDropZone = (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
        );

        const nextEmptyIndex = primaCasellaVuota();
        const boxes = document.querySelectorAll('.answer-box');
        boxes.forEach((box, i) => {
            box.classList.toggle('drag-over', isOverDropZone && i === nextEmptyIndex);
        });
    }

    e.preventDefault();
}

function handleTouchEnd(e) {
    if (!draggedElement && !touchClone) return;

    const touch = e.changedTouches[0];

    if (touchClone) {
        // Era un drag: verifica se rilasciato sulla drop zone
        const answerArea = document.querySelector('.answer-area');
        const rect = answerArea.getBoundingClientRect();
        const isOverDropZone = (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
        );

        if (isOverDropZone && draggedLetter) {
            selectLetter(draggedLetter);
        }

        // Rimuovi clone
        if (touchClone.parentNode) {
            touchClone.parentNode.removeChild(touchClone);
        }
        touchClone = null;
    } else {
        // Era un tap (nessun clone creato = nessun movimento significativo)
        if (draggedLetter) {
            selectLetter(draggedLetter);
        }
    }

    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }
    draggedElement = null;
    draggedLetter = null;

    document.querySelectorAll('.answer-box').forEach(box => {
        box.classList.remove('drag-over');
    });
}

function updateTouchClonePosition(touch) {
    if (touchClone) {
        touchClone.style.left = (touch.clientX - 30) + 'px';
        touchClone.style.top = (touch.clientY - 30) + 'px';
    }
}

// =====================================================
// INPUT DA TASTIERA
// =====================================================
let cursorEnabled = true;

function initKeyboardInput() {
    // Carica preferenza salvata (default: attivo)
    const saved = localStorage.getItem('scrivo_cursor_enabled');
    cursorEnabled = saved !== '0';
    const chk = document.getElementById('chkCursor');
    if (chk) chk.checked = cursorEnabled;

    document.addEventListener('keydown', handleKeyboard);
}

function toggleCursor() {
    const chk = document.getElementById('chkCursor');
    cursorEnabled = chk ? chk.checked : true;
    localStorage.setItem('scrivo_cursor_enabled', cursorEnabled ? '1' : '0');

    // Aggiorna subito la visualizzazione del cursore
    document.querySelectorAll('.answer-box').forEach(box => {
        box.classList.remove('active-cursor');
    });
    if (cursorEnabled && appState.isStarted && appState.currentExercise) {
        const nextEmptyIndex = primaCasellaVuota();
        const boxes = document.querySelectorAll('.answer-box');
        if (nextEmptyIndex < boxes.length) {
            boxes[nextEmptyIndex].classList.add('active-cursor');
        }
    }
}

function handleKeyboard(e) {
    // Ignora se cursore disattivato, esercizio non attivo, o focus su input/select
    if (!cursorEnabled) return;
    if (!appState.isStarted || !appState.currentExercise) return;
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

    // Backspace: cancella ultima lettera
    if (e.key === 'Backspace') {
        e.preventDefault();
        removeLetter();
        return;
    }

    // Accetta solo lettere singole (a-z, A-Z, lettere accentate)
    if (e.key.length === 1 && /\p{L}/u.test(e.key)) {
        e.preventDefault();
        selectLetter(e.key.toUpperCase());
    }
}

// =====================================================
// SELEZIONE LETTERE
// =====================================================
/**
 * Indice della prima casella libera.
 * Dopo la cancellazione delle sole lettere sbagliate la risposta puo' avere dei
 * "buchi" in mezzo (es. [C, vuota, S, A]): la prossima lettera va nel primo buco,
 * non in fondo. Se non ci sono buchi ritorna la lunghezza della parola.
 */
function primaCasellaVuota() {
    const targetLength = appState.currentExercise.parola_target.length;
    for (let i = 0; i < targetLength; i++) {
        if (!appState.currentAnswer[i]) return i;
    }
    return targetLength;
}

/** true quando tutte le caselle sono piene (nessun buco) */
function rispostaCompleta() {
    return primaCasellaVuota() >= appState.currentExercise.parola_target.length;
}

/** La risposta come stringa, con uno spazio dove la casella e' vuota */
function rispostaTesto() {
    const targetLength = appState.currentExercise.parola_target.length;
    let out = '';
    for (let i = 0; i < targetLength; i++) out += appState.currentAnswer[i] || ' ';
    return out;
}

function selectLetter(letter) {
    // Durante il lampeggio delle lettere sbagliate non si accettano nuove lettere
    if (appState.correzioneInCorso) return;

    const indice = primaCasellaVuota();

    // Se già completo, ignora
    if (indice >= appState.currentExercise.parola_target.length) {
        return;
    }

    // Mette la lettera nella prima casella libera
    appState.currentAnswer[indice] = letter;

    // Aggiorna UI
    updateAnswerDisplay();

    // Controlla se completo
    if (rispostaCompleta()) {
        checkAnswer();
    }
}

function removeLetter() {
    if (appState.correzioneInCorso) return;

    // Cancella l'ultima lettera inserita (l'ultima casella piena)
    const targetLength = appState.currentExercise.parola_target.length;
    for (let i = targetLength - 1; i >= 0; i--) {
        if (appState.currentAnswer[i]) {
            appState.currentAnswer[i] = null;
            updateAnswerDisplay();
            return;
        }
    }
}

function updateAnswerDisplay() {
    const boxes = document.querySelectorAll('.answer-box');
    const hintVisible = document.getElementById('chkHint') && document.getElementById('chkHint').checked;
    const slider = document.getElementById('hintSlider');
    const intensity = slider ? Math.round((slider.value / 100) * 255) : 208;
    const gray = 255 - intensity;
    const hintColor = `rgb(${gray}, ${gray}, ${gray})`;

    // Recupera scala font salvata
    const fontScale = localStorage.getItem('scrivo_font_scale') || '1';
    const scale = parseFloat(fontScale);
    const fontSize = `${2 * scale}rem`;

    // Recupera colore testo salvato
    const textColor = localStorage.getItem('scrivo_text_color') || '#000000';

    const nextEmptyIndex = primaCasellaVuota();

    boxes.forEach((box, index) => {
        const hintChar = box.dataset.hint || '';
        if (appState.currentAnswer[index]) {
            box.innerHTML = `<span class="answer-letter" style="font-size:${fontSize}; color:${textColor}">${appState.currentAnswer[index]}</span>`;
            box.classList.add('filled');
        } else {
            const hintSpan = `<span class="answer-hint" style="${hintVisible ? '' : 'display:none'}; color:${hintColor}; font-size:${fontSize}">${hintChar}</span>`;
            box.innerHTML = hintSpan;
            box.classList.remove('filled');
        }
        box.classList.remove('correct', 'wrong');

        // Cursore lampeggiante sulla prossima casella vuota (solo se attivato)
        box.classList.toggle('active-cursor', cursorEnabled && index === nextEmptyIndex);
    });
}

function toggleHint() {
    const checked = document.getElementById('chkHint').checked;
    const intensityMenu = document.getElementById('hintIntensityMenu');

    if (checked) {
        if (intensityMenu) intensityMenu.style.display = 'flex';
        // Applica il colore corrente dello slider
        const slider = document.getElementById('hintSlider');
        if (slider) updateHintIntensity(slider.value);
    } else {
        if (intensityMenu) intensityMenu.style.display = 'none';
    }

    document.querySelectorAll('.answer-hint').forEach(hint => {
        hint.style.display = checked ? '' : 'none';
    });

    // Salva preferenza
    localStorage.setItem('scrivo_hint_enabled', checked ? '1' : '0');
}

function updateHintIntensity(value) {
    // value 0 = bianco (#ffffff, invisibile), 100 = nero (#000000)
    const intensity = Math.round((value / 100) * 255);
    const gray = 255 - intensity;
    const color = `rgb(${gray}, ${gray}, ${gray})`;

    document.querySelectorAll('.answer-hint').forEach(hint => {
        hint.style.color = color;
    });

    // Salva preferenza
    localStorage.setItem('scrivo_hint_intensity', value);
}

// =====================================================
// VERIFICA RISPOSTA
// =====================================================
/** Quante volte l'utente puo' sbagliare prima che venga mostrata la soluzione */
const MAX_TENTATIVI = 3;
/** Durata del lampeggio delle lettere sbagliate, prima che si cancellino */
const DURATA_LAMPEGGIO_MS = 2000;

function checkAnswer() {
    const responseTime = Date.now() - appState.trialStartTime;
    const userAnswer = rispostaTesto();
    const correctAnswer = appState.currentExercise.parola_target;
    const isCorrect = userAnswer === correctAnswer;

    appState.tentativi = (appState.tentativi || 0) + 1;

    // Il risultato registrato e' quello del PRIMO tentativo: misura la risposta
    // spontanea, indipendentemente dalle correzioni successive.
    if (appState.tentativi === 1) {
        saveResult(isCorrect, userAnswer, responseTime);
    }

    if (isCorrect) {
        document.querySelectorAll('.answer-box').forEach(box => box.classList.add('correct'));
        showCelebration();
        return;
    }

    if (appState.tentativi < MAX_TENTATIVI) {
        // Le lettere sbagliate lampeggiano e poi si cancellano: quelle giuste
        // restano al loro posto e l'utente completa solo le caselle svuotate.
        lampeggiaEcancellaSbagliate();
        return;
    }

    // Tentativi esauriti: si mostra la parola corretta e si passa avanti
    document.querySelectorAll('.answer-box').forEach(box => box.classList.add('wrong'));
    showErrorFeedback();
}

/**
 * Evidenzia le lettere sbagliate facendole lampeggiare per 2 secondi, poi svuota
 * SOLO quelle caselle. Le lettere corrette restano, cosi' l'utente deve inserire
 * unicamente le lettere mancanti.
 */
function lampeggiaEcancellaSbagliate() {
    const correctAnswer = appState.currentExercise.parola_target;
    const boxes = document.querySelectorAll('.answer-box');

    // Indici delle caselle sbagliate (confronto posizione per posizione)
    const sbagliate = [];
    for (let i = 0; i < correctAnswer.length; i++) {
        if ((appState.currentAnswer[i] || '') !== correctAnswer[i]) sbagliate.push(i);
    }

    // Blocca l'inserimento durante il lampeggio
    appState.correzioneInCorso = true;

    sbagliate.forEach(i => {
        if (boxes[i]) boxes[i].classList.add('wrong', 'blink-wrong');
    });

    speakWord('Riprova');

    setTimeout(() => {
        sbagliate.forEach(i => {
            appState.currentAnswer[i] = null;      // svuota solo le sbagliate
            if (boxes[i]) boxes[i].classList.remove('wrong', 'blink-wrong');
        });
        appState.correzioneInCorso = false;
        updateAnswerDisplay();
    }, DURATA_LAMPEGGIO_MS);
}

async function saveResult(isCorrect, userAnswer, responseTime) {
    const result = {
        parola: appState.currentExercise.parola_target,
        risposta: userAnswer,
        esito: isCorrect ? 'positivo' : 'negativo',
        tempo: responseTime
    };
    
    appState.results.push(result);
    
    try {
        Archivio.salvaRisultato({
            id_config: appState.currentExercise.id_config,
            parola_target: appState.currentExercise.parola_target,
            risposta_data: userAnswer,
            esito: result.esito,
            tempo_risposta_ms: responseTime,
            id_sessione: appState.sessionId,
            numero_prova: appState.currentTrial,
            numero_prove_totali: appState.totalTrials
        });
    } catch (error) {
        console.error('[Save] Errore:', error);
    }
}

// =====================================================
// FEEDBACK
// =====================================================
function showCelebration() {
    const modal = document.getElementById('celebrationModal');
    document.getElementById('successWord').textContent = appState.currentExercise.parola_target;

    // Complimento in base al genere scelto dall'educatore (BRAVO / BRAVA)
    const complimento = appState.settings.genere_feedback === 'femminile' ? 'Brava' : 'Bravo';
    const titolo = document.getElementById('celebrationTitle');
    if (titolo) {
        titolo.textContent = complimento.toUpperCase() + '!';
    }

    modal.classList.add('active');

    speakWord(complimento + '!');
    
    setTimeout(() => {
        modal.classList.remove('active');
        document.getElementById('btnNext').disabled = false;
        avviaAvanzamentoAutomatico();
    }, 2500);
}

function showErrorFeedback() {
    const exerciseArea = document.getElementById('exerciseArea');
    const errorModal = document.getElementById('errorModal');
    
    // Mostra la risposta corretta nel modal
    document.getElementById('correctAnswer').textContent = appState.currentExercise.parola_target;
    
    // Animazione shake sull'area esercizio
    exerciseArea.classList.add('shake');
    
    // Mostra modal errore
    errorModal.classList.add('active');
    
    // Feedback vocale
    speakWord('Riprova!');
    
    setTimeout(() => {
        exerciseArea.classList.remove('shake');
        errorModal.classList.remove('active');
        document.getElementById('btnNext').disabled = false;
        avviaAvanzamentoAutomatico();
    }, 2000);
}

// =====================================================
// FINE SESSIONE
// =====================================================
function endSession() {
    annullaAvanzamentoAutomatico();
    appState.isStarted = false;
    
    const correct = appState.results.filter(r => r.esito === 'positivo').length;
    const wrong = appState.results.filter(r => r.esito === 'negativo').length;
    const percent = appState.results.length > 0 
        ? Math.round((correct / appState.results.length) * 100) 
        : 0;
    
    document.getElementById('statCorrect').textContent = correct;
    document.getElementById('statWrong').textContent = wrong;
    document.getElementById('statPercent').textContent = `${percent}%`;
    
    // Popola tabella
    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = appState.results.map(r => `
        <tr>
            <td><strong>${r.parola}</strong></td>
            <td>${r.risposta}</td>
            <td><span class="badge ${r.esito === 'positivo' ? 'correct' : 'wrong'}">${r.esito === 'positivo' ? '✓ Corretto' : '✗ Errato'}</span></td>
        </tr>
    `).join('');
    
    // Crea grafico
    createChart();
    
    document.getElementById('summaryModal').classList.add('active');
    
    speakWord(`Esercizio completato. Hai risposto correttamente ${correct} volte su ${appState.results.length}.`);
}

function createChart() {
    const ctx = document.getElementById('resultsChart').getContext('2d');
    
    if (window.resultsChartInstance) {
        window.resultsChartInstance.destroy();
    }
    
    // Statistiche per parola
    const statsByWord = {};
    appState.results.forEach(r => {
        if (!statsByWord[r.parola]) {
            statsByWord[r.parola] = { correct: 0, wrong: 0 };
        }
        if (r.esito === 'positivo') {
            statsByWord[r.parola].correct++;
        } else {
            statsByWord[r.parola].wrong++;
        }
    });
    
    const labels = Object.keys(statsByWord);
    const correctData = labels.map(w => statsByWord[w].correct);
    const wrongData = labels.map(w => statsByWord[w].wrong);
    
    window.resultsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Corrette',
                    data: correctData,
                    backgroundColor: 'rgba(76, 175, 80, 0.7)',
                    borderColor: '#4CAF50',
                    borderWidth: 2
                },
                {
                    label: 'Errate',
                    data: wrongData,
                    backgroundColor: 'rgba(244, 67, 54, 0.7)',
                    borderColor: '#F44336',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            },
            plugins: {
                legend: { position: 'top' },
                title: {
                    display: true,
                    text: 'Risultati per Parola'
                }
            }
        }
    });
}

function closeSummary() {
    document.getElementById('summaryModal').classList.remove('active');

    // Si torna alla schermata "Pronto a scrivere?" con il pulsante Inizia
    avviaApp();
}

// =====================================================
// TEXT-TO-SPEECH
// =====================================================
function speakCurrentWord() {
    if (appState.currentExercise) {
        speakWord(appState.currentExercise.parola_target);
    }
}

function speakWord(text) {
    if (!appState.synth) return;
    
    appState.synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    if (appState.selectedVoice) {
        utterance.voice = appState.selectedVoice;
    }
    
    appState.synth.speak(utterance);
}

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-x-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        info: 'bi-info-circle-fill'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="bi ${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// =====================================================
// MENU IMPOSTAZIONI LATERALE
// =====================================================
function toggleSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    const overlay = document.getElementById('settingsOverlay');

    if (menu && overlay) {
        menu.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

function updateFontSize(value) {
    // Valore da 1 a 3, scala proporzionale
    const scale = parseFloat(value);

    // Applica a box risposta
    document.querySelectorAll('.answer-box').forEach(box => {
        box.style.width = `${60 * scale}px`;
        box.style.height = `${70 * scale}px`;
        box.style.fontSize = `${2 * scale}rem`;
    });

    // Applica a lettere disponibili
    document.querySelectorAll('.letter-btn').forEach(btn => {
        btn.style.width = `${60 * scale}px`;
        btn.style.height = `${60 * scale}px`;
        btn.style.fontSize = `${1.8 * scale}rem`;
    });

    // Applica a hint e lettere risposta
    document.querySelectorAll('.answer-hint, .answer-letter').forEach(el => {
        el.style.fontSize = `${2 * scale}rem`;
    });

    // Salva preferenza
    localStorage.setItem('scrivo_font_scale', value);
}

function setBackgroundColor(color) {
    // Aggiorna stato attivo dei bottoni
    document.querySelectorAll('#bgColors .color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
    });

    // Applica colore ai box risposta
    document.querySelectorAll('.answer-box').forEach(box => {
        box.style.backgroundColor = color;
    });

    // Applica colore ai bottoni lettere
    document.querySelectorAll('.letter-btn').forEach(btn => {
        btn.style.background = `linear-gradient(135deg, ${color}, ${adjustColor(color, -20)})`;
    });

    // Salva preferenza
    localStorage.setItem('scrivo_bg_color', color);
}

function setTextColor(color) {
    // Aggiorna stato attivo dei bottoni
    document.querySelectorAll('#textColors .color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
    });

    // Applica colore testo ai box risposta
    document.querySelectorAll('.answer-box').forEach(box => {
        box.style.color = color;
    });

    // Applica colore testo alle lettere inserite
    document.querySelectorAll('.answer-letter').forEach(letter => {
        letter.style.color = color;
    });

    // Applica colore testo ai bottoni lettere
    document.querySelectorAll('.letter-btn').forEach(btn => {
        btn.style.color = color;
    });

    // Salva preferenza
    localStorage.setItem('scrivo_text_color', color);
}

// Utility: scurisce/schiarisce un colore hex
function adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Utility: calcola colore testo contrastante (bianco o nero)
function getContrastColor(hex) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 0xFF;
    const g = (num >> 8) & 0xFF;
    const b = num & 0xFF;
    // Formula luminosità percepita
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// Carica preferenze salvate all'avvio
function loadSavedPreferences() {
    // Font scale - imposta solo il valore dello slider
    const fontScale = localStorage.getItem('scrivo_font_scale');
    if (fontScale) {
        const slider = document.getElementById('fontSizeSlider');
        if (slider) {
            slider.value = fontScale;
        }
    }

    // Background color - imposta stato attivo del bottone
    const bgColor = localStorage.getItem('scrivo_bg_color');
    if (bgColor) {
        document.querySelectorAll('#bgColors .color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === bgColor);
        });
    }

    // Text color - imposta stato attivo del bottone
    const textColor = localStorage.getItem('scrivo_text_color');
    if (textColor) {
        document.querySelectorAll('#textColors .color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === textColor);
        });
    }

    // Hint enabled - imposta checkbox e mostra/nascondi slider intensità
    const hintEnabled = localStorage.getItem('scrivo_hint_enabled');
    const chkHint = document.getElementById('chkHint');
    const intensityMenu = document.getElementById('hintIntensityMenu');
    if (chkHint) {
        chkHint.checked = hintEnabled === '1';
        if (intensityMenu) {
            intensityMenu.style.display = hintEnabled === '1' ? 'flex' : 'none';
        }
    }

    // Hint intensity - imposta valore slider
    const hintIntensity = localStorage.getItem('scrivo_hint_intensity');
    if (hintIntensity) {
        const slider = document.getElementById('hintSlider');
        if (slider) {
            slider.value = hintIntensity;
        }
    }

    // Avanzamento automatico - toggle, slider durata e visibilità sotto-menu
    const autoEnabled = isAutoAdvanceEnabled();
    const chkAuto = document.getElementById('chkAutoAdvance');
    const autoMenu = document.getElementById('autoAdvanceMenu');
    if (chkAuto) chkAuto.checked = autoEnabled;
    if (autoMenu) autoMenu.style.display = autoEnabled ? 'block' : 'none';

    const autoSec = getAutoAdvanceSeconds();
    const autoSlider = document.getElementById('autoAdvanceSlider');
    if (autoSlider) autoSlider.value = autoSec;
    const autoLabel = document.getElementById('autoAdvanceValue');
    if (autoLabel) autoLabel.textContent = autoSec;
}

