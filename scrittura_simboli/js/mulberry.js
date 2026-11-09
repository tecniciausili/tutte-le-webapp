// ==================== MULBERRY ====================
// Simboli Mulberry (mulberrysymbols.org, Steve Lee, CC BY-SA 4.0), facoltativi: spunta «Simboli Mulberry».
// A differenza di ARASAAC sono inclusi nell'app (assets/mulberry/<numero>.svg) e non serve internet.
// La corrispondenza parola italiana -> simboli è in js/mulberry-dati.js (MULBERRY, generato).
// Quando si attivano, tutti gli SVG vengono messi nella cache "scrittura_simboli_mulberry",
// così l'app installata li mostra anche offline (il service worker li legge da lì).

const Mulberry = (() => {
  const DATI = window.MULBERRY || {};
  const CACHE = 'scrittura_simboli_mulberry';
  const TERMINI = Object.keys(DATI);
  let scaricando = null;

  const norm = (t) => String(t || '').trim().toLowerCase();

  function immagine(id) {
    return `assets/mulberry/${id}.svg`;
  }

  // Numeri dei simboli per una parola (lemma, parola o espressione); [] se non ci sono
  function risultati(termine) {
    return DATI[norm(termine)] || [];
  }

  // Ricerca libera per il pannello: prima i termini che iniziano con la ricerca
  function cerca(testo, limite = 24) {
    const q = norm(testo);
    if (q.length < 2) {
      return [];
    }
    const out = [];
    TERMINI.filter((t) => t.includes(q))
      .sort((a, b) => (a.startsWith(q) ? 0 : 1) - (b.startsWith(q) ? 0 : 1) || a.length - b.length)
      .forEach((t) => DATI[t].forEach((id) => out.push({ etichetta: t, simbolo: `mb:${id}` })));
    return out.slice(0, limite);
  }

  // Mette in cache tutti gli SVG (circa 10 MB). onProgresso(fatti, totale) mentre scarica.
  function scaricaTutti(onProgresso) {
    if (scaricando) {
      return scaricando;
    }
    if (!('caches' in window) || location.protocol === 'file:') {
      return Promise.resolve(false);
    }
    scaricando = (async () => {
      const cache = await caches.open(CACHE);
      const presenti = new Set((await cache.keys()).map((r) => new URL(r.url).pathname.split('/').pop()));
      const tutti = [...new Set(Object.values(DATI).flat())].map(immagine);
      const mancanti = tutti.filter((u) => !presenti.has(u.split('/').pop()));
      let fatti = tutti.length - mancanti.length;
      for (let i = 0; i < mancanti.length; i += 8) {
        await Promise.all(mancanti.slice(i, i + 8).map((u) => cache.add(u).catch(() => {})));
        fatti += Math.min(8, mancanti.length - i);
        onProgresso?.(fatti, tutti.length);
      }
      return true;
    })().catch(() => false).finally(() => { scaricando = null; });
    return scaricando;
  }

  return { immagine, risultati, cerca, scaricaTutti, numeroTermini: TERMINI.length };
})();
