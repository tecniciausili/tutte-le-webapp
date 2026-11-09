// ==================== ARASAAC ====================
// Pittogrammi ARASAAC (arasaac.org), facoltativi: si attivano con la spunta «Pittogrammi ARASAAC».
// Servono internet: si cerca il lemma della parola ("mangio" -> "mangiare") con l'API pubblica
// e l'immagine arriva da static.arasaac.org. Le ricerche fatte restano in localStorage
// (ss_arasaac) e le immagini già viste nella cache del service worker: dopo funzionano offline.
// Licenza CC BY-NC-SA 4.0: solo uso non commerciale, autore e origine sempre citati (#creditiArasaac).
// Quando arrivano nuovi risultati si avvisa con l'evento "ss:simboli" su document.

const Arasaac = (() => {
  const API = 'https://api.arasaac.org/v1/pictograms/it/search/';
  const MASSIMO = 12;            // pittogrammi tenuti per ogni parola
  const IN_PARALLELO = 4;        // richieste contemporanee al massimo
  const MAX_VOCI = 4000;         // parole ricordate in localStorage
  const ATTESA_RIPROVA = 30000;  // dopo un errore di rete non si riprova subito

  let memoria = Archivio.cacheArasaac();   // termine -> [[id, parola chiave], ...]
  const inCorso = new Map();               // termine -> Promise
  const falliti = new Map();               // termine -> momento dell'errore
  const coda = [];
  let attive = 0;
  let timerSalva = null;
  let timerAvviso = null;

  const norm = (t) => String(t || '').trim().toLowerCase();

  function immagine(id, lato = 300) {
    return `https://static.arasaac.org/pictograms/${id}/${id}_${lato}.png`;
  }

  // Inizio delle parole del termine, per riconoscerle anche coniugate ("lavo" ~ "lavarsi")
  const radici = (t) => t.split(/[\s']+/).filter((p) => p.length > 2).map((p) => p.slice(0, Math.max(3, p.length - 2)));

  // L'API non mette sempre per primo il pittogramma giusto ("felice" -> prima "contento"):
  // vince la parola chiave identica, poi quella che contiene più parole del termine.
  function punteggio(termine, chiavi) {
    const r = radici(termine);
    const quante = termine.split(/\s+/).length;
    let migliore = -Infinity;
    chiavi.forEach((k) => {
      const kk = k.toLowerCase();
      if (kk === termine) {
        migliore = Math.max(migliore, 1000);
        return;
      }
      const pezzi = kk.split(/[\s']+/);
      const prese = r.filter((x) => pezzi.some((p) => p.startsWith(x))).length;
      migliore = Math.max(migliore, prese * 10 - Math.abs(pezzi.length - quante));
    });
    return migliore;
  }

  function ordina(termine, lista) {
    return lista
      .filter((p) => p && Number.isInteger(p._id) && !p.violence && !p.sex)
      .map((p, i) => {
        const chiavi = (p.keywords || []).map((k) => k.keyword).filter(Boolean);
        const uguale = chiavi.find((k) => k.toLowerCase() === termine);
        return { id: p._id, k: uguale || chiavi[0] || termine, v: punteggio(termine, chiavi), i };
      })
      .sort((a, b) => b.v - a.v || a.i - b.i)
      .slice(0, MASSIMO)
      .map((x) => [x.id, x.k]);
  }

  async function scarica(termine) {
    const r = await fetch(API + encodeURIComponent(termine));
    if (r.status === 404) {
      return [];   // nessun pittogramma per questa parola
    }
    if (!r.ok) {
      throw new Error(`ARASAAC ${r.status}`);
    }
    const dati = await r.json();
    return Array.isArray(dati) ? ordina(termine, dati) : [];
  }

  function salvaPiuTardi() {
    clearTimeout(timerSalva);
    timerSalva = setTimeout(() => {
      const chiavi = Object.keys(memoria);
      if (chiavi.length > MAX_VOCI) {
        chiavi.slice(0, chiavi.length - MAX_VOCI).forEach((k) => delete memoria[k]);
      }
      Archivio.salvaCacheArasaac(memoria);
    }, 1500);
  }

  function avvisa() {
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(() => document.dispatchEvent(new CustomEvent('ss:simboli')), 120);
  }

  function prossimo() {
    while (attive < IN_PARALLELO && coda.length) {
      const { termine, resolve } = coda.shift();
      attive++;
      scarica(termine)
        .then((lista) => {
          memoria[termine] = lista;
          falliti.delete(termine);
          salvaPiuTardi();
          avvisa();
          resolve(lista);
        })
        .catch(() => {
          falliti.set(termine, Date.now());
          resolve(null);
        })
        .finally(() => {
          attive--;
          inCorso.delete(termine);
          prossimo();
        });
    }
  }

  // Ricerca (Promise): la lista dei pittogrammi, [] se non ce ne sono, null senza rete
  function cerca(termine) {
    const t = norm(termine);
    if (!t) {
      return Promise.resolve([]);
    }
    if (memoria[t]) {
      return Promise.resolve(memoria[t]);
    }
    if (!inCorso.has(t)) {
      inCorso.set(t, new Promise((resolve) => {
        coda.push({ termine: t, resolve });
        prossimo();
      }));
    }
    return inCorso.get(t);
  }

  // Sincrona, per disegnare: la lista se la si conosce già, altrimenti null (e parte la ricerca)
  function risultati(termine) {
    const t = norm(termine);
    if (!t) {
      return null;
    }
    if (memoria[t]) {
      return memoria[t];
    }
    if (Date.now() - (falliti.get(t) || 0) > ATTESA_RIPROVA) {
      cerca(t);
    }
    return null;
  }

  return { immagine, cerca, risultati };
})();
