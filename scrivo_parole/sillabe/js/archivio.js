// ==================== ARCHIVIO LOCALE ====================
// Scrivo Parole con le Sillabe - versione autonoma (come le altre app della raccolta).
// UN DISPOSITIVO = UN UTENTE, nessun server: tutto in localStorage.
//
// Le chiavi hanno il prefisso "sps_" perché sullo stesso dominio ci sono altre
// app (fra cui "Scrivo parole con le lettere", prefisso "spl_"): i loro dati NON
// vanno toccati.
//
//  - sps_config        → esercizi (sillabe disponibili + parole target + colori/font
//                        + pittogrammi ARASAAC incorporati)
//  - sps_impostazioni  → preferenze dell'area utente (ingrandimento, lettura per sillabe)
//  - sps_risultati     → storico delle parole composte
//
// Prende il posto della vecchia API del portale (server + database) e restituisce
// gli stessi campi che l'interfaccia si aspetta.

const Archivio = (() => {
  const CHIAVI = {
    config: 'sps_config',
    impostazioni: 'sps_impostazioni',
    risultati: 'sps_risultati',
  };
  const APP = 'scrivo-parole-con-le-sillabe';
  const MAX_RISULTATI = 2000;

  const ACCESSIBILITA_DEFAULT = { font_size: 2.5, bg_color: '#E3F2FD', text_color: '#1565C0' };
  const IMPOSTAZIONI_DEFAULT = { zoom: 1, sillabazione: true };

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
        throw new Error('Spazio del browser esaurito: elimina qualche esercizio o esporta i dati e fai pulizia.');
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

  // Maiuscolo, senza spazi: le sillabe e le parole si confrontano così.
  function normalizza(testo) {
    return String(testo || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function coloreValido(c, predefinito) {
    return /^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toUpperCase() : predefinito;
  }

  function numeroIn(v, min, max, predefinito) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : predefinito;
  }

  // ==================== SCOMPOSIZIONE IN SILLABE ====================

  // Scompone una parola nelle sillabe date, nell'ordine. Restituisce l'elenco delle
  // sillabe oppure null se la parola non si può comporre. Prova prima le sillabe più
  // lunghe e, se una strada non porta in fondo, torna indietro e ne prova un'altra.
  function scomponi(parola, sillabe) {
    const p = normalizza(parola);
    const elenco = [...new Set((sillabe || []).map(normalizza).filter(Boolean))]
      .sort((a, b) => b.length - a.length);
    if (!p || elenco.length === 0) return null;

    const ricorsiva = (resto) => {
      if (resto === '') return [];
      for (const s of elenco) {
        if (resto.startsWith(s)) {
          const seguito = ricorsiva(resto.slice(s.length));
          if (seguito) return [s, ...seguito];
        }
      }
      return null;
    };
    return ricorsiva(p);
  }

  // ==================== IMPOSTAZIONI (area utente) ====================

  function getImpostazioni() {
    const s = leggiJSON(CHIAVI.impostazioni, {}) || {};
    return {
      zoom: numeroIn(s.zoom, 0.7, 2.2, IMPOSTAZIONI_DEFAULT.zoom),
      sillabazione: s.sillabazione === undefined ? IMPOSTAZIONI_DEFAULT.sillabazione : !!s.sillabazione,
    };
  }

  function salvaImpostazioni(nuove = {}) {
    const attuali = getImpostazioni();
    const unite = { ...attuali, ...nuove };
    scriviJSON(CHIAVI.impostazioni, {
      zoom: numeroIn(unite.zoom, 0.7, 2.2, IMPOSTAZIONI_DEFAULT.zoom),
      sillabazione: !!unite.sillabazione,
    });
    return { success: true, message: 'Impostazioni salvate' };
  }

  // ==================== ESERCIZI ====================

  function normalizzaEsercizio(c) {
    return {
      ...c,
      sillabe_disponibili: Array.isArray(c.sillabe_disponibili) ? c.sillabe_disponibili : [],
      parole_target: Array.isArray(c.parole_target) ? c.parole_target : [],
      font_size: numeroIn(c.font_size, 1.5, 10, ACCESSIBILITA_DEFAULT.font_size),
      bg_color: coloreValido(c.bg_color, ACCESSIBILITA_DEFAULT.bg_color),
      text_color: coloreValido(c.text_color, ACCESSIBILITA_DEFAULT.text_color),
      immagini: c.immagini && typeof c.immagini === 'object' ? c.immagini : {},
    };
  }

  // Esercizi, dal più recente (come get_exercises).
  function getEsercizi() {
    return lista(CHIAVI.config)
      .map(normalizzaEsercizio)
      .sort((a, b) => (b.id_esercizio || 0) - (a.id_esercizio || 0));
  }

  // immagini: { PAROLA: dataURL } con i pittogrammi ARASAAC già scaricati (facoltativo).
  function salvaEsercizio({ sillabe_disponibili, parole_target, font_size, bg_color, text_color, immagini } = {}) {
    const sillabe = Array.isArray(sillabe_disponibili)
      ? [...new Set(sillabe_disponibili.map(normalizza).filter(Boolean))]
      : [];
    const parole = Array.isArray(parole_target)
      ? [...new Set(parole_target.map(normalizza).filter(Boolean))]
      : [];

    if (sillabe.length < 2) return { success: false, message: 'Inserisci almeno 2 sillabe' };
    if (parole.length === 0) return { success: false, message: 'Inserisci almeno 1 parola target' };

    const impossibili = parole.filter((p) => !scomponi(p, sillabe));
    if (impossibili.length) {
      return {
        success: false,
        message: `Con queste sillabe non si può comporre: ${impossibili.join(', ')}`,
      };
    }

    const img = {};
    if (immagini && typeof immagini === 'object') {
      parole.forEach((p) => {
        const v = immagini[p];
        if (typeof v === 'string' && v.startsWith('data:image/')) img[p] = v;
      });
    }

    const arr = lista(CHIAVI.config);
    const nuovoId = prossimoId(arr, 'id_esercizio');
    arr.push({
      id_esercizio: nuovoId,
      sillabe_disponibili: sillabe,
      parole_target: parole,
      font_size: numeroIn(font_size, 1.5, 10, ACCESSIBILITA_DEFAULT.font_size),
      bg_color: coloreValido(bg_color, ACCESSIBILITA_DEFAULT.bg_color),
      text_color: coloreValido(text_color, ACCESSIBILITA_DEFAULT.text_color),
      immagini: img,
      data_creazione: adesso(),
    });
    scriviJSON(CHIAVI.config, arr);
    return { success: true, message: 'Esercizio salvato', data: { id_esercizio: nuovoId } };
  }

  // Eliminazione vera (libera spazio per i pittogrammi incorporati).
  function eliminaEsercizio(id_esercizio) {
    const id = parseInt(id_esercizio, 10);
    scriviJSON(CHIAVI.config, lista(CHIAVI.config).filter((c) => c.id_esercizio !== id));
    return { success: true, message: 'Esercizio eliminato' };
  }

  // ==================== RISULTATI ====================

  function salvaRisultato(r = {}) {
    const arr = lista(CHIAVI.risultati);
    const tempo = parseFloat(r.tempo_composizione);
    arr.push({
      id_risultato: prossimoId(arr, 'id_risultato'),
      id_esercizio: r.id_esercizio ?? null,
      parola_richiesta: normalizza(r.parola_richiesta),
      parola_composta: normalizza(r.parola_composta),
      esito: r.esito === 'positivo' ? 'positivo' : 'negativo',
      tempo_composizione: Number.isFinite(tempo) && tempo >= 0 ? Math.round(tempo * 10) / 10 : null,
      data_esecuzione: adesso(),
    });
    if (arr.length > MAX_RISULTATI) arr.splice(0, arr.length - MAX_RISULTATI);
    scriviJSON(CHIAVI.risultati, arr);
    return { success: true, message: 'Risultato salvato' };
  }

  // Come get_statistics della vecchia API: totali + dettaglio per parola richiesta.
  function getStatistiche() {
    const arr = lista(CHIAVI.risultati);
    const corrette = arr.filter((r) => r.esito === 'positivo').length;
    const perParola = {};
    arr.forEach((r) => {
      const chiave = r.parola_richiesta || r.parola_composta || '?';
      const p = (perParola[chiave] ||= { parola_target: chiave, totale: 0, corrette: 0, errate: 0 });
      p.totale++;
      if (r.esito === 'positivo') p.corrette++; else p.errate++;
    });
    return {
      totale_prove: arr.length,
      corrette,
      errate: arr.length - corrette,
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
      throw new Error('Il file non è un\'esportazione di Scrivo Parole con le Sillabe.');
    }
    scriviJSON(CHIAVI.config, file.config.filter((c) => c && typeof c === 'object'));
    scriviJSON(CHIAVI.risultati, Array.isArray(file.risultati) ? file.risultati : []);
    if (file.impostazioni && typeof file.impostazioni === 'object') {
      salvaImpostazioni(file.impostazioni);
    }
    return { config: file.config.filter((c) => c && typeof c === 'object').length };
  }

  return {
    scomponi,
    getImpostazioni,
    salvaImpostazioni,
    getEsercizi,
    salvaEsercizio,
    eliminaEsercizio,
    salvaRisultato,
    getStatistiche,
    esportaDati,
    importaDati,
  };
})();
