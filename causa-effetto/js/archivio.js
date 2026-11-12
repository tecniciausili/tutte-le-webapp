// ==================== ARCHIVIO LOCALE ====================
// Come nelle altre app autonome: UN DISPOSITIVO = UN UTENTE, nessun server.
//
//  - Link YouTube, oggetti e impostazioni            → localStorage (JSON)
//  - Immagini degli oggetti caricate dal dispositivo → IndexedDB (Blob, una per oggetto)
//
// I video NON si scaricano: si salva solo il link. Dei pittogrammi ARASAAC si
// salva solo l'id: l'immagine arriva dal server ARASAAC.

const Archivio = (() => {
  const CHIAVI = {
    youtube: 'ce_youtube',
    impostazioni: 'ce_impostazioni',
    oggetti: 'ce_oggetti',
  };

  const DB_NOME = 'causa-effetto';
  const DB_VERSIONE = 1;
  const STORE_IMMAGINI = 'immagini';
  const CHIAVE_VECCHIA = 'oggetto';   // versioni fino alla 1.0.3: una sola immagine
  const chiaveImmagine = (id) => `img-${id}`;

  const LIMITI = {
    dimensione: { min: 10, max: 90 },   // % del lato corto dello schermo
    ampiezza_area: { min: 30, max: 100 },  // area centrale: % del lato corto dello schermo
    velocita: { min: 1, max: 10 },      // oggetto in movimento
    secondi: { min: 1, max: 600 },      // durata del temporizzato
  };

  const IMPOSTAZIONI_DEFAULT = {
    scena: {
      modo: 'uno',         // 'uno' (sempre lo stesso oggetto) | 'random' (uno alla volta, a caso)
      scelto: null,        // modo 'uno': id dell'oggetto usato
    },
    aspetto: {
      dimensione: 35,      // % del lato corto dello schermo
      sfondo: '#000000',   // l'unico sfondo: l'immagine non ne ha uno suo
      area_centrale: false, // true: l'oggetto sta solo in un quadrato al centro (visione a tunnel)
      ampiezza_area: 60,
      movimento: false,    // true: l'oggetto scorre e rimbalza; false: statico
      velocita: 3,
    },
    sessione: {
      durata: 'intero',    // 'intero' (fino alla fine o al tempo di fine) | 'temporizzato'
      secondi: 10,         // temporizzato: dopo quanti secondi il video va in pausa
      ordine: 'sequenza',  // 'sequenza' | 'random'
    },
  };

  // ==================== localStorage ====================

  function leggiJSON(chiave, predefinito) {
    try {
      const valore = localStorage.getItem(chiave);
      return valore ? JSON.parse(valore) : predefinito;
    } catch (e) {
      console.error(`Errore lettura ${chiave}:`, e);
      return predefinito;
    }
  }

  function scriviJSON(chiave, valore) {
    localStorage.setItem(chiave, JSON.stringify(valore));
  }

  function eOggetto(x) {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
  }

  // Unione profonda: i valori salvati prevalgono, i campi mancanti prendono il default
  function unisci(base, sopra) {
    const risultato = { ...base };
    if (!eOggetto(sopra)) {
      return risultato;
    }
    for (const [chiave, valore] of Object.entries(sopra)) {
      risultato[chiave] = eOggetto(base[chiave]) && eOggetto(valore)
        ? unisci(base[chiave], valore)
        : valore;
    }
    return risultato;
  }

  function limita(valore, { min, max }, predefinito) {
    const n = Number(valore);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : predefinito;
  }

  const COLORE_VALIDO = /^#[0-9a-f]{6}$/i;

  // ==================== IMPOSTAZIONI ====================

  function getImpostazioni() {
    const imp = unisci(IMPOSTAZIONI_DEFAULT, leggiJSON(CHIAVI.impostazioni, {}));
    // Valori sempre validi, anche se il file importato o il localStorage sono stati toccati a mano
    const a = imp.aspetto;
    const d = IMPOSTAZIONI_DEFAULT.aspetto;
    a.dimensione = limita(a.dimensione, LIMITI.dimensione, d.dimensione);
    a.ampiezza_area = limita(a.ampiezza_area, LIMITI.ampiezza_area, d.ampiezza_area);
    a.velocita = limita(a.velocita, LIMITI.velocita, d.velocita);
    a.area_centrale = !!a.area_centrale;
    a.movimento = !!a.movimento;
    a.sfondo = COLORE_VALIDO.test(a.sfondo) ? a.sfondo : d.sfondo;
    delete a.riquadro;          // campi delle prime prove, non più usati
    delete a.colore_riquadro;
    const s = imp.sessione;
    s.durata = s.durata === 'temporizzato' ? 'temporizzato' : 'intero';
    s.ordine = s.ordine === 'random' ? 'random' : 'sequenza';
    s.secondi = limita(s.secondi, LIMITI.secondi, IMPOSTAZIONI_DEFAULT.sessione.secondi);
    imp.scena.modo = imp.scena.modo === 'random' ? 'random' : 'uno';
    delete imp.oggetto;         // versioni fino alla 1.0.3 (vedi migraVersionePrecedente)
    return imp;
  }

  function salvaImpostazioni(parziale) {
    const nuove = unisci(getImpostazioni(), parziale);
    scriviJSON(CHIAVI.impostazioni, nuove);
    return getImpostazioni();
  }

  // ==================== VIDEO YOUTUBE ====================

  function getYoutube() {
    const lista = leggiJSON(CHIAVI.youtube, []);
    return Array.isArray(lista) ? lista : [];
  }

  function salvaYoutube(lista) {
    scriviJSON(CHIAVI.youtube, lista);
  }

  function aggiungiYoutube(dati) {
    const lista = getYoutube();
    const doppione = lista.some((v) => v.video_id === dati.video_id
      && (v.inizio || 0) === (dati.inizio || 0) && (v.fine || 0) === (dati.fine || 0));
    if (doppione) {
      throw new Error('Questo video (con gli stessi tempi) è già nella lista.');
    }
    const record = {
      id: lista.reduce((max, v) => Math.max(max, v.id || 0), 0) + 1,
      nome: dati.nome,
      categoria: dati.categoria || '',
      link: dati.link,
      video_id: dati.video_id,
      inizio: Math.max(0, parseInt(dati.inizio, 10) || 0),
      fine: Math.max(0, parseInt(dati.fine, 10) || 0),
      playlist_id: dati.playlist_id || null,
      playlist_nome: dati.playlist_nome || '',
      attivo: true,        // fa parte della lista dell'utente
      errore: null,        // codice YouTube se il video non si può riprodurre
      data_creazione: Date.now(),
    };
    lista.push(record);
    salvaYoutube(lista);
    return record;
  }

  function aggiornaYoutube(id, campi) {
    salvaYoutube(getYoutube().map((v) => (v.id === id ? { ...v, ...campi } : v)));
  }

  function eliminaYoutube(id) {
    salvaYoutube(getYoutube().filter((v) => v.id !== id));
  }

  // Elimina in un colpo solo tutti i video importati da una stessa playlist
  function eliminaYoutubePlaylist(playlistId) {
    if (!playlistId) {
      return 0;
    }
    const prima = getYoutube();
    const dopo = prima.filter((v) => v.playlist_id !== playlistId);
    salvaYoutube(dopo);
    return prima.length - dopo.length;
  }

  function getCategorie() {
    return Array.from(new Set(getYoutube().map((v) => v.categoria).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'it'));
  }

  // ==================== OGGETTI ====================
  // Ogni oggetto è un pittogramma ARASAAC (solo l'id) o un'immagine caricata dal
  // dispositivo (in IndexedDB con la chiave img-<id>). La spunta "attivo" vale nel
  // modo 'random': sono gli oggetti che compaiono a caso, uno alla volta.
  // "categorie": le categorie dei video che l'oggetto fa partire; vuoto = tutti i video.

  function soloTesti(x) {
    return Array.isArray(x) ? x.filter((c) => typeof c === 'string' && c) : [];
  }

  function getOggetti() {
    const lista = leggiJSON(CHIAVI.oggetti, []);
    // Gli oggetti salvati prima della 1.0.6 non hanno categorie: fanno partire tutti i video
    return Array.isArray(lista) ? lista.map((o) => ({ ...o, categorie: soloTesti(o.categorie) })) : [];
  }

  function salvaOggetti(lista) {
    scriviJSON(CHIAVI.oggetti, lista);
  }

  function nuovoIdOggetto() {
    return getOggetti().reduce((max, o) => Math.max(max, o.id || 0), 0) + 1;
  }

  function aggiungiOggetto(dati, id = nuovoIdOggetto()) {
    const lista = getOggetti();
    if (dati.tipo === 'arasaac' && lista.some((o) => o.tipo === 'arasaac' && o.arasaac_id === dati.arasaac_id)) {
      throw new Error(`"${dati.nome}" è già tra i tuoi oggetti.`);
    }
    const record = {
      id,
      tipo: dati.tipo,
      arasaac_id: dati.tipo === 'arasaac' ? dati.arasaac_id : null,
      nome: dati.nome || '',
      attivo: true,
      categorie: [],
      data_creazione: Date.now(),
    };
    lista.push(record);
    salvaOggetti(lista);
    // Nel modo "un solo oggetto" l'ultimo aggiunto diventa quello usato
    const scena = getImpostazioni().scena;
    if (scena.modo === 'uno' || !scena.scelto) {
      salvaImpostazioni({ scena: { scelto: id } });
    }
    return record;
  }

  // Immagine dal dispositivo: prima il file in IndexedDB, poi la voce nell'elenco
  async function aggiungiImmagine(blob, nome) {
    const id = nuovoIdOggetto();
    await salvaImmagine(id, blob, nome);
    return aggiungiOggetto({ tipo: 'immagine', nome }, id);
  }

  function aggiornaOggetto(id, campi) {
    salvaOggetti(getOggetti().map((o) => (o.id === id ? { ...o, ...campi } : o)));
  }

  async function eliminaOggetto(id) {
    const oggetto = getOggetti().find((o) => o.id === id);
    if (!oggetto) {
      return;
    }
    if (oggetto.tipo === 'immagine') {
      await eliminaImmagine(id).catch(() => {});
    }
    const resto = getOggetti().filter((o) => o.id !== id);
    salvaOggetti(resto);
    if (getImpostazioni().scena.scelto === id) {
      salvaImpostazioni({ scena: { scelto: resto[0]?.id ?? null } });
    }
  }

  // Gli oggetti che possono comparire nell'Area Utente
  function oggettiInScena() {
    const { scena } = getImpostazioni();
    const lista = getOggetti();
    if (scena.modo === 'random') {
      return lista.filter((o) => o.attivo);
    }
    const scelto = lista.find((o) => o.id === scena.scelto) || lista[0];
    return scelto ? [scelto] : [];
  }

  // Il video può partire toccando l'oggetto? Sì se è di una delle sue categorie,
  // oppure se l'oggetto non ha categorie (fa partire tutti i video)
  function videoAdatto(oggetto, video) {
    const categorie = oggetto?.categorie || [];
    return !categorie.length || categorie.includes(video.categoria);
  }

  // I video che l'oggetto fa partire, tra quelli della lista indicata
  function videoDellOggetto(oggetto, lista = getYoutube()) {
    return lista.filter((v) => videoAdatto(oggetto, v));
  }

  // ==================== IMMAGINI DEGLI OGGETTI (IndexedDB) ====================

  let db = null;

  function apriDB() {
    if (db) {
      return Promise.resolve(db);
    }
    return new Promise((resolve, reject) => {
      const richiesta = indexedDB.open(DB_NOME, DB_VERSIONE);
      richiesta.onupgradeneeded = () => {
        const d = richiesta.result;
        if (!d.objectStoreNames.contains(STORE_IMMAGINI)) {
          d.createObjectStore(STORE_IMMAGINI);
        }
      };
      richiesta.onsuccess = () => {
        db = richiesta.result;
        db.onversionchange = () => {
          db.close();
          db = null;
        };
        resolve(db);
      };
      richiesta.onerror = () => reject(richiesta.error || new Error('Archivio immagini non disponibile.'));
    });
  }

  async function transazione(modo, operazione) {
    const d = await apriDB();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE_IMMAGINI, modo);
      const richiesta = operazione(tx.objectStore(STORE_IMMAGINI));
      tx.oncomplete = () => resolve(richiesta?.result);
      tx.onerror = () => reject(tx.error || new Error('Operazione sull\'archivio non riuscita.'));
      tx.onabort = () => reject(tx.error || new Error('Operazione sull\'archivio annullata (spazio esaurito?).'));
    });
  }

  function getImmagine(id) {
    return transazione('readonly', (store) => store.get(chiaveImmagine(id))).then((r) => r || null);
  }

  function salvaImmagine(id, blob, nome) {
    return transazione('readwrite', (store) => store.put({ blob, nome, data: Date.now() }, chiaveImmagine(id)));
  }

  // Nuova versione dell'immagine (dopo un ritaglio): il nome resta
  async function aggiornaImmagine(id, blob) {
    const vecchia = await getImmagine(id).catch(() => null);
    return salvaImmagine(id, blob, vecchia?.nome || '');
  }

  function eliminaImmagine(id) {
    return transazione('readwrite', (store) => store.delete(chiaveImmagine(id)));
  }

  // Fino alla versione 1.0.3 c'era un solo oggetto, dentro le impostazioni (e la sua
  // immagine in IndexedDB con la chiave "oggetto"): diventa il primo dell'elenco.
  async function migraVersionePrecedente() {
    if (localStorage.getItem(CHIAVI.oggetti) !== null) {
      return;
    }
    const salvate = leggiJSON(CHIAVI.impostazioni, {});
    const vecchio = eOggetto(salvate.oggetto) ? salvate.oggetto : {};
    const lista = [];
    const record = { id: 1, nome: vecchio.nome || '', attivo: true, data_creazione: Date.now() };
    if (vecchio.tipo === 'arasaac' && vecchio.arasaac_id) {
      lista.push({ ...record, tipo: 'arasaac', arasaac_id: Number(vecchio.arasaac_id) });
    } else if (vecchio.tipo === 'immagine') {
      const immagine = await transazione('readonly', (store) => store.get(CHIAVE_VECCHIA)).catch(() => null);
      if (immagine?.blob) {
        await salvaImmagine(1, immagine.blob, immagine.nome || record.nome);
        lista.push({ ...record, tipo: 'immagine', arasaac_id: null });
      }
    }
    await transazione('readwrite', (store) => store.delete(CHIAVE_VECCHIA)).catch(() => {});
    salvaOggetti(lista);
    delete salvate.oggetto;
    salvate.scena = { modo: 'uno', scelto: lista[0]?.id ?? null };
    scriviJSON(CHIAVI.impostazioni, salvate);
  }

  // ==================== ESPORTA / IMPORTA ====================

  // Un piccolo file JSON: impostazioni, link dei video, oggetti e immagini caricate
  async function esportaDati() {
    const oggetti = getOggetti();
    const immagini = [];
    for (const o of oggetti.filter((x) => x.tipo === 'immagine')) {
      const record = await getImmagine(o.id).catch(() => null);
      if (record?.blob) {
        immagini.push({ id: o.id, nome: record.nome || '', dati: await Util.blobInDataUrl(record.blob) });
      }
    }
    return {
      app: 'causa-effetto',
      versione: window.APP_CONFIG?.versione || '',
      esportato: Date.now(),
      impostazioni: getImpostazioni(),
      youtube: getYoutube(),
      oggetti,
      immagini,
    };
  }

  // Legge anche i file delle versioni fino alla 1.0.3 (un solo oggetto nelle impostazioni)
  function oggettiDaFile(file, impostazioni) {
    if (Array.isArray(file.oggetti)) {
      return {
        oggetti: file.oggetti.filter((o) => eOggetto(o) && ['arasaac', 'immagine'].includes(o.tipo)),
        immagini: Array.isArray(file.immagini) ? file.immagini.filter(eOggetto) : [],
      };
    }
    const vecchio = eOggetto(impostazioni.oggetto) ? impostazioni.oggetto : {};
    const base = { id: 1, nome: vecchio.nome || '', attivo: true };
    impostazioni.scena = { modo: 'uno', scelto: 1 };
    if (vecchio.tipo === 'arasaac' && vecchio.arasaac_id) {
      return { oggetti: [{ ...base, tipo: 'arasaac', arasaac_id: Number(vecchio.arasaac_id) }], immagini: [] };
    }
    if (vecchio.tipo === 'immagine' && file.immagine?.dati) {
      return {
        oggetti: [{ ...base, tipo: 'immagine', arasaac_id: null }],
        immagini: [{ id: 1, nome: file.immagine.nome || '', dati: file.immagine.dati }],
      };
    }
    return { oggetti: [], immagini: [] };
  }

  async function importaDati(file) {
    if (!eOggetto(file) || file.app !== 'causa-effetto') {
      throw new Error('Il file non è un\'esportazione di Causa Effetto.');
    }
    const youtube = Array.isArray(file.youtube) ? file.youtube.filter((v) => eOggetto(v)
      && /^[A-Za-z0-9_-]{11}$/.test(v.video_id || '')) : [];
    const impostazioni = eOggetto(file.impostazioni) ? { ...file.impostazioni } : {};
    const { oggetti, immagini } = oggettiDaFile(file, impostazioni);

    // Prima si leggono le immagini (l'operazione che può fallire), poi si scrive tutto
    const blob = new Map();
    for (const im of immagini) {
      if (typeof im.dati === 'string' && /^data:image\//.test(im.dati)) {
        blob.set(im.id, { blob: await Util.dataUrlInBlob(im.dati), nome: im.nome || '' });
      }
    }
    const validi = oggetti.filter((o) => (o.tipo === 'arasaac'
      ? Number.isFinite(Number(o.arasaac_id)) : blob.has(o.id)));

    // Gli id vengono rinumerati: il file può arrivare da versioni o dispositivi diversi
    const nuoviId = new Map(validi.map((o, i) => [o.id, i + 1]));
    await transazione('readwrite', (store) => store.clear());
    for (const o of validi.filter((x) => x.tipo === 'immagine')) {
      const im = blob.get(o.id);
      await salvaImmagine(nuoviId.get(o.id), im.blob, im.nome);
    }
    salvaOggetti(validi.map((o) => ({
      id: nuoviId.get(o.id),
      tipo: o.tipo,
      arasaac_id: o.tipo === 'arasaac' ? Number(o.arasaac_id) : null,
      nome: String(o.nome || ''),
      attivo: o.attivo !== false,
      categorie: soloTesti(o.categorie),
      data_creazione: o.data_creazione || Date.now(),
    })));
    const scena = eOggetto(impostazioni.scena) ? impostazioni.scena : {};
    impostazioni.scena = { ...scena, scelto: nuoviId.get(scena.scelto) ?? (validi.length ? 1 : null) };
    delete impostazioni.oggetto;
    salvaYoutube(youtube.map((v, i) => ({ ...v, id: i + 1 })));
    scriviJSON(CHIAVI.impostazioni, unisci(IMPOSTAZIONI_DEFAULT, impostazioni));
    return { youtube: youtube.length, oggetti: validi.length };
  }

  // ==================== SPAZIO ====================

  async function richiediStoragePersistente() {
    try {
      if (navigator.storage?.persist) {
        if (await navigator.storage.persisted()) {
          return true;
        }
        return await navigator.storage.persist();
      }
    } catch (e) {
      console.warn('Richiesta di storage persistente non riuscita:', e);
    }
    return false;
  }

  async function storageInfo() {
    try {
      if (navigator.storage?.estimate) {
        const stima = await navigator.storage.estimate();
        return { usati: stima.usage || 0, disponibili: stima.quota || 0 };
      }
    } catch (e) { /* non supportato */ }
    return null;
  }

  return {
    LIMITI,
    getImpostazioni,
    salvaImpostazioni,
    getYoutube,
    aggiungiYoutube,
    aggiornaYoutube,
    eliminaYoutube,
    eliminaYoutubePlaylist,
    getCategorie,
    getOggetti,
    aggiungiOggetto,
    aggiungiImmagine,
    aggiornaOggetto,
    eliminaOggetto,
    oggettiInScena,
    videoAdatto,
    videoDellOggetto,
    getImmagine,
    aggiornaImmagine,
    migraVersionePrecedente,
    esportaDati,
    importaDati,
    richiediStoragePersistente,
    storageInfo,
  };
})();
