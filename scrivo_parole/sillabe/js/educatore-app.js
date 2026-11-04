/**
 * SCRIVO PAROLE CON LE SILLABE - Area Educatore
 * Versione 5.0.0 (autonoma)
 *
 * Gestione esercizi: sillabe disponibili, parole target, accessibilità.
 * Nessun server né login: un dispositivo = un utente, dati in localStorage
 * tramite js/archivio.js (Archivio).
 */

// ============================================
// CONFIGURAZIONE
// ============================================

const APP_CONFIG = {
    name: 'Scrivo Parole con le Sillabe - Educatore',
    version: '5.0.0',
};

const ARASAAC_API = 'https://api.arasaac.org/api';
const ARASAAC_STATIC = 'https://static.arasaac.org/pictograms';
// Lato massimo dei pittogrammi incorporati: un esercizio può avere più parole,
// localStorage ha spazio limitato (circa 5 MB per tutto il sito).
const LATO_MAX_PITTOGRAMMA = 400;

const ACCESSIBILITA_DEFAULT = { fontSize: 2.5, bgColor: '#E3F2FD', textColor: '#1565C0' };

// ============================================
// STATO APPLICAZIONE
// ============================================

let appState = {
    syllables: [],
    targetWords: [],
    exercises: [],
    accessibility: { ...ACCESSIBILITA_DEFAULT },
    saving: false,
};

let ui = {};
let statsChart = null;

// ============================================
// INIZIALIZZAZIONE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log(`${APP_CONFIG.name} v${APP_CONFIG.version} caricato`);

    cacheUIRefs();
    bindEvents();
    renderSyllables();
    renderTargetWords();
    updateAccessibility();
    loadExercises();
});

function cacheUIRefs() {
    ui = {
        syllableInput: document.getElementById('syllableInput'),
        selectedSyllables: document.getElementById('selectedSyllables'),
        targetWordInput: document.getElementById('targetWordInput'),
        selectedTargetWords: document.getElementById('selectedTargetWords'),
        fontSizeSlider: document.getElementById('fontSizeSlider'),
        fontSizeValue: document.getElementById('fontSizeValue'),
        bgColorPicker: document.getElementById('bgColorPicker'),
        textColorPicker: document.getElementById('textColorPicker'),
        previewContainer: document.getElementById('previewContainer'),
        btnSaveExercise: document.getElementById('btnSaveExercise'),
        statusMessage: document.getElementById('statusMessage'),
        exercisesList: document.getElementById('exercisesList'),
        exerciseCount: document.getElementById('exerciseCount'),
    };
}

// Gli input hanno già onkeydown="on...Keydown(event)" nell'HTML: qui solo il file d'importazione.
function bindEvents() {
    document.getElementById('fileImporta')?.addEventListener('change', alFileImporta);
}

// ============================================
// NAVIGAZIONE
// ============================================

function goBack() {
    window.location.href = './';   // pagina iniziale di Scrivo parole con le sillabe
}

function goHome() {
    window.location.href = '../../';   // Tutte le Web App
}

// ============================================
// UTILITÀ
// ============================================

// Testo sicuro da inserire nell'HTML
function esc(testo) {
    return String(testo ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

// Solo lettere (accentate comprese) e apostrofo, in maiuscolo, senza spazi
function pulisciVoce(testo) {
    return String(testo || '').toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ']/g, '');
}

// ============================================
// GESTIONE SILLABE
// ============================================

function addSyllableFromInput() {
    const input = ui.syllableInput;
    if (!input) return;

    // Si possono scrivere più sillabe insieme: "CA, NE MA"
    const nuove = input.value.split(/[\s,;]+/).map(pulisciVoce).filter(Boolean);
    if (nuove.length === 0) return;

    let doppie = 0;
    nuove.forEach((s) => {
        if (appState.syllables.includes(s)) doppie++;
        else appState.syllables.push(s);
    });
    if (doppie) showToast(doppie === 1 ? 'Sillaba già presente!' : `${doppie} sillabe erano già presenti`, 'warning');

    input.value = '';
    input.focus();

    renderSyllables();
    updatePreview();
    updateSaveButtonState();
}

function onSyllableKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addSyllableFromInput();
    }
}

function removeSyllable(index) {
    appState.syllables.splice(index, 1);
    renderSyllables();
    updatePreview();
    updateSaveButtonState();
}

function renderSyllables() {
    const container = ui.selectedSyllables;
    if (!container) return;

    if (appState.syllables.length === 0) {
        container.innerHTML = '<p style="color: #999; font-style: italic; margin: 0;">Nessuna sillaba inserita</p>';
        return;
    }

    container.innerHTML = appState.syllables.map((s, i) => `
        <span class="syllable-tag" onclick="removeSyllable(${i})" title="Clicca per rimuovere">
            ${esc(s)}
            <i class="bi bi-x remove-syllable"></i>
        </span>
    `).join('');
}

function addCommonSyllables() {
    const common = ['CA', 'CO', 'CU', 'CE', 'CI', 'MA', 'ME', 'MI', 'MO', 'MU', 'PA', 'PE', 'PI', 'PO', 'PU',
                    'TA', 'TE', 'TI', 'TO', 'TU', 'LA', 'LE', 'LI', 'LO', 'LU', 'NA', 'NE', 'NI', 'NO', 'NU',
                    'SA', 'SE', 'SI', 'SO', 'SU', 'RA', 'RE', 'RI', 'RO', 'RU'];

    common.forEach((s) => {
        if (!appState.syllables.includes(s)) {
            appState.syllables.push(s);
        }
    });

    renderSyllables();
    updatePreview();
    updateSaveButtonState();
    showToast('Sillabe comuni aggiunte!', 'success');
}

function clearSyllables() {
    if (appState.syllables.length === 0) return;

    if (!confirm('Vuoi rimuovere tutte le sillabe?')) return;

    appState.syllables = [];
    renderSyllables();
    updatePreview();
    updateSaveButtonState();
}

// ============================================
// GESTIONE PAROLE TARGET
// ============================================

function addTargetWordFromInput() {
    const input = ui.targetWordInput;
    if (!input) return;

    const nuove = input.value.split(/[\s,;]+/).map(pulisciVoce).filter(Boolean);
    if (nuove.length === 0) return;

    let doppie = 0;
    nuove.forEach((w) => {
        if (appState.targetWords.includes(w)) doppie++;
        else appState.targetWords.push(w);
    });
    if (doppie) showToast(doppie === 1 ? 'Parola già presente!' : `${doppie} parole erano già presenti`, 'warning');

    input.value = '';
    input.focus();

    renderTargetWords();
    updatePreview();
    updateSaveButtonState();
}

function onWordKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addTargetWordFromInput();
    }
}

function removeTargetWord(index) {
    appState.targetWords.splice(index, 1);
    renderTargetWords();
    updatePreview();
    updateSaveButtonState();
}

function renderTargetWords() {
    const container = ui.selectedTargetWords;
    if (!container) return;

    if (appState.targetWords.length === 0) {
        container.innerHTML = '<p style="color: #999; font-style: italic; margin: 0;">Nessuna parola target inserita</p>';
        return;
    }

    container.innerHTML = appState.targetWords.map((w, i) => {
        // Avvisa subito se la parola non si può comporre con le sillabe inserite
        const ok = appState.syllables.length === 0 || Archivio.scomponi(w, appState.syllables);
        const avviso = ok ? '' : ' style="border-color: #d32f2f; color: #d32f2f;" title="Non si compone con le sillabe inserite: clicca per rimuovere"';
        return `
        <span class="word-tag" onclick="removeTargetWord(${i})"${avviso || ' title="Clicca per rimuovere"'}>
            ${esc(w)}${ok ? '' : ' <i class="bi bi-exclamation-triangle"></i>'}
            <i class="bi bi-x remove-word"></i>
        </span>
    `;
    }).join('');
}

// ============================================
// ACCESSIBILITÀ
// ============================================

function remToPt(rem) {
    return Math.round(rem * 12);
}

function updateAccessibility() {
    const fontSize = parseFloat(ui.fontSizeSlider?.value || ACCESSIBILITA_DEFAULT.fontSize);
    const bgColor = ui.bgColorPicker?.value || ACCESSIBILITA_DEFAULT.bgColor;
    const textColor = ui.textColorPicker?.value || ACCESSIBILITA_DEFAULT.textColor;

    appState.accessibility = { fontSize, bgColor, textColor };

    if (ui.fontSizeValue) {
        ui.fontSizeValue.textContent = `${fontSize} rem (~${remToPt(fontSize)}pt)`;
    }

    updatePreview();
}

// ============================================
// ANTEPRIMA
// ============================================

function updatePreview() {
    const container = ui.previewContainer;
    if (!container) return;

    renderTargetWords();

    if (appState.syllables.length < 2 || appState.targetWords.length === 0) {
        container.innerHTML = '<p class="preview-empty">Inserisci almeno 2 sillabe e 1 parola target per vedere l\'anteprima</p>';
        return;
    }

    const { fontSize, bgColor, textColor } = appState.accessibility;
    const shuffled = [...appState.syllables].sort(() => Math.random() - 0.5);

    container.innerHTML = `
        <div style="text-align: center; width: 100%;">
            <p style="color: #666; margin-bottom: 1rem;">
                <strong>Parole target:</strong> ${esc(appState.targetWords.join(', '))}
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center;">
                ${shuffled.map((s) => `
                    <div class="syllable-box" style="font-size: ${fontSize}rem; background: ${bgColor}; color: ${textColor}; border-color: ${textColor}; cursor: default;">
                        ${esc(s)}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ============================================
// PITTOGRAMMI ARASAAC (incorporati nell'esercizio)
// ============================================

// Ridimensiona un'immagine (src = URL o data URL) e la restituisce come data URL.
// Serve a incorporarla nell'esercizio: funziona offline e finisce nell'esportazione.
function immagineComeDataUrl(src, latoMax = LATO_MAX_PITTOGRAMMA) {
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
                // Se c'è trasparenza (i pittogrammi la hanno) serve il PNG: col JPEG
                // le parti trasparenti diventerebbero nere.
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

// Cerca il primo pittogramma ARASAAC della parola e lo scarica come data URL.
// Senza rete (o senza risultati) restituisce null: l'esercizio mostrerà la parola scritta.
async function pittogrammaComeDataUrl(parola) {
    try {
        const r = await fetch(`${ARASAAC_API}/pictograms/it/search/${encodeURIComponent(parola.toLowerCase())}`);
        if (!r.ok) return null;
        const dati = await r.json();
        if (!Array.isArray(dati) || dati.length === 0) return null;
        const id = dati[0]._id;
        return await immagineComeDataUrl(`${ARASAAC_STATIC}/${id}/${id}_500.png`);
    } catch (e) {
        console.warn(`Pittogramma non disponibile per "${parola}":`, e.message || e);
        return null;
    }
}

// ============================================
// SALVATAGGIO ESERCIZIO
// ============================================

function updateSaveButtonState() {
    const canSave = !appState.saving &&
                    appState.syllables.length >= 2 &&
                    appState.targetWords.length >= 1;

    if (ui.btnSaveExercise) {
        ui.btnSaveExercise.disabled = !canSave;
    }
}

async function saveExercise() {
    if (appState.saving) return;

    if (appState.syllables.length < 2) {
        showStatus('Inserisci almeno 2 sillabe!', 'error');
        return;
    }

    if (appState.targetWords.length === 0) {
        showStatus('Inserisci almeno 1 parola target!', 'error');
        return;
    }

    const impossibili = appState.targetWords.filter((w) => !Archivio.scomponi(w, appState.syllables));
    if (impossibili.length) {
        showStatus(`❌ Con queste sillabe non si può comporre: ${impossibili.join(', ')}`, 'error');
        return;
    }

    appState.saving = true;
    updateSaveButtonState();
    showStatus('⏳ Scarico i pittogrammi ARASAAC...', 'info');

    try {
        // Pittogrammi scaricati ora e incorporati: l'esercizio funziona anche offline
        const immagini = {};
        for (const parola of appState.targetWords) {
            const dataUrl = await pittogrammaComeDataUrl(parola);
            if (dataUrl) immagini[parola] = dataUrl;
        }

        const esito = Archivio.salvaEsercizio({
            sillabe_disponibili: [...appState.syllables],
            parole_target: [...appState.targetWords],
            font_size: appState.accessibility.fontSize,
            bg_color: appState.accessibility.bgColor,
            text_color: appState.accessibility.textColor,
            immagini,
        });

        if (!esito.success) {
            showStatus(`❌ ${esito.message}`, 'error');
            return;
        }

        const senza = appState.targetWords.length - Object.keys(immagini).length;
        showStatus(
            `✅ Esercizio salvato con ${appState.targetWords.length} parole target!`
            + (senza ? ` (${senza} senza pittogramma: si vedrà la parola scritta)` : ''),
            'success'
        );
        resetForm();
        loadExercises();
    } catch (error) {
        console.error('❌ Errore salvataggio:', error);
        showStatus(`❌ ${error.message}`, 'error');
    } finally {
        appState.saving = false;
        updateSaveButtonState();
    }
}

function resetForm() {
    appState.syllables = [];
    appState.targetWords = [];

    if (ui.syllableInput) ui.syllableInput.value = '';
    if (ui.targetWordInput) ui.targetWordInput.value = '';
    if (ui.fontSizeSlider) ui.fontSizeSlider.value = ACCESSIBILITA_DEFAULT.fontSize;
    if (ui.bgColorPicker) ui.bgColorPicker.value = ACCESSIBILITA_DEFAULT.bgColor;
    if (ui.textColorPicker) ui.textColorPicker.value = ACCESSIBILITA_DEFAULT.textColor;

    appState.accessibility = { ...ACCESSIBILITA_DEFAULT };

    renderSyllables();
    renderTargetWords();
    updateAccessibility();
    updatePreview();
    updateSaveButtonState();
}

// ============================================
// LISTA ESERCIZI
// ============================================

function loadExercises() {
    if (!ui.exercisesList) return;

    const exercises = Archivio.getEsercizi();
    appState.exercises = exercises;

    if (ui.exerciseCount) {
        ui.exerciseCount.textContent = exercises.length;
    }

    if (exercises.length === 0) {
        ui.exercisesList.innerHTML = '<p class="empty-message">Nessun esercizio creato</p>';
        return;
    }

    ui.exercisesList.innerHTML = exercises.map((ex) => {
        const syllables = ex.sillabe_disponibili;
        const targetWords = ex.parole_target;
        const dateStr = ex.data_creazione ? new Date(ex.data_creazione).toLocaleDateString('it-IT') : '';
        const conImmagine = targetWords.filter((w) => ex.immagini[w]).length;

        return `
            <div class="exercise-item">
                <i class="bi bi-puzzle"></i>
                <div class="exercise-item-content">
                    <strong>${esc(targetWords.join(', '))}</strong>
                    <small>${syllables.length} sillabe • ${targetWords.length} parole target • ${conImmagine} pittogrammi</small>
                    ${dateStr ? `<small style="display: block; color: #999; font-size: 0.75rem;">${dateStr}</small>` : ''}
                </div>
                <button class="btn-delete" onclick="deleteExercise(${ex.id_esercizio})" title="Elimina" aria-label="Elimina esercizio">
                    <i class="bi bi-trash3"></i>
                </button>
            </div>
        `;
    }).join('');
}

function deleteExercise(exerciseId) {
    if (!confirm('Eliminare questo esercizio?')) return;

    try {
        Archivio.eliminaEsercizio(exerciseId);
        showToast('Esercizio eliminato', 'success');
    } catch (e) {
        showToast('Eliminazione non riuscita: ' + e.message, 'error');
    }
    loadExercises();
}

// ============================================
// STATISTICHE
// ============================================

let statsData = null;

function showStatistics() {
    const modal = document.getElementById('statsModal');
    if (!modal) return;

    modal.classList.add('active');

    statsData = Archivio.getStatistiche();
    populateWordFilter(statsData.per_parola || []);
    renderStatsChart(statsData.per_parola || [], 'tutti');
}

function populateWordFilter(stats) {
    const select = document.getElementById('statsWordFilter');
    if (!select) return;

    select.innerHTML = '<option value="tutti">📊 Tutti i risultati</option>';

    const parole = [...new Set(stats.map((s) => s.parola_target))].filter(Boolean);
    parole.forEach((parola) => {
        const option = document.createElement('option');
        option.value = parola;
        option.textContent = `📝 ${parola}`;
        select.appendChild(option);
    });
}

function filterStatsByWord(parola) {
    if (!statsData) return;

    const allStats = statsData.per_parola || [];

    if (parola === 'tutti') {
        renderStatsChart(allStats, 'tutti');
    } else {
        renderStatsChart(allStats.filter((s) => s.parola_target === parola), parola);
    }
}

// Tabella di riserva, se il grafico non si può disegnare
function statsTable(stats) {
    return `
        <table style="width: 100%; border-collapse: collapse; font-size: 1.05rem;">
            <thead>
                <tr style="text-align: left; border-bottom: 2px solid var(--primary-color);">
                    <th style="padding: 0.5rem;">Parola</th>
                    <th style="padding: 0.5rem;">Tentativi</th>
                    <th style="padding: 0.5rem;">✅ Corrette</th>
                    <th style="padding: 0.5rem;">❌ Errate</th>
                </tr>
            </thead>
            <tbody>
                ${stats.map((s) => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 0.5rem;"><strong>${esc(s.parola_target)}</strong></td>
                        <td style="padding: 0.5rem;">${s.totale}</td>
                        <td style="padding: 0.5rem;">${s.corrette}</td>
                        <td style="padding: 0.5rem;">${s.errate}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderStatsChart(stats, filterLabel) {
    const container = document.getElementById('statsChartContainer');
    if (!container) return;

    if (statsChart) {
        statsChart.destroy();
        statsChart = null;
    }

    if (stats.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; font-size: 1.2rem;"><i class="bi bi-inbox"></i><br>Nessun risultato registrato.</p>';
        return;
    }

    if (typeof Chart === 'undefined') {
        container.innerHTML = statsTable(stats);
        return;
    }

    const labels = stats.map((s) => s.parola_target);
    const corrette = stats.map((s) => s.corrette);
    const errate = stats.map((s) => s.errate);
    const totali = stats.map((s) => s.totale);

    const chartTitle = filterLabel === 'tutti'
        ? 'Risultati per Tutte le Parole Target'
        : `Risultati per: "${filterLabel}"`;

    container.innerHTML = '<div style="position: relative; width: 100%; height: 450px;"><canvas id="statsChart"></canvas></div>';

    try {
        const ctx = document.getElementById('statsChart').getContext('2d');
        statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: '✅ Corrette',
                        data: corrette,
                        backgroundColor: 'rgba(76, 175, 80, 0.85)',
                        borderColor: 'rgba(76, 175, 80, 1)',
                        borderWidth: 2,
                        borderRadius: 6,
                        barPercentage: 0.4,
                    },
                    {
                        label: '❌ Errate',
                        data: errate,
                        backgroundColor: 'rgba(244, 67, 54, 0.85)',
                        borderColor: 'rgba(244, 67, 54, 1)',
                        borderWidth: 2,
                        borderRadius: 6,
                        barPercentage: 0.4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: chartTitle,
                        font: { size: 20, weight: 'bold' },
                        padding: { bottom: 20 },
                    },
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 14 }, padding: 20 },
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel(context) {
                                const tot = totali[context.dataIndex];
                                const perc = tot > 0 ? Math.round((context.raw / tot) * 100) : 0;
                                return `${perc}% del totale (${tot} tentativi)`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Parole Target', font: { size: 14, weight: 'bold' } },
                        ticks: { font: { size: 13 } },
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Numero Risposte', font: { size: 14, weight: 'bold' } },
                        ticks: { stepSize: 1, font: { size: 12 } },
                    },
                },
            },
        });
    } catch (e) {
        console.warn('Grafico non disponibile, mostro la tabella:', e);
        container.innerHTML = statsTable(stats);
    }
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
}

// ============================================
// COPIA DEI DATI: ESPORTA / IMPORTA
// ============================================
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
        a.download = `scrivo-parole-sillabe-${dataPerNomeFile()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(`Dati esportati (${(dati.config || []).length} esercizi)`, 'success');
    } catch (e) {
        showToast('Esportazione non riuscita: ' + e.message, 'error');
    }
}

function importaBackup() {
    if (!confirm('IMPORTA DATI\n\nEsercizi, impostazioni e risultati di questo dispositivo verranno '
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
        showToast(`Importati ${esito.config} esercizi. Ricarico...`, 'success');
        setTimeout(() => window.location.reload(), 900);
    } catch (err) {
        showToast('Importazione non riuscita: ' + err.message, 'error');
    }
}

// ============================================
// MESSAGGI
// ============================================

function showStatus(message, type) {
    if (!ui.statusMessage) return;
    ui.statusMessage.className = `status-message ${type}`;
    ui.statusMessage.textContent = message;

    if (type !== 'info') {
        setTimeout(() => {
            ui.statusMessage.className = 'status-message';
            ui.statusMessage.textContent = '';
        }, 5000);
    }
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
window.addSyllableFromInput = addSyllableFromInput;
window.onSyllableKeydown = onSyllableKeydown;
window.removeSyllable = removeSyllable;
window.addCommonSyllables = addCommonSyllables;
window.clearSyllables = clearSyllables;
window.addTargetWordFromInput = addTargetWordFromInput;
window.onWordKeydown = onWordKeydown;
window.removeTargetWord = removeTargetWord;
window.updateAccessibility = updateAccessibility;
window.saveExercise = saveExercise;
window.resetForm = resetForm;
window.deleteExercise = deleteExercise;
window.showStatistics = showStatistics;
window.filterStatsByWord = filterStatsByWord;
window.closeModal = closeModal;
window.esportaBackup = esportaBackup;
window.importaBackup = importaBackup;
