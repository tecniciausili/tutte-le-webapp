// ==================== ARCHIVIO LOCALE ====================
// Conta con le Dita - versione autonoma (come le altre app del portale).
// UN DISPOSITIVO = UN UTENTE, nessun server: tutto in localStorage.
//
// Le chiavi hanno il prefisso "cd_" perché sullo stesso dominio
// (es. assistivetech.it/webapp/) ci sono altre app: i loro dati NON vanno toccati.
//
//  - cd_config     → elenco degli esercizi configurati dall'educatore
//  - cd_risultati  → storico delle esecuzioni dell'utente
//  - cd_impostazioni → impostazioni dell'educatore (esercizi per sessione)
//
// Questo modulo prende il posto delle vecchie API PHP (api_conta_dita.php,
// api_immagini_dita.php): restituisce gli stessi dati che si aspetta l'interfaccia.

const Archivio = (() => {
  const CHIAVI = {
    config: 'cd_config',
    risultati: 'cd_risultati',
    impostazioni: 'cd_impostazioni',
  };

  // Esercizi per sessione di lavoro: 0 = libera (nessun numero fisso)
  const PER_SESSIONE_DEFAULT = 10;
  const PER_SESSIONE_MAX = 50;

  // Immagini incluse nell'app (cartella assets/dita/).
  // Il numero di dita è dedotto dal nome del file, come faceva il backend.
  // Per aggiungere immagini: copiale in assets/dita/ e aggiungi qui il nome file.
  const FILE_DITA = [
    'mano-00.png', 'mano-01.png', 'mano-02.png', 'mano-03.png',
    'mano-04.png', 'mano-05.png', 'mano-06.png', 'mano-07.png',
    'mano-08.png', 'mano-09.png', 'mano-10.png',
  ];

  const NUMERO_MIN = 0;
  const NUMERO_MAX = 10;
  const NUMERO_MAX_DISTRATTORE = 99;
  const MAX_RISULTATI = 500;

  // ==================== UTILITÀ ====================

  // Deduce la quantità dal nome del file (stessa logica del vecchio PHP):
  // primo gruppo di 1-2 cifre isolato, compreso fra 0 e 10.
  function numeroDaNomeFile(nomeFile) {
    const base = String(nomeFile).replace(/\.[^.]+$/, '');
    const m = base.match(/(?:^|[^0-9])([0-9]{1,2})(?=[^0-9]|$)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= NUMERO_MIN && n <= NUMERO_MAX) return n;
    }
    return null;
  }

  function leggiJSON(chiave, predefinito) {
    try {
      const v = localStorage.getItem(chiave);
      return v ? JSON.parse(v) : predefinito;
    } catch (e) {
      console.error(`Errore lettura ${chiave}:`, e);
      return predefinito;
    }
  }

  function scriviJSON(chiave, valore) {
    try {
      localStorage.setItem(chiave, JSON.stringify(valore));
    } catch (e) {
      console.error(`Errore scrittura ${chiave}:`, e);
      throw e;
    }
  }

  // Data/ora in formato italiano, come faceva formatoDataItaliana() del PHP.
  function dataOra() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ` +
           `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function urlImmagine(file) {
    return 'assets/dita/' + encodeURIComponent(file);
  }

  function leggiConfigRaw() {
    const arr = leggiJSON(CHIAVI.config, []);
    return Array.isArray(arr) ? arr.filter((c) => c && typeof c === 'object') : [];
  }

  // Arricchisce una config con i campi pronti per l'interfaccia (come decodeNumeri del PHP).
  function vestiConfig(c) {
    return {
      ...c,
      numeri: Array.isArray(c.numeri) ? c.numeri.map((n) => parseInt(n, 10)) : [],
      numero_corretto: parseInt(c.numero_corretto, 10),
      mescola: parseInt(c.mescola, 10) ? 1 : 0,
      url_immagine: urlImmagine(c.immagine),
    };
  }

  // ==================== GALLERIA ====================

  // Elenco immagini ordinato: prima quelle riconosciute per numero crescente.
  function galleria() {
    return FILE_DITA
      .map((file) => ({ file, url: urlImmagine(file), numero: numeroDaNomeFile(file) }))
      .sort((a, b) => {
        if (a.numero === null && b.numero === null) return a.file.localeCompare(b.file);
        if (a.numero === null) return 1;
        if (b.numero === null) return -1;
        if (a.numero === b.numero) return a.file.localeCompare(b.file);
        return a.numero - b.numero;
      });
  }

  // ==================== CONFIGURAZIONI (ESERCIZI) ====================

  // Esercizi attivi, dal più recente (come get_config_list).
  function getConfigList() {
    return leggiConfigRaw()
      .filter((c) => c.stato !== 'archiviato')
      .map(vestiConfig)
      .sort((a, b) => (b.id_config || 0) - (a.id_config || 0));
  }

  // Crea o aggiorna un esercizio. Ritorna { success, message, data }.
  function salvaConfig({ immagine, numeri, mescola, id_config } = {}) {
    immagine = String(immagine || '').trim();
    if (!immagine) {
      return { success: false, message: 'Scegli un\'immagine dalla galleria' };
    }
    if (!FILE_DITA.includes(immagine)) {
      return { success: false, message: 'Immagine non valida' };
    }

    const numero_corretto = numeroDaNomeFile(immagine);
    if (numero_corretto === null) {
      return { success: false, message: `Dal nome "${immagine}" non si capisce quante dita mostra.` };
    }

    const nums = Array.isArray(numeri) ? numeri.map((n) => parseInt(n, 10)) : [];
    if (nums.length !== 3 || nums.some((n) => !Number.isFinite(n))) {
      return { success: false, message: 'Compila tutti e 3 i numeri' };
    }
    if (nums.some((n) => n < NUMERO_MIN || n > NUMERO_MAX_DISTRATTORE)) {
      return { success: false, message: `I numeri devono essere fra ${NUMERO_MIN} e ${NUMERO_MAX_DISTRATTORE}` };
    }
    if (new Set(nums).size !== 3) {
      return { success: false, message: 'I 3 numeri devono essere diversi fra loro' };
    }
    if (!nums.includes(numero_corretto)) {
      return { success: false, message: `Nessuno dei 3 numeri corrisponde alle dita mostrate (${numero_corretto})` };
    }

    const arr = leggiConfigRaw();
    const now = dataOra();
    const mesc = mescola ? 1 : 0;

    if (id_config) {
      const i = arr.findIndex((c) => c.id_config === id_config);
      if (i >= 0) {
        arr[i] = { ...arr[i], immagine, numero_corretto, numeri: nums, mescola: mesc, data_modifica: now };
        scriviJSON(CHIAVI.config, arr);
        return { success: true, message: 'Esercizio aggiornato', data: { id_config } };
      }
    }

    const nuovoId = arr.reduce((max, c) => Math.max(max, c.id_config || 0), 0) + 1;
    arr.push({
      id_config: nuovoId,
      immagine,
      numero_corretto,
      numeri: nums,
      mescola: mesc,
      stato: 'attivo',
      data_creazione: now,
      data_modifica: now,
    });
    scriviJSON(CHIAVI.config, arr);
    return { success: true, message: 'Esercizio salvato', data: { id_config: nuovoId } };
  }

  // Elimina un esercizio e i suoi risultati.
  function eliminaConfig(id_config) {
    scriviJSON(CHIAVI.config, leggiConfigRaw().filter((c) => c.id_config !== id_config));
    const ris = leggiJSON(CHIAVI.risultati, []);
    if (Array.isArray(ris)) {
      scriviJSON(CHIAVI.risultati, ris.filter((r) => r.id_config !== id_config));
    }
    return { success: true, message: 'Esercizio eliminato' };
  }

  // ==================== RISULTATI ====================

  function salvaRisultato({ id_config, numero_corretto, errori, tempo_secondi } = {}) {
    const arr = leggiJSON(CHIAVI.risultati, []);
    const lista = Array.isArray(arr) ? arr : [];
    const nuovoId = lista.reduce((max, r) => Math.max(max, r.id_risultato || 0), 0) + 1;
    lista.push({
      id_risultato: nuovoId,
      id_config,
      numero_corretto: parseInt(numero_corretto, 10) || 0,
      errori: Math.max(0, parseInt(errori, 10) || 0),
      tempo_secondi: Math.max(0, parseInt(tempo_secondi, 10) || 0),
      data_esecuzione: dataOra(),
    });
    if (lista.length > MAX_RISULTATI) lista.splice(0, lista.length - MAX_RISULTATI);
    scriviJSON(CHIAVI.risultati, lista);
    return { success: true, message: 'Risultato salvato' };
  }

  // Ultimi risultati, dal più recente, con il nome immagine dell'esercizio.
  function getRisultati(limite = 30) {
    const arr = leggiJSON(CHIAVI.risultati, []);
    const lista = Array.isArray(arr) ? arr : [];
    const immaginePerConfig = {};
    leggiConfigRaw().forEach((c) => { immaginePerConfig[c.id_config] = c.immagine; });

    const lim = Math.max(1, Math.min(200, parseInt(limite, 10) || 30));
    return lista
      .slice()
      .sort((a, b) => (b.id_risultato || 0) - (a.id_risultato || 0))
      .slice(0, lim)
      .map((r) => ({ ...r, immagine: immaginePerConfig[r.id_config] || null }));
  }

  // ==================== SESSIONE DI LAVORO ====================

  function numeroPerSessione(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, PER_SESSIONE_MAX) : PER_SESSIONE_DEFAULT;
  }

  function getImpostazioni() {
    const s = leggiJSON(CHIAVI.impostazioni, {});
    return { per_sessione: numeroPerSessione(s && s.per_sessione) };
  }

  function salvaImpostazioni({ per_sessione } = {}) {
    const imp = { per_sessione: numeroPerSessione(per_sessione) };
    scriviJSON(CHIAVI.impostazioni, imp);
    return imp;
  }

  // ==================== ESPORTA / IMPORTA ====================
  // Utile per spostare i dati su un altro dispositivo o farne una copia:
  // i dati stanno solo in questo browser.

  function esportaDati() {
    return {
      app: 'conta-con-le-dita',
      esportato: Date.now(),
      config: leggiConfigRaw(),
      risultati: leggiJSON(CHIAVI.risultati, []),
      impostazioni: getImpostazioni(),
    };
  }

  function importaDati(file) {
    if (!file || typeof file !== 'object' || file.app !== 'conta-con-le-dita' || !Array.isArray(file.config)) {
      throw new Error('Il file non è un\'esportazione di Conta con le Dita.');
    }
    scriviJSON(CHIAVI.config, file.config);
    scriviJSON(CHIAVI.risultati, Array.isArray(file.risultati) ? file.risultati : []);
    if (file.impostazioni && typeof file.impostazioni === 'object') salvaImpostazioni(file.impostazioni);
    return { config: file.config.length };
  }

  return {
    galleria,
    getConfigList,
    salvaConfig,
    eliminaConfig,
    salvaRisultato,
    getRisultati,
    getImpostazioni,
    salvaImpostazioni,
    PER_SESSIONE_MAX,
    esportaDati,
    importaDati,
  };
})();
