/**
 * Scrivo Parole con le Lettere - Area Educatore
 * AssistiveTech.it - Training Cognitivo
 */

// =====================================================
// CONFIGURAZIONE
// =====================================================
// App autonoma: nessun server, nessun login. Un dispositivo = un utente.
// I dati stanno in localStorage (vedi js/archivio.js).

// Alfabeto italiano
const ALFABETO_ITALIANO = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L',
    'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'Z'
];

// Lato massimo delle immagini salvate (px): tiene leggero localStorage.
const LATO_MAX_IMMAGINE = 600;

// =====================================================
// STATO APPLICAZIONE
// =====================================================
let appState = {
    selectedLetters: [],
    exercises: [],
    settings: {
        numero_prove: 10,
        tasto_cancella_visibile: false,
        genere_feedback: 'maschile'
    },
    selectedImageType: 'nessuna',
    selectedArasaacId: null,
    selectedArasaacUrl: null,
    selectedUploadDataUrl: null
};

// =====================================================
// INIZIALIZZAZIONE
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadExercises();
});

// =====================================================
// NAVIGAZIONE
// =====================================================
function goBack() {
    window.location.href = './';   // pagina iniziale di Scrivo parole con le lettere
}

// =====================================================
// IMPOSTAZIONI
// =====================================================
function loadSettings() {
    const s = Archivio.getImpostazioni();
    appState.settings = {
        numero_prove: s.numero_prove,
        tasto_cancella_visibile: s.tasto_cancella_visibile == 1,
        genere_feedback: s.genere_feedback
    };
    document.getElementById('numProve').value = appState.settings.numero_prove;
    document.getElementById('tastoCancella').checked = appState.settings.tasto_cancella_visibile;
    document.getElementById('genereFeedback').value = appState.settings.genere_feedback;
}

function saveSettings() {
    const numero_prove = parseInt(document.getElementById('numProve').value) || 10;
    const tasto_cancella_visibile = document.getElementById('tastoCancella').checked;
    const genere_feedback = document.getElementById('genereFeedback').value === 'femminile' ? 'femminile' : 'maschile';

    try {
        Archivio.salvaImpostazioni({ numero_prove, tasto_cancella_visibile, genere_feedback });
        loadSettings();
        showToast('Impostazioni salvate!', 'success');
    } catch (error) {
        console.error('[Settings] Errore:', error);
        showToast(error.message || 'Errore salvataggio', 'error');
    }
}

// =====================================================
// GESTIONE ESERCIZI
// =====================================================
function loadExercises() {
    appState.exercises = Archivio.getConfigList();
    renderExercisesList();
}

function srcImmagineEsercizio(ex, lato = 300) {
    if (ex.url_immagine) return ex.url_immagine;
    if (ex.tipo_immagine === 'arasaac' && ex.id_arasaac) {
        return `https://static.arasaac.org/pictograms/${ex.id_arasaac}/${ex.id_arasaac}_${lato}.png`;
    }
    return null;
}

function renderExercisesList() {
    const container = document.getElementById('exercisesList');
    const countBadge = document.getElementById('exerciseCount');

    countBadge.textContent = appState.exercises.length;

    if (appState.exercises.length === 0) {
        container.innerHTML = '<p class="empty-message">Nessun esercizio creato</p>';
        return;
    }

    container.innerHTML = appState.exercises.map(ex => {
        const src = ex.tipo_immagine !== 'nessuna' ? srcImmagineEsercizio(ex) : null;
        const imgHtml = src ? `<img src="${src}" class="exercise-thumb" alt="">` : '';
        return `
        <div class="exercise-item" data-id="${ex.id_config}">
            ${imgHtml}
            <span class="exercise-word">${ex.parola_target}</span>
            <div class="exercise-letters">
                ${ex.lettere_disponibili.map(l => `<span class="mini-letter">${l}</span>`).join('')}
            </div>
            <button class="btn-delete-exercise" onclick="deleteExercise(${ex.id_config})" aria-label="Elimina">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `;
    }).join('');
}

// Ridimensiona un'immagine (src = URL o data URL) e la restituisce come data URL.
// Serve a incorporarla nell'esercizio: funziona offline e finisce nell'esportazione.
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

async function saveConfig() {
    const parolaTarget = document.getElementById('parolaTarget').value.trim().toUpperCase();

    if (!parolaTarget) {
        showToast('Inserisci una parola target', 'warning');
        return;
    }

    if (appState.selectedLetters.length === 0) {
        showToast('Seleziona almeno una lettera', 'warning');
        return;
    }

    // Verifica che tutte le lettere della parola siano disponibili
    const parolaLettere = parolaTarget.split('');
    const missingLetters = parolaLettere.filter(l => !appState.selectedLetters.includes(l));

    if (missingLetters.length > 0) {
        showToast(`Mancano le lettere: ${[...new Set(missingLetters)].join(', ')}`, 'warning');
        return;
    }

    // Determina dati immagine
    const tipoImmagine = appState.selectedImageType;
    let selectedArasaacId = null;
    let selectedUrl = null;

    if (tipoImmagine === 'arasaac') {
        selectedArasaacId = appState.selectedArasaacId;
        if (!selectedArasaacId) {
            showToast('Seleziona un pittogramma ARASAAC', 'warning');
            return;
        }
        // Prova a incorporare il pittogramma; se la rete non lo permette resta il link
        try {
            selectedUrl = await immagineComeDataUrl(
                `https://static.arasaac.org/pictograms/${selectedArasaacId}/${selectedArasaacId}_500.png`, 500);
        } catch (e) {
            console.warn('[ARASAAC] Pittogramma non incorporato, uso il link:', e);
            selectedUrl = null;
        }
    } else if (tipoImmagine === 'upload') {
        selectedUrl = appState.selectedUploadDataUrl;
        if (!selectedUrl) {
            showToast('Carica un\'immagine dal PC', 'warning');
            return;
        }
    }

    let data;
    try {
        data = Archivio.salvaConfig({
            parola_target: parolaTarget,
            lettere_disponibili: appState.selectedLetters,
            tipo_immagine: tipoImmagine,
            id_arasaac: selectedArasaacId,
            url_immagine: selectedUrl
        });
    } catch (error) {
        console.error('[Save] Errore:', error);
        showToast(error.message || 'Errore salvataggio', 'error');
        return;
    }

    if (data.success) {
        showToast('Esercizio creato!', 'success');

        // Reset form
        document.getElementById('parolaTarget').value = '';
        appState.selectedLetters = [];
        renderSelectedLetters();
        resetImageFields();
        updateSaveButton();

        loadExercises();
    } else {
        showToast(data.message || 'Errore creazione', 'error');
    }
}

function deleteExercise(id) {
    if (!confirm('Eliminare questo esercizio?')) return;

    const data = Archivio.eliminaConfig(id);
    if (data.success) {
        showToast('Esercizio eliminato', 'success');
        loadExercises();
    } else {
        showToast('Errore eliminazione', 'error');
    }
}

// =====================================================
// GESTIONE LETTERE
// =====================================================
function addAllAlphabet() {
    appState.selectedLetters = [...ALFABETO_ITALIANO];
    renderSelectedLetters();
    updateSaveButton();
    showToast('Alfabeto italiano aggiunto', 'info');
}

function addTargetLetters() {
    const parola = document.getElementById('parolaTarget').value.trim().toUpperCase();
    
    if (!parola) {
        showToast('Inserisci prima una parola', 'warning');
        return;
    }
    
    // Aggiungi lettere uniche della parola
    const lettereParola = [...new Set(parola.split(''))];
    
    lettereParola.forEach(l => {
        if (!appState.selectedLetters.includes(l) && /^[A-Z]$/.test(l)) {
            appState.selectedLetters.push(l);
        }
    });
    
    renderSelectedLetters();
    updateSaveButton();
    showToast('Lettere della parola aggiunte', 'info');
}

function clearLetters() {
    appState.selectedLetters = [];
    renderSelectedLetters();
    updateSaveButton();
}

function addLetterFromInput() {
    const input = document.getElementById('letterInput');
    const letters = input.value.toUpperCase().split('').filter(l => /^[A-Z]$/.test(l));
    
    letters.forEach(l => {
        if (!appState.selectedLetters.includes(l)) {
            appState.selectedLetters.push(l);
        }
    });
    
    input.value = '';
    renderSelectedLetters();
    updateSaveButton();
}

function onLetterKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addLetterFromInput();
    }
}

function removeLetter(letter) {
    appState.selectedLetters = appState.selectedLetters.filter(l => l !== letter);
    renderSelectedLetters();
    updateSaveButton();
}

function renderSelectedLetters() {
    const container = document.getElementById('selectedLetters');
    
    if (appState.selectedLetters.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light); margin: 0;">Nessuna lettera selezionata</p>';
        return;
    }
    
    // Ordina alfabeticamente
    const sorted = [...appState.selectedLetters].sort();
    
    container.innerHTML = sorted.map(l => `
        <span class="letter-tag" onclick="removeLetter('${l}')">
            ${l}
            <span class="remove-letter">×</span>
        </span>
    `).join('');
}

function onParolaChange() {
    updateSaveButton();
}

function updateSaveButton() {
    const btn = document.getElementById('btnSaveConfig');
    const parola = document.getElementById('parolaTarget').value.trim();

    let imageOk = true;
    if (appState.selectedImageType === 'arasaac' && !appState.selectedArasaacId) {
        imageOk = false;
    }
    if (appState.selectedImageType === 'upload' && !appState.selectedUploadDataUrl) {
        imageOk = false;
    }

    btn.disabled = !parola || appState.selectedLetters.length === 0 || !imageOk;
}

// =====================================================
// GESTIONE IMMAGINI
// =====================================================
function updateImageTypeFields() {
    const selected = document.querySelector('input[name="tipoImmagine"]:checked').value;
    appState.selectedImageType = selected;

    document.getElementById('fieldArasaac').style.display = selected === 'arasaac' ? 'block' : 'none';
    document.getElementById('fieldUpload').style.display = selected === 'upload' ? 'block' : 'none';

    // Reset campi non attivi
    if (selected !== 'arasaac') {
        appState.selectedArasaacId = null;
        appState.selectedArasaacUrl = null;
        document.getElementById('inputSearchArasaac').value = '';
        document.getElementById('arasaacResults').innerHTML = '';
    }
    if (selected !== 'upload') {
        appState.selectedUploadDataUrl = null;
        document.getElementById('inputFileImmagine').value = '';
        document.getElementById('uploadPreview').innerHTML = '';
    }

    // Reset preview
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imagePreview').innerHTML = '';

    updateSaveButton();
}

function searchArasaac() {
    const query = document.getElementById('inputSearchArasaac').value.trim();
    const resultsContainer = document.getElementById('arasaacResults');

    if (!query) {
        resultsContainer.innerHTML = '';
        return;
    }

    arasaacService.searchWithDebounce(query, (results) => {
        renderArasaacResults(results);
    });
}

function renderArasaacResults(results) {
    const container = document.getElementById('arasaacResults');

    if (!results || results.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; color: var(--text-light); text-align: center;">Nessun risultato</p>';
        return;
    }

    container.innerHTML = results.map(item => `
        <div class="arasaac-item ${appState.selectedArasaacId === item.id ? 'selected' : ''}"
             onclick="selectArasaac(${item.id}, '${item.url}')">
            <img src="${item.thumbnail}" alt="Pittogramma ${item.id}" loading="lazy">
        </div>
    `).join('');
}

function selectArasaac(id, url) {
    appState.selectedArasaacId = id;
    appState.selectedArasaacUrl = url;

    // Evidenzia selezione
    document.querySelectorAll('.arasaac-item').forEach(el => el.classList.remove('selected'));
    const selected = document.querySelector(`.arasaac-item[onclick*="selectArasaac(${id}"]`);
    if (selected) selected.classList.add('selected');

    // Mostra preview
    const preview = document.getElementById('imagePreview');
    preview.style.display = 'block';
    preview.innerHTML = `<img src="${url}" alt="Pittogramma selezionato">`;

    updateSaveButton();
}

function previewUploadImage() {
    const fileInput = document.getElementById('inputFileImmagine');
    const file = fileInput.files[0];

    if (!file) {
        appState.selectedUploadDataUrl = null;
        document.getElementById('uploadPreview').innerHTML = '';
        document.getElementById('imagePreview').style.display = 'none';
        updateSaveButton();
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        let dataUrl = e.target.result;
        try {
            dataUrl = await immagineComeDataUrl(dataUrl);   // max 600 px: localStorage ha spazio limitato
        } catch (err) {
            showToast('Immagine non leggibile', 'error');
            return;
        }
        appState.selectedUploadDataUrl = dataUrl;

        // Mostra preview
        const preview = document.getElementById('imagePreview');
        preview.style.display = 'block';
        preview.innerHTML = `<img src="${dataUrl}" alt="Immagine caricata">`;

        updateSaveButton();
    };
    reader.readAsDataURL(file);
}

function resetImageFields() {
    appState.selectedImageType = 'nessuna';
    appState.selectedArasaacId = null;
    appState.selectedArasaacUrl = null;
    appState.selectedUploadDataUrl = null;

    // Reset radio
    const radioNessuna = document.querySelector('input[name="tipoImmagine"][value="nessuna"]');
    if (radioNessuna) radioNessuna.checked = true;

    // Nascondi campi
    document.getElementById('fieldArasaac').style.display = 'none';
    document.getElementById('fieldUpload').style.display = 'none';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('inputSearchArasaac').value = '';
    document.getElementById('arasaacResults').innerHTML = '';
    document.getElementById('inputFileImmagine').value = '';
    document.getElementById('uploadPreview').innerHTML = '';
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
