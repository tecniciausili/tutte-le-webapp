// ==================== OGGETTI DA TOCCARE ====================
// Ogni oggetto è un pittogramma ARASAAC (si salva solo l'id, l'immagine arriva dal
// server ARASAAC come nelle app di assistivetech) oppure un'immagine caricata
// dal dispositivo (salvata in IndexedDB). L'elenco sta in Archivio.
// Qui ci sono anche le regole di aspetto comuni ad Area Educatore e Area Utente:
// dimensione dell'oggetto e sfondo.

const Oggetto = (() => {
  const API_RICERCA = 'https://api.arasaac.org/api/pictograms/it/search/';
  const MAX_RISULTATI = 30;

  const urlBlob = new Map();        // id oggetto → {data, url} dell'immagine caricata

  function urlArasaac(id, lato = 500) {
    return `https://static.arasaac.org/pictograms/${id}/${id}_${lato}.png`;
  }

  // Nome italiano più corto tra le parole chiave del pittogramma
  function nomeArasaac(item) {
    const parole = (item.keywords || []).map((k) => k.keyword).filter(Boolean);
    parole.sort((a, b) => a.length - b.length);
    return parole[0] || 'pittogramma';
  }

  async function cercaArasaac(testo) {
    const risposta = await fetch(`${API_RICERCA}${encodeURIComponent(testo)}`);
    if (risposta.status === 404) {
      return [];   // ARASAAC risponde 404 quando non trova nulla
    }
    if (!risposta.ok) {
      throw new Error(`ARASAAC non risponde (errore ${risposta.status}).`);
    }
    const dati = await risposta.json();
    return (Array.isArray(dati) ? dati : [])
      .filter((item) => item && item._id)
      .slice(0, MAX_RISULTATI)
      .map((item) => ({ id: item._id, nome: nomeArasaac(item) }));
  }

  // URL da mettere nell'<img> per un oggetto, oppure null se l'immagine manca
  async function urlDi(o) {
    if (!o) {
      return null;
    }
    if (o.tipo === 'arasaac') {
      return urlArasaac(o.arasaac_id);
    }
    const record = await Archivio.getImmagine(o.id).catch(() => null);
    if (!record?.blob) {
      return null;
    }
    // Stesso URL finché l'immagine non cambia: più <img> possono usarlo insieme
    const noto = urlBlob.get(o.id);
    if (noto && noto.data === record.data) {
      return noto.url;
    }
    if (noto) {
      URL.revokeObjectURL(noto.url);
    }
    const nuovo = { data: record.data, url: URL.createObjectURL(record.blob) };
    urlBlob.set(o.id, nuovo);
    return nuovo.url;
  }

  // I pittogrammi ARASAAC si chiedono con CORS: così il service worker li può conservare
  function mostraIn(img, o, url) {
    img.crossOrigin = o.tipo === 'arasaac' ? 'anonymous' : null;
    if (img.getAttribute('src') !== url) {
      img.src = url;
    }
    img.alt = o.nome || 'Oggetto da toccare';
  }

  // Carica in anticipo le immagini degli oggetti: quando l'oggetto cambia, compare
  // subito. Restituisce [{oggetto, url}] di quelli pronti (un'immagine che non si
  // carica, per esempio ARASAAC senza rete, viene lasciata fuori).
  async function precarica(oggetti, attesaMassima = 8000) {
    const pronti = await Promise.all(oggetti.map(async (o) => {
      const url = await urlDi(o);
      if (!url) {
        return null;
      }
      const img = new Image();
      mostraIn(img, o, url);
      const ok = await Promise.race([
        img.decode().then(() => true, () => false),
        new Promise((resolve) => setTimeout(() => resolve(false), attesaMassima)),
      ]);
      return ok ? { oggetto: o, url } : null;
    }));
    return pronti.filter(Boolean);
  }

  // Legge un'immagine scelta dal dispositivo (File o Blob) per il ritaglio
  function caricaImmagine(file) {
    return new Promise((resolve, reject) => {
      const indirizzo = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(indirizzo);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(indirizzo);
        reject(new Error('Il browser non riesce a leggere questa immagine (formati sicuri: JPG, PNG).'));
      };
      img.src = indirizzo;
    });
  }


  // ==================== ASPETTO ====================

  // Lato dell'oggetto in pixel dentro un contenitore: % del lato corto
  function latoPx(larghezza, altezza, aspetto) {
    return Math.round(Math.min(larghezza, altezza) * (aspetto.dimensione / 100));
  }

  // Applica sfondo e dimensione. elOggetto contiene l'<img>: dietro l'immagine
  // si vede solo lo sfondo scelto dall'educatore.
  function applicaAspetto(elContenitore, elOggetto, aspetto) {
    elContenitore.style.backgroundColor = aspetto.sfondo;
    const lato = latoPx(elContenitore.clientWidth, elContenitore.clientHeight, aspetto);
    elOggetto.style.width = `${lato}px`;
    elOggetto.style.height = `${lato}px`;
    return lato;
  }

  // Zona in cui può stare l'oggetto. Area centrale (visione a tunnel): un quadrato
  // al centro, con il lato in % del lato corto dello schermo. Tutto schermo: il
  // contenitore meno i margini (in alto c'è la fascia dei pulsanti dell'educatore).
  function areaConsentita(larghezza, altezza, aspetto, { margine = 0, fasciaAlta = 0 } = {}) {
    if (aspetto.area_centrale) {
      const lato = Math.round(Math.min(larghezza, altezza) * (aspetto.ampiezza_area / 100));
      return { x: (larghezza - lato) / 2, y: (altezza - lato) / 2, w: lato, h: lato };
    }
    const alto = Math.max(margine, fasciaAlta);
    return { x: margine, y: alto, w: larghezza - 2 * margine, h: altezza - alto - margine };
  }

  // ==================== POSIZIONE E MOVIMENTO ====================
  // Tiene l'oggetto dentro la zona consentita. Statico: una posizione (casuale,
  // lontana dalla precedente, oppure al centro). In movimento: l'oggetto scorre in
  // linea retta e rimbalza sui bordi della zona, alla velocità impostata.

  function creaPosizionatore(elContenitore, elOggetto, { elArea = null, margine = 0, fasciaAlta = 0 } = {}) {
    let pos = null;          // angolo in alto a sinistra dell'oggetto, in px
    let dir = null;          // direzione del movimento (vettore unitario)
    let limiti = null;
    let velocita = 0;        // px al secondo, 0 = statico
    let attivo = false;
    let raf = null;
    let ultimo = 0;

    function calcola(aspetto) {
      // Spazio interno, senza il bordo: è lì che si posiziona l'oggetto
      const r = { width: elContenitore.clientWidth, height: elContenitore.clientHeight };
      const lato = applicaAspetto(elContenitore, elOggetto, aspetto);
      const a = areaConsentita(r.width, r.height, aspetto, { margine, fasciaAlta });
      // Oggetto più grande della zona: resta centrato su quell'asse
      const asse = (inizio, spazio, totale) => (spazio >= lato
        ? [inizio, inizio + spazio - lato]
        : [(totale - lato) / 2, (totale - lato) / 2]);
      const [xMin, xMax] = asse(a.x, a.w, r.width);
      const [yMin, yMax] = asse(a.y, a.h, r.height);
      limiti = { xMin, xMax, yMin, yMax };
      velocita = aspetto.movimento ? aspetto.velocita * 0.04 * Math.min(r.width, r.height) : 0;
      if (elArea) {
        elArea.hidden = !aspetto.area_centrale;
        Object.assign(elArea.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px` });
      }
    }

    function casuale() {
      const { xMin, xMax, yMin, yMax } = limiti;
      return { x: xMin + Math.random() * (xMax - xMin), y: yMin + Math.random() * (yMax - yMin) };
    }

    // Tra alcune posizioni casuali sceglie la più lontana dalla precedente:
    // lo spostamento si vede sempre, anche quando l'oggetto è grande
    function lontana() {
      if (!pos) {
        return casuale();
      }
      let migliore = null;
      let distanza = -1;
      for (let i = 0; i < 12; i++) {
        const p = casuale();
        const d = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (d > distanza) {
          migliore = p;
          distanza = d;
        }
      }
      return migliore;
    }

    // Direzione casuale, mai troppo vicina all'orizzontale o alla verticale
    function direzioneCasuale() {
      const angolo = (20 + Math.random() * 50) * (Math.PI / 180);
      return {
        x: Math.cos(angolo) * (Math.random() < 0.5 ? -1 : 1),
        y: Math.sin(angolo) * (Math.random() < 0.5 ? -1 : 1),
      };
    }

    function limita() {
      pos.x = Math.min(limiti.xMax, Math.max(limiti.xMin, pos.x));
      pos.y = Math.min(limiti.yMax, Math.max(limiti.yMin, pos.y));
    }

    function disegna() {
      elOggetto.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`;
    }

    function passo(adesso) {
      const dt = ultimo ? Math.min(0.05, (adesso - ultimo) / 1000) : 0;
      ultimo = adesso;
      pos.x += dir.x * velocita * dt;
      pos.y += dir.y * velocita * dt;
      // Rimbalzo sui bordi della zona
      if (pos.x <= limiti.xMin) {
        pos.x = limiti.xMin;
        dir.x = Math.abs(dir.x);
      } else if (pos.x >= limiti.xMax) {
        pos.x = limiti.xMax;
        dir.x = -Math.abs(dir.x);
      }
      if (pos.y <= limiti.yMin) {
        pos.y = limiti.yMin;
        dir.y = Math.abs(dir.y);
      } else if (pos.y >= limiti.yMax) {
        pos.y = limiti.yMax;
        dir.y = -Math.abs(dir.y);
      }
      disegna();
      raf = requestAnimationFrame(passo);
    }

    function aggiornaAnimazione() {
      const deveMuoversi = attivo && velocita > 0;
      if (deveMuoversi && !raf) {
        ultimo = 0;
        raf = requestAnimationFrame(passo);
      } else if (!deveMuoversi && raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    }

    // sposta: nuova posizione casuale; centro: al centro della zona;
    // altrimenti l'oggetto resta dov'è (riportato dentro la zona se serve)
    function aggiorna({ sposta = false, centro = false } = {}) {
      calcola(Archivio.getImpostazioni().aspetto);
      if (centro) {
        pos = { x: (limiti.xMin + limiti.xMax) / 2, y: (limiti.yMin + limiti.yMax) / 2 };
      } else if (sposta || !pos) {
        pos = lontana();
      } else {
        limita();
      }
      if (sposta || !dir) {
        dir = direzioneCasuale();
      }
      disegna();
      aggiornaAnimazione();
    }

    function avvia() {
      attivo = true;
      aggiornaAnimazione();
    }

    function ferma() {
      attivo = false;
      aggiornaAnimazione();
    }

    return { aggiorna, avvia, ferma };
  }

  // ==================== CONTROLLI DI ASPETTO ====================
  // Gli stessi controlli compaiono nell'Area Educatore (scheda Aspetto) e nel
  // pannello dell'Area Utente: le modifiche si salvano subito e valgono per entrambe.

  const COLORI_SFONDO = [
    ['#000000', 'Nero'],
    ['#ffffff', 'Bianco'],
    ['#fff59d', 'Giallo chiaro'],
    ['#ffeb3b', 'Giallo'],
    ['#0d47a1', 'Blu'],
    ['#1b5e20', 'Verde'],
    ['#424242', 'Grigio scuro'],
    ['#b3e5fc', 'Azzurro'],
  ];

  // Come si scrive il valore di ogni cursore
  const FORMATI = {
    dimensione: (v) => `${v}%`,
    ampiezza_area: (v) => `${v}%`,
    velocita: (v) => `${v}`,
  };

  function campioni(colori, gruppo, attuale) {
    return colori.map(([colore, nome]) => `
      <button type="button" class="campione ${colore === attuale ? 'scelto' : ''}" data-colore="${colore}"
        data-gruppo="${gruppo}" style="background:${colore}" title="${nome}" aria-label="${nome}"
        aria-pressed="${colore === attuale}"></button>`).join('');
  }

  function cursore(campo, titolo, valore, passo, [meno, piu]) {
    const { min, max } = Archivio.LIMITI[campo];
    const id = `asp-${campo}`;
    return `
      <label class="controllo-titolo" for="${id}">
        ${titolo} <output data-uscita="${campo}">${FORMATI[campo](valore)}</output>
      </label>
      <div class="riga-cursore">
        <button type="button" class="btn-icona" data-passo="${-passo}" data-per="${campo}" aria-label="${meno}"><i class="bi bi-dash-lg"></i></button>
        <input id="${id}" type="range" min="${min}" max="${max}" step="1" value="${valore}" data-campo="${campo}" />
        <button type="button" class="btn-icona" data-passo="${passo}" data-per="${campo}" aria-label="${piu}"><i class="bi bi-plus-lg"></i></button>
      </div>`;
  }

  function htmlControlliAspetto(a) {
    return `
      <div class="controllo">
        ${cursore('dimensione', 'Dimensione dell\'oggetto', a.dimensione, 5, ['Più piccolo', 'Più grande'])}
        <p class="helper-text">In percentuale del lato corto dello schermo.</p>
      </div>
      <div class="controllo">
        <span class="controllo-titolo">Sfondo</span>
        <div class="campioni">
          ${campioni(COLORI_SFONDO, 'sfondo', a.sfondo)}
          <label class="campione campione-libero" title="Altro colore">
            <input type="color" value="${a.sfondo}" data-gruppo="sfondo" aria-label="Altro colore di sfondo" />
            <i class="bi bi-eyedropper"></i>
          </label>
        </div>
      </div>
      <div class="controllo">
        <label class="spunta grande">
          <input type="checkbox" data-campo="area_centrale" ${a.area_centrale ? 'checked' : ''} />
          <span><strong>Solo area centrale</strong> (visione a tunnel, per esempio Sindrome di Usher)</span>
        </label>
        <div class="dettaglio" data-dettaglio="area_centrale" ${a.area_centrale ? '' : 'hidden'}>
          ${cursore('ampiezza_area', 'Ampiezza dell\'area', a.ampiezza_area, 5, ['Area più stretta', 'Area più ampia'])}
          <p class="helper-text">Un quadrato al centro, in percentuale del lato corto dello schermo.
            Senza la spunta si usa tutto lo schermo.</p>
        </div>
      </div>
      <div class="controllo">
        <label class="spunta grande">
          <input type="checkbox" data-campo="movimento" ${a.movimento ? 'checked' : ''} />
          <span><strong>Oggetto in movimento</strong> (senza spunta: statico)</span>
        </label>
        <div class="dettaglio" data-dettaglio="movimento" ${a.movimento ? '' : 'hidden'}>
          ${cursore('velocita', 'Velocità', a.velocita, 1, ['Più lento', 'Più veloce'])}
          <p class="helper-text">L'oggetto scorre e rimbalza sui bordi dell'area. 1 = molto lento, 10 = veloce.</p>
        </div>
      </div>
      <p class="nota-contrasto" data-nota-contrasto hidden></p>
    `;
  }

  // Luminanza relativa (formula WCAG)
  function luminanza(esadecimale) {
    const canali = [1, 3, 5].map((i) => parseInt(esadecimale.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * canali[0] + 0.7152 * canali[1] + 0.0722 * canali[2];
  }

  // Consigli: contrasto (i pittogrammi ARASAAC hanno contorni neri) e spazio nell'area centrale
  function note(imp) {
    const a = imp.aspetto;
    const testi = [];
    if (Archivio.oggettiInScena().some((o) => o.tipo === 'arasaac') && luminanza(a.sfondo) < 0.2) {
      testi.push('I pittogrammi ARASAAC hanno contorni neri: su uno sfondo scuro si vedono poco. Prova uno sfondo chiaro.');
    }
    if (a.area_centrale && a.dimensione >= a.ampiezza_area) {
      testi.push('L\'oggetto è grande quanto l\'area centrale: resta fermo al centro. Riduci l\'oggetto o allarga l\'area.');
    }
    return testi.join(' ');
  }

  function aggiornaControlli(radice, imp) {
    const a = imp.aspetto;
    radice.querySelectorAll('input[type="range"][data-campo]').forEach((c) => {
      if (Number(c.value) !== a[c.dataset.campo]) {
        c.value = a[c.dataset.campo];
      }
    });
    radice.querySelectorAll('[data-uscita]').forEach((o) => {
      o.textContent = FORMATI[o.dataset.uscita](a[o.dataset.uscita]);
    });
    radice.querySelectorAll('input[type="checkbox"][data-campo]').forEach((c) => {
      c.checked = !!a[c.dataset.campo];
    });
    radice.querySelectorAll('[data-dettaglio]').forEach((d) => {
      d.hidden = !a[d.dataset.dettaglio];
    });
    radice.querySelectorAll('.campione[data-colore]').forEach((b) => {
      const scelto = a[b.dataset.gruppo] === b.dataset.colore;
      b.classList.toggle('scelto', scelto);
      b.setAttribute('aria-pressed', String(scelto));
    });
    radice.querySelectorAll('input[type="color"]').forEach((c) => {
      c.value = a[c.dataset.gruppo];
    });
    const nota = radice.querySelector('[data-nota-contrasto]');
    if (nota) {
      const testo = note(imp);
      nota.textContent = testo;
      nota.hidden = !testo;
    }
  }

  // Collega i controlli: ogni modifica si salva e viene passata ad alCambio(impostazioni)
  function collegaControlli(radice, alCambio) {
    const salva = (parziale) => {
      const imp = Archivio.salvaImpostazioni({ aspetto: parziale });
      aggiornaControlli(radice, imp);
      alCambio?.(imp);
    };
    radice.addEventListener('input', (e) => {
      const t = e.target;
      if (t.type === 'range' && t.dataset.campo) {
        salva({ [t.dataset.campo]: Number(t.value) });
      } else if (t.type === 'color' && t.dataset.gruppo) {
        salva({ [t.dataset.gruppo]: t.value.toLowerCase() });
      }
    });
    radice.addEventListener('change', (e) => {
      const t = e.target;
      if (t.type === 'checkbox' && t.dataset.campo) {
        salva({ [t.dataset.campo]: t.checked });
      }
    });
    radice.addEventListener('click', (e) => {
      const campione = e.target.closest('.campione[data-colore]');
      if (campione) {
        salva({ [campione.dataset.gruppo]: campione.dataset.colore });
        return;
      }
      const passo = e.target.closest('[data-passo]');
      if (passo) {
        const campo = passo.dataset.per;
        const { min, max } = Archivio.LIMITI[campo];
        const attuale = Archivio.getImpostazioni().aspetto[campo];
        salva({ [campo]: Math.min(max, Math.max(min, attuale + Number(passo.dataset.passo))) });
      }
    });
    aggiornaControlli(radice, Archivio.getImpostazioni());
  }

  return {
    urlArasaac,
    cercaArasaac,
    urlDi,
    mostraIn,
    precarica,
    caricaImmagine,
    applicaAspetto,
    creaPosizionatore,
    htmlControlliAspetto,
    collegaControlli,
  };
})();
