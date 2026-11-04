/**
 * SCRIVO PAROLE CON LE SILLABE - Area Utente/Esercizio
 * Versione 5.0.0 (autonoma)
 *
 * Esecuzione esercizi: composizione parole con sillabe.
 * Nessun server né login: un dispositivo = un utente, dati in localStorage
 * tramite js/archivio.js (Archivio).
 */

// ============================================
// CONFIGURAZIONE
// ============================================

const APP_CONFIG = {
    name: 'Scrivo Parole con le Sillabe - Esercizio',
    version: '5.0.0',
};

const ARASAAC_API = 'https://api.arasaac.org/api';
const ARASAAC_STATIC = 'https://static.arasaac.org/pictograms';

// ============================================
// STATO APPLICAZIONE
// ============================================

let appState = {
    exercises: [],
    currentExercise: null,
    currentExerciseIndex: null,
    currentTargetWord: '',
    requiredSyllableCount: 2,
    selectedSyllables: [],
    composedWord: '',
    composedImageUrl: null,
    exerciseCompleted: false,
    startTime: null,
    autoAdvanceTimer: null,   // passaggio automatico al prossimo esercizio
    sillabazioneAttiva: true, // lettura sillaba per sillaba all'apertura
    userZoom: 1,              // ingrandimento box+lettere nell'area utente
};

let ui = {};

// Pittogrammi cercati online durante la sessione (parola → URL o null)
const cacheImmagini = new Map();

// ============================================
// INIZIALIZZAZIONE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log(`${APP_CONFIG.name} v${APP_CONFIG.version} caricato`);

    cacheUIRefs();
    initSillabazione();
    initUserZoom();
    loadExercises();

    // Gestione tasto Escape per chiudere modali
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal('successModal');
            closeModal('errorModal');
        }
    });
});

function cacheUIRefs() {
    ui = {
        exercisesSelectionSection: document.getElementById('exercisesSelectionSection'),
        exercisesListContainer: document.getElementById('exercisesListContainer'),
        exerciseArea: document.getElementById('exerciseArea'),
        targetImageContainer: document.getElementById('targetImageContainer'),
        targetWordText: document.getElementById('targetWordText'),
        answerZone: document.getElementById('answerZone'),
        syllablesZone: document.getElementById('syllablesZone'),
        answerImageBox: document.getElementById('answerImageBox'),
        answerImage: document.getElementById('answerImage'),
        answerImagePlaceholder: document.getElementById('answerImagePlaceholder'),
        verifyButton: document.getElementById('verifyButton'),
        actionButtons: document.getElementById('actionButtons'),
    };
}

// ============================================
// NAVIGAZIONE
// ============================================

function goBack() {
    // Un livello sopra: dall'esercizio aperto alla scelta dell'esercizio, altrimenti alla pagina iniziale
    if (ui.exerciseArea && ui.exerciseArea.style.display !== 'none') {
        backToExercisesList();
        return;
    }
    window.location.href = './';
}

function goHome() {
    window.location.href = window.RACCOLTA ? window.RACCOLTA.url : '../';   // Tutte le Web App (indice della raccolta)
}

// ============================================
// UTILITÀ
// ============================================

function esc(testo) {
    return String(testo ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

// Immagine di una parola: prima il pittogramma incorporato nell'esercizio (funziona
// offline), poi una ricerca su ARASAAC se c'è la rete. null se non c'è.
async function immaginePerParola(parola, esercizio) {
    const p = String(parola || '').toUpperCase();
    if (!p) return null;
    const incorporata = esercizio?.immagini?.[p];
    if (incorporata) return incorporata;
    if (cacheImmagini.has(p)) return cacheImmagini.get(p);
    let url = null;
    try {
        const response = await fetch(`${ARASAAC_API}/pictograms/it/search/${encodeURIComponent(p.toLowerCase())}`);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                const id = data[0]._id;
                url = `${ARASAAC_STATIC}/${id}/${id}_500.png`;
            }
        }
        cacheImmagini.set(p, url);   // risposta avuta: si ricorda anche "nessun pittogramma"
    } catch (e) {
        console.log('ARASAAC non raggiungibile:', e.message || e);
    }
    return url;
}

// ============================================
// CARICAMENTO ESERCIZI
// ============================================

function loadExercises() {
    if (!ui.exercisesListContainer) return;

    const exercises = Archivio.getEsercizi();
    appState.exercises = exercises;

    if (exercises.length === 0) {
        ui.exercisesListContainer.innerHTML = `
            <p class="empty-message" id="noExercisesMessage">
                <i class="bi bi-inbox" style="font-size: 3rem; display: block; margin-bottom: 1rem;"></i>
                Nessun esercizio trovato.
                <br><small>L'educatore deve prima creare un esercizio nell'Area Educatore.</small>
                <br><a href="gestione.html" class="btn-primary" style="display: inline-flex; margin-top: 1.2rem; text-decoration: none;">
                    <i class="bi bi-person-gear"></i>&nbsp;Vai all'Area Educatore
                </a>
            </p>
        `;
        return;
    }

    ui.exercisesListContainer.innerHTML = exercises.map((ex, i) => {
        const syllables = ex.sillabe_disponibili;
        const targetWords = ex.parole_target;

        return `
            <button class="exercise-item-btn" onclick="startExercise(${i})">
                <i class="bi bi-puzzle"></i>
                <div class="exercise-item-info">
                    <strong>${esc(targetWords.join(', '))}</strong>
                    <small>${syllables.length} sillabe • ${targetWords.length} parole</small>
                </div>
                <i class="bi bi-chevron-right" style="color: var(--primary-color);"></i>
            </button>
        `;
    }).join('');
}

// ============================================
// ESECUZIONE ESERCIZIO
// ============================================

// Quante sillabe servono per comporre la parola (scomposizione esatta, vedi archivio.js)
function countSyllablesInWord(word, syllables) {
    const parti = Archivio.scomponi(word, syllables);
    return parti ? parti.length : 2;
}

async function startExercise(index, forceWord = null) {
    cancelAutoAdvance();
    const exercise = appState.exercises[index];
    if (!exercise) return;
    
    const normalizedExercise = {
        ...exercise,
        id: exercise.id_esercizio,
        syllables: exercise.sillabe_disponibili || [],
        targetWords: exercise.parole_target || [],
        accessibility: {
            fontSize: exercise.font_size || 2.5,
            bgColor: exercise.bg_color || '#E3F2FD',
            textColor: exercise.text_color || '#1565C0',
        },
    };

    appState.currentExercise = normalizedExercise;
    appState.currentExerciseIndex = index;
    appState.selectedSyllables = [];
    appState.composedWord = '';
    appState.startTime = Date.now();
    appState.exerciseCompleted = false;
    appState.composedImageUrl = null;
    appState.errorCount = 0;
    
    // Estrai parola target (random o forzata)
    const targets = normalizedExercise.targetWords;
    if (forceWord && targets.includes(forceWord)) {
        appState.currentTargetWord = forceWord;
    } else {
        const randomIndex = Math.floor(Math.random() * targets.length);
        appState.currentTargetWord = targets[randomIndex] || '';
    }
    
    // Calcola numero di sillabe richieste
    appState.requiredSyllableCount = countSyllablesInWord(appState.currentTargetWord, normalizedExercise.syllables);
    console.log(`🎯 Target: "${appState.currentTargetWord}" richiede ${appState.requiredSyllableCount} sillabe`);
    
    // Applica accessibilità
    const { fontSize, bgColor, textColor } = normalizedExercise.accessibility;
    document.documentElement.style.setProperty('--syllable-font-size', `${fontSize}rem`);
    document.documentElement.style.setProperty('--syllable-bg-color', bgColor);
    document.documentElement.style.setProperty('--syllable-text-color', textColor);
    document.documentElement.style.setProperty('--syllable-border-color', textColor);
    
    // Mostra area esercizio
    if (ui.exercisesSelectionSection) ui.exercisesSelectionSection.style.display = 'none';
    if (ui.exerciseArea) ui.exerciseArea.style.display = 'block';
    
    // Render esercizio
    await renderExercise(normalizedExercise);
}

async function renderExercise(exercise) {
    const shuffled = [...exercise.syllables].sort(() => Math.random() - 0.5);
    const targetWord = appState.currentTargetWord;
    
    // Immagine della parola target: incorporata nell'esercizio o, in mancanza, da ARASAAC
    const targetImageUrl = await immaginePerParola(targetWord, exercise);

    // Aggiorna immagine target
    if (ui.targetImageContainer) {
        if (targetImageUrl) {
            ui.targetImageContainer.innerHTML = `<img src="${targetImageUrl}" alt="${esc(targetWord)}" class="target-image" />`;
        } else {
            ui.targetImageContainer.innerHTML = `
                <div class="no-image">
                    <i class="bi bi-image"></i>
                    <p>${esc(targetWord)}</p>
                </div>
            `;
        }
    }
    
    // Reset zona risposta
    if (ui.answerZone) {
        ui.answerZone.innerHTML = '<span style="color: #999;">Clicca le sillabe per comporre la parola</span>';
        ui.answerZone.className = 'answer-zone empty';
    }
    
    // Reset immagine risposta
    if (ui.answerImage) ui.answerImage.style.display = 'none';
    if (ui.answerImagePlaceholder) {
        ui.answerImagePlaceholder.innerHTML = '<i class="bi bi-question-circle"></i><p>?</p>';
        ui.answerImagePlaceholder.style.display = 'flex';
    }
    if (ui.answerImageBox) ui.answerImageBox.className = 'image-box answer-image-box';
    
    // Render sillabe
    if (ui.syllablesZone) {
        ui.syllablesZone.innerHTML = shuffled.map((s, i) => `
            <div class="syllable-box" data-syllable="${esc(s)}" data-index="${i}"
                 onclick="selectSyllable(this)" tabindex="0" role="button" aria-label="Sillaba ${esc(s)}">
                ${esc(s)}
            </div>
        `).join('');
        // Tastiera: Invio o spazio scelgono la sillaba
        ui.syllablesZone.querySelectorAll('.syllable-box').forEach((box) => {
            box.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectSyllable(box);
                }
            });
        });
    }
    
    // Reset pulsante verifica
    if (ui.verifyButton) {
        ui.verifyButton.disabled = true;
        ui.verifyButton.classList.remove('active');
    }
    
    // Nascondi pulsanti azione
    if (ui.actionButtons) ui.actionButtons.style.display = 'none';

    // Verbalizza la parola da scrivere: prima intera, poi sillaba per sillaba
    speakWordThenSyllables(appState.currentTargetWord, exercise.syllables);
}

// Scompone una parola nelle sillabe dell'esercizio, nell'ordine corretto.
// Se non è ricomponibile con le sillabe date, ritorna la parola intera.
function splitWordIntoSyllables(word, syllables) {
    if (!word) return [];
    return Archivio.scomponi(word, syllables) || [String(word).toUpperCase()];
}

// ===== INGRANDIMENTO BOX + LETTERE (area utente) =====
const ZOOM_MIN = 0.7, ZOOM_MAX = 2.2, ZOOM_STEP = 0.15;

function initUserZoom() {
    appState.userZoom = Archivio.getImpostazioni().zoom;
    applyUserZoom();
}

function applyUserZoom() {
    document.documentElement.style.setProperty('--user-zoom', appState.userZoom);
    const slider = document.getElementById('zoomSlider');
    if (slider) slider.value = Math.round(appState.userZoom * 100);
}

function setUserZoom(z) {
    appState.userZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
    try { Archivio.salvaImpostazioni({ zoom: appState.userZoom }); } catch (e) {}
    applyUserZoom();
    if (typeof showToast === 'function') {
        showToast(`Dimensione ${Math.round(appState.userZoom * 100)}%`, 'info');
    }
}

function onZoomSlider() {
    const slider = document.getElementById('zoomSlider');
    if (!slider) return;
    setUserZoom(parseInt(slider.value, 10) / 100);
}

// ===== LETTURA PER SILLABE (attiva/disattiva) =====
function initSillabazione() {
    appState.sillabazioneAttiva = Archivio.getImpostazioni().sillabazione;
    syncSillabazioneUI();
}

function syncSillabazioneUI() {
    const btn = document.getElementById('btnSyllable');
    const icon = document.getElementById('iconSyllable');
    if (btn) {
        btn.classList.toggle('off', !appState.sillabazioneAttiva);
        btn.title = appState.sillabazioneAttiva
            ? 'Lettura per sillabe attiva (tocca per disattivare)'
            : 'Lettura per sillabe disattivata (tocca per attivare)';
    }
    if (icon) icon.className = appState.sillabazioneAttiva ? 'bi bi-soundwave' : 'bi bi-soundwave';
}

function toggleSillabazione() {
    appState.sillabazioneAttiva = !appState.sillabazioneAttiva;
    try { Archivio.salvaImpostazioni({ sillabazione: appState.sillabazioneAttiva }); } catch (e) {}
    syncSillabazioneUI();
    showToast(
        appState.sillabazioneAttiva ? 'Lettura per sillabe attiva' : 'Solo parola intera',
        'info'
    );
}

// Legge la parola intera e poi, scandite più lentamente, le sillabe che la compongono
function speakWordThenSyllables(word, syllables) {
    if (!word || !('speechSynthesis' in window)) return;
    try {
        speechSynthesis.cancel();

        // 1) parola intera
        const uWord = new SpeechSynthesisUtterance(word);
        uWord.lang = 'it-IT';
        uWord.rate = 0.9;
        uWord.pitch = 1.05;
        speechSynthesis.speak(uWord);

        // 2) sillaba per sillaba, più lente per scandire la composizione
        //    (saltata se l'educatore ha disattivato la sillabazione)
        if (!appState.sillabazioneAttiva) return;
        splitWordIntoSyllables(word, syllables).forEach(s => {
            const u = new SpeechSynthesisUtterance(s);
            u.lang = 'it-IT';
            u.rate = 0.6;
            u.pitch = 1.1;
            speechSynthesis.speak(u);
        });
    } catch (e) {
        console.warn('TTS non disponibile:', e);
    }
}

async function selectSyllable(element) {
    const syllable = element?.dataset?.syllable;
    if (!syllable) return;
    if (!appState.currentExercise) return;
    if (appState.exerciseCompleted) return;
    
    // Effetto visivo temporaneo
    element.classList.add('clicked');
    setTimeout(() => element.classList.remove('clicked'), 200);
    
    // Leggi la sillaba con TTS
    speakSyllable(syllable);
    
    appState.selectedSyllables.push(syllable);
    appState.composedWord = appState.selectedSyllables.join('');
    
    updateAnswerZone();
    
    const clickCount = appState.selectedSyllables.length;
    const requiredCount = appState.requiredSyllableCount || 2;
    
    console.log(`🖱️ Click ${clickCount}/${requiredCount} - Parola: "${appState.composedWord}"`);
    
    // Abilita pulsante Verifica dopo almeno 2 sillabe
    if (ui.verifyButton && clickCount >= 2) {
        ui.verifyButton.disabled = false;
        ui.verifyButton.classList.add('active');
    }
    
    // Dopo 2+ sillabe, cerca immagine ARASAAC
    if (clickCount >= 2) {
        await searchAndShowComposedImage();
    }
    
    // Verifica AUTOMATICA solo se il numero di sillabe corrisponde esattamente
    if (clickCount === requiredCount) {
        checkIfWordMatchesTarget();
    }
}

function updateAnswerZone() {
    if (!ui.answerZone) return;
    
    ui.answerZone.classList.remove('empty', 'correct', 'error');
    
    if (appState.selectedSyllables.length === 0) {
        ui.answerZone.innerHTML = '<span style="color: #999;">Clicca le sillabe per comporre la parola</span>';
        ui.answerZone.classList.add('empty');
        return;
    }
    
    ui.answerZone.innerHTML = appState.selectedSyllables.map(s => 
        `<div class="syllable-box selected">${esc(s)}</div>`
    ).join('');
}

async function searchAndShowComposedImage() {
    const word = appState.composedWord;
    const imageUrl = await immaginePerParola(word, appState.currentExercise);

    // Nel frattempo l'utente può aver scelto un'altra sillaba: vale solo l'ultima parola
    if (word !== appState.composedWord) return;

    if (imageUrl) {
        if (ui.answerImage) {
            ui.answerImage.src = imageUrl;
            ui.answerImage.alt = word;
            ui.answerImage.style.display = 'block';
        }
        if (ui.answerImagePlaceholder) ui.answerImagePlaceholder.style.display = 'none';
        appState.composedImageUrl = imageUrl;
    } else {
        if (ui.answerImage) ui.answerImage.style.display = 'none';
        if (ui.answerImagePlaceholder) {
            ui.answerImagePlaceholder.innerHTML = `<i class="bi bi-x-circle"></i><p>${esc(word)}</p>`;
            ui.answerImagePlaceholder.style.display = 'flex';
        }
        appState.composedImageUrl = null;
    }
}

function checkIfWordMatchesTarget() {
    const word = appState.composedWord;
    const target = appState.currentTargetWord;
    const clickedCount = appState.selectedSyllables.length;
    const requiredCount = appState.requiredSyllableCount || 2;
    
    console.log(`🔍 Verifica: "${word}" vs "${target}" | Click: ${clickedCount}/${requiredCount}`);
    
    if (clickedCount < requiredCount) return;
    
    appState.exerciseCompleted = true;
    const tempoComposizione = (Date.now() - appState.startTime) / 1000;
    
    // Disabilita pulsante verifica
    if (ui.verifyButton) {
        ui.verifyButton.disabled = true;
        ui.verifyButton.classList.remove('active');
    }
    
    if (word === target) {
        console.log(`✅ Parola corretta! "${word}"`);
        
        saveResult({
            parola_composta: word,
            esito: 'positivo',
            arasaac_image_url: appState.composedImageUrl,
            tempo_composizione: tempoComposizione,
        });
        
        showFeedback('correct');
    } else {
        console.log(`❌ Parola errata! "${word}" invece di "${target}"`);
        
        saveResult({
            parola_composta: word,
            esito: 'negativo',
            tempo_composizione: tempoComposizione,
        });
        
        showFeedback('error');
    }
}

function verifyWord() {
    if (appState.exerciseCompleted) return;
    if (appState.selectedSyllables.length < 2) {
        showToast('Seleziona almeno 2 sillabe prima di verificare!', 'warning');
        return;
    }
    
    const word = appState.composedWord;
    const target = appState.currentTargetWord;
    const tempoComposizione = (Date.now() - appState.startTime) / 1000;
    
    console.log(`🔍 Verifica manuale: "${word}" vs "${target}"`);
    
    appState.exerciseCompleted = true;
    
    if (ui.verifyButton) {
        ui.verifyButton.disabled = true;
        ui.verifyButton.classList.remove('active');
    }
    
    if (word === target) {
        console.log(`✅ Parola corretta! "${word}"`);
        
        saveResult({
            parola_composta: word,
            esito: 'positivo',
            arasaac_image_url: appState.composedImageUrl,
            tempo_composizione: tempoComposizione,
        });
        
        showFeedback('correct');
    } else {
        console.log(`❌ Parola errata! "${word}" invece di "${target}"`);
        
        saveResult({
            parola_composta: word,
            esito: 'negativo',
            tempo_composizione: tempoComposizione,
        });
        
        showFeedback('error');
    }
}

function showFeedback(type) {
    if (ui.answerZone) ui.answerZone.classList.add(type);
    if (ui.answerImageBox) ui.answerImageBox.classList.add(type);

    if (type === 'correct') {
        // Feedback sonoro positivo
        appState.errorCount = 0;
        try {
            const utterance = new SpeechSynthesisUtterance(`Bravo! Hai scritto ${appState.composedWord}!`);
            utterance.lang = 'it-IT';
            speechSynthesis.speak(utterance);
        } catch (e) {}

        // Passa automaticamente a un altro esercizio, scelto a caso, dopo il rinforzo
        cancelAutoAdvance();
        appState.autoAdvanceTimer = setTimeout(() => goToRandomExercise(), 3500);

        // Mostra pulsanti azione (solo dopo una risposta corretta)
        if (ui.actionButtons) ui.actionButtons.style.display = 'flex';
    } else {
        // Errore: conta i tentativi sbagliati su questa parola
        appState.errorCount = (appState.errorCount || 0) + 1;
        cancelAutoAdvance();

        if (appState.errorCount < 2) {
            // Primo errore: invita a riprovare, poi cancella il campo per riscrivere la stessa parola
            try {
                const utterance = new SpeechSynthesisUtterance(`Non è corretto. Riprova a scrivere ${appState.currentTargetWord}.`);
                utterance.lang = 'it-IT';
                speechSynthesis.speak(utterance);
            } catch (e) {}
            appState.autoAdvanceTimer = setTimeout(() => resetAnswerForRetry(), 2500);
        } else {
            // Secondo errore: svela la parola, cancella il campo e passa al prossimo esercizio
            try {
                const utterance = new SpeechSynthesisUtterance(`${appState.composedWord} non è corretto. La parola era ${appState.currentTargetWord}. Proviamo con un'altra.`);
                utterance.lang = 'it-IT';
                speechSynthesis.speak(utterance);
            } catch (e) {}
            appState.autoAdvanceTimer = setTimeout(() => goToRandomExercise(), 3000);
        }
    }
}

// Cancella il campo composto lasciando la stessa parola target, per un nuovo tentativo
function resetAnswerForRetry() {
    cancelAutoAdvance();
    appState.selectedSyllables = [];
    appState.composedWord = '';
    appState.composedImageUrl = null;
    appState.exerciseCompleted = false;

    // Reset zona risposta
    if (ui.answerZone) {
        ui.answerZone.innerHTML = '<span style="color: #999;">Clicca le sillabe per comporre la parola</span>';
        ui.answerZone.className = 'answer-zone empty';
    }

    // Reset immagine risposta al placeholder
    if (ui.answerImage) ui.answerImage.style.display = 'none';
    if (ui.answerImagePlaceholder) {
        ui.answerImagePlaceholder.innerHTML = '<i class="bi bi-question-circle"></i><p>?</p>';
        ui.answerImagePlaceholder.style.display = 'flex';
    }
    if (ui.answerImageBox) ui.answerImageBox.className = 'image-box answer-image-box';

    // Disabilita di nuovo il pulsante Verifica finché non si ricompone
    if (ui.verifyButton) {
        ui.verifyButton.disabled = true;
        ui.verifyButton.classList.remove('active');
    }

    // Nascondi i pulsanti azione
    if (ui.actionButtons) ui.actionButtons.style.display = 'none';
}

// ============================================
// SALVATAGGIO RISULTATI
// ============================================

function saveResult(resultData) {
    const exercise = appState.currentExercise;
    if (!exercise) return;
    try {
        Archivio.salvaRisultato({
            id_esercizio: exercise.id,
            parola_richiesta: appState.currentTargetWord || '',
            parola_composta: resultData.parola_composta,
            esito: resultData.esito,
            tempo_composizione: resultData.tempo_composizione,
        });
    } catch (error) {
        console.error('Risultato non salvato:', error);
        showToast(error.message, 'error');
    }
}

// ============================================
// NAVIGAZIONE ESERCIZI
// ============================================

function sameExercise() {
    closeModal('successModal');
    closeModal('errorModal');
    startExercise(appState.currentExerciseIndex, appState.currentTargetWord);
}

function nextRandomExercise() {
    closeModal('successModal');
    closeModal('errorModal');
    goToRandomExercise();
}

// Passa a un altro esercizio della lista, scelto a caso e diverso dall'attuale.
// Con un solo esercizio disponibile lo ripropone.
function goToRandomExercise() {
    cancelAutoAdvance();

    const list = appState.exercises || [];
    if (list.length === 0) { backToExercisesList(); return; }
    if (list.length === 1) { startExercise(0); return; }

    let idx = appState.currentExerciseIndex;
    let guard = 0;
    while (idx === appState.currentExerciseIndex && guard++ < 30) {
        idx = Math.floor(Math.random() * list.length);
    }
    startExercise(idx);
}

// Annulla l'avanzamento automatico in sospeso (es. l'utente agisce manualmente)
function cancelAutoAdvance() {
    if (appState.autoAdvanceTimer) {
        clearTimeout(appState.autoAdvanceTimer);
        appState.autoAdvanceTimer = null;
    }
}

function continueExercise() {
    closeModal('successModal');
    closeModal('errorModal');
    nextRandomExercise();
}

function backToExercisesList() {
    cancelAutoAdvance();
    if (ui.exerciseArea) ui.exerciseArea.style.display = 'none';
    if (ui.exercisesSelectionSection) ui.exercisesSelectionSection.style.display = 'block';
    
    appState.currentExercise = null;
    appState.currentExerciseIndex = null;
}

// ============================================
// TTS - TEXT TO SPEECH
// ============================================

function speakSyllable(syllable) {
    try {
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(syllable);
        utterance.lang = 'it-IT';
        utterance.rate = 0.8;
        utterance.pitch = 1.1;
        utterance.volume = 1.0;
        
        speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('TTS non disponibile:', e);
    }
}

// ============================================
// UTILITY
// ============================================

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'bi-info-circle';
    if (type === 'success') icon = 'bi-check-circle';
    if (type === 'error') icon = 'bi-x-circle';
    if (type === 'warning') icon = 'bi-exclamation-triangle';
    
    toast.innerHTML = `<i class="bi ${icon}"></i> ${esc(message)}`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// ESPOSIZIONE FUNZIONI GLOBALI
// ============================================

window.goBack = goBack;
window.goHome = goHome;
window.startExercise = startExercise;
window.selectSyllable = selectSyllable;
window.verifyWord = verifyWord;
window.toggleSillabazione = toggleSillabazione;
window.onZoomSlider = onZoomSlider;
window.sameExercise = sameExercise;
window.nextRandomExercise = nextRandomExercise;
window.continueExercise = continueExercise;
window.backToExercisesList = backToExercisesList;
window.closeModal = closeModal;

// La freccia ← dice sempre dove porta (cambia quando si apre o si chiude un esercizio)
document.addEventListener('DOMContentLoaded', () => {
    const freccia = document.querySelector('.btn-back');
    if (!freccia) return;
    const aggiorna = () => {
        const testo = (ui.exerciseArea && ui.exerciseArea.style.display !== 'none') ? 'Torna a: scelta dell\'esercizio' : 'Torna a: Scrivo parole con le sillabe';
        freccia.title = testo;
        freccia.setAttribute('aria-label', testo);
    };
    ['pointerenter', 'focus', 'pointerdown'].forEach(ev => freccia.addEventListener(ev, aggiorna));
    aggiorna();
});
