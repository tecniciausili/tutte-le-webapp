// ==================== ARCHIVIO LOCALE ====================
// Scrivo Parole con le Lettere - versione autonoma (come le altre app della raccolta).
// UN DISPOSITIVO = UN UTENTE, nessun server: tutto in localStorage.
//
// Le chiavi hanno il prefisso "spl_" perché sullo stesso dominio ci sono altre
// app: i loro dati NON vanno toccati.
//
//  - spl_config        → esercizi (parola + lettere disponibili + immagine)
//  - spl_impostazioni  → numero prove, tasto cancella, BRAVO/BRAVA
//  - spl_risultati     → storico delle prove svolte
//
// Prende il posto della vecchia API PHP (api_scrivo_parole_lettere.php) e
// restituisce gli stessi campi che l'interfaccia si aspetta.

const Archivio = (() => {
  const CHIAVI = {
    config: 'spl_config',
    impostazioni: 'spl_impostazioni',
    risultati: 'spl_risultati',
  };
  const APP = 'scrivo-parole-con-le-lettere';
  const MAX_RISULTATI = 2000;

  const IMPOSTAZIONI_DEFAULT = {
    numero_prove: 10,
    tasto_cancella_visibile: 0,
    genere_feedback: 'maschile',
  };

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
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        throw new Error('Spazio del browser esaurito: elimina qualche esercizio con immagine o esporta i dati e fai pulizia.');
      }
      throw e;
    }
  }

  function lista(chiave) {
    const v = leggiJSON(chiave, []);
    return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];
  }

  function adesso() {
    return new Date().toISOString();
  }

  function prossimoId(arr, campo) {
    return arr.reduce((max, x) => Math.max(max, parseInt(x[campo], 10) || 0), 0) + 1;
  }

  // ==================== IMPOSTAZIONI ====================

  function getImpostazioni() {
    const s = leggiJSON(CHIAVI.impostazioni, {}) || {};
    const n = parseInt(s.numero_prove, 10);
    return {
      numero_prove: Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : IMPOSTAZIONI_DEFAULT.numero_prove,
      tasto_cancella_visibile: s.tasto_cancella_visibile ? 1 : 0,
      genere_feedback: s.genere_feedback === 'femminile' ? 'femminile' : 'maschile',
    };
  }

  function salvaImpostazioni({ numero_prove, tasto_cancella_visibile, genere_feedback } = {}) {
    const n = parseInt(numero_prove, 10);
    scriviJSON(CHIAVI.impostazioni, {
      numero_prove: Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : IMPOSTAZIONI_DEFAULT.numero_prove,
      tasto_cancella_visibile: tasto_cancella_visibile ? 1 : 0,
      genere_feedback: genere_feedback === 'femminile' ? 'femminile' : 'maschile',
    });
    return { success: true, message: 'Impostazioni salvate' };
  }

  // ==================== ESERCIZI ====================

  // Esercizi attivi, dal più recente (come get_config_list).
  function getConfigList() {
    return lista(CHIAVI.config)
      .filter((c) => c.stato !== 'archiviata')
      .map((c) => ({
        ...c,
        lettere_disponibili: Array.isArray(c.lettere_disponibili) ? c.lettere_disponibili : [],
      }))
      .sort((a, b) => (b.id_config || 0) - (a.id_config || 0));
  }

  function salvaConfig({ parola_target, lettere_disponibili, tipo_immagine, id_arasaac, url_immagine } = {}) {
    const parola = String(parola_target || '').trim().toUpperCase();
    const lettere = Array.isArray(lettere_disponibili)
      ? [...new Set(lettere_disponibili.map((l) => String(l).toUpperCase()).filter(Boolean))]
      : [];

    if (!parola || lettere.length === 0) {
      return { success: false, message: 'Parola target e lettere sono richieste' };
    }
    const mancanti = [...new Set(parola.split(''))].filter((l) => !lettere.includes(l));
    if (mancanti.length) {
      return { success: false, message: `Mancano le lettere: ${mancanti.join(', ')}` };
    }

    let tipo = ['arasaac', 'upload', 'nessuna'].includes(tipo_immagine) ? tipo_immagine : 'nessuna';
    const idA = tipo === 'arasaac' ? (parseInt(id_arasaac, 10) || null) : null;
    const url = tipo === 'nessuna' ? null : (url_immagine || null);
    if (tipo === 'arasaac' && !idA) return { success: false, message: 'Seleziona un pittogramma ARASAAC' };
    if (tipo === 'upload' && !url) return { success: false, message: 'Carica un\'immagine' };

    const arr = lista(CHIAVI.config);
    const nuovoId = prossimoId(arr, 'id_config');
    arr.push({
      id_config: nuovoId,
      parola_target: parola,
      lettere_disponibili: lettere,
      tipo_immagine: tipo,
      id_arasaac: idA,
      // Immagine incorporata (data URL): per le foto caricate, e per ARASAAC quando
      // è stato possibile scaricarlo (così funziona anche offline). Altrimenti null.
      url_immagine: url,
      stato: 'attiva',
      data_creazione: adesso(),
    });
    scriviJSON(CHIAVI.config, arr);
    return { success: true, message: 'Configurazione creata', data: { id_config: nuovoId } };
  }

  // Eliminazione vera (non serve archiviare: libera spazio per le immagini).
  function eliminaConfig(id_config) {
    const id = parseInt(id_config, 10);
    scriviJSON(CHIAVI.config, lista(CHIAVI.config).filter((c) => c.id_config !== id));
    return { success: true, message: 'Configurazione eliminata' };
  }

  // ==================== RISULTATI ====================

  function salvaRisultato(r = {}) {
    const arr = lista(CHIAVI.risultati);
    arr.push({
      id_risultato: prossimoId(arr, 'id_risultato'),
      id_config: r.id_config ?? null,
      parola_target: String(r.parola_target || ''),
      risposta_data: String(r.risposta_data ?? ''),
      esito: r.esito === 'positivo' ? 'positivo' : 'negativo',
      tempo_risposta_ms: Math.max(0, parseInt(r.tempo_risposta_ms, 10) || 0),
      id_sessione: r.id_sessione || null,
      numero_prova: parseInt(r.numero_prova, 10) || null,
      numero_prove_totali: parseInt(r.numero_prove_totali, 10) || null,
      data_esecuzione: adesso(),
    });
    if (arr.length > MAX_RISULTATI) arr.splice(0, arr.length - MAX_RISULTATI);
    scriviJSON(CHIAVI.risultati, arr);
    return { success: true, message: 'Risultato salvato' };
  }

  // Come get_statistiche del PHP: totali + dettaglio per parola.
  function getStatistiche() {
    const arr = lista(CHIAVI.risultati);
    const corrette = arr.filter((r) => r.esito === 'positivo').length;
    const tempi = arr.map((r) => r.tempo_risposta_ms).filter((t) => t > 0);
    const perParola = {};
    arr.forEach((r) => {
      const p = (perParola[r.parola_target] ||= { parola_target: r.parola_target, totale: 0, corrette: 0, errate: 0 });
      p.totale++;
      if (r.esito === 'positivo') p.corrette++; else p.errate++;
    });
    return {
      totale_prove: arr.length,
      corrette,
      errate: arr.length - corrette,
      tempo_medio_ms: tempi.length ? Math.round(tempi.reduce((a, b) => a + b, 0) / tempi.length) : null,
      per_parola: Object.values(perParola).sort((a, b) => a.parola_target.localeCompare(b.parola_target)),
    };
  }

  // ==================== ESPORTA / IMPORTA ====================

  function esportaDati() {
    return {
      app: APP,
      versione: 1,
      esportato: Date.now(),
      config: lista(CHIAVI.config),
      impostazioni: getImpostazioni(),
      risultati: lista(CHIAVI.risultati),
    };
  }

  function importaDati(file) {
    if (!file || typeof file !== 'object' || file.app !== APP || !Array.isArray(file.config)) {
      throw new Error('Il file non è un\'esportazione di Scrivo Parole con le Lettere.');
    }
    scriviJSON(CHIAVI.config, file.config);
    scriviJSON(CHIAVI.risultati, Array.isArray(file.risultati) ? file.risultati : []);
    if (file.impostazioni && typeof file.impostazioni === 'object') {
      salvaImpostazioni(file.impostazioni);
    }
    return { config: file.config.filter((c) => c && c.stato !== 'archiviata').length };
  }

  return {
    getImpostazioni,
    salvaImpostazioni,
    getConfigList,
    salvaConfig,
    eliminaConfig,
    salvaRisultato,
    getStatistiche,
    esportaDati,
    importaDati,
  };
})();
