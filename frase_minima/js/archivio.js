// ==================== ARCHIVIO LOCALE ====================
// Frase Minima - versione autonoma (come le altre app della raccolta).
// UN DISPOSITIVO = UN UTENTE, nessun server: tutto in localStorage.
//
// Le chiavi hanno il prefisso "fm_" perché sullo stesso dominio ci sono altre
// app: i loro dati NON vanno toccati.
//
//  - fm_config        → frasi (soggetto, predicato, complemento: testo + immagine)
//  - fm_risultati     → storico delle frasi composte (errori, tempo)
//  - fm_impostazioni  → impostazioni del menu dell'Area Utente (voce, aiuto, scala…)
//  - fm_scala_testo   → dimensione del testo sotto i pittogrammi
//  - fm_bordi_colorati→ indizio colore dei bordi ('1' / '0')
//
// Prende il posto del vecchio archivio sul server del portale e
// restituisce gli stessi campi che l'interfaccia si aspetta: ogni frase ha
// elementi = [{ruolo, testo, url, id_arasaac}] nell'ordine della frase.

const Archivio = (() => {
  const CHIAVI = {
    config: 'fm_config',
    risultati: 'fm_risultati',
    impostazioni: 'fm_impostazioni',
    scalaTesto: 'fm_scala_testo',
    bordi: 'fm_bordi_colorati',
  };
  const APP = 'frase-minima';
  const RUOLI = ['soggetto', 'predicato', 'complemento'];
  const ETICHETTE = {
    soggetto: 'soggetto (box blu)',
    predicato: 'predicato (box rosso)',
    complemento: 'complemento (box verde)',
  };
  const MAX_TESTO = 60;
  const MAX_FRASE = 200;
  const MAX_RISULTATI = 2000;

  // ==================== UTILITÀ ====================

  function leggiJSON(chiave, predefinito) {
    try {
      const v = localStorage.getItem(chiave);
      return v ? JSON.parse(v) : predefinito;
    } catch (e) {
      console.error(`Errore lettura ${chiave}:`, e);
      return predefinito;
    }
  }

  // Lancia un errore leggibile se lo spazio del browser è pieno.
  function scriviJSON(chiave, valore) {
    try {
      localStorage.setItem(chiave, JSON.stringify(valore));
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)) {
        throw new Error('Spazio del browser esaurito: elimina qualche frase con immagini caricate, oppure esporta i dati e fai pulizia.');
      }
      throw e;
    }
  }

  function lista(chiave) {
    const v = leggiJSON(chiave, []);
    return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];
  }

  // Data leggibile come quella del portale: "GG/MM/AAAA HH:MM"
  function adesso() {
    const d = new Date();
    const due = (n) => String(n).padStart(2, '0');
    return `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()} ${due(d.getHours())}:${due(d.getMinutes())}`;
  }

  function prossimoId(arr, campo) {
    return arr.reduce((max, x) => Math.max(max, parseInt(x[campo], 10) || 0), 0) + 1;
  }

  // Elementi della frase nell'ordine soggetto → predicato → complemento
  function conElementi(c) {
    return {
      ...c,
      mostra_testo: c.mostra_testo ? 1 : 0,
      elementi: RUOLI.map((ruolo) => ({
        ruolo,
        testo: (c[ruolo] && c[ruolo].testo) || '',
        url: (c[ruolo] && c[ruolo].url) || '',
        id_arasaac: c[ruolo] && c[ruolo].id_arasaac != null ? c[ruolo].id_arasaac : null,
      })),
    };
  }

  // ==================== FRASI ====================

  // Frasi attive, dalla più recente (come get_config_list).
  function getConfigList() {
    return lista(CHIAVI.config)
      .filter((c) => c.stato !== 'archiviato')
      .sort((a, b) => (b.id_config || 0) - (a.id_config || 0))
      .map(conElementi);
  }

  function getConfig(id_config) {
    const id = parseInt(id_config, 10);
    const c = lista(CHIAVI.config).find((x) => x.id_config === id && x.stato !== 'archiviato');
    return c ? conElementi(c) : null;
  }

  // Come save_config del PHP: stessi controlli, stessi messaggi.
  function salvaConfig(input = {}) {
    const valori = {};
    for (const ruolo of RUOLI) {
      const el = input[ruolo];
      if (!el || typeof el !== 'object') {
        return { success: false, message: `Manca il ${ETICHETTE[ruolo]}` };
      }
      const testo = String(el.testo || '').trim();
      const url = String(el.url || '').trim();
      const idA = el.id_arasaac === null || el.id_arasaac === '' || el.id_arasaac === undefined
        ? null : (parseInt(el.id_arasaac, 10) || null);

      if (!testo) return { success: false, message: `Scrivi la parola del ${ETICHETTE[ruolo]}` };
      if (testo.length > MAX_TESTO) {
        return { success: false, message: `Il testo del ${ETICHETTE[ruolo]} è troppo lungo (max ${MAX_TESTO} caratteri)` };
      }
      if (!url) return { success: false, message: `Scegli l'immagine del ${ETICHETTE[ruolo]}` };
      valori[ruolo] = { testo, url, id_arasaac: idA };
    }

    // La frase letta ad alta voce: quella scritta dall'educatore, altrimenti le tre parole.
    let frase = String(input.frase || '').trim();
    if (!frase) frase = RUOLI.map((r) => valori[r].testo).join(' ').trim();
    frase = frase.slice(0, MAX_FRASE);

    const mostra = input.mostra_testo === undefined || input.mostra_testo ? 1 : 0;
    const ora = adesso();
    const arr = lista(CHIAVI.config);
    const idEsistente = parseInt(input.id_config, 10) || null;
    const i = idEsistente ? arr.findIndex((c) => c.id_config === idEsistente) : -1;

    if (i >= 0) {
      arr[i] = { ...arr[i], ...valori, frase, mostra_testo: mostra, data_modifica: ora };
      scriviJSON(CHIAVI.config, arr);
      return { success: true, message: 'Frase aggiornata', data: { id_config: idEsistente, frase } };
    }

    const id_config = prossimoId(arr, 'id_config');
    arr.push({
      id_config,
      ...valori,
      frase,
      mostra_testo: mostra,
      stato: 'attivo',
      data_creazione: ora,
      data_modifica: ora,
    });
    scriviJSON(CHIAVI.config, arr);
    return { success: true, message: 'Frase salvata', data: { id_config, frase } };
  }

  // Eliminazione vera (libera spazio: le immagini sono incorporate nella frase).
  function eliminaConfig(id_config) {
    const id = parseInt(id_config, 10);
    scriviJSON(CHIAVI.config, lista(CHIAVI.config).filter((c) => c.id_config !== id));
    return { success: true, message: 'Frase eliminata' };
  }

  // ==================== RISULTATI ====================

  function salvaRisultato(r = {}) {
    const id_config = parseInt(r.id_config, 10);
    if (!id_config) return { success: false, message: 'ID frase richiesto' };
    const arr = lista(CHIAVI.risultati);
    arr.push({
      id_risultato: prossimoId(arr, 'id_risultato'),
      id_config,
      frase: String(r.frase || '').trim().slice(0, MAX_FRASE),
      errori: Math.max(0, parseInt(r.errori, 10) || 0),
      tempo_secondi: Math.max(0, parseInt(r.tempo_secondi, 10) || 0),
      data_esecuzione: adesso(),
    });
    if (arr.length > MAX_RISULTATI) arr.splice(0, arr.length - MAX_RISULTATI);
    scriviJSON(CHIAVI.risultati, arr);
    return { success: true, message: 'Risultato salvato' };
  }

  // Ultimi risultati, dal più recente (come get_risultati, limite 1–200).
  function getRisultati(limite = 30) {
    let n = parseInt(limite, 10) || 30;
    n = Math.min(200, Math.max(1, n));
    return lista(CHIAVI.risultati)
      .sort((a, b) => (b.id_risultato || 0) - (a.id_risultato || 0))
      .slice(0, n);
  }

  // ==================== ESPORTA / IMPORTA ====================

  function esportaDati() {
    const preferenze = {};
    [CHIAVI.impostazioni, CHIAVI.scalaTesto, CHIAVI.bordi].forEach((k) => {
      try {
        const v = localStorage.getItem(k);
        if (v !== null) preferenze[k] = v;
      } catch (e) { /* ignora */ }
    });
    return {
      app: APP,
      versione: 1,
      esportato: Date.now(),
      config: lista(CHIAVI.config),
      risultati: lista(CHIAVI.risultati),
      preferenze,
    };
  }

  function importaDati(file) {
    if (!file || typeof file !== 'object' || file.app !== APP || !Array.isArray(file.config)) {
      throw new Error('Il file non è un\'esportazione di Frase Minima.');
    }
    scriviJSON(CHIAVI.config, file.config);
    scriviJSON(CHIAVI.risultati, Array.isArray(file.risultati) ? file.risultati : []);
    const pref = file.preferenze && typeof file.preferenze === 'object' ? file.preferenze : {};
    // Solo le chiavi di questa app, mai altre
    [CHIAVI.impostazioni, CHIAVI.scalaTesto, CHIAVI.bordi].forEach((k) => {
      if (typeof pref[k] === 'string') {
        try { localStorage.setItem(k, pref[k]); } catch (e) { /* ignora */ }
      }
    });
    return { config: file.config.filter((c) => c && c.stato !== 'archiviato').length };
  }

  return {
    CHIAVI,
    RUOLI,
    getConfigList,
    getConfig,
    salvaConfig,
    eliminaConfig,
    salvaRisultato,
    getRisultati,
    esportaDati,
    importaDati,
  };
})();
