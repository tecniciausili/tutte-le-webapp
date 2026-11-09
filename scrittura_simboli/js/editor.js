// ==================== EDITOR (pagina «Frasi e discorsi») ====================
// Si scrive una parola per riga, sempre in maiuscolo: lo spazio manda a capo. A sinistra il
// testo, a destra la colonna delle immagini, riga per riga alla stessa altezza (--riga).
// Toccando un'immagine il pannello mostra le alternative, "nessun simbolo", la ricerca e le foto.
// Andando a capo la parola viene letta; con . ! ? viene letta la frase intera.
// Con le spunte «Pittogrammi ARASAAC» (js/arasaac.js, da internet) e «Simboli Mulberry»
// (js/mulberry.js, inclusi nell'app) il primo simbolo proposto viene da quei set, in quest'ordine;
// i simboli dell'app restano come alternative e come riserva.
// Foto personali: una foto collegata a una parola (es. la propria mamma) compare ogni volta che
// la parola viene scritta, finché per quella parola è attiva la spunta «Usa la mia foto».
// Ogni foto importata (anche HEIC dell'iPhone) viene ridotta e convertita in PNG.

const Editor = (() => {
  const ESEMPIO = 'mamma\nmangia\nla\nmela';
  const SUGGERIMENTO = '<p class="hint">Tocca un\'immagine per vederne altre, toglierla, cercarne una diversa o usare una tua foto.</p>';
  const PASSI_TESTO = [24, 32, 40, 48, 60, 72, 90, 110];
  const PASSI_IMMAGINI = [56, 72, 96, 120, 150, 190, 240, 300];
  const LATO_FOTO = 480;   // lato massimo delle foto salvate (PNG)
  const $ = (id) => document.getElementById(id);
  const esc = Util.escapeHtml;

  let el = {};
  let scelte = {};
  let fotoParole = {};   // chiave -> { id, attiva }
  let imp = {};
  let cartellini = [];
  let chiaveScelta = null;
  let inPannello = null;
  let timerRicerca = null;
  let ultimaRicerca = '';
  let ultimoFoglio = '';
  const FOTO = new Map();

  // ---------- simboli ----------

  function simboloHtml(s, lato = 300) {
    if (!s) {
      return '';
    }
    if (s.startsWith('aac:')) {
      const id = s.slice(4);
      return /^\d+$/.test(id)
        ? `<img class="pitto" src="${Arasaac.immagine(id, lato)}" alt="" crossorigin="anonymous" draggable="false">`
        : '';
    }
    if (s.startsWith('img:')) {
      const f = FOTO.get(s.slice(4));
      return f ? `<img class="foto" src="${f.data}" alt="" draggable="false">` : '<span class="buco" aria-hidden="true">?</span>';
    }
    if (s.startsWith('mb:')) {
      const id = s.slice(3);
      return /^\d+$/.test(id)
        ? `<img class="pitto mulberry" src="${Mulberry.immagine(id)}" alt="" draggable="false">`
        : '';
    }
    if (s.startsWith('ms:')) {
      return `<span class="ms" aria-hidden="true">${s.slice(3)}</span>`;
    }
    if (s.startsWith('#')) {
      return `<span class="num" aria-hidden="true">${esc(s.slice(1))}</span>`;
    }
    return `<span class="emo" aria-hidden="true">${s}</span>`;
  }

  const haScelta = (chiave) => !!chiave && Object.prototype.hasOwnProperty.call(scelte, chiave);

  // La parola da cercare nei set di pittogrammi: il lemma, l'espressione o la parola sconosciuta.
  // Le parole grammaticali tengono i loro segni piccoli.
  function termine(c) {
    if (!c.chiave || c.tipo === 'g' || c.tipo === 'punct' || c.tipo === 'num') {
      return null;
    }
    return c.chiave.slice(2);
  }

  const termineArasaac = (c) => (imp.arasaac ? termine(c) : null);

  // Tutti i simboli possibili: ARASAAC (se attivo e già arrivato), Mulberry (se attivo), poi quelli dell'app
  function simboliDi(c) {
    const t = termine(c);
    const aac = t && imp.arasaac ? (Arasaac.risultati(t) || []).map(([id]) => `aac:${id}`) : [];
    const mb = t && imp.mulberry ? Mulberry.risultati(t).map((id) => `mb:${id}`) : [];
    return aac.concat(mb, c.simboli);
  }

  // Un simbolo di un set spento non vale: si torna al simbolo proposto
  function permesso(s) {
    const x = String(s);
    return (imp.arasaac || !x.startsWith('aac:')) && (imp.mulberry || !x.startsWith('mb:')) && !x.startsWith('img:');
  }

  // ---------- foto personali collegate alle parole ----------

  // La foto collegata a una parola, se c'è ed è ancora salvata: { id, attiva, data }
  function fotoParola(chiave) {
    const f = chiave && fotoParole[chiave];
    const foto = f && FOTO.get(f.id);
    return foto ? { id: f.id, attiva: f.attiva !== false, data: foto.data } : null;
  }

  function collegaFoto(chiave, id) {
    fotoParole[chiave] = { id, attiva: true };
    Archivio.salvaFotoParole(fotoParole);
  }

  // Spunta «Usa la mia foto» di una parola: foto personale o pittogramma generico
  function impostaFoto(chiave, attiva) {
    if (!fotoParole[chiave]) {
      return;
    }
    fotoParole[chiave].attiva = !!attiva;
    Archivio.salvaFotoParole(fotoParole);
    avvisaCambio();
  }

  function scelto(c) {
    const f = fotoParola(c.chiave);
    if (f && f.attiva) {
      return `img:${f.id}`;
    }
    if (haScelta(c.chiave) && permesso(scelte[c.chiave])) {
      return scelte[c.chiave];
    }
    return simboliDi(c)[0] || '';
  }

  function avvisaCambio() {
    document.dispatchEvent(new CustomEvent('ss:simboli'));
  }

  // Scelta di un simbolo: una foto si collega alla parola,
  // un pittogramma spegne la foto della parola (che resta collegata, per riattivarla)
  function salvaScelta(chiave, s) {
    if (!chiave) {
      return;
    }
    if (String(s).startsWith('img:')) {
      collegaFoto(chiave, s.slice(4));
    } else {
      scelte[chiave] = s;
      Archivio.salvaScelte(scelte);
      if (fotoParole[chiave]) {
        fotoParole[chiave].attiva = false;
        Archivio.salvaFotoParole(fotoParole);
      }
    }
    avvisaCambio();
  }

  // Versioni precedenti: la foto era una scelta come le altre ("img:id" in ss_scelte)
  function migraFotoVecchie() {
    let cambiato = false;
    Object.entries(scelte).forEach(([chiave, s]) => {
      if (String(s).startsWith('img:')) {
        if (!fotoParole[chiave]) {
          fotoParole[chiave] = { id: s.slice(4), attiva: true };
        }
        delete scelte[chiave];
        cambiato = true;
      }
    });
    if (cambiato) {
      Archivio.salvaScelte(scelte);
      Archivio.salvaFotoParole(fotoParole);
    }
  }

  // ---------- colonna delle immagini ----------

  function disegna() {
    const testo = el.testo.value;
    cartellini = Simboli.cartellini(testo);
    const staScrivendo = document.activeElement === el.testo && el.testo.selectionStart === testo.length;
    let html = '';
    let mancanti = 0;
    testo.split('\n').forEach((_, riga) => {
      const nellaRiga = cartellini
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c.riga === riga && c.tipo !== 'punct');
      // Più parole nella stessa riga (testo incollato): immagini più piccole, affiancate
      const stile = nellaRiga.length > 1 ? ` style="--sym-r: calc(var(--sym) / ${Math.min(nellaRiga.length, 4)})"` : '';
      html += `<div class="riga-img"${stile}>`;
      nellaRiga.forEach(({ c, i }) => {
        const inCorso = staScrivendo && c.fineParola === testo.length && c.tipo !== 'num';
        let simbolo = '';
        let classi = 'cartellino';
        if (inCorso) {
          simbolo = '<span class="attesa" aria-hidden="true"></span>';
        } else {
          const s = scelto(c);
          if (s) {
            simbolo = simboloHtml(s);
          } else if (c.tipo === 'sconosciuta' && scelte[c.chiave] !== '') {
            simbolo = '<span class="buco" aria-hidden="true">?</span>';
            classi += ' mancante';
            mancanti++;
          }
        }
        if (c.tipo === 'g') {
          classi += ' piccolo';
        }
        if (chiaveScelta && c.chiave === chiaveScelta) {
          classi += ' scelto';
        }
        const parola = esc(testo.slice(c.inizio, c.fineParola).toUpperCase());
        html += `<button type="button" class="${classi}" data-i="${i}" aria-label="${parola}: cambia immagine"><span class="simbolo">${simbolo}</span></button>`;
      });
      html += '</div>';
    });
    if (html !== ultimoFoglio) {
      el.foglio.innerHTML = html;
      ultimoFoglio = html;
    }
    allineaScorrimento();
    if (!testo.trim()) {
      el.stato.textContent = '';
    } else {
      el.stato.textContent = mancanti
        ? `${mancanti} ${mancanti === 1 ? 'parola' : 'parole'} senza immagine: tocca il «?» per sceglierne una o usare una foto.`
        : '';
    }
  }

  // Le due colonne scorrono insieme
  function allineaScorrimento(da = el.testo, a = el.foglio) {
    if (Math.abs(a.scrollTop - da.scrollTop) > 1) {
      a.scrollTop = da.scrollTop;
    }
  }

  // ---------- scrittura: una parola per riga ----------

  // Lo spazio manda a capo (una riga vuota non ne crea un'altra)
  function vaiACapo() {
    const t = el.testo;
    const { selectionStart: a, selectionEnd: b } = t;
    if (a === b && (a === 0 || t.value[a - 1] === '\n')) {
      return;
    }
    let fatto = false;
    try {
      fatto = document.execCommand('insertText', false, '\n');   // tiene l'annulla (⌘Z)
    } catch (e) { /* non disponibile */ }
    if (!fatto) {
      t.setRangeText('\n', a, b, 'end');
      t.dispatchEvent(new InputEvent('input', { inputType: 'insertLineBreak', bubbles: true }));
    }
  }

  // Riserva per le tastiere che non lasciano fermare lo spazio (Android) e per il testo incollato:
  // ogni spazio diventa un a capo (uno spazio accanto a un a capo non ne aggiunge un altro;
  // le righe vuote fatte con Invio restano)
  function normalizzaSpazi() {
    const t = el.testo;
    if (!/[ \t]/.test(t.value)) {
      return;
    }
    const sistema = (x) => x.replace(/\n?[ \t]+\n?/g, '\n');
    const pos = t.selectionStart;
    let prima = sistema(t.value.slice(0, pos));
    let dopo = sistema(t.value.slice(pos));
    if (prima.endsWith('\n') && dopo.startsWith('\n')) {
      dopo = dopo.slice(1);
    }
    if (prima.startsWith('\n')) {
      prima = prima.slice(1);   // uno spazio all'inizio non crea una riga vuota
    }
    t.value = prima + dopo;
    t.setSelectionRange(prima.length, prima.length);
  }

  // Il testo scorre seguendo la riga in cui si scrive (le righe sono alte: il browser da solo
  // non sempre la porta in vista); la colonna delle immagini segue il testo
  function mostraCursore() {
    const t = el.testo;
    const cs = getComputedStyle(t);
    const riga = parseFloat(cs.lineHeight) || 0;
    if (!riga) {
      return;
    }
    const sopra = parseFloat(cs.paddingTop) || 0;
    const sotto = parseFloat(cs.paddingBottom) || 0;
    const n = (t.value.slice(0, t.selectionStart).match(/\n/g) || []).length;
    const inizio = sopra + n * riga;
    if (inizio < t.scrollTop) {
      t.scrollTop = Math.max(0, inizio - sopra);
    } else if (inizio + riga > t.scrollTop + t.clientHeight) {
      t.scrollTop = inizio + riga + sotto - t.clientHeight;
    }
    allineaScorrimento();
  }

  function alScrivere(e) {
    normalizzaSpazi();
    Archivio.salvaTesto(el.testo.value);
    disegna();
    mostraCursore();
    if (!imp.leggiAuto || !String(e.inputType || '').startsWith('insert')) {
      return;
    }
    const t = el.testo.value;
    const fine = el.testo.selectionStart;
    const ultimo = t[fine - 1];
    if (/[.!?]/.test(ultimo || '')) {
      // Finita la frase: la si legge tutta, anche se è su più righe
      let inizio = fine - 2;
      while (inizio >= 0 && !/[.!?]/.test(t[inizio])) {
        inizio--;
      }
      leggi(inizio + 1, fine);
    } else if (ultimo === '\n') {
      // Andando a capo si legge la parola appena scritta (se non chiudeva una frase già letta)
      const fineParola = fine - 1;
      const inizioRiga = t.lastIndexOf('\n', fineParola - 1) + 1;
      const parola = t.slice(inizioRiga, fineParola);
      if (parola.trim() && !/[.!?]\s*$/.test(parola)) {
        leggi(inizioRiga, fineParola);
      }
    }
  }

  // ---------- pannello del simbolo ----------

  function opzione(s, attiva, etichetta = '') {
    return `<button type="button" class="opz ${attiva ? 'attiva' : ''}" data-simbolo="${esc(s)}" aria-label="${esc(etichetta || 'Usa questo simbolo')}">${simboloHtml(s)}${etichetta ? `<small>${esc(etichetta)}</small>` : ''}</button>`;
  }

  function opzioniHtml(c) {
    const attuale = scelto(c);
    let h = simboliDi(c).map((s) => opzione(s, s === attuale)).join('');
    h += `<button type="button" class="opz nessuno ${attuale === '' ? 'attiva' : ''}" data-simbolo="" aria-label="Nessun simbolo"><span class="ms" aria-hidden="true">hide_image</span><small>nessuno</small></button>`;
    const t = termineArasaac(c);
    if (t && !Arasaac.risultati(t)) {
      h += '<p class="hint attesa-aac">Cerco i pittogrammi ARASAAC…</p>';
    }
    return h;
  }

  function nomeParola(c) {
    return (c.etichetta || el.testo.value.slice(c.inizio, c.fineParola)).toLowerCase();
  }

  function fotoHtml(c) {
    const f = fotoParola(c.chiave);
    let h = `<label class="btn-secondary btn-foto" for="fotoNuova"><span class="ms" aria-hidden="true">add_a_photo</span> ${f ? 'Cambia la mia foto' : 'Usa una mia foto'}</label><input type="file" id="fotoNuova" accept="image/*,.heic,.heif" class="nascosto">`;
    if (f) {
      h += `<label class="spunta spunta-foto"><input type="checkbox" id="usaFotoPannello" ${f.attiva ? 'checked' : ''}> <img src="${f.data}" alt="" class="mini-foto"> Usa la mia foto per «${esc(nomeParola(c).toUpperCase())}» (se no, il pittogramma)</label>`;
    }
    return h;
  }

  function apriPannello(c) {
    chiaveScelta = c.chiave;
    inPannello = c;
    const parola = el.testo.value.slice(c.inizio, c.fine).toUpperCase();
    let h = `<div class="pannello-parola">${esc(parola)}</div><div class="opzioni" id="opzioniParola">${opzioniHtml(c)}</div>`;
    if (c.tipo === 'sconosciuta' && !simboliDi(c).length) {
      h += '<p class="hint">Questa parola non è nel vocabolario. Cerca un simbolo che le somigli o usa una tua foto.</p>';
    }
    h += `<div class="foto-parola" id="fotoPannello">${fotoHtml(c)}</div>`;
    const mie = [...FOTO.values()].sort((a, b) => b.t - a.t).slice(0, 24);
    if (mie.length) {
      const attuale = scelto(c);
      h += '<p class="sottotitolo">Le tue foto</p><div class="opzioni">'
        + mie.map((f) => opzione(`img:${f.id}`, attuale === `img:${f.id}`, f.parola || '')).join('')
        + '</div>';
    }
    h += '<label class="cerca"><span class="ms" aria-hidden="true">search</span><input id="cercaSimbolo" type="search" placeholder="Cerca un simbolo (es. gioco, sole)" aria-label="Cerca un simbolo"></label><div class="opzioni" id="risultati"></div>';
    ultimaRicerca = '';
    if (haScelta(c.chiave)) {
      h += '<button type="button" class="link" id="ripristina">Torna al simbolo proposto</button>';
    }
    el.corpoPannello.innerHTML = h;
    el.pannello.classList.add('aperto');

    $('ripristina')?.addEventListener('click', () => {
      delete scelte[c.chiave];
      Archivio.salvaScelte(scelte);
      disegna();
      apriPannello(c);
    });
    $('cercaSimbolo').addEventListener('input', (e) => mostraRisultati(c, e.target.value));
    disegna();
  }

  function mostraRisultati(c, q) {
    const box = $('risultati');
    const query = q.trim().toLowerCase();
    const foto = query.length < 2 ? [] : [...FOTO.values()]
      .filter((f) => (f.parola || '').includes(query))
      .map((f) => ({ etichetta: f.parola, simbolo: `img:${f.id}` }));
    const trovati = foto.concat(imp.mulberry ? Mulberry.cerca(q) : [], Simboli.cerca(q));
    const mostra = (lista, attesa) => {
      box.innerHTML = query.length < 2 ? ''
        : lista.map((r) => opzione(r.simbolo, false, r.etichetta)).join('')
          + (attesa ? '<p class="hint attesa-aac">Cerco anche tra i pittogrammi ARASAAC…</p>' : '')
          || `<p class="hint">Nessun simbolo per «${esc(q)}».</p>`;
    };
    ultimaRicerca = query;
    clearTimeout(timerRicerca);
    const conArasaac = imp.arasaac && query.length >= 2;
    mostra(trovati, conArasaac);
    if (conArasaac) {
      timerRicerca = setTimeout(() => {
        Arasaac.cerca(query).then((lista) => {
          if (ultimaRicerca !== query || !$('risultati')) {
            return;
          }
          const aac = (lista || []).map(([id, k]) => ({ etichetta: k, simbolo: `aac:${id}` }));
          mostra(aac.concat(trovati), false);
        });
      }, 350);
    }
  }

  function scegli(c, s) {
    salvaScelta(c.chiave, s);
    const ancora = cartellini.find((x) => x.chiave === c.chiave);
    if (ancora) {
      apriPannello(ancora);
    }
  }

  function chiudiPannello() {
    chiaveScelta = null;
    inPannello = null;
    el.pannello.classList.remove('aperto');
    el.corpoPannello.innerHTML = SUGGERIMENTO;
    disegna();
  }

  // ---------- foto: qualsiasi formato -> PNG ----------

  const eHeic = (file) => /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '');

  // Il convertitore HEIC (3 MB, LGPL) si carica solo quando serve: Safari apre le HEIC da solo
  let caricaHeic = null;
  function convertitoreHeic() {
    if (window.HeicTo) {
      return Promise.resolve(window.HeicTo);
    }
    if (!caricaHeic) {
      caricaHeic = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'assets/vendor/heic-to/heic-to.js';
        s.onload = () => (window.HeicTo ? resolve(window.HeicTo) : reject(new Error('convertitore HEIC non disponibile')));
        s.onerror = () => { caricaHeic = null; reject(new Error('convertitore HEIC non disponibile')); };
        document.head.appendChild(s);
      });
    }
    return caricaHeic;
  }

  function apriImmagine(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('immagine non leggibile'));
      };
      img.src = url;
    });
  }

  // Riduce la foto (lato massimo LATO_FOTO) e la restituisce come PNG (data URL).
  // L'orientamento delle foto del telefono viene applicato dal browser.
  async function inPng(file) {
    let aperta;
    try {
      aperta = await apriImmagine(file);
    } catch (e) {
      if (!eHeic(file)) {
        throw e;
      }
      const HeicTo = await convertitoreHeic();
      const png = await HeicTo({ blob: file, type: 'image/png' });
      aperta = await apriImmagine(png);
    }
    const { img, url } = aperta;
    const k = Math.min(1, LATO_FOTO / Math.max(img.naturalWidth, img.naturalHeight));
    const tela = document.createElement('canvas');
    tela.width = Math.max(1, Math.round(img.naturalWidth * k));
    tela.height = Math.max(1, Math.round(img.naturalHeight * k));
    tela.getContext('2d').drawImage(img, 0, 0, tela.width, tela.height);
    URL.revokeObjectURL(url);
    return tela.toDataURL('image/png');
  }

  // Salva una foto per una parola e la collega: da ora la parola mostra questa foto.
  // Restituisce il messaggio da mostrare.
  async function caricaFoto(chiave, parola, file) {
    if (!file || !chiave) {
      return '';
    }
    try {
      const data = await inPng(file);
      const foto = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        data,
        parola: String(parola || '').toLowerCase(),
        t: Date.now(),
      };
      FOTO.set(foto.id, foto);
      const salvata = await Archivio.salvaFoto(foto);
      salvaScelta(chiave, `img:${foto.id}`);
      return salvata
        ? `Foto salvata: ogni volta che scrivi «${foto.parola.toUpperCase()}» compare la tua foto.`
        : 'Foto usata, ma questo browser non permette di salvarla: andrà persa chiudendo l\'app.';
    } catch (e) {
      return eHeic(file)
        ? 'Non riesco a convertire questa foto HEIC. Prova a esportarla come JPG dall\'app Foto.'
        : 'Non riesco ad aprire questo file: scegli una foto (JPG, PNG, HEIC…).';
    }
  }

  // ---------- lettura ad alta voce ----------

  let letturaId = 0;

  function illumina(da, a) {
    el.foglio.querySelectorAll('.cartellino.letto').forEach((n) => n.classList.remove('letto'));
    if (da == null) {
      return;
    }
    cartellini.forEach((c, i) => {
      if (c.tipo !== 'punct' && c.inizio < a && c.fine > da) {
        el.foglio.querySelector(`.cartellino[data-i="${i}"]`)?.classList.add('letto');
      }
    });
  }

  // Le frasi finiscono con . ! ? (non con l'a capo: c'è una parola per riga)
  function frasi(testo, da, a) {
    const out = [];
    const re = /[^.!?]+[.!?]*/g;
    const parte = testo.slice(da, a);
    let m;
    while ((m = re.exec(parte))) {
      if (m[0].trim()) {
        out.push({ inizio: da + m.index, testo: m[0] });
      }
    }
    return out;
  }

  async function leggi(da, a) {
    if (!Voce.disponibile()) {
      el.stato.textContent = 'Questo browser non sa leggere ad alta voce.';
      return;
    }
    const testo = el.testo.value;
    if (!testo.slice(da, a).trim()) {
      el.stato.textContent = 'Non c\'è ancora niente da leggere.';
      return;
    }
    Voce.stop();
    const mio = ++letturaId;
    el.stop.disabled = false;
    for (const f of frasi(testo, da, a)) {
      if (mio !== letturaId) {
        return;
      }
      // Gli a capo diventano spazi (stessa lunghezza: le posizioni delle parole non cambiano);
      // in minuscolo, perché alcune voci leggono lettera per lettera le parole maiuscole
      await Voce.parla(f.testo.replace(/\n/g, ' ').toLowerCase(), {
        velocita: imp.velocita,
        uri: imp.voce,
        onInizio: () => illumina(f.inizio, f.inizio + f.testo.length),
        onParola: (pos) => {
          const p = f.inizio + pos;
          illumina(p, p + 1);
        },
      });
    }
    if (mio === letturaId) {
      illumina(null);
      el.stop.disabled = true;
    }
  }

  function ferma() {
    letturaId++;
    Voce.stop();
    illumina(null);
    el.stop.disabled = true;
  }

  // ---------- impostazioni: testo e immagini ----------

  async function riempiVoci() {
    await Voce.init();
    const it = Voce.vociItaliane();
    el.voce.innerHTML = '<option value="">Voce italiana del dispositivo</option>'
      + it.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === imp.voce ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    if (!it.length && Voce.disponibile()) {
      el.stato.textContent = 'Su questo dispositivo non trovo una voce italiana: si usa la voce predefinita.';
    }
  }

  const piuVicino = (passi, v) => passi.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

  // Grandezza di testo e immagini, grassetto, colore: l'altezza della riga segue il più grande
  function applicaAspetto() {
    imp.testoPx = piuVicino(PASSI_TESTO, +imp.testoPx || 40);
    imp.grandezza = piuVicino(PASSI_IMMAGINI, +imp.grandezza || 120);
    const riga = Math.max(imp.grandezza + 6, Math.round(imp.testoPx * 1.2));   // interlinea stretta
    const radice = document.documentElement.style;
    radice.setProperty('--sym', `${imp.grandezza}px`);
    el.pagina.style.setProperty('--testo', `${imp.testoPx}px`);
    el.pagina.style.setProperty('--riga', `${riga}px`);
    el.pagina.style.setProperty('--peso-testo', imp.grassetto ? '700' : '400');
    el.pagina.style.setProperty('--colore-testo', imp.colore || '#1f2933');
    $('misuraTesto').textContent = imp.testoPx;
    $('misuraImmagini').textContent = imp.grandezza;
    el.grassetto.setAttribute('aria-pressed', String(!!imp.grassetto));
    document.querySelectorAll('[data-colore]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.colore === imp.colore)));
    el.coloreLibero.value = /^#[0-9a-f]{6}$/i.test(imp.colore) ? imp.colore : '#1f2933';
    document.querySelector('[data-testo="-1"]').disabled = imp.testoPx === PASSI_TESTO[0];
    document.querySelector('[data-testo="1"]').disabled = imp.testoPx === PASSI_TESTO[PASSI_TESTO.length - 1];
    document.querySelector('[data-immagini="-1"]').disabled = imp.grandezza === PASSI_IMMAGINI[0];
    document.querySelector('[data-immagini="1"]').disabled = imp.grandezza === PASSI_IMMAGINI[PASSI_IMMAGINI.length - 1];
    requestAnimationFrame(() => allineaScorrimento());
  }

  function passo(passi, attuale, verso) {
    const i = passi.indexOf(attuale);
    return passi[Math.min(passi.length - 1, Math.max(0, i + verso))];
  }

  // Mulberry offline: si mettono in cache tutti gli SVG; l'avanzamento si vede in fondo alla pagina
  function preparaMulberry(avvisa) {
    Mulberry.scaricaTutti((fatti, totale) => {
      el.scarico.hidden = false;
      el.scarico.textContent = `Preparo i simboli Mulberry per l'uso senza internet: ${fatti} di ${totale}…`;
    }).then((ok) => {
      if (!el.scarico.hidden || avvisa) {
        el.scarico.hidden = !ok;
        el.scarico.textContent = 'Simboli Mulberry pronti anche senza internet.';
        setTimeout(() => { el.scarico.hidden = true; }, 4000);
      }
    });
  }

  function salvaImp() {
    Archivio.salvaImpostazioni(imp);
  }

  // ---------- avvio ----------

  async function avvia() {
    el = {
      pagina: $('paginaFrasi'), foglio: $('foglio'), testo: $('testo'), stato: $('stato'), pannello: $('pannello'),
      corpoPannello: $('corpoPannello'), leggi: $('btnLeggi'), stop: $('btnStop'),
      voce: $('sceltaVoce'), velocita: $('velocita'), auto: $('leggiAuto'),
      grassetto: $('btnGrassetto'), coloreLibero: $('coloreLibero'),
      arasaac: [...document.querySelectorAll('.usa-arasaac')], creditiAac: $('creditiArasaac'),
      mulberry: [...document.querySelectorAll('.usa-mulberry')], creditiMb: $('creditiMulberry'),
      scarico: $('statoScarico'),
    };
    scelte = Archivio.scelte();
    fotoParole = Archivio.fotoParole();
    migraFotoVecchie();
    imp = Archivio.impostazioni();
    const salvato = Archivio.testo();
    el.testo.value = salvato === null ? ESEMPIO : salvato;
    normalizzaSpazi();   // testi delle versioni precedenti: una parola per riga
    Archivio.salvaTesto(el.testo.value);
    el.velocita.value = imp.velocita;
    el.auto.checked = imp.leggiAuto;
    el.arasaac.forEach((x) => { x.checked = !!imp.arasaac; });
    el.mulberry.forEach((x) => { x.checked = !!imp.mulberry; });
    el.creditiAac.hidden = !imp.arasaac;
    el.creditiMb.hidden = !imp.mulberry;
    applicaAspetto();
    el.corpoPannello.innerHTML = SUGGERIMENTO;

    // Scrittura: lo spazio va a capo
    el.testo.addEventListener('beforeinput', (e) => {
      if (e.inputType === 'insertText' && e.data === ' ') {
        e.preventDefault();
        vaiACapo();
      }
    });
    el.testo.addEventListener('input', alScrivere);
    ['keyup', 'click', 'focus', 'blur'].forEach((ev) => el.testo.addEventListener(ev, disegna));
    el.testo.addEventListener('scroll', () => allineaScorrimento(el.testo, el.foglio));
    el.foglio.addEventListener('scroll', () => allineaScorrimento(el.foglio, el.testo));

    // Toccare un'immagine non toglie il fuoco al testo: la colonna non si ridisegna sotto il dito
    el.foglio.addEventListener('mousedown', (e) => {
      if (e.target.closest('.cartellino')) {
        e.preventDefault();
      }
    });
    el.foglio.addEventListener('click', (e) => {
      const b = e.target.closest('.cartellino');
      const c = b && cartellini[+b.dataset.i];
      if (c && c.tipo !== 'punct') {
        apriPannello(c);
      }
    });
    el.corpoPannello.addEventListener('click', (e) => {
      const b = e.target.closest('.opz');
      if (b && inPannello) {
        scegli(inPannello, b.dataset.simbolo);
      }
    });
    el.corpoPannello.addEventListener('change', async (e) => {
      const c = inPannello;
      if (!c) {
        return;
      }
      if (e.target.id === 'usaFotoPannello') {
        impostaFoto(c.chiave, e.target.checked);
      } else if (e.target.id === 'fotoNuova') {
        el.stato.textContent = 'Preparo la foto…';
        const messaggio = await caricaFoto(c.chiave, nomeParola(c), e.target.files?.[0]);
        const ancora = cartellini.find((x) => x.chiave === c.chiave);
        if (ancora && inPannello) {
          apriPannello(ancora);
        }
        el.stato.textContent = messaggio;   // dopo il ridisegno, che riscrive lo stato
      }
    });
    $('chiudiPannello').addEventListener('click', chiudiPannello);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && chiaveScelta) {
        chiudiPannello();
      }
    });

    // Strumenti del testo e delle immagini
    document.querySelectorAll('[data-testo]').forEach((b) => b.addEventListener('click', () => {
      imp.testoPx = passo(PASSI_TESTO, imp.testoPx, +b.dataset.testo);
      applicaAspetto();
      salvaImp();
    }));
    document.querySelectorAll('[data-immagini]').forEach((b) => b.addEventListener('click', () => {
      imp.grandezza = passo(PASSI_IMMAGINI, imp.grandezza, +b.dataset.immagini);
      applicaAspetto();
      salvaImp();
    }));
    el.grassetto.addEventListener('click', () => {
      imp.grassetto = !imp.grassetto;
      applicaAspetto();
      salvaImp();
    });
    document.querySelectorAll('[data-colore]').forEach((b) => b.addEventListener('click', () => {
      imp.colore = b.dataset.colore;
      applicaAspetto();
      salvaImp();
    }));
    el.coloreLibero.addEventListener('input', () => {
      imp.colore = el.coloreLibero.value;
      applicaAspetto();
      salvaImp();
    });

    el.leggi.addEventListener('click', () => leggi(0, el.testo.value.length));
    el.stop.addEventListener('click', ferma);
    el.voce.addEventListener('change', () => { imp.voce = el.voce.value; salvaImp(); });
    el.velocita.addEventListener('change', () => { imp.velocita = +el.velocita.value; salvaImp(); });
    el.auto.addEventListener('change', () => { imp.leggiAuto = el.auto.checked; salvaImp(); });
    el.arasaac.forEach((spunta) => spunta.addEventListener('change', () => {
      imp.arasaac = spunta.checked;
      salvaImp();
      el.arasaac.forEach((x) => { x.checked = imp.arasaac; });
      el.creditiAac.hidden = !imp.arasaac;
      if (imp.arasaac && navigator.onLine === false) {
        el.stato.textContent = 'Senza internet i pittogrammi ARASAAC non arrivano: si vedono solo quelli già usati.';
      }
      avvisaCambio();
    }));
    el.mulberry.forEach((spunta) => spunta.addEventListener('change', () => {
      imp.mulberry = spunta.checked;
      salvaImp();
      el.mulberry.forEach((x) => { x.checked = imp.mulberry; });
      el.creditiMb.hidden = !imp.mulberry;
      if (imp.mulberry) {
        preparaMulberry(true);
      }
      avvisaCambio();
    }));
    if (imp.mulberry) {
      preparaMulberry(false);
    }

    // Nuovi pittogrammi ARASAAC: si ridisegna
    document.addEventListener('ss:simboli', () => {
      disegna();
      const box = $('opzioniParola');
      if (inPannello && box) {
        const c = cartellini.find((x) => x.chiave === inPannello.chiave);
        if (c) {
          inPannello = c;
          box.innerHTML = opzioniHtml(c);
          const foto = $('fotoPannello');
          if (foto) {
            foto.innerHTML = fotoHtml(c);
          }
        }
      }
    });

    // Pittogramma ARASAAC che non arriva (niente rete e non ancora in cache): punto di domanda
    document.addEventListener('error', (e) => {
      const img = e.target;
      if (img instanceof HTMLImageElement && img.classList.contains('pitto')) {
        const buco = document.createElement('span');
        buco.className = 'buco';
        buco.textContent = '?';
        buco.title = 'Pittogramma non disponibile senza internet';
        img.replaceWith(buco);
      }
    }, true);
    if (!Voce.disponibile()) {
      el.leggi.disabled = true;
    }

    disegna();
    (await Archivio.tutteLeFoto()).forEach((f) => FOTO.set(f.id, f));
    disegna();
    riempiVoci();
  }

  function nuovoFoglio() {
    ferma();
    el.testo.value = '';
    Archivio.salvaTesto('');
    chiudiPannello();
    el.testo.focus();
  }

  return { avvia, nuovoFoglio, ferma, chiudiPannello };
})();
