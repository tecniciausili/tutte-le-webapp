// ==================== RICONOSCIMENTO DELLE PAROLE ====================
// Dal testo scritto ai "cartellini": ogni parola (o espressione di più parole)
// con il suo simbolo. Il vocabolario è in js/lessico.js (LESSICO):
//   forms   forma scritta -> lemma   ("mangio" -> "mangiare", "mele" -> "mela")
//   lemmas  lemma -> { k: tipo, s: [simboli] }   tipo g = parola grammaticale (simbolo piccolo)
//   phrases espressioni di più parole -> simboli ("lavo i denti" -> 🪥)
// Un simbolo è "ms:nome" (Material Symbols), un'emoji, "#3" (numero) o "img:id" (foto dell'utente).

const Simboli = (() => {
  const FORME = LESSICO.forms;
  const LEMMI = LESSICO.lemmas;
  const ACCENTI = { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' };

  function lemmaDi(parola) {
    if (!parola) {
      return null;
    }
    if (FORME[parola]) {
      return FORME[parola];
    }
    // "perche" -> "perché", "citta" -> "città"
    const ultima = parola.slice(-1);
    const base = parola.slice(0, -1);
    if (ACCENTI[ultima] && FORME[base + ACCENTI[ultima]]) {
      return FORME[base + ACCENTI[ultima]];
    }
    if (ultima === 'e' && FORME[`${base}é`]) {
      return FORME[`${base}é`];
    }
    return null;
  }

  // "lavarsi" e "lavare" sono la stessa cosa per le espressioni
  const radice = (l) => (l && l.endsWith('rsi') ? `${l.slice(0, -3)}re` : l);

  function infoParola(grezza) {
    const w = grezza.normalize('NFC').toLowerCase().replace(/’/g, "'");
    let cerca = w;
    const apostrofo = w.indexOf("'");
    if (apostrofo > -1 && apostrofo < w.length - 1) {
      cerca = w.slice(apostrofo + 1);   // "l'acqua" -> "acqua"
    }
    let lemma = lemmaDi(cerca);
    if (!lemma && cerca.endsWith("'")) {
      lemma = lemmaDi(cerca.slice(0, -1));
    }
    if (!lemma && w === "po'") {
      lemma = 'poco';
    }
    return { w, cerca, lemma, radice: radice(lemma || cerca) };
  }

  // Espressioni indicizzate per la prima parola
  const ESPRESSIONI = new Map();
  LESSICO.phrases.forEach((p) => {
    const parole = p.w.map((x) => radice(lemmaDi(x) || x));
    const voce = { parole, s: p.s, etichetta: p.w.join(' ') };
    if (!ESPRESSIONI.has(parole[0])) {
      ESPRESSIONI.set(parole[0], []);
    }
    ESPRESSIONI.get(parole[0]).push(voce);
  });

  const TOKEN = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)*['’]?|\d+(?:[.,]\d+)?|[^\sA-Za-zÀ-ÖØ-öø-ÿ\d]+/g;

  // Ogni cartellino: { riga, inizio, fine, fineParola, tipo, chiave, simboli, etichetta }
  // tipo: g (grammaticale), n/v/x (parola), num, punct, sconosciuta
  function cartellini(testo) {
    const out = [];
    let inizioRiga = 0;
    testo.split('\n').forEach((riga, nRiga) => {
      const pezzi = [];
      let m;
      TOKEN.lastIndex = 0;
      while ((m = TOKEN.exec(riga))) {
        const t = m[0];
        const inizio = inizioRiga + m.index;
        const tipo = /^\d/.test(t) ? 'num' : /[A-Za-zÀ-ÿ]/.test(t) ? 'parola' : 'punct';
        pezzi.push({ t, inizio, fine: inizio + t.length, tipo, info: tipo === 'parola' ? infoParola(t) : null });
      }
      for (let i = 0; i < pezzi.length; i++) {
        const p = pezzi[i];
        if (p.tipo === 'punct') {
          const prima = out[out.length - 1];
          if (prima && prima.riga === nRiga && prima.fine === p.inizio) {
            prima.fine = p.fine;   // la punteggiatura resta attaccata alla parola
            continue;
          }
          out.push({ riga: nRiga, inizio: p.inizio, fine: p.fine, fineParola: p.fine, tipo: 'punct', chiave: null, simboli: [] });
          continue;
        }
        if (p.tipo === 'num') {
          out.push({ riga: nRiga, inizio: p.inizio, fine: p.fine, fineParola: p.fine, tipo: 'num', chiave: `n:${p.t}`, simboli: [`#${p.t}`] });
          continue;
        }
        // Espressione di più parole: vince la più lunga
        const candidate = (ESPRESSIONI.get(p.info.radice) || [])
          .concat(p.info.cerca !== p.info.radice ? (ESPRESSIONI.get(p.info.cerca) || []) : []);
        let trovata = null;
        for (const e of candidate) {
          const n = e.parole.length;
          if (i + n > pezzi.length || (trovata && n <= trovata.parole.length)) {
            continue;
          }
          let ok = true;
          for (let j = 0; j < n; j++) {
            const x = pezzi[i + j];
            if (x.tipo !== 'parola' || (x.info.radice !== e.parole[j] && x.info.cerca !== e.parole[j])) {
              ok = false;
              break;
            }
          }
          if (ok) {
            trovata = e;
          }
        }
        if (trovata) {
          const ultima = pezzi[i + trovata.parole.length - 1];
          out.push({ riga: nRiga, inizio: p.inizio, fine: ultima.fine, fineParola: ultima.fine, tipo: 'n', chiave: `f:${trovata.etichetta}`, simboli: trovata.s, etichetta: trovata.etichetta });
          i += trovata.parole.length - 1;
          continue;
        }
        const lemma = p.info.lemma;
        if (lemma && LEMMI[lemma]) {
          out.push({ riga: nRiga, inizio: p.inizio, fine: p.fine, fineParola: p.fine, tipo: LEMMI[lemma].k, chiave: `l:${lemma}`, simboli: LEMMI[lemma].s, etichetta: lemma });
        } else {
          out.push({ riga: nRiga, inizio: p.inizio, fine: p.fine, fineParola: p.fine, tipo: 'sconosciuta', chiave: `w:${p.info.cerca}`, simboli: [], etichetta: p.info.cerca });
        }
      }
      inizioRiga += riga.length + 1;
    });
    return out;
  }

  // Ricerca libera nel vocabolario (pannello "Cerca un simbolo")
  function cerca(testo, limite = 30) {
    const q = testo.trim().toLowerCase();
    if (q.length < 2) {
      return [];
    }
    const risultati = [];
    for (const [lemma, L] of Object.entries(LEMMI)) {
      if (!L.s.length || !lemma.includes(q)) {
        continue;
      }
      L.s.forEach((s) => risultati.push({ etichetta: lemma, simbolo: s, punteggio: lemma.startsWith(q) ? 0 : 1 }));
    }
    risultati.sort((a, b) => a.punteggio - b.punteggio || a.etichetta.localeCompare(b.etichetta));
    return risultati.slice(0, limite);
  }

  return { cartellini, cerca, numeroParole: Object.keys(LEMMI).length };
})();
