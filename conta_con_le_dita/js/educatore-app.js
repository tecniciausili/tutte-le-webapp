/**
 * Conta con le Dita - Area Educatore
 * AssistiveTech.it - Training Cognitivo
 *
 * L'educatore sceglie un'immagine di dita dalla galleria (cartella assets/dita/)
 * e scrive i 3 numeri che l'utente vedrà nei box in basso: uno corrisponde alle
 * dita mostrate (riconosciuto dal nome del file), gli altri due sono distrattori.
 */

// App autonoma: nessun server, dati in localStorage (vedi js/archivio.js).

const appState = {
    gallery: [],          // [{file, url, numero}]
    selectedImage: null,  // elemento della galleria scelto
    exercises: [],
    risultati: []
};

document.addEventListener('DOMContentLoaded', () => {
    loadGallery();
    loadExercises();
    loadRisultati();
    document.getElementById('fileImporta')?.addEventListener('change', alFileImporta);
});

// ===== NAVIGAZIONE =====
function goHome() {
    window.location.href = '../';   // Tutte le Web App
}

function goBack() {
    window.location.href = './';   // pagina iniziale di Conta con le dita
}

function goToExercise() {
    window.location.href = 'esercizio.html';
}

// ===== GALLERIA IMMAGINI DITA =====
function loadGallery(mostraToast = false) {
    appState.gallery = Archivio.galleria();
    renderGallery();

    if (mostraToast) {
        showToast(`${appState.gallery.length} immagini disponibili`, 'success');
    }
}

function renderGallery() {
    const container = document.getElementById('ditaGallery');
    const emptyBox = document.getElementById('galleryEmpty');
    const countEl = document.getElementById('galleryCount');

    if (appState.gallery.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        emptyBox.classList.remove('hidden');
        countEl.textContent = '';
        return;
    }

    container.classList.remove('hidden');
    emptyBox.classList.add('hidden');

    const filtro = (document.getElementById('inputFiltroImmagini')?.value || '').trim().toLowerCase();
    const lista = filtro
        ? appState.gallery.filter(img =>
            img.file.toLowerCase().includes(filtro) || String(img.numero) === filtro)
        : appState.gallery;

    const nonRiconosciute = appState.gallery.filter(i => i.numero === null).length;
    countEl.textContent = `${appState.gallery.length} immagini` +
        (nonRiconosciute ? ` · ${nonRiconosciute} da rinominare` : '');

    container.innerHTML = '';

    if (lista.length === 0) {
        container.innerHTML = '<p class="empty-message" style="grid-column: 1/-1;">Nessuna immagine corrisponde al filtro</p>';
        return;
    }

    lista.forEach(img => {
        const item = document.createElement('div');
        item.className = 'dita-item' + (img.numero === null ? ' unknown' : '');
        if (appState.selectedImage && appState.selectedImage.file === img.file) {
            item.classList.add('selected');
        }
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', img.numero === null
            ? `${img.file}, numero non riconosciuto`
            : `${img.numero} dita, file ${img.file}`);

        item.innerHTML = `
            <span class="dita-badge">${img.numero === null ? '?' : img.numero}</span>
            <img src="${img.url}" alt="${img.file}" loading="lazy">
            <span class="dita-file">${img.file}</span>
        `;

        const scegli = () => selectImage(img);
        item.onclick = scegli;
        item.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scegli(); }
        };

        container.appendChild(item);
    });
}

function selectImage(img) {
    if (img.numero === null) {
        showToast(`Dal nome "${img.file}" non si capisce il numero di dita. Rinominalo, es. dita_3.png`, 'error');
        return;
    }

    appState.selectedImage = img;
    renderGallery();

    document.getElementById('selectedPreview').classList.remove('hidden');
    document.getElementById('selectedPreviewImg').src = img.url;
    document.getElementById('selectedPreviewNumber').textContent = `${img.numero} dita`;
    document.getElementById('selectedPreviewFile').textContent = img.file;

    onNumeriChange();
}

// ===== TRE NUMERI =====
function lettiNumeri() {
    return [0, 1, 2].map(i => {
        const val = document.getElementById(`inputNumero${i}`).value.trim();
        return val === '' ? null : parseInt(val);
    });
}

function onNumeriChange() {
    const numeri = lettiNumeri();
    const corretto = appState.selectedImage ? appState.selectedImage.numero : null;

    numeri.forEach((n, i) => {
        const box = document.getElementById(`numeroBox${i}`);
        const flag = document.getElementById(`numeroFlag${i}`);
        const isCorrect = corretto !== null && n !== null && n === corretto;
        box.classList.toggle('is-correct', isCorrect);
        flag.textContent = isCorrect ? '✓ corretto' : '';
    });
}

// ===== AGGIUNGI ESERCIZIO =====
function addExercise() {
    if (!appState.selectedImage) {
        showToast('Scegli un\'immagine dalla galleria', 'error');
        return;
    }

    const numeri = lettiNumeri();

    if (numeri.some(n => n === null || isNaN(n))) {
        showToast('Compila tutti e 3 i numeri', 'error');
        return;
    }
    if (new Set(numeri).size !== 3) {
        showToast('I 3 numeri devono essere diversi fra loro', 'error');
        return;
    }
    if (!numeri.includes(appState.selectedImage.numero)) {
        showToast(`Uno dei 3 numeri deve essere ${appState.selectedImage.numero} (le dita mostrate)`, 'error');
        return;
    }

    const data = Archivio.salvaConfig({
        immagine: appState.selectedImage.file,
        numeri: numeri,
        mescola: document.getElementById('inputMescola').checked ? 1 : 0
    });

    if (data.success) {
        showToast('Esercizio aggiunto!', 'success');
        resetForm();
        loadExercises();
    } else {
        showToast(data.message || 'Errore salvataggio', 'error');
    }
}

function resetForm() {
    appState.selectedImage = null;
    [0, 1, 2].forEach(i => {
        document.getElementById(`inputNumero${i}`).value = '';
        document.getElementById(`numeroBox${i}`).classList.remove('is-correct');
        document.getElementById(`numeroFlag${i}`).textContent = '';
    });
    document.getElementById('inputMescola').checked = true;
    document.getElementById('selectedPreview').classList.add('hidden');
    renderGallery();
}

// ===== LISTA ESERCIZI =====
function loadExercises() {
    appState.exercises = Archivio.getConfigList();
    renderExercisesList();
}

function renderExercisesList() {
    const container = document.getElementById('exercisesList');
    document.getElementById('exerciseCount').textContent = appState.exercises.length;

    if (appState.exercises.length === 0) {
        container.innerHTML = '<p class="empty-message">Nessun esercizio creato</p>';
        return;
    }

    container.innerHTML = '';
    appState.exercises.forEach(ex => {
        const card = document.createElement('div');
        card.className = 'exercise-card';

        const chips = (ex.numeri || [])
            .map(n => `<span class="ex-num-chip ${n === ex.numero_corretto ? 'correct' : ''}">${n}</span>`)
            .join('');

        card.innerHTML = `
            <img class="ex-img" src="${ex.url_immagine}" alt="${ex.immagine}">
            <div class="ex-info">
                <div class="ex-numeri">${chips}</div>
                <div class="ex-meta">
                    ${ex.immagine} · ${ex.numero_corretto} dita ·
                    ${ex.mescola ? 'posizioni mescolate' : 'ordine fisso'} ·
                    ${ex.data_creazione || ''}
                </div>
            </div>
            <button class="btn-delete" title="Elimina esercizio" aria-label="Elimina esercizio">
                <i class="bi bi-trash3"></i>
            </button>
        `;
        card.querySelector('.btn-delete').onclick = () => deleteExercise(ex.id_config, ex.numero_corretto);
        container.appendChild(card);
    });
}

function deleteExercise(id_config, numero) {
    if (!confirm(`Eliminare l'esercizio con ${numero} dita?`)) return;

    const data = Archivio.eliminaConfig(id_config);
    if (data.success) {
        showToast('Esercizio eliminato', 'success');
        loadExercises();
        loadRisultati();
    } else {
        showToast(data.message || 'Errore eliminazione', 'error');
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
        wrap.innerHTML = '<p class="empty-message">Nessun esercizio ancora svolto</p>';
        return;
    }

    const righe = appState.risultati.map(r => {
        const errori = parseInt(r.errori) || 0;
        const classe = errori === 0 ? 'esito-ok' : 'esito-warn';
        const esito = errori === 0 ? 'Al primo colpo' : `${errori} error${errori === 1 ? 'e' : 'i'}`;
        return `
            <tr>
                <td>${r.data_esecuzione || '-'}</td>
                <td>${r.numero_corretto}</td>
                <td class="${classe}">${esito}</td>
                <td>${r.tempo_secondi || 0} sec</td>
                <td>${r.immagine || '-'}</td>
            </tr>
        `;
    }).join('');

    wrap.innerHTML = `
        <table class="risultati-table">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Numero</th>
                    <th>Esito</th>
                    <th>Tempo</th>
                    <th>Immagine</th>
                </tr>
            </thead>
            <tbody>${righe}</tbody>
        </table>
    `;
}

// ===== COPIA DEI DATI: ESPORTA / IMPORTA =====
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
        const blob = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conta-con-le-dita-${dataPerNomeFile()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        const n = (dati.config || []).length;
        showToast(`Dati esportati (${n} esercizi${(dati.risultati || []).length ? ' + risultati' : ''})`, 'success');
    } catch (e) {
        showToast('Esportazione non riuscita: ' + e.message, 'error');
    }
}

function importaBackup() {
    if (!confirm('IMPORTA DATI\n\nGli esercizi e i risultati di questo dispositivo verranno '
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
