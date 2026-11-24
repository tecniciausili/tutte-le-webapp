// ==================== ARCHIVIO LOCALE ====================
// Nessun server: quello che si registra sul tablet resta sul tablet, quello che si
// registra sul computer resta sul computer.
//
//  - Video YouTube, impostazioni, registro sessioni → localStorage (JSON)
//  - Audio registrati o caricati (blob MP3)         → IndexedDB
//
// CONFIGURAZIONI: sullo stesso dispositivo si possono tenere più configurazioni con un nome,
// una per ogni utente. Ognuna ha i suoi audio, video, impostazioni, ordine e registro; se ne
// usa una alla volta (quella attiva). La prima («c1») usa le chiavi di sempre, così i dati
// delle versioni precedenti diventano la sua configurazione senza conversioni.
// Restano del dispositivo, comuni a tutte: le prese (account e indirizzi) e il codice del ponte.

const Archivio = (() => {
  const CHIAVI = {
    youtube: 'mt_youtube',
    impostazioni: 'mt_impostazioni',
    registro: 'mt_registro',
    ordine: 'mt_ordine',
  };
  const CHIAVE_CONFIGURAZIONI = 'mt_configurazioni';
  const CHIAVE_PONTE = 'mt_ponte_codice';   // codice del ponte: del dispositivo, non dell'utente
  const PRIMA = 'c1';
  const NOME_PRIMA = 'Utente 1';

  const DB_NOME = 'mastertutor';
  const DB_VERSIONE = 1;
  const STORE_AUDIO = 'audio';
  const MAX_SESSIONI = 200;

  const IMPOSTAZIONI_DEFAULT = {
    // Anticipatore GENERALE: 'predefinito' (suono incluso nell'app) | 'nessuno' | id di un audio
    anticipatore: 'predefinito',
    // Anticipatore di ogni tipo di stimolo: 'generale' (= quello qui sopra) | 'nessuno' |
    // 'predefinito' | id di un audio. Le prese ne hanno uno ciascuna: prese[idPresa]
    anticipatori: {
      audio: 'generale',       // voci registrate
      youtube: 'generale',     // musica e video YouTube
      prese: {},
    },
    stimolazione: {
      attesa_min: 15,          // secondi di attesa casuale tra due stimoli (minimo)
      attesa_max: 20,          // ... (massimo) — valori del programma originale in sede
      durata_max: 0,           // durata massima di audio e video, 0 = fino alla fine
      eventi: { audio: true, youtube: true, presa: true },
      risposta_timeout: 10,    // stimolo su richiesta: secondi per premere lo switch, 0 = senza limite
      ordine: 'successivo',    // 'successivo' (come nella lista dell'Area Utente) | 'random'
    },
    presa: {
      codice: '',              // codice di abbinamento mostrato dal ponte
      prese: [],               // id delle prese da accendere (vuoto = tutte)
      secondi: 30,             // quanto resta accesa la presa a ogni stimolo (valore in sede)
    },
    utente: {                  // ultime scelte fatte nell'Area Utente
      modalita: 'casuale',     // 'casuale' | 'richiesta' | 'switch'
      ascolto: 'diretto',      // 'diretto' | 'random' | 'temporizzato' | 'persistente' | 'navigazione'
      ordine: 'successivo',    // temporizzato e persistente: 'successivo' | 'random'
      timer: 30,
      attesa_navigazione: 10,
      spazio_navigazione: 'next', // 'next' | 'ignore' | 'disabled'
      switch2_audio: false,    // freccia DESTRA dedicata agli audio registrati
      pannello_chiuso: false,
      categoria: '',
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

  // ==================== CONFIGURAZIONI (UNA PER UTENTE) ====================

  function statoConfigurazioni() {
    const s = leggiJSON(CHIAVE_CONFIGURAZIONI, null);
    const elenco = (eOggetto(s) && Array.isArray(s.elenco) ? s.elenco : [])
      .filter((c) => eOggetto(c) && typeof c.id === 'string' && c.id)
      .map((c) => ({ id: c.id, nome: String(c.nome || '').trim() || c.id, creata: Number(c.creata) || 0 }));
    if (elenco.length === 0) {
      elenco.push({ id: PRIMA, nome: NOME_PRIMA, creata: 0 });
    }
    const attiva = elenco.some((c) => c.id === s?.attiva) ? s.attiva : elenco[0].id;
    return { attiva, elenco };
  }

  function salvaStatoConfigurazioni(stato) {
    scriviJSON(CHIAVE_CONFIGURAZIONI, stato);
  }

  // Chiave di localStorage di un dato per una configurazione
  function chiaveDi(base, id = statoConfigurazioni().attiva) {
    return id === PRIMA ? base : `${base}@${id}`;
  }

  function configurazioni() {
    return statoConfigurazioni().elenco.slice();
  }

  function configurazioneAttiva() {
    const s = statoConfigurazioni();
    return s.elenco.find((c) => c.id === s.attiva);
  }

  function nomeLibero(nome, tranneId = null) {
    const pulito = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!pulito) {
      throw new Error('Scrivi un nome per la configurazione.');
    }
    const doppione = statoConfigurazioni().elenco
      .some((c) => c.id !== tranneId && c.nome.toLocaleLowerCase('it') === pulito.toLocaleLowerCase('it'));
    if (doppione) {
      throw new Error(`Esiste già una configurazione «${pulito}».`);
    }
    return pulito;
  }

  function usaConfigurazione(id) {
    const s = statoConfigurazioni();
    if (!s.elenco.some((c) => c.id === id)) {
      throw new Error('Configurazione non trovata.');
    }
    // Il codice del ponte resta del dispositivo anche passando a un'altra configurazione
    localStorage.setItem(CHIAVE_PONTE, getImpostazioni().presa.codice || '');
    salvaStatoConfigurazioni({ ...s, attiva: id });
  }

  // Crea una configurazione nuova e la rende attiva. Con copia = true parte da una copia di
  // quella attiva (audio, video, anticipatori, tempi e ordine; il registro no).
  async function creaConfigurazione(nome, { copia = false } = {}) {
    const pulito = nomeLibero(nome);
    const s = statoConfigurazioni();
    let n = s.elenco.length + 1;
    while (s.elenco.some((c) => c.id === `c${n}`)) {
      n++;
    }
    const id = `c${n}`;
    const datiDaCopiare = copia ? await esportaDati() : null;
    // Pulisco eventuali resti di una configurazione eliminata con lo stesso id
    await cancellaDatiConfigurazione(id);
    salvaStatoConfigurazioni({ ...s, elenco: [...s.elenco, { id, nome: pulito, creata: Date.now() }] });
    usaConfigurazione(id);
    if (datiDaCopiare) {
      await importaDati(datiDaCopiare);
    }
    return { id, nome: pulito };
  }

  function rinominaConfigurazione(id, nome) {
    const pulito = nomeLibero(nome, id);
    const s = statoConfigurazioni();
    salvaStatoConfigurazioni({ ...s, elenco: s.elenco.map((c) => (c.id === id ? { ...c, nome: pulito } : c)) });
    return pulito;
  }

  async function cancellaDatiConfigurazione(id) {
    for (const base of Object.values(CHIAVI)) {
      localStorage.removeItem(chiaveDi(base, id));
    }
    const ids = (await tuttiGliAudio()).filter((a) => (a.config || PRIMA) === id).map((a) => a.id);
    if (ids.length) {
      await transazione('readwrite', (store) => {
        ids.forEach((k) => store.delete(k));
      });
    }
  }

  // Elimina una configurazione con tutti i suoi dati. L'ultima rimasta non si può eliminare;
  // se si elimina quella attiva diventa attiva la prima dell'elenco.
  async function eliminaConfigurazione(id) {
    const s = statoConfigurazioni();
    if (!s.elenco.some((c) => c.id === id)) {
      throw new Error('Configurazione non trovata.');
    }
    if (s.elenco.length <= 1) {
      throw new Error('È l\'unica configurazione: non si può eliminare.');
    }
    if (s.attiva === id) {
      localStorage.setItem(CHIAVE_PONTE, getImpostazioni().presa.codice || '');
    }
    await cancellaDatiConfigurazione(id);
    const elenco = s.elenco.filter((c) => c.id !== id);
    salvaStatoConfigurazioni({ attiva: s.attiva === id ? elenco[0].id : s.attiva, elenco });
  }

  // Una presa tolta dalla configurazione delle prese (comuni a tutte le configurazioni):
  // la dimentico nelle scelte e negli anticipatori di ogni configurazione, così un'eventuale
  // presa nuova con lo stesso id non eredita impostazioni non sue
  function dimenticaPresa(idPresa) {
    for (const c of statoConfigurazioni().elenco) {
      const chiave = chiaveDi(CHIAVI.impostazioni, c.id);
      const imp = leggiJSON(chiave, null);
      if (!eOggetto(imp)) {
        continue;
      }
      if (eOggetto(imp.presa) && Array.isArray(imp.presa.prese)) {
        imp.presa.prese = imp.presa.prese.filter((x) => x !== idPresa);
      }
      if (eOggetto(imp.anticipatori) && eOggetto(imp.anticipatori.prese)) {
        delete imp.anticipatori.prese[idPresa];
      }
      scriviJSON(chiave, imp);
    }
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

  // ==================== IMPOSTAZIONI ====================

  function getImpostazioni() {
    const imp = unisci(IMPOSTAZIONI_DEFAULT, leggiJSON(chiaveDi(CHIAVI.impostazioni), {}));
    const ponte = localStorage.getItem(CHIAVE_PONTE);
    if (ponte !== null) {
      imp.presa.codice = ponte;
    }
    // Valori numerici sempre validi, anche se modificati a mano
    const st = imp.stimolazione;
    st.attesa_min = Math.max(1, Number(st.attesa_min) || IMPOSTAZIONI_DEFAULT.stimolazione.attesa_min);
    st.attesa_max = Math.max(st.attesa_min, Number(st.attesa_max) || st.attesa_min);
    st.durata_max = Math.max(0, Number(st.durata_max) || 0);
    st.risposta_timeout = Math.max(0, Number(st.risposta_timeout) || 0);
    imp.presa.secondi = Math.min(600, Math.max(1, Number(imp.presa.secondi) || 30));
    return imp;
  }

  function salvaImpostazioni(parziale) {
    const nuove = unisci(getImpostazioni(), parziale);
    scriviJSON(chiaveDi(CHIAVI.impostazioni), nuove);
    localStorage.setItem(CHIAVE_PONTE, nuove.presa.codice || '');
    return nuove;
  }

  // ==================== VIDEO YOUTUBE ====================

  function getYoutube() {
    const lista = leggiJSON(chiaveDi(CHIAVI.youtube), []);
    return Array.isArray(lista) ? lista : [];
  }

  function salvaYoutube(lista) {
    scriviJSON(chiaveDi(CHIAVI.youtube), lista);
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
      solo_audio: !!dati.solo_audio,
      intero: !!dati.intero,    // ignora la durata massima generale
      playlist_id: dati.playlist_id || null,
      playlist_nome: dati.playlist_nome || '',
      attivo: true,
      data_creazione: Date.now(),
    };
    lista.push(record);
    salvaYoutube(lista);
    return record;
  }

  function aggiornaYoutube(id, campi) {
    const lista = getYoutube().map((v) => (v.id === id ? { ...v, ...campi } : v));
    salvaYoutube(lista);
  }

  function eliminaYoutube(id) {
    salvaYoutube(getYoutube().filter((v) => v.id !== id));
    // L'id può tornare a un video nuovo: non deve ereditare il posto nella sequenza
    salvaOrdine(getOrdine().filter((k) => k !== `y${id}`));
  }

  // Elimina in un colpo solo tutti i video importati da una stessa playlist.
  // Restituisce quanti ne ha rimossi.
  function eliminaYoutubePlaylist(playlistId) {
    if (!playlistId) {
      return 0;
    }
    const daRimuovere = getYoutube().filter((v) => v.playlist_id === playlistId);
    if (daRimuovere.length === 0) {
      return 0;
    }
    const idRimossi = new Set(daRimuovere.map((v) => `y${v.id}`));
    salvaYoutube(getYoutube().filter((v) => v.playlist_id !== playlistId));
    salvaOrdine(getOrdine().filter((k) => !idRimossi.has(k)));
    return daRimuovere.length;
  }

  function getCategorie() {
    return Array.from(new Set(getYoutube().map((v) => v.categoria).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'it'));
  }

  // ==================== AUDIO (IndexedDB) ====================

  let db = null;

  function apriDB() {
    if (db) {
      return Promise.resolve(db);
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NOME, DB_VERSIONE);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(STORE_AUDIO)) {
          database.createObjectStore(STORE_AUDIO, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => {
        db = req.result;
        // Se un'altra scheda aggiorna il database, chiudo per non bloccarla
        db.onversionchange = () => {
          db.close();
          db = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(new Error('Impossibile aprire il database audio del dispositivo.'));
    });
  }

  async function transazione(modo, operazione) {
    const database = await apriDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_AUDIO, modo);
      const store = tx.objectStore(STORE_AUDIO);
      let risultato;
      operazione(store, (valore) => {
        risultato = valore;
      });
      tx.oncomplete = () => resolve(risultato);
      tx.onerror = () => reject(tx.error || new Error('Errore del database audio.'));
      tx.onabort = () => reject(tx.error || new Error('Operazione sul database audio annullata.'));
    });
  }

  // audio: {nome, origine: 'registrazione'|'upload', durata, blob, attivo?, data_creazione?, anticipa?}
  // anticipa: per gli audio anticipatori, la categoria per cui sono stati registrati
  //   'generale' | 'audio' | 'youtube' | 'presa:<id della presa>' (null = audio normale, uno stimolo)
  async function audioAggiungi(audio) {
    const record = {
      config: statoConfigurazioni().attiva,   // configurazione (utente) a cui appartiene
      anticipa: typeof audio.anticipa === 'string' && audio.anticipa ? audio.anticipa : null,
      nome: audio.nome,
      origine: audio.origine === 'registrazione' ? 'registrazione' : 'upload',
      durata: Number(audio.durata) || 0,
      attivo: audio.attivo !== false,
      intero: !!audio.intero,   // ignora la durata massima generale: si ascolta sempre tutto
      data_creazione: Number(audio.data_creazione) || Date.now(),
      blob: audio.blob,
    };
    const id = await transazione('readwrite', (store, fine) => {
      const req = store.add(record);
      req.onsuccess = () => fine(req.result);
    });
    return { ...record, id };
  }

  // Tutti gli audio del dispositivo, di ogni configurazione
  function tuttiGliAudio() {
    return transazione('readonly', (store, fine) => {
      const req = store.getAll();
      req.onsuccess = () => fine(req.result || []);
    });
  }

  // Gli audio senza "config" sono quelli delle versioni precedenti: della prima configurazione
  function dellaAttiva(record) {
    return !!record && (record.config || PRIMA) === statoConfigurazioni().attiva;
  }

  async function audioLista() {
    return (await tuttiGliAudio()).filter(dellaAttiva);
  }

  async function audioGet(id) {
    const record = await transazione('readonly', (store, fine) => {
      const req = store.get(id);
      req.onsuccess = () => fine(req.result || null);
    });
    return dellaAttiva(record) ? record : null;
  }

  function audioAggiorna(id, campi) {
    return transazione('readwrite', (store) => {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
          store.put({ ...req.result, ...campi, id });
        }
      };
    });
  }

  function audioElimina(id) {
    salvaOrdine(getOrdine().filter((k) => k !== `a${id}`));
    return transazione('readwrite', (store) => {
      store.delete(id);
    });
  }

  // ==================== ORDINE DEGLI STIMOLI ====================
  // Chiavi degli stimoli nell'ordine scelto trascinandoli nell'Area Utente
  // ('a12' = audio, 'y5' = video YouTube, 'presa'). Vale ovunque: stimolazione,
  // ascolto con switch, navigazione assistita ed elenchi dell'Area Educatore.

  function getOrdine() {
    const lista = leggiJSON(chiaveDi(CHIAVI.ordine), []);
    return Array.isArray(lista) ? lista.filter((k) => typeof k === 'string') : [];
  }

  function salvaOrdine(chiavi) {
    scriviJSON(chiaveDi(CHIAVI.ordine), Array.from(new Set(chiavi)));
  }

  // Mette una lista nell'ordine scelto; chi non c'è ancora (appena aggiunto) va in fondo
  function inOrdine(lista, chiaveDi) {
    const posizione = new Map(getOrdine().map((k, i) => [k, i]));
    return lista
      .map((el, i) => ({ el, i, p: posizione.get(chiaveDi(el)) ?? Infinity }))
      .sort((a, b) => (a.p !== b.p ? a.p - b.p : a.i - b.i))
      .map((x) => x.el);
  }

  // ==================== REGISTRO SESSIONI ====================

  function getRegistro() {
    const lista = leggiJSON(chiaveDi(CHIAVI.registro), []);
    return Array.isArray(lista) ? lista : [];
  }

  // Inserisce o aggiorna una sessione (salvata anche durante lo svolgimento,
  // così i dati non si perdono se l'app viene chiusa all'improvviso)
  function salvaSessione(sessione) {
    const lista = getRegistro().filter((s) => s.id !== sessione.id);
    lista.push(sessione);
    lista.sort((a, b) => a.inizio - b.inizio);
    scriviJSON(chiaveDi(CHIAVI.registro), lista.slice(-MAX_SESSIONI));
  }

  function azzeraRegistro() {
    localStorage.removeItem(chiaveDi(CHIAVI.registro));
  }

  // ==================== ESPORTA / IMPORTA ====================
  // Un solo file .json con tutto il necessario per riconfigurare un dispositivo:
  // impostazioni, video YouTube, ordine degli stimoli e gli audio (inclusi nel file).
  // NON contiene il registro delle sessioni né la password delle prese (che sta solo
  // nel ponte). Il codice di abbinamento del ponte viene escluso: ogni casa ha il suo.

  const FORMATO_BACKUP = 1;

  function blobInBase64(blob) {
    return new Promise((resolve, reject) => {
      if (!blob) {
        resolve('');
        return;
      }
      const lettore = new FileReader();
      lettore.onload = () => resolve(String(lettore.result).split(',')[1] || '');
      lettore.onerror = () => reject(new Error('Lettura di un audio non riuscita.'));
      lettore.readAsDataURL(blob);
    });
  }

  function base64InBlob(base64, tipo) {
    const binario = atob(base64 || '');
    const byte = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) {
      byte[i] = binario.charCodeAt(i);
    }
    return new Blob([byte], { type: tipo || 'audio/mpeg' });
  }

  async function esportaDati() {
    const impostazioni = getImpostazioni();
    // Il codice del ponte resta legato al singolo dispositivo: non viaggia nel file
    impostazioni.presa = { ...impostazioni.presa, codice: '' };

    const audio = await audioLista();
    const audioEsportati = await Promise.all(audio.map(async (a) => ({
      id: a.id,
      nome: a.nome,
      origine: a.origine,
      durata: a.durata,
      attivo: a.attivo,
      intero: !!a.intero,
      anticipa: a.anticipa || null,
      data_creazione: a.data_creazione,
      tipo: a.blob?.type || 'audio/mpeg',
      dati: await blobInBase64(a.blob),
    })));

    return {
      app: 'mastertutor',
      formato: FORMATO_BACKUP,
      versione_app: window.APP_CONFIG?.versione || '',
      esportato: Date.now(),
      configurazione: configurazioneAttiva()?.nome || '',
      impostazioni,
      youtube: getYoutube(),
      ordine: getOrdine(),
      audio: audioEsportati,
    };
  }

  // Sostituisce impostazioni, video, ordine e audio con quelli del file.
  // Mantiene il codice del ponte già presente su questo dispositivo e non tocca il registro.
  async function importaDati(oggetto) {
    if (!eOggetto(oggetto) || oggetto.app !== 'mastertutor' || !Number.isInteger(oggetto.formato)) {
      throw new Error('Questo file non è un backup di Mastertutor.');
    }
    if (oggetto.formato > FORMATO_BACKUP) {
      throw new Error('Il file è stato creato con una versione più recente dell\'app. Aggiorna l\'app e riprova.');
    }

    // Impostazioni: quelle del file prevalgono, il codice del ponte resta quello locale
    const codicePonteLocale = getImpostazioni().presa.codice;
    const impFinale = unisci(IMPOSTAZIONI_DEFAULT, eOggetto(oggetto.impostazioni) ? oggetto.impostazioni : {});
    impFinale.presa.codice = codicePonteLocale;
    scriviJSON(chiaveDi(CHIAVI.impostazioni), impFinale);

    // Video YouTube: gli id restano quelli del file, così l'ordine y* è ancora valido
    scriviJSON(chiaveDi(CHIAVI.youtube), Array.isArray(oggetto.youtube) ? oggetto.youtube : []);

    // Audio: svuoto e re-inserisco. Gli id di IndexedDB cambiano, quindi tengo la
    // corrispondenza vecchio → nuovo per rimettere a posto l'ordine.
    // (solo quelli della configurazione attiva: le altre non si toccano)
    const daTogliere = (await audioLista()).map((a) => a.id);
    await transazione('readwrite', (store) => {
      daTogliere.forEach((k) => store.delete(k));
    });
    const mappaAudio = new Map();
    const mappaId = new Map();   // vecchio id numerico → nuovo
    for (const a of (Array.isArray(oggetto.audio) ? oggetto.audio : [])) {
      const blob = base64InBlob(a.dati, a.tipo);
      const nuovo = await audioAggiungi({
        nome: a.nome,
        origine: a.origine,
        durata: a.durata,
        attivo: a.attivo,
        intero: a.intero,
        anticipa: a.anticipa,
        data_creazione: a.data_creazione,
        blob,
      });
      if (a.id != null) {
        mappaAudio.set(`a${a.id}`, `a${nuovo.id}`);
        mappaId.set(Number(a.id), nuovo.id);
      }
    }

    // Gli anticipatori scelti puntano agli id degli audio: li rimappo come l'ordine
    // (prima l'anticipatore scelto si perdeva dopo un'importazione)
    const rimappa = (v) => (typeof v === 'number' ? (mappaId.get(v) ?? 'predefinito') : v);
    const imp = getImpostazioni();
    const prese = {};
    for (const [id, v] of Object.entries(imp.anticipatori.prese || {})) {
      prese[id] = rimappa(v);
    }
    scriviJSON(chiaveDi(CHIAVI.impostazioni), {
      ...imp,
      anticipatore: rimappa(imp.anticipatore),
      anticipatori: { audio: rimappa(imp.anticipatori.audio), youtube: rimappa(imp.anticipatori.youtube), prese },
    });

    // Ordine: rimappo le chiavi audio, lascio invariate quelle video ('y*') e 'presa'
    const ordine = (Array.isArray(oggetto.ordine) ? oggetto.ordine : [])
      .map((k) => mappaAudio.get(k) || k);
    salvaOrdine(ordine);

    return {
      audio: mappaAudio.size,
      youtube: Array.isArray(oggetto.youtube) ? oggetto.youtube.length : 0,
    };
  }

  // ==================== SPAZIO E PERSISTENZA ====================

  // Chiede al browser di non cancellare mai da solo i dati (registrazioni comprese)
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
    configurazioni,
    configurazioneAttiva,
    usaConfigurazione,
    creaConfigurazione,
    rinominaConfigurazione,
    eliminaConfigurazione,
    dimenticaPresa,
    getImpostazioni,
    salvaImpostazioni,
    getYoutube,
    aggiungiYoutube,
    aggiornaYoutube,
    eliminaYoutube,
    eliminaYoutubePlaylist,
    getCategorie,
    audioAggiungi,
    audioLista,
    audioGet,
    audioAggiorna,
    audioElimina,
    getOrdine,
    salvaOrdine,
    inOrdine,
    esportaDati,
    importaDati,
    getRegistro,
    salvaSessione,
    azzeraRegistro,
    richiediStoragePersistente,
    storageInfo,
  };
})();
