// ==================== ARCHIVIO LOCALE ====================
// Parola-Immagine - versione autonoma (come le altre app della raccolta).
// UN DISPOSITIVO = UN UTENTE, nessun server: tutto resta nel browser.
//
//   IndexedDB "parola-immagine", archivio "coppie"
//       → coppie target/distrattore. Le immagini sono INCORPORATE (data URL):
//         l'esercizio funziona offline e le immagini finiscono nell'esportazione.
//         Stanno in IndexedDB perché in localStorage (circa 5 MB) ci starebbero poche coppie.
//   localStorage (prefisso "pi_": sullo stesso dominio ci sono altre app, i loro dati NON si toccano)
//       pi_impostazioni → prove per sessione + aspetto delle parole (prende il posto della
//                         «taratura font» del portale)
//       pi_risultati    → una riga per ogni risposta data negli esercizi
//       pi_display_parola_immagine / pi_display_immagine_parola → menu ☰ di ogni esercizio
//       pi_voce         → voce attiva ('true' / 'false')
//
// Le coppie hanno gli stessi campi della vecchia tabella parola_immagine_coppie:
// id_coppia, parola_target, url_immagine_target, id_pittogramma_target (0 = immagine dal
// dispositivo), parola_distrattore, url_immagine_distrattore, id_pittogramma_distrattore.

const Archivio = (() => {
  const APP = 'parola-immagine';
  const CHIAVI = {
    impostazioni: 'pi_impostazioni',
    risultati: 'pi_risultati',
    displayPI: 'pi_display_parola_immagine',
    displayIP: 'pi_display_immagine_parola',
    voce: 'pi_voce',
  };
  const PREFERENZE = [CHIAVI.displayPI, CHIAVI.displayIP, CHIAVI.voce];
  const DB_NOME = 'parola-immagine';
  const DB_ARCHIVIO = 'coppie';
  const MAX_PAROLA = 100;
  const MAX_RISULTATI = 3000;
  const PROVE_MIN = 1;
  const PROVE_MAX = 50;

  const TESTO_PREDEFINITO = {
    carattere: 'Arial, sans-serif',
    grassetto: true,
    maiuscolo: true,
    coloreTesto: '#000000',
    coloreSfondo: '#FFFFFF',
    spaziatura: 0,          // spaziatura tra le lettere, in em
  };

  let db = null;

  // ==================== localStorage ====================

  function leggiJSON(chiave, predefinito) {
    try {
      const v = localStorage.getItem(chiave);
      return v === null ? predefinito : JSON.parse(v);
    } catch (e) {
      return predefinito;
    }
  }

  // Lancia un errore leggibile se lo spazio del browser è pieno.
  function scriviJSON(chiave, valore) {
    try {
      localStorage.setItem(chiave, JSON.stringify(valore));
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)) {
        throw new Error('Spazio del browser esaurito: esporta i dati e svuota i risultati.');
      }
      throw e;
    }
  }

  // ==================== IndexedDB (coppie) ====================

  function apriDb() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      let r;
      try {
        r = indexedDB.open(DB_NOME, 1);
      } catch (e) {
        reject(new Error('Questo browser non permette di salvare i dati (IndexedDB non disponibile).'));
        return;
      }
      r.onupgradeneeded = () => {
        r.result.createObjectStore(DB_ARCHIVIO, { keyPath: 'id_coppia', autoIncrement: true });
      };
      r.onsuccess = () => {
        db = r.result;
        resolve(db);
      };
      r.onerror = () => reject(new Error('Archivio del browser non disponibile (navigazione privata?).'));
    });
  }

  // Esegue una richiesta su un'unica transazione e aspetta che sia completata.
  async function transazione(modo, opera) {
    const d = await apriDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction(DB_ARCHIVIO, modo);
      const archivio = t.objectStore(DB_ARCHIVIO);
      let risultato;
      const r = opera(archivio);
      if (r) r.onsuccess = () => { risultato = r.result; };
      t.oncomplete = () => resolve(risultato);
      t.onerror = () => {
        const e = t.error;
        reject(e && e.name === 'QuotaExceededError'
          ? new Error('Spazio del browser esaurito: elimina qualche coppia con foto, oppure esporta i dati e fai pulizia.')
          : (e || new Error('Errore dell\'archivio del browser')));
      };
      t.onabort = t.onerror;
    });
  }

  // Coppie dalla più recente (come get_coppie del portale)
  async function getCoppie() {
    const tutte = (await transazione('readonly', (a) => a.getAll())) || [];
    return tutte.sort((a, b) => (b.id_coppia || 0) - (a.id_coppia || 0));
  }

  function pulisciParola(p) {
    return String(p || '').replace(/\s+/g, ' ').trim().slice(0, MAX_PAROLA);
  }

  // Come create_coppia del PHP: stessi controlli
  async function salvaCoppia(input = {}) {
    const coppia = {
      parola_target: pulisciParola(input.parola_target),
      url_immagine_target: String(input.url_immagine_target || ''),
      id_pittogramma_target: parseInt(input.id_pittogramma_target, 10) || 0,
      parola_distrattore: pulisciParola(input.parola_distrattore),
      url_immagine_distrattore: String(input.url_immagine_distrattore || ''),
      id_pittogramma_distrattore: parseInt(input.id_pittogramma_distrattore, 10) || 0,
      data_creazione: new Date().toISOString(),
    };
    if (!coppia.parola_target || !coppia.parola_distrattore) {
      return { success: false, message: 'Scrivi la parola del target e quella del distrattore' };
    }
    if (!coppia.url_immagine_target || !coppia.url_immagine_distrattore) {
      return { success: false, message: 'Scegli l\'immagine del target e quella del distrattore' };
    }
    const id = await transazione('readwrite', (a) => a.add(coppia));
    richiediSpazioPersistente();
    return { success: true, message: 'Coppia creata', data: { id_coppia: id } };
  }

  async function eliminaCoppia(id_coppia) {
    await transazione('readwrite', (a) => a.delete(Number(id_coppia)));
    return { success: true, message: 'Coppia eliminata' };
  }

  // ==================== IMPOSTAZIONI ====================

  function numeroProve(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(PROVE_MAX, Math.max(PROVE_MIN, n)) : 10;
  }

  function colore(v, predefinito) {
    return /^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : predefinito;
  }

  function getImpostazioni() {
    const s = leggiJSON(CHIAVI.impostazioni, {}) || {};
    const t = { ...TESTO_PREDEFINITO, ...(s.testo && typeof s.testo === 'object' ? s.testo : {}) };
    return {
      numero_prove: numeroProve(s.numero_prove),
      testo: {
        carattere: String(t.carattere || TESTO_PREDEFINITO.carattere).slice(0, 120),
        grassetto: t.grassetto !== false,
        maiuscolo: t.maiuscolo !== false,
        coloreTesto: colore(t.coloreTesto, TESTO_PREDEFINITO.coloreTesto),
        coloreSfondo: colore(t.coloreSfondo, TESTO_PREDEFINITO.coloreSfondo),
        spaziatura: Math.min(0.5, Math.max(0, parseFloat(t.spaziatura) || 0)),
      },
    };
  }

  function salvaImpostazioni(modifiche = {}) {
    const attuali = getImpostazioni();
    const nuove = {
      numero_prove: modifiche.numero_prove !== undefined ? numeroProve(modifiche.numero_prove) : attuali.numero_prove,
      testo: { ...attuali.testo, ...(modifiche.testo || {}) },
    };
    scriviJSON(CHIAVI.impostazioni, nuove);
    return getImpostazioni();
  }

  // ==================== RISULTATI ====================

  // Una riga per ogni risposta (come save_risultato del portale)
  function salvaRisultato(r = {}) {
    const arr = leggiJSON(CHIAVI.risultati, []);
    const lista = Array.isArray(arr) ? arr : [];
    lista.push({
      id_sessione: String(r.id_sessione || ''),
      modo: r.modo === 'immagine-parola' ? 'immagine-parola' : 'parola-immagine',
      id_coppia: parseInt(r.id_coppia, 10) || 0,
      parola_target: pulisciParola(r.parola_target),
      esito: r.esito === 'corretto' ? 'corretto' : 'errato',
      tempo_risposta_ms: Math.max(0, parseInt(r.tempo_risposta_ms, 10) || 0),
      numero_prova: parseInt(r.numero_prova, 10) || 0,
      numero_prove_totali: parseInt(r.numero_prove_totali, 10) || 0,
      data: new Date().toISOString(),
    });
    if (lista.length > MAX_RISULTATI) lista.splice(0, lista.length - MAX_RISULTATI);
    try {
      scriviJSON(CHIAVI.risultati, lista);
    } catch (e) {
      // Spazio esaurito: si tengono solo i risultati più recenti
      scriviJSON(CHIAVI.risultati, lista.slice(-500));
    }
  }

  // Sessioni dalla più recente: { id_sessione, modo, data, risposte: [...] }
  function getSessioni(limite = 20) {
    const arr = leggiJSON(CHIAVI.risultati, []);
    const perSessione = new Map();
    (Array.isArray(arr) ? arr : []).forEach((r) => {
      if (!r || typeof r !== 'object') return;
      const id = r.id_sessione || r.data;
      if (!perSessione.has(id)) perSessione.set(id, { id_sessione: id, modo: r.modo, data: r.data, risposte: [] });
      perSessione.get(id).risposte.push(r);
    });
    return [...perSessione.values()]
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))
      .slice(0, limite);
  }

  function svuotaRisultati() {
    try { localStorage.removeItem(CHIAVI.risultati); } catch (e) { /* ignora */ }
  }

  // ==================== PREFERENZE DEGLI ESERCIZI ====================

  function getDisplay(modo) {
    const v = leggiJSON(modo === 'immagine-parola' ? CHIAVI.displayIP : CHIAVI.displayPI, {});
    return v && typeof v === 'object' ? v : {};
  }

  function salvaDisplay(modo, valori) {
    try {
      scriviJSON(modo === 'immagine-parola' ? CHIAVI.displayIP : CHIAVI.displayPI, valori || {});
    } catch (e) { /* preferenza non essenziale */ }
  }

  function cancellaDisplay(modo) {
    try { localStorage.removeItem(modo === 'immagine-parola' ? CHIAVI.displayIP : CHIAVI.displayPI); } catch (e) { /* ignora */ }
  }

  function voceAttiva() {
    try { return localStorage.getItem(CHIAVI.voce) !== 'false'; } catch (e) { return true; }
  }

  function salvaVoce(attiva) {
    try { localStorage.setItem(CHIAVI.voce, attiva ? 'true' : 'false'); } catch (e) { /* ignora */ }
  }

  // ==================== ESPORTA / IMPORTA ====================

  async function esportaDati() {
    const preferenze = {};
    PREFERENZE.forEach((k) => {
      try {
        const v = localStorage.getItem(k);
        if (v !== null) preferenze[k] = v;
      } catch (e) { /* ignora */ }
    });
    return {
      app: APP,
      versione: 1,
      esportato: new Date().toISOString(),
      coppie: await getCoppie(),
      impostazioni: getImpostazioni(),
      risultati: leggiJSON(CHIAVI.risultati, []),
      preferenze,
    };
  }

  function immagineValida(u) {
    return typeof u === 'string' && (u.startsWith('data:image/') || /^https:\/\//.test(u));
  }

  async function importaDati(file) {
    if (!file || typeof file !== 'object' || file.app !== APP || !Array.isArray(file.coppie)) {
      throw new Error('Il file non è un\'esportazione di Parola-Immagine.');
    }
    const coppie = file.coppie.filter((c) => c && typeof c === 'object'
      && pulisciParola(c.parola_target) && pulisciParola(c.parola_distrattore)
      && immagineValida(c.url_immagine_target) && immagineValida(c.url_immagine_distrattore));

    await transazione('readwrite', (a) => {
      a.clear();
      coppie.forEach((c) => {
        const pulita = {
          parola_target: pulisciParola(c.parola_target),
          url_immagine_target: c.url_immagine_target,
          id_pittogramma_target: parseInt(c.id_pittogramma_target, 10) || 0,
          parola_distrattore: pulisciParola(c.parola_distrattore),
          url_immagine_distrattore: c.url_immagine_distrattore,
          id_pittogramma_distrattore: parseInt(c.id_pittogramma_distrattore, 10) || 0,
          data_creazione: String(c.data_creazione || new Date().toISOString()),
        };
        const id = parseInt(c.id_coppia, 10);
        if (id > 0) pulita.id_coppia = id;
        a.put(pulita);
      });
      return null;
    });

    if (file.impostazioni && typeof file.impostazioni === 'object') {
      scriviJSON(CHIAVI.impostazioni, file.impostazioni);
    }
    scriviJSON(CHIAVI.risultati, Array.isArray(file.risultati) ? file.risultati.slice(-MAX_RISULTATI) : []);
    const pref = file.preferenze && typeof file.preferenze === 'object' ? file.preferenze : {};
    // Solo le chiavi di questa app, mai altre
    PREFERENZE.forEach((k) => {
      if (typeof pref[k] === 'string') {
        try { localStorage.setItem(k, pref[k]); } catch (e) { /* ignora */ }
      }
    });
    richiediSpazioPersistente();
    return { coppie: coppie.length };
  }

  // Chiede al browser di non cancellare i dati quando lo spazio scarseggia
  function richiediSpazioPersistente() {
    try { navigator.storage?.persist?.(); } catch (e) { /* non disponibile */ }
  }

  return {
    CHIAVI,
    TESTO_PREDEFINITO,
    PROVE_MIN,
    PROVE_MAX,
    MAX_PAROLA,
    getCoppie,
    salvaCoppia,
    eliminaCoppia,
    getImpostazioni,
    salvaImpostazioni,
    salvaRisultato,
    getSessioni,
    svuotaRisultati,
    getDisplay,
    salvaDisplay,
    cancellaDisplay,
    voceAttiva,
    salvaVoce,
    esportaDati,
    importaDati,
  };
})();
