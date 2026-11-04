/**
 * Conta con le Dita - Area Utente
 * AssistiveTech.it - Training Cognitivo
 *
 * L'utente vede l'immagine di una mano (o due) e trascina nel box accanto
 * il numero corrispondente, scegliendolo fra i tre riquadri in basso.
 * Drag & Drop (mouse) + trascinamento touch + tap + tastiera.
 */

// App autonoma: nessun server, dati in localStorage (vedi js/archivio.js).

const NUMERI_PAROLE = [
    'zero', 'uno', 'due', 'tre', 'quattro', 'cinque',
    'sei', 'sette', 'otto', 'nove', 'dieci'
];

const ERRORI_PER_AIUTO = 3;      // errori dopo i quali si evidenzia il numero giusto
const COOLDOWN_ERRORE = 700;     // ms fra due segnalazioni di errore consecutive

const state = {
    userId: null,
    exercises: [],
    currentConfig: null,
    errori: 0,
    completed: false,
    startTime: null,
    // impostazioni
    voceAbilitata: true,
    gender: 'M',
    aiutoAbilitato: true,
    autoAdvance: true,
    autoAdvanceTimer: null
};

let currentDragTile = null;
let lastErrorTime = 0;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupDropZone();
});

// ===== NAVIGAZIONE =====
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
// App autonoma: niente login, niente scelta utente. Un dispositivo = un utente.
async function initApp() {
    state.userId = 1;
    await loadExercisesList();
}

// ===== LISTA ESERCIZI (CHOOSER) =====
async function loadExercisesList() {
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
        console.error('[Exercises] Errore:', e);
        showToast('Errore caricamento esercizi', 'error');
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
        card.setAttribute('aria-label', `Esercizio con ${ex.numero_corretto} dita`);

        const numeri = (ex.numeri || []).map(n => `<span class="uex-num">${n}</span>`).join('');
        card.innerHTML = `
            <img src="${ex.url_immagine}" alt="Mano da contare">
            <div class="uex-numeri">${numeri}</div>
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
    state.errori = 0;
    state.completed = false;
    state.startTime = Date.now();

    document.querySelector('.app-main').classList.add('hidden');
    document.getElementById('exerciseChooser').classList.add('hidden');
    document.getElementById('noConfigMessage').classList.add('hidden');
    document.getElementById('exerciseArea').classList.remove('hidden');
    document.getElementById('sideMenuToggle').classList.remove('hidden');
    document.getElementById('celebrationOverlay').classList.remove('active');

    // Immagine delle dita
    const img = document.getElementById('fingerImg');
    img.src = config.url_immagine;
    img.alt = `Mano che mostra ${config.numero_corretto} dita`;

    // Box di rilascio pulito
    const dropBox = document.getElementById('dropBox');
    dropBox.classList.remove('filled', 'wrong', 'drag-over');
    document.getElementById('dropHint').classList.remove('hidden');
    const dropped = document.getElementById('droppedNumber');
    dropped.classList.add('hidden');
    dropped.textContent = '';

    document.getElementById('erroriCount').textContent = '0';

    // Tre box numero
    const numeri = Array.isArray(config.numeri) ? [...config.numeri] : [];
    if (parseInt(config.mescola) === 1) shuffleArray(numeri);

    const row = document.getElementById('numbersRow');
    row.innerHTML = '';
    numeri.forEach((n, idx) => row.appendChild(createNumberTile(n, idx)));

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

// ===== BOX NUMERO (draggabili) =====
function createNumberTile(numero, idx) {
    const tile = document.createElement('div');
    tile.className = 'number-tile';
    tile.textContent = numero;
    tile.draggable = true;
    tile.dataset.numero = numero;
    tile.dataset.idx = idx;
    tile.tabIndex = 0;
    tile.setAttribute('role', 'button');
    tile.setAttribute('aria-label', `Numero ${numero}`);

    // Stato del trascinamento col dito
    let ghost = null;
    let touchStartX = 0, touchStartY = 0;
    let didTouchDrag = false;
    let suppressClickUntil = 0;

    const TAP_THRESHOLD = 8;

    tile.addEventListener('click', (e) => {
        if (Date.now() < suppressClickUntil) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (state.completed) return;
        // Tap semplice: vale come risposta (utile per chi non riesce a trascinare)
        valutaRisposta(tile);
    });

    tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!state.completed) valutaRisposta(tile);
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
        document.getElementById('dropBox').classList.remove('drag-over');
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
        ghost.textContent = tile.textContent;
        ghost.style.width = rect.width + 'px';
        ghost.style.height = rect.height + 'px';
        ghost.style.fontSize = window.getComputedStyle(tile).fontSize;
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

        // Evidenzia il box di rilascio quando il dito ci passa sopra
        const overDrop = isOverDropBox(touch.clientX, touch.clientY);
        document.getElementById('dropBox').classList.toggle('drag-over', overDrop);
    }, { passive: false });

    tile.addEventListener('touchend', (e) => {
        if (!ghost) return;
        const touch = e.changedTouches[0];
        ghost.remove();
        ghost = null;
        tile.classList.remove('dragging');
        document.getElementById('dropBox').classList.remove('drag-over');

        if (didTouchDrag) {
            suppressClickUntil = Date.now() + 500;
            if (isOverDropBox(touch.clientX, touch.clientY)) {
                valutaRisposta(tile);
            }
            // Rilasciato fuori dal box: nessuna risposta, il numero resta al suo posto
        }
        didTouchDrag = false;
    });

    tile.addEventListener('touchcancel', () => {
        if (ghost) { ghost.remove(); ghost = null; }
        tile.classList.remove('dragging');
        document.getElementById('dropBox').classList.remove('drag-over');
        if (didTouchDrag) suppressClickUntil = Date.now() + 500;
        didTouchDrag = false;
    });

    return tile;
}

function isOverDropBox(x, y) {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest('#dropBox'));
}

// ===== ZONA DI RILASCIO =====
function setupDropZone() {
    const dropBox = document.getElementById('dropBox');

    dropBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        dropBox.classList.add('drag-over');
    });

    dropBox.addEventListener('dragleave', (e) => {
        // Ignora i passaggi sui figli del box
        if (e.relatedTarget && dropBox.contains(e.relatedTarget)) return;
        dropBox.classList.remove('drag-over');
    });

    dropBox.addEventListener('drop', (e) => {
        e.preventDefault();
        dropBox.classList.remove('drag-over');

        const idx = e.dataTransfer.getData('text/plain');
        const tile = document.querySelector(`.number-tile[data-idx="${idx}"]`) || currentDragTile;
        if (tile) valutaRisposta(tile);
    });
}

// ===== VALUTAZIONE RISPOSTA =====
function valutaRisposta(tile) {
    if (state.completed || !state.currentConfig) return;

    const scelto = parseInt(tile.dataset.numero);
    const corretto = parseInt(state.currentConfig.numero_corretto);

    if (scelto === corretto) {
        rispostaCorretta(tile, scelto);
    } else {
        rispostaSbagliata(tile, scelto);
    }
}

function rispostaCorretta(tile, numero) {
    state.completed = true;

    const dropBox = document.getElementById('dropBox');
    dropBox.classList.remove('wrong', 'drag-over');
    dropBox.classList.add('filled');

    document.getElementById('dropHint').classList.add('hidden');
    const dropped = document.getElementById('droppedNumber');
    dropped.textContent = numero;
    dropped.classList.remove('hidden');

    tile.classList.add('placed');
    document.querySelectorAll('.number-tile').forEach(t => t.classList.remove('hint'));

    playSuccessSound();
    launchConfetti();

    const rinforzo = state.gender === 'F' ? 'Brava' : 'Bravo';
    const parola = NUMERI_PAROLE[numero] || numero;
    speak(`${rinforzo}! Sono ${parola} dita`);

    const tempo = Math.max(0, Math.round((Date.now() - state.startTime) / 1000));
    salvaRisultato(tempo);

    document.getElementById('bravoText').textContent = `${rinforzo.toUpperCase()}!`;
    document.getElementById('reachedNumber').textContent = numero;
    document.getElementById('celebrationDetail').textContent = state.errori === 0
        ? 'Hai indovinato al primo colpo!'
        : `Ci sei riuscito dopo ${state.errori} tentativ${state.errori === 1 ? 'o' : 'i'}`;

    setTimeout(() => {
        document.getElementById('celebrationOverlay').classList.add('active');
        if (state.autoAdvance) {
            cancelAutoAdvance();
            state.autoAdvanceTimer = setTimeout(() => goToRandomExercise(), 4000);
        }
    }, 900);
}

function rispostaSbagliata(tile, numero) {
    const now = Date.now();
    if (now - lastErrorTime < COOLDOWN_ERRORE) return;
    lastErrorTime = now;

    state.errori += 1;
    document.getElementById('erroriCount').textContent = state.errori;

    // Il numero non entra nel box: resta al suo posto e "trema"
    tile.classList.remove('shake');
    void tile.offsetWidth;
    tile.classList.add('shake');
    setTimeout(() => tile.classList.remove('shake'), 600);

    const dropBox = document.getElementById('dropBox');
    dropBox.classList.add('wrong');
    setTimeout(() => dropBox.classList.remove('wrong'), 900);

    playErrorSound();
    speak('No, riprova. Conta di nuovo le dita');
    showErrorOverlay('Non è questo', `Riprova: quante dita vedi?`);

    // Aiuto: dopo N errori evidenzia il numero giusto
    if (state.aiutoAbilitato && state.errori >= ERRORI_PER_AIUTO) {
        const corretto = parseInt(state.currentConfig.numero_corretto);
        document.querySelectorAll('.number-tile').forEach(t => {
            t.classList.toggle('hint', parseInt(t.dataset.numero) === corretto);
        });
    }
}

async function salvaRisultato(tempoSecondi) {
    if (!state.currentConfig || state.userId === null) return;

    try {
        Archivio.salvaRisultato({
            id_config: state.currentConfig.id_config,
            numero_corretto: state.currentConfig.numero_corretto,
            errori: state.errori,
            tempo_secondi: tempoSecondi
        });
    } catch (e) {
        console.warn('[Risultato] Non salvato:', e);
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

function onScaleChange() {
    const slider = document.getElementById('scaleSlider');
    if (!slider) return;
    let v = parseInt(slider.value);
    if (isNaN(v) || v < 70) v = 70;
    if (v > 130) v = 130;
    document.documentElement.style.setProperty('--scala-box', (v / 100).toFixed(2));
    document.getElementById('scaleValue').textContent = `${v}%`;
}

function onHintChange() {
    const check = document.getElementById('hintCheck');
    state.aiutoAbilitato = check ? check.checked : true;
    if (!state.aiutoAbilitato) {
        document.querySelectorAll('.number-tile').forEach(t => t.classList.remove('hint'));
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
        utter.rate = 0.95;
        utter.pitch = 1.05;
        utter.volume = 1.0;
        window.speechSynthesis.speak(utter);
    } catch (e) { console.warn('TTS errore:', e); }
}

function speakConsegna(manualClick = false) {
    if (manualClick && !state.voceAbilitata) setVoce(true);
    speak('Quante dita vedi? Trascina il numero giusto nel box');
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
    const colors = ['#673AB7', '#FF9800', '#4CAF50', '#F44336', '#2196F3', '#FFEB3B'];
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
            gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
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
        const testo = (state.currentConfig) ? 'Torna a: scelta dell\'esercizio' : 'Torna a: Conta con le dita';
        freccia.title = testo;
        freccia.setAttribute('aria-label', testo);
    };
    ['pointerenter', 'focus', 'pointerdown'].forEach(ev => freccia.addEventListener(ev, aggiorna));
    aggiorna();
});
