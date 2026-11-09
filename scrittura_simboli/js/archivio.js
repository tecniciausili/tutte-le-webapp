// ==================== ARCHIVIO ====================
// Un dispositivo = un utente: tutto resta nel browser.
//   localStorage  ss_testo, ss_scelte (simbolo scelto per ogni parola), ss_impostazioni,
//                 ss_foto_parole (foto personale di una parola: { chiave: { id, attiva } }),
//                 ss_arasaac (ricerche ARASAAC già fatte: è una cache, non si esporta)
//   IndexedDB     database "scrittura-simboli", archivio "foto" (foto dell'utente, già ridotte)
// Le chiavi hanno il prefisso ss_ e il database un nome proprio: non toccano le altre app del dominio.

const Archivio = (() => {
  const CHIAVI = {
    testo: 'ss_testo', scelte: 'ss_scelte', impostazioni: 'ss_impostazioni', arasaac: 'ss_arasaac', fotoParole: 'ss_foto_parole',
  };
  const DB_NOME = 'scrittura-simboli';
  const DB_ARCHIVIO = 'foto';
  let db = null;

  function leggi(chiave, predefinito) {
    try {
      const v = localStorage.getItem(chiave);
      return v === null ? predefinito : JSON.parse(v);
    } catch (e) {
      return predefinito;
    }
  }

  function scrivi(chiave, valore) {
    try {
      localStorage.setItem(chiave, JSON.stringify(valore));
      return true;
    } catch (e) {
      return false;
    }
  }

  const testo = () => leggi(CHIAVI.testo, null);
  const salvaTesto = (t) => scrivi(CHIAVI.testo, t);
  const scelte = () => leggi(CHIAVI.scelte, {});
  const salvaScelte = (s) => scrivi(CHIAVI.scelte, s);
  const impostazioni = () => Object.assign(
    {
      velocita: 0.9, voce: '', grandezza: 120, leggiAuto: true, arasaac: false, mulberry: false,
      testoPx: 40, grassetto: false, colore: '#1f2933',
    },
    leggi(CHIAVI.impostazioni, {}),
  );
  const salvaImpostazioni = (i) => scrivi(CHIAVI.impostazioni, i);
  const fotoParole = () => {
    const f = leggi(CHIAVI.fotoParole, {});
    return f && typeof f === 'object' && !Array.isArray(f) ? f : {};
  };
  const salvaFotoParole = (f) => scrivi(CHIAVI.fotoParole, f);
  const cacheArasaac = () => {
    const c = leggi(CHIAVI.arasaac, {});
    return c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  };
  const salvaCacheArasaac = (c) => scrivi(CHIAVI.arasaac, c);

  // ---------- foto ----------

  function apriDb() {
    if (db) {
      return Promise.resolve(db);
    }
    return new Promise((resolve) => {
      try {
        const r = indexedDB.open(DB_NOME, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(DB_ARCHIVIO, { keyPath: 'id' });
        r.onsuccess = () => {
          db = r.result;
          resolve(db);
        };
        r.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function tutteLeFoto() {
    const d = await apriDb();
    if (!d) {
      return [];
    }
    return new Promise((resolve) => {
      try {
        const r = d.transaction(DB_ARCHIVIO).objectStore(DB_ARCHIVIO).getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async function salvaFoto(foto) {
    const d = await apriDb();
    if (!d) {
      return false;
    }
    return new Promise((resolve) => {
      try {
        const t = d.transaction(DB_ARCHIVIO, 'readwrite');
        t.objectStore(DB_ARCHIVIO).put(foto);
        t.oncomplete = () => resolve(true);
        t.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async function svuotaFoto() {
    const d = await apriDb();
    if (!d) {
      return;
    }
    await new Promise((resolve) => {
      const t = d.transaction(DB_ARCHIVIO, 'readwrite');
      t.objectStore(DB_ARCHIVIO).clear();
      t.oncomplete = resolve;
      t.onerror = resolve;
    });
  }

  // ---------- esporta / importa ----------

  async function esportaDati() {
    return {
      app: 'scrittura_simboli',
      versione: window.APP_CONFIG?.versione,
      data: new Date().toISOString(),
      testo: testo() || '',
      scelte: scelte(),
      fotoParole: fotoParole(),
      impostazioni: impostazioni(),
      foto: await tutteLeFoto(),
    };
  }

  async function importaDati(o) {
    if (!o || o.app !== 'scrittura_simboli') {
      throw new Error('il file non è un salvataggio di Scrittura con Simboli');
    }
    salvaTesto(String(o.testo || ''));
    salvaScelte(o.scelte && typeof o.scelte === 'object' ? o.scelte : {});
    salvaFotoParole(o.fotoParole && typeof o.fotoParole === 'object' ? o.fotoParole : {});
    if (o.impostazioni) {
      salvaImpostazioni(o.impostazioni);
    }
    await svuotaFoto();
    const foto = Array.isArray(o.foto) ? o.foto : [];
    for (const f of foto) {
      if (f && f.id && typeof f.data === 'string' && f.data.startsWith('data:image/')) {
        await salvaFoto(f);
      }
    }
    return { foto: foto.length };
  }

  async function storageInfo() {
    try {
      const s = await navigator.storage?.estimate?.();
      return s ? { usati: s.usage || 0, disponibili: s.quota || 0 } : null;
    } catch (e) {
      return null;
    }
  }

  function richiediStoragePersistente() {
    try {
      navigator.storage?.persist?.();
    } catch (e) { /* non disponibile */ }
  }

  return {
    testo, salvaTesto, scelte, salvaScelte, impostazioni, salvaImpostazioni, cacheArasaac, salvaCacheArasaac,
    fotoParole, salvaFotoParole,
    tutteLeFoto, salvaFoto, esportaDati, importaDati, storageInfo, richiediStoragePersistente,
  };
})();
