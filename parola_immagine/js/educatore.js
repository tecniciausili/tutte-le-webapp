/**
 * Parola-Immagine - Area Educatore
 * AssistiveTech.it - Training Cognitivo
 *
 * L'educatore crea le coppie: TARGET (immagine giusta) e DISTRATTORE (immagine sbagliata),
 * ciascuna con la sua parola. Le immagini sono pittogrammi ARASAAC oppure foto del dispositivo.
 *
 * Versione autonoma: un dispositivo = un utente, nessun login e nessun server.
 * I dati stanno nel browser (js/archivio.js). Al salvataggio le immagini vengono
 * INCORPORATE nella coppia (data URL ridotto), così gli esercizi funzionano offline
 * e le immagini finiscono nell'esportazione.
 */

const ARASAAC_API = 'https://api.arasaac.org/api';
const ARASAAC_STATIC = 'https://static.arasaac.org/pictograms';

// Lato massimo delle immagini incorporate: pittogrammi (già 500 px) e foto
const LATO_MAX_PITTOGRAMMA = 500;
const LATO_MAX_FOTO = 800;

const appState = {
    selectedTarget: null,       // { id, name, url, foto }
    selectedDistractor: null,
    pairs: [],
    searchTimers: { target: null, distractor: null },
    searchSeq: { target: 0, distractor: 0 },
    salvataggioInCorso: false
};

document.addEventListener('DOMContentLoaded', () => {
    caricaImpostazioni();
    loadPairs();
    renderRisultati();
    document.getElementById('numProve').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveSettings();
    });
});

// ===== NAVIGAZIONE =====
function goBack() {
    window.location.href = './';              // pagina iniziale di Parola-Immagine
}

// =====================================================
// IMPOSTAZIONI SESSIONE E TESTO
// =====================================================
function caricaImpostazioni() {
    const imp = Archivio.getImpostazioni();
    document.getElementById('numProve').value = imp.numero_prove;

    const t = imp.testo;
    const carattere = document.getElementById('testoCarattere');
    if (![...carattere.options].some((o) => o.value === t.carattere)) {
        carattere.add(new Option(t.carattere.split(',')[0].replace(/['"]/g, ''), t.carattere));
    }
    carattere.value = t.carattere;
    document.getElementById('testoColore').value = t.coloreTesto;
    document.getElementById('testoSfondo').value = t.coloreSfondo;
    const spaz = document.getElementById('testoSpaziatura');
    if (![...spaz.options].some((o) => parseFloat(o.value) === t.spaziatura)) {
        spaz.add(new Option(`${t.spaziatura} em`, String(t.spaziatura)));
    }
    spaz.value = [...spaz.options].find((o) => parseFloat(o.value) === t.spaziatura).value;
    document.getElementById('testoMaiuscolo').checked = t.maiuscolo;
    document.getElementById('testoGrassetto').checked = t.grassetto;
    aggiornaAnteprimaTesto(t);
}

function saveSettings() {
    const campo = document.getElementById('numProve');
    const richiesto = parseInt(campo.value, 10);
    try {
        const imp = Archivio.salvaImpostazioni({ numero_prove: campo.value });
        campo.value = imp.numero_prove;
        if (richiesto !== imp.numero_prove) {
            showToast(`Valore corretto: da ${Archivio.PROVE_MIN} a ${Archivio.PROVE_MAX} prove`, 'warning');
        }
        showToast(`Impostazioni salvate: ${imp.numero_prove} prove per sessione`, 'success');
    } catch (e) {
        showToast('Impostazioni non salvate: ' + e.message, 'error');
    }
}

function leggiTestoDalModulo() {
    return {
        carattere: document.getElementById('testoCarattere').value,
        coloreTesto: document.getElementById('testoColore').value,
        coloreSfondo: document.getElementById('testoSfondo').value,
        spaziatura: parseFloat(document.getElementById('testoSpaziatura').value) || 0,
        maiuscolo: document.getElementById('testoMaiuscolo').checked,
        grassetto: document.getElementById('testoGrassetto').checked
    };
}

function salvaTesto() {
    try {
        const imp = Archivio.salvaImpostazioni({ testo: leggiTestoDalModulo() });
        aggiornaAnteprimaTesto(imp.testo);
        showToast('Testo delle parole salvato', 'success');
    } catch (e) {
        showToast('Impostazione non salvata: ' + e.message, 'error');
    }
}

function ripristinaTesto() {
    try {
        Archivio.salvaImpostazioni({ testo: { ...Archivio.TESTO_PREDEFINITO } });
        caricaImpostazioni();
        showToast('Testo delle parole ripristinato', 'success');
    } catch (e) {
        showToast('Impostazione non salvata: ' + e.message, 'error');
    }
}

function aggiornaAnteprimaTesto(t) {
    const el = document.getElementById('testoAnteprima');
    el.style.fontFamily = t.carattere;
    el.style.color = t.coloreTesto;
    el.style.backgroundColor = t.coloreSfondo;
    el.style.letterSpacing = `${t.spaziatura}em`;
    el.style.fontWeight = t.grassetto ? '700' : '400';
    el.textContent = t.maiuscolo ? 'CASA' : 'casa';
}

// =====================================================
// RICERCA ARASAAC
// =====================================================
function debounceSearch(type) {
    clearTimeout(appState.searchTimers[type]);
    appState.searchTimers[type] = setTimeout(() => searchArasaac(type), 400);
}

async function searchArasaac(type) {
    const input = document.getElementById(type === 'target' ? 'searchTarget' : 'searchDistractor');
    const grid = document.getElementById(type === 'target' ? 'gridTarget' : 'gridDistractor');
    const query = input.value.trim();
    const seq = ++appState.searchSeq[type];   // scarta le risposte di ricerche superate

    if (query.length < 2) {
        grid.innerHTML = `<div class="loading"><span>${query ? 'Inserisci almeno 2 caratteri...' : 'Inserisci una parola per cercare...'}</span></div>`;
        return;
    }
    if (!navigator.onLine) {
        grid.innerHTML = '<div class="loading"><span>Senza connessione: per ora carica un\'immagine dal dispositivo</span></div>';
        return;
    }

    grid.innerHTML = '<div class="loading"><div class="spinner"></div><span>Ricerca in corso...</span></div>';

    try {
        const response = await fetch(`${ARASAAC_API}/pictograms/it/search/${encodeURIComponent(query)}`);
        if (seq !== appState.searchSeq[type]) return;
        // ARASAAC risponde 404 quando non trova nulla
        const data = response.ok ? await response.json() : [];
        if (seq !== appState.searchSeq[type]) return;

        if (!Array.isArray(data) || data.length === 0) {
            grid.innerHTML = '<div class="loading"><span>Nessun risultato trovato</span></div>';
            return;
        }

        grid.innerHTML = '';
        data.slice(0, 24).forEach((item) => {
            const id = parseInt(item._id, 10);
            if (!id) return;

            // La parola cercata se il pittogramma la contiene, altrimenti la sua prima parola
            // chiave (la ricerca in /it/ restituisce già le parole in italiano)
            const parole = (item.keywords || []).map((k) => k && k.keyword).filter(Boolean);
            const uguale = parole.find((p) => p.toLowerCase() === query.toLowerCase());
            const name = uguale || parole[0] || query;
            const url = `${ARASAAC_STATIC}/${id}/${id}_500.png`;

            const div = document.createElement('button');
            div.type = 'button';
            div.className = 'pictogram-item';
            div.dataset.id = id;
            div.title = name;
            div.innerHTML = `<img src="${ARASAAC_STATIC}/${id}/${id}_300.png" alt="" loading="lazy"><div class="name"></div>`;
            div.querySelector('.name').textContent = name;
            div.addEventListener('click', () => selectPictogram(type, id, name, url));
            grid.appendChild(div);
        });
    } catch (error) {
        if (seq !== appState.searchSeq[type]) return;
        console.error('[ARASAAC] Errore:', error);
        grid.innerHTML = '<div class="loading"><span>Errore nella ricerca: controlla la connessione</span></div>';
    }
}

function selectPictogram(type, id, name, url) {
    const gridId = type === 'target' ? 'gridTarget' : 'gridDistractor';
    document.querySelectorAll(`#${gridId} .pictogram-item`).forEach((item) => {
        item.classList.toggle('selected', item.dataset.id === String(id));
    });
    mostraSelezione(type, { id, name, url, foto: false });
}

// =====================================================
// IMMAGINI DAL DISPOSITIVO (in alternativa ad ARASAAC)
// =====================================================
function chooseFile(type) {
    document.getElementById(type === 'target' ? 'fileTarget' : 'fileDistractor').click();
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
// Con trasparenza (pittogrammi, PNG ritagliati) resta PNG, altrimenti JPEG più leggero.
function immagineComeDataUrl(src, latoMax) {
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
                const alfa = ctx.getImageData(0, 0, w, h).data;
                let trasparente = false;
                for (let i = 3; i < alfa.length; i += 4) {
                    if (alfa[i] < 250) { trasparente = true; break; }
                }
                resolve(trasparente ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.86));
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => reject(new Error('Immagine non leggibile'));
        img.src = src;
    });
}

async function onFileChosen(type, input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
        showToast('Il file scelto non è un\'immagine', 'warning');
        return;
    }

    const preview = document.getElementById(type === 'target' ? 'previewTarget' : 'previewDistractor');
    preview.classList.remove('has-selection');
    preview.innerHTML = '<div class="spinner"></div><span>Preparazione immagine...</span>';

    try {
        const originale = await leggiFileComeDataUrl(file);
        const url = await immagineComeDataUrl(originale, LATO_MAX_FOTO);
        // La parola la propone il nome del file; l'educatore la corregge
        const parola = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
            .replace(/^(IMG|DSC|PXL|Photo|Foto)?\s*\d[\d\s]*$/i, '').trim().slice(0, Archivio.MAX_PAROLA);
        document.querySelectorAll(`#${type === 'target' ? 'gridTarget' : 'gridDistractor'} .pictogram-item`)
            .forEach((item) => item.classList.remove('selected'));
        mostraSelezione(type, { id: 0, name: parola, url, foto: true });
        showToast('Immagine pronta: controlla la parola', 'success');
    } catch (error) {
        console.error('[Immagine] Errore:', error);
        showToast('Immagine non leggibile: prova con un file JPG o PNG', 'error');
        resetPreview(type);
    }
}

// Anteprima della scelta con la parola sempre modificabile
function mostraSelezione(type, selezione) {
    if (type === 'target') appState.selectedTarget = selezione;
    else appState.selectedDistractor = selezione;

    const preview = document.getElementById(type === 'target' ? 'previewTarget' : 'previewDistractor');
    preview.classList.add('has-selection');
    preview.innerHTML = `
        <img alt="">
        <label class="word-label" for="word_${type}">Parola per questa immagine</label>
        <input type="text" id="word_${type}" class="word-input" maxlength="${Archivio.MAX_PAROLA}" placeholder="Scrivi la parola" autocomplete="off">
    `;
    preview.querySelector('img').src = selezione.url;
    const campo = preview.querySelector('.word-input');
    campo.value = selezione.name || '';
    campo.addEventListener('input', () => {
        selezione.name = campo.value;
        campo.classList.toggle('mancante', !campo.value.trim());
        updateSaveButton();
    });
    campo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !document.getElementById('btnSavePair').disabled) savePair();
    });
    campo.classList.toggle('mancante', !campo.value.trim());
    if (!campo.value.trim()) campo.focus();
    updateSaveButton();
}

function resetPreview(type) {
    const preview = document.getElementById(type === 'target' ? 'previewTarget' : 'previewDistractor');
    preview.classList.remove('has-selection');
    preview.innerHTML = `
        <i class="bi bi-image" style="font-size: 2rem; color: #ccc;"></i>
        <span style="color: #999;">Nessuna selezione</span>
    `;
    if (type === 'target') appState.selectedTarget = null;
    else appState.selectedDistractor = null;
    updateSaveButton();
}

function updateSaveButton() {
    const pronta = (sel) => sel && String(sel.name || '').trim() !== '';
    document.getElementById('btnSavePair').disabled = appState.salvataggioInCorso
        || !(pronta(appState.selectedTarget) && pronta(appState.selectedDistractor));
}

// =====================================================
// COPPIE
// =====================================================
async function incorpora(selezione) {
    if (String(selezione.url).startsWith('data:')) return selezione.url;
    try {
        return await immagineComeDataUrl(selezione.url, LATO_MAX_PITTOGRAMMA);
    } catch (e) {
        // Download non riuscito: resta il link (servirà la rete durante l'esercizio)
        console.warn('[ARASAAC] immagine non incorporata, resta il link', e);
        return selezione.url;
    }
}

async function savePair() {
    const t = appState.selectedTarget;
    const d = appState.selectedDistractor;
    if (!t || !d) {
        showToast('Seleziona sia il target che il distrattore', 'warning');
        return;
    }
    const parolaTarget = String(t.name || '').trim();
    const parolaDistrattore = String(d.name || '').trim();
    if (!parolaTarget || !parolaDistrattore) {
        showToast('Scrivi la parola di entrambe le immagini', 'warning');
        return;
    }
    if (parolaTarget.toLowerCase() === parolaDistrattore.toLowerCase()) {
        showToast('Target e distrattore devono avere parole diverse', 'warning');
        return;
    }

    const btn = document.getElementById('btnSavePair');
    appState.salvataggioInCorso = true;
    updateSaveButton();
    const testoBtn = btn.innerHTML;
    btn.innerHTML = '<div class="spinner spinner-chiaro"></div> Salvataggio...';

    try {
        const [urlT, urlD] = await Promise.all([incorpora(t), incorpora(d)]);
        const esito = await Archivio.salvaCoppia({
            parola_target: parolaTarget,
            id_pittogramma_target: t.id,            // 0 = immagine dal dispositivo
            url_immagine_target: urlT,
            parola_distrattore: parolaDistrattore,
            id_pittogramma_distrattore: d.id,
            url_immagine_distrattore: urlD
        });
        if (esito.success) {
            const avviso = [urlT, urlD].some((u) => !u.startsWith('data:'));
            showToast(avviso ? 'Coppia creata (immagine non copiata: servirà la rete)' : 'Coppia creata!', avviso ? 'warning' : 'success');
            resetCreateForm();
            await loadPairs();
        } else {
            showToast(esito.message || 'Errore nella creazione della coppia', 'error');
        }
    } catch (error) {
        console.error('[Coppie] Errore:', error);
        showToast(error.message || 'Errore nel salvataggio', 'error');
    } finally {
        appState.salvataggioInCorso = false;
        btn.innerHTML = testoBtn;
        updateSaveButton();
    }
}

function resetCreateForm() {
    ['target', 'distractor'].forEach((type) => {
        const maiuscolo = type === 'target' ? 'Target' : 'Distractor';
        document.getElementById(`search${maiuscolo}`).value = '';
        document.getElementById(`grid${maiuscolo}`).innerHTML =
            '<div class="loading"><span>Inserisci una parola per cercare...</span></div>';
        document.getElementById(`file${maiuscolo}`).value = '';
        resetPreview(type);
    });
}

async function loadPairs() {
    const grid = document.getElementById('pairsGrid');
    const countEl = document.getElementById('pairsCount');

    try {
        appState.pairs = await Archivio.getCoppie();
    } catch (error) {
        console.error('[Coppie] Errore:', error);
        grid.innerHTML = '';
        const msg = document.createElement('div');
        msg.className = 'loading';
        msg.textContent = error.message || 'Errore nel caricamento delle coppie';
        grid.appendChild(msg);
        return;
    }

    const n = appState.pairs.length;
    countEl.textContent = `${n} coppi${n === 1 ? 'a' : 'e'}`;

    if (n === 0) {
        grid.innerHTML = `
            <div class="loading">
                <i class="bi bi-inbox" style="font-size: 3rem; color: #ccc;"></i>
                <span>Nessuna coppia creata: comincia da «Crea Nuova Coppia»</span>
            </div>`;
        return;
    }

    grid.innerHTML = '';
    appState.pairs.forEach((pair) => grid.appendChild(createPairCard(pair)));
}

function createPairCard(pair) {
    const div = document.createElement('div');
    div.className = 'pair-card';
    div.innerHTML = `
        <div class="pair-images">
            <img class="pair-image target" alt="">
            <img class="pair-image distractor" alt="">
        </div>
        <div class="pair-info">
            <div class="pair-word">${escapeHtml(pair.parola_target)}</div>
            <div class="pair-labels">
                <span style="color: #2E7D32;">✓ ${escapeHtml(pair.parola_target)}</span> /
                <span style="color: #D32F2F;">✗ ${escapeHtml(pair.parola_distrattore)}</span>
            </div>
        </div>
        <button class="btn-delete" type="button" title="Elimina coppia" aria-label="Elimina la coppia ${escapeHtml(pair.parola_target)}">
            <i class="bi bi-trash3"></i>
        </button>
    `;
    const [imgT, imgD] = div.querySelectorAll('img');
    imgT.src = pair.url_immagine_target;
    imgT.alt = imgT.title = `Target: ${pair.parola_target}`;
    imgD.src = pair.url_immagine_distrattore;
    imgD.alt = imgD.title = `Distrattore: ${pair.parola_distrattore}`;
    div.querySelector('.btn-delete').addEventListener('click', () => deletePair(pair));
    return div;
}

async function deletePair(pair) {
    if (!confirm(`Eliminare la coppia «${pair.parola_target} / ${pair.parola_distrattore}»?`)) return;
    try {
        await Archivio.eliminaCoppia(pair.id_coppia);
        showToast('Coppia eliminata', 'success');
        await loadPairs();
    } catch (error) {
        console.error('[Coppie] Errore:', error);
        showToast(error.message || 'Errore nell\'eliminazione', 'error');
    }
}

// =====================================================
// RISULTATI (ultime sessioni)
// =====================================================
const NOMI_MODO = {
    'parola-immagine': 'Parola → Immagine',
    'immagine-parola': 'Immagine → Parola'
};

function dataLeggibile(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    const due = (n) => String(n).padStart(2, '0');
    return `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()} ${due(d.getHours())}:${due(d.getMinutes())}`;
}

function renderRisultati() {
    const wrap = document.getElementById('risultatiWrap');
    const sessioni = Archivio.getSessioni(20);
    document.getElementById('btnSvuotaRisultati').hidden = sessioni.length === 0;

    if (sessioni.length === 0) {
        wrap.innerHTML = '<p class="empty-message">Nessuna sessione svolta</p>';
        return;
    }

    const righe = sessioni.map((s) => {
        const corrette = s.risposte.filter((r) => r.esito === 'corretto').length;
        const errate = s.risposte.length - corrette;
        const perc = s.risposte.length ? Math.round((corrette / s.risposte.length) * 100) : 0;
        const prove = Math.max(0, ...s.risposte.map((r) => r.numero_prova || 0));
        const totali = Math.max(0, ...s.risposte.map((r) => r.numero_prove_totali || 0));
        const sbagliate = [...new Set(s.risposte.filter((r) => r.esito !== 'corretto').map((r) => r.parola_target))];
        const classe = perc >= 80 ? 'esito-ok' : perc >= 50 ? 'esito-medio' : 'esito-warn';
        return `
            <tr>
                <td>${escapeHtml(dataLeggibile(s.data))}</td>
                <td>${escapeHtml(NOMI_MODO[s.modo] || s.modo || '-')}</td>
                <td>${prove}${totali ? ` / ${totali}` : ''}</td>
                <td><span class="badge correct">${corrette} ✓</span> <span class="badge wrong">${errate} ✗</span></td>
                <td class="${classe}">${perc}%</td>
                <td>${sbagliate.length ? escapeHtml(sbagliate.join(', ')) : '—'}</td>
            </tr>`;
    }).join('');

    wrap.innerHTML = `
        <table class="results-table risultati-table">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Esercizio</th>
                    <th>Prove</th>
                    <th>Risposte</th>
                    <th>Corrette</th>
                    <th>Parole sbagliate</th>
                </tr>
            </thead>
            <tbody>${righe}</tbody>
        </table>`;
}

function svuotaRisultati() {
    if (!confirm('Cancellare tutti i risultati delle sessioni?\n\nLe coppie e le impostazioni restano.')) return;
    Archivio.svuotaRisultati();
    renderRisultati();
    showToast('Risultati cancellati', 'success');
}
