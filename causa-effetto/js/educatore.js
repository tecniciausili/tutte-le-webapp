// ==================== AREA EDUCATORE ====================
// Colonna a sinistra con quattro schede; lo spazio a destra resta libero per la
// finestra di ricerca di YouTube (come in Mastertutor).
//   Oggetti   pittogrammi ARASAAC e immagini dal dispositivo: uno solo, oppure
//             più oggetti che compaiono uno alla volta a caso
//   Aspetto   dimensione dell'oggetto e sfondo (con anteprima)
//   YouTube   ricerca, link con inizio e fine, playlist, lista dei video
//   Sessione  durata (fino alla fine / temporizzato) e ordine (sequenza / random)

const Educatore = (() => {
  const SCHEDE = [
    { id: 'oggetti', icona: 'bi-images', titolo: 'Oggetti' },
    { id: 'aspetto', icona: 'bi-palette', titolo: 'Aspetto' },
    { id: 'youtube', icona: 'bi-youtube', titolo: 'YouTube' },
    { id: 'sessione', icona: 'bi-stopwatch', titolo: 'Sessione' },
  ];

  const RICERCA_PREDEFINITA = 'cartoni animati per bambini';

  let contenuto = null;
  let schedaAttiva = 'oggetti';
  let finestraYoutube = null;
  let timerRicerca = null;
  let timerArasaac = null;
  let ricercaArasaac = 0;          // scarta le risposte arrivate fuori tempo
  let osservatoreAnteprima = null;
  let posizionatoreAnteprima = null;
  let timerAnteprima = null;       // rotazione degli oggetti nell'anteprima
  let indiceAnteprima = 0;

  // Controllo dei video YouTube: un piccolo player di anteprima nel modulo
  let playerVerifica = null;
  let eventiVerifica = null;
  let timerVerifica = null;
  let verifica = { videoId: '', esito: null };   // esito: null | 'attesa' | {ok, codice?}

  // Importazione di una playlist: player nascosto usato solo per leggere l'elenco
  let playerImport = null;
  let importInCorso = false;

  // ==================== STRUTTURA ====================

  function apri(contenitore) {
    contenitore.innerHTML = `
      <div class="educatore">
        <section class="panel pannello-educatore" aria-label="Area Educatore">
          <div class="intestazione-area">
            <h2><i class="bi bi-person-workspace"></i> Area Educatore</h2>
            <button type="button" class="btn-secondary btn-piccolo" data-azione="vai-utente">
              <i class="bi bi-hand-index-thumb"></i> Area Utente
            </button>
          </div>
          <nav class="schede" role="tablist" aria-label="Sezioni">
            ${SCHEDE.map((s) => `
              <button type="button" class="scheda" role="tab" data-scheda="${s.id}">
                <i class="bi ${s.icona}"></i><span>${s.titolo}</span>
              </button>`).join('')}
          </nav>
          <div class="scheda-contenuto" id="schedaContenuto"></div>
        </section>
        <div class="spazio-youtube" aria-hidden="true">
          <i class="bi bi-youtube"></i>
          <p>Qui a destra si apre la finestra di YouTube quando scrivi la categoria nella scheda <strong>YouTube</strong>.</p>
        </div>
      </div>
    `;

    contenuto = contenitore.querySelector('#schedaContenuto');
    contenitore.querySelector('.schede').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-scheda]');
      if (btn) {
        mostraScheda(btn.dataset.scheda);
      }
    });
    contenitore.querySelector('[data-azione="vai-utente"]').addEventListener('click', () => App.mostraUtente());
    contenuto.addEventListener('click', gestisciClick);
    contenuto.addEventListener('change', gestisciCambio);

    mostraScheda(schedaAttiva);
  }

  function chiudi() {
    pulisciScheda();
    contenuto = null;
  }

  // Ferma quello che la scheda precedente aveva lasciato attivo
  function pulisciScheda() {
    clearTimeout(timerRicerca);
    clearTimeout(timerArasaac);
    ricercaArasaac++;
    osservatoreAnteprima?.disconnect();
    osservatoreAnteprima = null;
    posizionatoreAnteprima?.ferma();
    posizionatoreAnteprima = null;
    clearInterval(timerAnteprima);
    timerAnteprima = null;
    distruggiVerifica();
  }

  function mostraScheda(id) {
    if (!contenuto) {
      return;
    }
    pulisciScheda();
    schedaAttiva = id;
    document.querySelectorAll('.schede .scheda').forEach((b) => {
      const attiva = b.dataset.scheda === id;
      b.classList.toggle('attiva', attiva);
      b.setAttribute('aria-selected', attiva ? 'true' : 'false');
    });
    const disegna = {
      oggetti: schedaOggetti,
      aspetto: schedaAspetto,
      youtube: schedaYoutube,
      sessione: schedaSessione,
    }[id] || schedaOggetti;
    disegna();
  }

  function stato(selettore, testo, tipo) {
    const box = contenuto?.querySelector(selettore);
    if (box) {
      box.textContent = testo;
      box.className = `status-message ${tipo}`;
    }
  }

  // ==================== ANTEPRIMA (schede Oggetti e Aspetto) ====================

  // Un piccolo "schermo" con le proporzioni di un tablet: sfondo, area centrale (se
  // attiva) e oggetto, con la stessa dimensione relativa e lo stesso movimento
  // che avrà nell'Area Utente. Con più oggetti in scena li mostra a rotazione.
  function htmlAnteprima() {
    return `
      <div class="anteprima-schermo" id="anteprimaSchermo">
        <div class="area-centrale" id="anteprimaArea" hidden></div>
        <div class="oggetto" id="anteprimaOggetto" hidden><img alt="" /></div>
        <p class="anteprima-vuota" id="anteprimaVuota" hidden><i class="bi bi-image"></i> Nessun oggetto in scena</p>
      </div>`;
  }

  async function aggiornaAnteprima() {
    const schermo = contenuto?.querySelector('#anteprimaSchermo');
    if (!schermo) {
      return;
    }
    const imp = Archivio.getImpostazioni();
    const inScena = Archivio.oggettiInScena();
    const o = inScena[indiceAnteprima % Math.max(1, inScena.length)] || null;
    const url = await Oggetto.urlDi(o);
    const oggetto = contenuto?.querySelector('#anteprimaOggetto');
    if (!oggetto) {
      return;
    }
    if (url) {
      Oggetto.mostraIn(oggetto.querySelector('img'), o, url);
    }
    oggetto.hidden = !url;
    contenuto.querySelector('#anteprimaVuota').hidden = !!url;
    if (!posizionatoreAnteprima) {
      posizionatoreAnteprima = Oggetto.creaPosizionatore(schermo, oggetto, {
        elArea: contenuto.querySelector('#anteprimaArea'),
      });
      posizionatoreAnteprima.avvia();
    }
    // Statico: al centro. In movimento: continua da dove si trova.
    posizionatoreAnteprima.aggiorna({ centro: !imp.aspetto.movimento });
    // Più oggetti in scena: a rotazione, come compariranno nell'Area Utente
    if (inScena.length > 1 && !timerAnteprima) {
      timerAnteprima = setInterval(() => {
        indiceAnteprima++;
        aggiornaAnteprima();
      }, 2000);
    } else if (inScena.length <= 1 && timerAnteprima) {
      clearInterval(timerAnteprima);
      timerAnteprima = null;
    }
  }

  function osservaAnteprima() {
    const schermo = contenuto?.querySelector('#anteprimaSchermo');
    if (schermo) {
      osservatoreAnteprima = new ResizeObserver(() => aggiornaAnteprima());
      osservatoreAnteprima.observe(schermo);
    }
  }

  // ==================== SCHEDA OGGETTI ====================

  function schedaOggetti() {
    const { scena } = Archivio.getImpostazioni();
    contenuto.innerHTML = `
      <h3><i class="bi bi-images"></i> Oggetti da toccare</h3>
      ${htmlAnteprima()}
      <p class="oggetto-attuale" id="riepilogoOggetti"></p>

      <fieldset class="gruppo-scelte">
        <legend>Quanti oggetti</legend>
        <label class="scelta">
          <input type="radio" name="modoOggetti" value="uno" data-azione="modo-oggetti" ${scena.modo === 'uno' ? 'checked' : ''} />
          <span><strong>Un solo oggetto</strong>
            <small>Compare sempre lo stesso: quello con «Usa questo» nell'elenco.</small></span>
        </label>
        <label class="scelta">
          <input type="radio" name="modoOggetti" value="random" data-azione="modo-oggetti" ${scena.modo === 'random' ? 'checked' : ''} />
          <span><strong>Più oggetti, uno alla volta a caso</strong>
            <small>A ogni ricomparsa un oggetto diverso tra quelli con la spunta «In scena».
              Nessuno si ripete finché non sono comparsi tutti.</small></span>
        </label>
      </fieldset>

      <h4 class="titolo-lista"><i class="bi bi-collection"></i> I tuoi oggetti</h4>
      <div class="griglia-oggetti" id="listaOggetti"></div>

      <h4 class="titolo-lista"><i class="bi bi-link-45deg"></i> Quali video fa partire ogni oggetto</h4>
      <p class="helper-text">Spunta le categorie dei video (scheda YouTube). Toccando l'oggetto parte un video
        di quelle categorie. Senza spunte l'oggetto fa partire tutti i video.</p>
      <div class="collegamenti-oggetti" id="collegamentiOggetti"></div>

      <h4 class="titolo-lista"><i class="bi bi-plus-circle"></i> Aggiungi un oggetto</h4>
      <div class="aggiungi-oggetto">
        <div class="form-group">
          <label for="arasaacCerca">Cerca un pittogramma ARASAAC</label>
          <input id="arasaacCerca" type="search" maxlength="80" autocomplete="off"
            placeholder="Es: palla, cane, macchina…" />
        </div>
        <span class="aggiungi-oppure">oppure</span>
        <label class="btn-secondary btn-carica">
          <i class="bi bi-upload"></i> Carica un'immagine dal computer
          <input type="file" id="fileImmagine" accept="image/*" multiple hidden />
        </label>
      </div>
      <p class="helper-text">Foto o disegni dal computer (o dalle Foto del tablet), anche più di una alla volta:
        ognuna si ritaglia quadrata, così sullo schermo è grande come un pittogramma. Vengono salvate
        su questo dispositivo e incluse in <em>Esporta dati</em>.</p>
      <div id="statoImmagine" class="status-message" role="status" aria-live="polite"></div>
      <div id="statoArasaac" class="status-message" role="status" aria-live="polite"></div>
      <div class="griglia-pittogrammi" id="grigliaArasaac"></div>
      <p class="helper-text crediti-arasaac">
        Tocca un pittogramma per aggiungerlo ai tuoi oggetti.
        Pittogrammi di Sergio Palao, proprietà del Governo di Aragona (ARASAAC), licenza CC BY-NC-SA.
        <button type="button" class="link" data-azione="licenza-arasaac">Condizioni d'uso</button>
      </p>
    `;

    const campo = contenuto.querySelector('#arasaacCerca');
    campo.addEventListener('input', () => {
      clearTimeout(timerArasaac);
      const testo = campo.value.trim();
      if (testo.length >= 2) {
        timerArasaac = setTimeout(() => cercaArasaac(testo), 500);
      } else {
        contenuto.querySelector('#grigliaArasaac').innerHTML = '';
      }
    });
    contenuto.querySelector('#fileImmagine').addEventListener('change', caricaImmagini);
    disegnaOggetti();
    osservaAnteprima();
  }

  function descriviOggetto(o) {
    return o.tipo === 'arasaac' ? 'ARASAAC' : 'Immagine';
  }

  // Elenco degli oggetti: nel modo "uno" si sceglie quello usato, nel modo
  // "random" si mettono in scena quelli che compaiono a caso
  function disegnaOggetti() {
    const lista = contenuto?.querySelector('#listaOggetti');
    if (!lista) {
      return;
    }
    const { scena } = Archivio.getImpostazioni();
    const oggetti = Archivio.getOggetti();
    const inScena = Archivio.oggettiInScena();
    const idInScena = new Set(inScena.map((o) => o.id));

    const riepilogo = contenuto.querySelector('#riepilogoOggetti');
    if (!oggetti.length) {
      riepilogo.innerHTML = 'Nessun oggetto: aggiungi un pittogramma ARASAAC o un\'immagine qui sotto.';
    } else if (scena.modo === 'uno') {
      riepilogo.innerHTML = `In scena: <strong>${Util.escapeHtml(inScena[0]?.nome || '')}</strong> (sempre lo stesso).`;
    } else if (!inScena.length) {
      riepilogo.innerHTML = '<span class="avviso-testo">Nessun oggetto in scena: metti la spunta «In scena» ad almeno uno.</span>';
    } else {
      riepilogo.innerHTML = `In scena: <strong>${inScena.length}</strong> oggetti su ${oggetti.length}, uno alla volta a caso.`;
    }

    if (!oggetti.length) {
      lista.innerHTML = '<p class="vuoto"><i class="bi bi-image"></i> Ancora nessun oggetto.</p>';
      aggiornaAnteprima();
      return;
    }
    lista.innerHTML = oggetti.map((o) => {
      const controllo = scena.modo === 'uno'
        ? `<label class="spunta"><input type="radio" name="oggettoScelto" data-azione="oggetto-scelto" data-id="${o.id}"
            ${idInScena.has(o.id) ? 'checked' : ''} /> <span>Usa questo</span></label>`
        : `<label class="spunta"><input type="checkbox" data-azione="oggetto-attivo" data-id="${o.id}"
            ${o.attivo ? 'checked' : ''} /> <span>In scena</span></label>`;
      return `
        <div class="scheda-oggetto ${idInScena.has(o.id) ? 'in-scena' : ''}">
          <button type="button" class="btn-icona pericolo scheda-oggetto-elimina" data-azione="oggetto-elimina"
            data-id="${o.id}" title="Elimina" aria-label="Elimina ${Util.escapeHtml(o.nome)}"><i class="bi bi-trash3"></i></button>
          ${o.tipo === 'immagine' ? `<button type="button" class="btn-icona scheda-oggetto-ritaglia" data-azione="oggetto-ritaglia"
            data-id="${o.id}" title="Ritaglia" aria-label="Ritaglia ${Util.escapeHtml(o.nome)}"><i class="bi bi-crop"></i></button>` : ''}
          <img alt="" data-miniatura="${o.id}"
            ${o.tipo === 'arasaac' ? `src="${Oggetto.urlArasaac(o.arasaac_id, 300)}"` : ''} />
          <span class="scheda-oggetto-nome" title="${Util.escapeHtml(o.nome)}">${Util.escapeHtml(o.nome || 'senza nome')}</span>
          <small>${descriviOggetto(o)}</small>
          ${controllo}
        </div>`;
    }).join('');
    // Le immagini dal dispositivo arrivano da IndexedDB
    oggetti.filter((o) => o.tipo === 'immagine').forEach(async (o) => {
      const url = await Oggetto.urlDi(o);
      const img = contenuto?.querySelector(`[data-miniatura="${o.id}"]`);
      if (img && url) {
        img.src = url;
      }
    });
    aggiornaAnteprima();
    segnaRisultatiArasaac();
    disegnaCollegamenti();
  }

  // Per ogni oggetto, le categorie di video che fa partire. Si vede subito quanti
  // video ci sono e se l'oggetto resterà fuori perché non ne ha.
  function disegnaCollegamenti() {
    const box = contenuto?.querySelector('#collegamentiOggetti');
    if (!box) {
      return;
    }
    const oggetti = Archivio.getOggetti();
    const categorie = Archivio.getCategorie();
    const disponibili = Archivio.getYoutube().filter((v) => v.attivo && !Riproduttore.erroreDefinitivo(v.errore));
    if (!oggetti.length) {
      box.innerHTML = '';
      return;
    }
    if (!categorie.length) {
      box.innerHTML = '<p class="vuoto"><i class="bi bi-youtube"></i> Aggiungi prima i video nella scheda YouTube: ognuno ha la sua categoria.</p>';
      return;
    }
    const idInScena = new Set(Archivio.oggettiInScena().map((o) => o.id));
    box.innerHTML = oggetti.map((o) => {
      // Anche le categorie rimaste senza video, se spuntate, per poterle togliere
      const elenco = [...categorie, ...o.categorie.filter((c) => !categorie.includes(c))];
      const quanti = Archivio.videoDellOggetto(o, disponibili).length;
      let esito;
      if (!quanti) {
        esito = `<span class="avviso-testo"><i class="bi bi-exclamation-triangle-fill"></i>
          Nessun video nella lista per queste categorie: l'oggetto non compare.</span>`;
      } else if (!o.categorie.length) {
        esito = `Tutti i video della lista (${quanti})`;
      } else {
        esito = `${quanti} video nella lista`;
      }
      const chip = elenco.map((c) => {
        const nVideo = disponibili.filter((v) => v.categoria === c).length;
        return `
          <label class="chip-categoria">
            <input type="checkbox" data-azione="oggetto-categoria" data-id="${o.id}"
              data-categoria="${Util.escapeHtml(c)}" ${o.categorie.includes(c) ? 'checked' : ''} />
            <span>${Util.escapeHtml(c)} <small>(${nVideo})</small></span>
          </label>`;
      }).join('');
      return `
        <div class="collegamento ${idInScena.has(o.id) ? 'in-scena' : ''}">
          <img alt="" data-miniatura-collegamento="${o.id}"
            ${o.tipo === 'arasaac' ? `src="${Oggetto.urlArasaac(o.arasaac_id, 300)}"` : ''} />
          <div class="collegamento-testo">
            <strong>${Util.escapeHtml(o.nome || 'senza nome')}</strong>
            <div class="chip-elenco">${chip}</div>
            <small class="collegamento-esito">${esito}</small>
          </div>
        </div>`;
    }).join('');
    oggetti.filter((o) => o.tipo === 'immagine').forEach(async (o) => {
      const url = await Oggetto.urlDi(o);
      const img = contenuto?.querySelector(`[data-miniatura-collegamento="${o.id}"]`);
      if (img && url) {
        img.src = url;
      }
    });
  }

  // Nei risultati della ricerca si vede quali pittogrammi sono già tra gli oggetti
  function segnaRisultatiArasaac() {
    const presenti = new Set(Archivio.getOggetti().filter((o) => o.tipo === 'arasaac').map((o) => o.arasaac_id));
    contenuto?.querySelectorAll('.pittogramma[data-id]').forEach((b) => {
      const gia = presenti.has(Number(b.dataset.id));
      b.classList.toggle('scelto', gia);
      b.title = gia ? `${b.dataset.nome}: già tra i tuoi oggetti` : b.dataset.nome;
    });
  }

  async function cercaArasaac(testo) {
    const numero = ++ricercaArasaac;
    const griglia = contenuto?.querySelector('#grigliaArasaac');
    if (!griglia) {
      return;
    }
    stato('#statoArasaac', '⏳ Ricerca in corso…', 'info');
    try {
      const risultati = await Oggetto.cercaArasaac(testo);
      if (numero !== ricercaArasaac || !contenuto) {
        return;
      }
      if (!risultati.length) {
        stato('#statoArasaac', `Nessun pittogramma per "${testo}". Prova con un'altra parola.`, 'info');
        griglia.innerHTML = '';
        return;
      }
      stato('#statoArasaac', '', '');
      griglia.innerHTML = risultati.map((p) => `
        <button type="button" class="pittogramma" data-azione="aggiungi-arasaac" data-id="${p.id}"
          data-nome="${Util.escapeHtml(p.nome)}" title="${Util.escapeHtml(p.nome)}">
          <img src="${Oggetto.urlArasaac(p.id, 300)}" alt="" loading="lazy"
            onerror="this.closest('.pittogramma').hidden = true" />
          <span>${Util.escapeHtml(p.nome)}</span>
        </button>`).join('');
      segnaRisultatiArasaac();
    } catch (e) {
      if (numero === ricercaArasaac) {
        stato('#statoArasaac', navigator.onLine === false
          ? 'Serve la connessione a internet per cercare i pittogrammi.'
          : `❌ ${e.message}`, 'error');
      }
    }
  }

  function aggiungiArasaac(id, nome) {
    try {
      Archivio.aggiungiOggetto({ tipo: 'arasaac', arasaac_id: id, nome });
      const modo = Archivio.getImpostazioni().scena.modo;
      stato('#statoArasaac', modo === 'uno'
        ? `✅ "${nome}" aggiunto: è l'oggetto usato.`
        : `✅ "${nome}" aggiunto e messo in scena.`, 'success');
      disegnaOggetti();
    } catch (e) {
      stato('#statoArasaac', e.message, 'info');
    }
  }

  async function caricaImmagini(e) {
    const file = Array.from(e.target.files || []);
    e.target.value = '';
    if (!file.length) {
      return;
    }
    let aggiunte = 0;
    let saltate = 0;
    const errori = [];
    for (let i = 0; i < file.length; i++) {
      stato('#statoImmagine', `✂️ Ritaglio delle immagini… ${i + 1}/${file.length}`, 'info');
      const nome = file[i].name.replace(/\.[^.]+$/, '');
      try {
        const blob = await Ritaglio.apri(file[i], {
          sottotitolo: file.length > 1 ? `${nome} · ${i + 1} di ${file.length}` : nome,
          trasparente: /png|gif|webp|svg/.test(file[i].type),
        });
        if (!blob) {
          saltate++;
          continue;
        }
        await Archivio.aggiungiImmagine(blob, nome);
        aggiunte++;
      } catch (errore) {
        errori.push(`${file[i].name}: ${errore.message}`);
      }
    }
    if (!contenuto) {
      return;
    }
    const parti = [];
    if (aggiunte) {
      parti.push(`✅ ${aggiunte === 1 ? 'Un\'immagine aggiunta' : `${aggiunte} immagini aggiunte`}.`);
    }
    if (saltate) {
      parti.push(`${saltate === 1 ? 'Un\'immagine annullata' : `${saltate} immagini annullate`}.`);
    }
    if (errori.length) {
      parti.push(`❌ ${errori.join(' · ')}`);
    }
    stato('#statoImmagine', parti.join(' '), errori.length ? 'error' : (aggiunte ? 'success' : 'info'));
    disegnaOggetti();
  }

  // Ritaglia di nuovo un'immagine già salvata (per esempio una caricata prima della 1.0.6)
  async function ritagliaOggetto(id) {
    const oggetto = Archivio.getOggetti().find((o) => o.id === id);
    const record = await Archivio.getImmagine(id).catch(() => null);
    if (!oggetto || !record?.blob) {
      return;
    }
    try {
      const blob = await Ritaglio.apri(record.blob, {
        sottotitolo: oggetto.nome,
        trasparente: record.blob.type === 'image/png',
      });
      if (blob) {
        await Archivio.aggiornaImmagine(id, blob);
        stato('#statoImmagine', `✅ "${oggetto.nome}" ritagliata.`, 'success');
        disegnaOggetti();
      }
    } catch (errore) {
      stato('#statoImmagine', `❌ ${errore.message}`, 'error');
    }
  }

  // ==================== SCHEDA ASPETTO ====================

  function schedaAspetto() {
    contenuto.innerHTML = `
      <h3><i class="bi bi-palette"></i> Aspetto</h3>
      <p class="helper-text">Regola dimensione e colori sulle capacità visive dell'utente. Si possono
        cambiare anche durante l'uso, dal pulsante <i class="bi bi-sliders"></i> dell'Area Utente.</p>
      ${htmlAnteprima()}
      <div class="controlli-aspetto" id="controlliAspetto">
        ${Oggetto.htmlControlliAspetto(Archivio.getImpostazioni().aspetto)}
      </div>
    `;
    Oggetto.collegaControlli(contenuto.querySelector('#controlliAspetto'), () => aggiornaAnteprima());
    osservaAnteprima();
    aggiornaAnteprima();
  }

  // ==================== SCHEDA YOUTUBE ====================

  function opzioniCategorie() {
    return Archivio.getCategorie().map((c) => `<option value="${Util.escapeHtml(c)}"></option>`).join('');
  }

  function schedaYoutube() {
    contenuto.innerHTML = `
      <h3><i class="bi bi-youtube"></i> Video YouTube</h3>
      <p class="helper-text">
        Scrivi la categoria: dopo un secondo si apre YouTube con la ricerca. Scegli il video,
        copia il link dalla barra degli indirizzi e incollalo qui sotto. Si salva solo il link.
      </p>
      <form id="formYoutube" class="form-grid" novalidate>
        <div class="form-group">
          <label for="ytCategoria">Categoria *</label>
          <input id="ytCategoria" type="text" maxlength="100" required list="ytCategorie"
            placeholder="Es: cartoni animati" autocomplete="off" />
          <datalist id="ytCategorie">${opzioniCategorie()}</datalist>
        </div>
        <div class="form-group">
          <label for="ytLink">Link YouTube *</label>
          <input id="ytLink" type="url" maxlength="500" required autocomplete="off"
            placeholder="https://www.youtube.com/watch?v=..." />
        </div>
        <div class="verifica-video" id="ytVerifica" hidden>
          <div class="yt-anteprima"><div id="ytAnteprimaPlayer"></div></div>
          <p class="verifica-esito" id="ytVerificaEsito" role="status" aria-live="polite"></p>
        </div>
        <div class="form-group">
          <label for="ytNome">Nome *</label>
          <input id="ytNome" type="text" maxlength="150" required autocomplete="off"
            placeholder="Es: Peppa Pig al parco" />
        </div>
        <div class="riga-2">
          <div class="form-group">
            <label>Inizio (facoltativo)</label>
            <div class="tempo">
              <input id="ytInizioMin" type="number" min="0" max="999" placeholder="min" aria-label="Minuti di inizio" />
              <span>:</span>
              <input id="ytInizioSec" type="number" min="0" max="59" placeholder="sec" aria-label="Secondi di inizio" />
            </div>
          </div>
          <div class="form-group">
            <label>Fine (facoltativo)</label>
            <div class="tempo">
              <input id="ytFineMin" type="number" min="0" max="999" placeholder="min" aria-label="Minuti di fine" />
              <span>:</span>
              <input id="ytFineSec" type="number" min="0" max="59" placeholder="sec" aria-label="Secondi di fine" />
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary"><i class="bi bi-save"></i> Salva video</button>
          <button type="reset" class="btn-secondary"><i class="bi bi-eraser"></i> Svuota</button>
        </div>
        <div id="statoYoutube" class="status-message" role="status" aria-live="polite"></div>
      </form>

      <div class="blocco-playlist">
        <h4 class="titolo-lista"><i class="bi bi-list-ol"></i> Importa una playlist</h4>
        <p class="helper-text">
          Incolla il link di una playlist di YouTube: i suoi video vengono aggiunti sotto,
          uno per uno, con il titolo di YouTube e la categoria uguale al nome della playlist.
        </p>
        <form id="formPlaylist" class="form-grid" novalidate>
          <div class="form-group">
            <label for="ytPlaylist">Link playlist</label>
            <input id="ytPlaylist" type="url" maxlength="600" autocomplete="off"
              placeholder="https://www.youtube.com/playlist?list=..." />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary"><i class="bi bi-download"></i> Importa playlist</button>
          </div>
          <div id="statoPlaylist" class="status-message" role="status" aria-live="polite"></div>
        </form>
        <div id="ytImportPlayer" class="import-player-nascosto" aria-hidden="true"></div>
      </div>

      <h4 class="titolo-lista"><i class="bi bi-collection-play"></i> Video archiviati</h4>
      <div id="listaYoutube" class="lista-elementi"></div>
    `;

    const categoria = contenuto.querySelector('#ytCategoria');
    categoria.addEventListener('input', () => {
      clearTimeout(timerRicerca);
      const testo = categoria.value.trim();
      if (testo.length >= 3) {
        timerRicerca = setTimeout(() => apriRicercaYoutube(testo), 1000);
      }
    });
    const form = contenuto.querySelector('#formYoutube');
    form.addEventListener('submit', salvaVideo);
    form.addEventListener('reset', () => {
      contenuto.querySelector('#ytVerifica').hidden = true;
      verifica = { videoId: '', esito: null };
    });
    const link = contenuto.querySelector('#ytLink');
    link.addEventListener('input', () => {
      clearTimeout(timerVerifica);
      timerVerifica = setTimeout(() => verificaVideo(link.value), 500);
    });
    contenuto.querySelector('#formPlaylist').addEventListener('submit', importaPlaylist);

    disegnaListaYoutube();
  }

  // Finestra di ricerca YouTube affiancata (2/3 destri dello schermo, come nelle altre app)
  function apriRicercaYoutube(testo) {
    if (navigator.onLine === false) {
      stato('#statoYoutube', 'YouTube non è raggiungibile senza connessione a internet.', 'info');
      return;
    }
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(testo || RICERCA_PREDEFINITA)}`;
    const larghezzaSchermo = window.screen.availWidth;
    const tablet = /iPad|Android/i.test(navigator.userAgent) || Riproduttore.IOS;
    const quota = tablet ? 0.5 : 0.667;
    const larghezza = Math.floor(larghezzaSchermo * quota);
    const altezza = Math.floor(window.screen.availHeight * 0.75);
    const sinistra = (window.screen.availLeft || 0) + Math.floor(larghezzaSchermo * (1 - quota));

    if (finestraYoutube && !finestraYoutube.closed) {
      try {
        finestraYoutube.location.href = url;
        finestraYoutube.focus();
        return;
      } catch (e) {
        finestraYoutube = null;
      }
    }
    finestraYoutube = window.open(url, 'RicercaYouTube',
      `width=${larghezza},height=${altezza},left=${sinistra},top=0,scrollbars=yes,resizable=yes`);
    if (!finestraYoutube) {
      stato('#statoYoutube', 'Il browser ha bloccato la finestra di YouTube: consenti i popup per questo sito.', 'error');
    }
  }

  // ---------- Controllo del video (si può vedere fuori da YouTube?) ----------

  function distruggiVerifica() {
    clearTimeout(timerVerifica);
    try {
      playerVerifica?.destroy();
    } catch (e) { /* già distrutto */ }
    playerVerifica = null;
    eventiVerifica = null;
    verifica = { videoId: '', esito: null };
    distruggiImport();
  }

  function distruggiImport() {
    try {
      playerImport?.destroy();
    } catch (e) { /* già distrutto */ }
    playerImport = null;
  }

  function esitoVerifica(testo, classe) {
    const p = contenuto?.querySelector('#ytVerificaEsito');
    if (p) {
      p.textContent = testo;
      p.className = `verifica-esito ${classe}`;
    }
  }

  // Carica il video in un piccolo player: YouTube segnala subito (onError) se il
  // proprietario non ne permette la riproduzione fuori dal suo sito
  async function verificaVideo(testo) {
    const box = contenuto?.querySelector('#ytVerifica');
    if (!box) {
      return;
    }
    const id = Util.estraiVideoId(testo);
    if (!id) {
      box.hidden = true;
      verifica = { videoId: '', esito: null };
      return;
    }
    if (id === verifica.videoId && verifica.esito && verifica.esito !== 'attesa') {
      return;
    }
    verifica = { videoId: id, esito: 'attesa' };
    box.hidden = false;
    esitoVerifica('⏳ Controllo del video…', 'attesa');
    try {
      await Riproduttore.attendiApi(8000);
    } catch (e) {
      verifica.esito = null;
      esitoVerifica('YouTube non è raggiungibile: il controllo richiede internet.', 'attesa');
      return;
    }
    const risultato = await new Promise((resolve) => {
      let fatto = false;
      const fine = (r) => {
        if (!fatto) {
          fatto = true;
          clearTimeout(tempoMassimo);
          resolve(r);
        }
      };
      const tempoMassimo = setTimeout(() => fine({ ok: true, incerto: true }), 8000);
      eventiVerifica = {
        // 5 = video pronto: se entro poco non arriva un errore, si può usare
        stato: (s) => {
          if (s === 5 || s === 1) {
            setTimeout(() => fine({ ok: true }), 1200);
          }
        },
        errore: (codice) => fine({ ok: false, codice }),
      };
      if (playerVerifica) {
        playerVerifica.cueVideoById(id);
      } else if (contenuto?.querySelector('#ytAnteprimaPlayer')) {
        playerVerifica = new YT.Player('ytAnteprimaPlayer', {
          width: '100%',
          height: '100%',
          videoId: id,
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1, enablejsapi: 1, origin: window.location.origin },
          events: {
            onStateChange: (e) => eventiVerifica?.stato(e.data),
            onError: (e) => eventiVerifica?.errore(e.data),
          },
        });
      } else {
        fine({ ok: true, incerto: true });
      }
    });
    if (verifica.videoId !== id) {
      return; // nel frattempo il link è cambiato
    }
    verifica.esito = risultato;
    if (risultato.ok) {
      esitoVerifica(risultato.incerto
        ? 'Il video sembra a posto (YouTube non ha confermato in tempo).'
        : '✅ Il video si può usare.', risultato.incerto ? 'attesa' : 'ok');
      // Nome proposto: il titolo di YouTube, se il campo è ancora vuoto
      const nome = contenuto?.querySelector('#ytNome');
      if (nome && !nome.value.trim()) {
        const titolo = await titoloOEmbed(`https://www.youtube.com/watch?v=${id}`);
        if (titolo && !nome.value.trim() && verifica.videoId === id) {
          nome.value = titolo.slice(0, 150);
        }
      }
    } else {
      esitoVerifica(`❌ ${Riproduttore.descriviErrore(risultato.codice)} Cerca un'altra versione dello stesso video.`, 'errore');
    }
  }

  function salvaVideo(evento) {
    evento.preventDefault();
    const f = (id) => contenuto.querySelector(id);
    const categoria = f('#ytCategoria').value.trim();
    const link = f('#ytLink').value.trim();
    const nome = f('#ytNome').value.trim();
    const videoId = Util.estraiVideoId(link);
    const inizio = Util.secondiDa(f('#ytInizioMin').value, f('#ytInizioSec').value);
    const fine = Util.secondiDa(f('#ytFineMin').value, f('#ytFineSec').value);

    if (!categoria || !link || !nome) {
      stato('#statoYoutube', 'Compila categoria, link e nome.', 'error');
      return;
    }
    if (!videoId) {
      stato('#statoYoutube', 'Il link non sembra un indirizzo YouTube valido.', 'error');
      return;
    }
    if (fine > 0 && fine <= inizio) {
      stato('#statoYoutube', 'Il tempo di fine deve essere dopo il tempo di inizio.', 'error');
      return;
    }
    if (verifica.videoId === videoId && verifica.esito && verifica.esito.ok === false) {
      stato('#statoYoutube', `Questo video non si può usare: ${Riproduttore.descriviErrore(verifica.esito.codice)}`, 'error');
      return;
    }

    try {
      Archivio.aggiungiYoutube({ nome, categoria, link, video_id: videoId, inizio, fine });
      f('#formYoutube').reset();
      f('#ytCategoria').value = categoria;   // spesso si aggiungono più video della stessa categoria
      stato('#statoYoutube', `✅ "${nome}" salvato e messo nella lista dell'utente.`, 'success');
      f('#ytCategorie').innerHTML = opzioniCategorie();
      disegnaListaYoutube();
    } catch (e) {
      stato('#statoYoutube', e.message, 'error');
    }
  }

  // ---------- Importazione playlist (come in Mastertutor) ----------

  // Legge l'elenco dei video di una playlist riusando il player di YouTube:
  // niente chiave API, tutto lato client. Restituisce gli id dei video.
  function enumeraPlaylist(playlistId) {
    return new Promise((resolve, reject) => {
      const box = contenuto?.querySelector('#ytImportPlayer');
      if (!box) {
        reject(new Error('Riquadro di importazione non disponibile.'));
        return;
      }
      // YT.Player sostituisce l'elemento bersaglio con un iframe: ne uso uno
      // nuovo ogni volta, così il riquadro contenitore resta al suo posto.
      box.innerHTML = '<div id="ytImportTarget"></div>';
      let concluso = false;
      let sonda = null;
      const scadenza = setTimeout(
        () => fine(null, new Error('La playlist non risponde: potrebbe essere vuota o privata.')),
        15000,
      );
      function fine(ids, errore) {
        if (concluso) {
          return;
        }
        concluso = true;
        clearTimeout(scadenza);
        clearInterval(sonda);
        if (errore) {
          reject(errore);
        } else {
          resolve(ids);
        }
      }
      const leggi = () => {
        try {
          const ids = playerImport?.getPlaylist?.();
          if (Array.isArray(ids) && ids.length) {
            fine(ids.filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id)));
          }
        } catch (e) { /* non ancora pronto */ }
      };
      try {
        playerImport = new YT.Player('ytImportTarget', {
          width: '1',
          height: '1',
          playerVars: {
            listType: 'playlist', list: playlistId,
            enablejsapi: 1, origin: window.location.origin,
          },
          events: {
            onReady: () => {
              sonda = setInterval(leggi, 300);
              leggi();
            },
            onError: (e) => fine(null, new Error(`YouTube non apre la playlist (codice ${e.data}).`)),
          },
        });
      } catch (e) {
        fine(null, e);
      }
    });
  }

  // Titolo di un video o di una playlist tramite oEmbed (gratis, senza chiave)
  async function titoloOEmbed(indirizzo) {
    try {
      const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(indirizzo)}&format=json`;
      const risposta = await fetch(url);
      if (!risposta.ok) {
        return null;
      }
      const dati = await risposta.json();
      const titolo = (dati && dati.title ? String(dati.title) : '').trim();
      return titolo || null;
    } catch (e) {
      return null;
    }
  }

  async function importaPlaylist(evento) {
    evento.preventDefault();
    if (importInCorso) {
      return;
    }
    const campo = contenuto.querySelector('#ytPlaylist');
    const url = campo.value.trim();
    const playlistId = Util.estraiPlaylistId(url);
    if (!url) {
      stato('#statoPlaylist', 'Incolla il link di una playlist di YouTube.', 'error');
      return;
    }
    if (!playlistId) {
      stato('#statoPlaylist', 'Il link non contiene una playlist valida (manca il parametro "list"). Le liste "Guarda più tardi" e "Mi piace" sono private e non si possono importare.', 'error');
      return;
    }
    if (navigator.onLine === false) {
      stato('#statoPlaylist', 'Serve la connessione a internet per leggere la playlist.', 'error');
      return;
    }

    importInCorso = true;
    const bottone = contenuto.querySelector('#formPlaylist button[type="submit"]');
    bottone.disabled = true;
    stato('#statoPlaylist', '⏳ Apertura della playlist…', 'info');
    try {
      await Riproduttore.attendiApi(8000);
      distruggiImport();
      const ids = await enumeraPlaylist(playlistId);
      const nomePlaylist = (await titoloOEmbed(`https://www.youtube.com/playlist?list=${playlistId}`)) || 'Playlist importata';
      let aggiunti = 0;
      let gia = 0;
      for (let i = 0; i < ids.length; i++) {
        if (!contenuto) {
          return;   // l'educatore ha cambiato area durante l'importazione
        }
        stato('#statoPlaylist', `⏳ Importazione di "${nomePlaylist}"… ${i + 1}/${ids.length}`, 'info');
        const id = ids[i];
        const link = `https://www.youtube.com/watch?v=${id}`;
        const titolo = (await titoloOEmbed(link)) || `${nomePlaylist} #${i + 1}`;
        try {
          Archivio.aggiungiYoutube({
            nome: titolo, categoria: nomePlaylist, link, video_id: id,
            playlist_id: playlistId, playlist_nome: nomePlaylist,
          });
          aggiunti++;
        } catch (e) {
          gia++;   // già presente (stesso video già in lista)
        }
      }
      distruggiImport();
      if (!contenuto) {
        return;
      }
      campo.value = '';
      const parti = [`✅ ${aggiunti} video aggiunti da "${nomePlaylist}"`];
      if (gia) {
        parti.push(`${gia} già presenti`);
      }
      stato('#statoPlaylist', parti.join(' · '), aggiunti ? 'success' : 'info');
      contenuto.querySelector('#ytCategorie').innerHTML = opzioniCategorie();
      disegnaListaYoutube();
    } catch (e) {
      distruggiImport();
      stato('#statoPlaylist', `❌ ${e.message}`, 'error');
    } finally {
      importInCorso = false;
      if (bottone) {
        bottone.disabled = false;
      }
    }
  }

  // ---------- Lista dei video ----------

  function campoTempo(v, quale, etichetta) {
    const secondi = v[quale] || 0;
    const vuoto = quale === 'fine' && !secondi;
    return `
      <label class="campo-tempo">
        <span>${etichetta}</span>
        <input type="number" min="0" max="999" inputmode="numeric" data-azione="yt-tempo" data-id="${v.id}"
          data-parte="${quale}-min" value="${vuoto ? '' : Math.floor(secondi / 60)}" placeholder="min"
          aria-label="${etichetta}: minuti" />
        <span>:</span>
        <input type="number" min="0" max="59" inputmode="numeric" data-azione="yt-tempo" data-id="${v.id}"
          data-parte="${quale}-sec" value="${vuoto ? '' : secondi % 60}" placeholder="sec"
          aria-label="${etichetta}: secondi" />
      </label>`;
  }

  // Una singola scheda video, usata sia per i video singoli sia dentro un gruppo playlist
  function cardYoutube(v) {
    const avviso = Riproduttore.erroreDefinitivo(v.errore) ? `
          <div class="avviso-video">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>Non riproducibile: ${Util.escapeHtml(Riproduttore.descriviErrore(v.errore))} Non viene proposto.</span>
            <button type="button" class="btn-secondary btn-piccolo" data-azione="yt-riprova" data-id="${v.id}">Riprova</button>
          </div>` : '';
    return `
      <div class="elemento ${v.attivo ? 'attivo' : ''}">
        <img class="miniatura" src="https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg" alt="" loading="lazy" />
        <div class="elemento-testo">
          <strong title="${Util.escapeHtml(v.nome)}">${Util.escapeHtml(v.nome)}</strong>
          <small>${Util.escapeHtml(v.categoria || 'Senza categoria')}</small>
          <label class="spunta">
            <input type="checkbox" data-azione="yt-attivo" data-id="${v.id}" ${v.attivo ? 'checked' : ''} />
            <span>Nella lista dell'utente</span>
          </label>
          <div class="tempi-riga" data-tempi-id="${v.id}">
            ${campoTempo(v, 'inizio', 'Inizio')}
            ${campoTempo(v, 'fine', 'Fine')}
            <span class="tempi-esito" role="status" aria-live="polite"></span>
          </div>
          ${avviso}
        </div>
        <div class="elemento-azioni">
          <a class="btn-icona" href="${Util.escapeHtml(v.link)}" target="_blank" rel="noopener" title="Apri su YouTube">
            <i class="bi bi-box-arrow-up-right"></i>
          </a>
          <button type="button" class="btn-icona pericolo" data-azione="yt-elimina" data-id="${v.id}" title="Elimina">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>`;
  }

  // Salva inizio e fine (minuti e secondi) del singolo video quando l'educatore li cambia
  function salvaTempiVideo(id) {
    const riga = contenuto?.querySelector(`[data-tempi-id="${id}"]`);
    if (!riga) {
      return;
    }
    const esito = riga.querySelector('.tempi-esito');
    const mostra = (testo, classe) => {
      esito.textContent = testo;
      esito.className = `tempi-esito ${classe}`;
    };
    const valore = (parte) => riga.querySelector(`[data-parte="${parte}"]`).value;
    const inizio = Util.secondiDa(valore('inizio-min'), valore('inizio-sec'));
    const fine = Util.secondiDa(valore('fine-min'), valore('fine-sec'));
    if (fine > 0 && fine <= inizio) {
      mostra('La fine deve essere dopo l\'inizio', 'errore');
      return;
    }
    Archivio.aggiornaYoutube(id, { inizio, fine });
    mostra(`✓ ${Util.formatoTempo(inizio)}${fine ? `–${Util.formatoTempo(fine)}` : ' → fine video'}`, 'ok');
  }

  function disegnaListaYoutube() {
    const lista = contenuto?.querySelector('#listaYoutube');
    if (!lista) {
      return;
    }
    const video = Archivio.getYoutube();
    if (video.length === 0) {
      lista.innerHTML = '<p class="vuoto"><i class="bi bi-youtube"></i> Nessun video archiviato su questo dispositivo.</p>';
      return;
    }
    const nellaLista = video.filter((v) => v.attivo).length;
    // I video di una stessa playlist si raggruppano sotto un'intestazione,
    // alla posizione del loro primo video
    const playlistRese = new Set();
    const blocchi = [];
    for (const v of video) {
      if (!v.playlist_id) {
        blocchi.push(cardYoutube(v));
        continue;
      }
      if (playlistRese.has(v.playlist_id)) {
        continue;
      }
      playlistRese.add(v.playlist_id);
      const membri = video.filter((x) => x.playlist_id === v.playlist_id);
      const attivi = membri.filter((m) => m.attivo).length;
      blocchi.push(`
        <div class="gruppo-playlist">
          <div class="gruppo-playlist-intestazione">
            <div class="gruppo-playlist-titolo">
              <i class="bi bi-list-ol"></i>
              <strong>Playlist: ${Util.escapeHtml(v.playlist_nome || 'Playlist')}</strong>
              <small>${attivi} nella lista su ${membri.length}</small>
            </div>
            <button type="button" class="btn-secondary btn-piccolo pericolo" data-azione="yt-elimina-playlist"
              data-playlist="${Util.escapeHtml(v.playlist_id)}">
              <i class="bi bi-trash3"></i> Elimina playlist
            </button>
          </div>
          <div class="gruppo-playlist-video">${membri.map(cardYoutube).join('')}</div>
        </div>`);
    }
    lista.innerHTML = `
      <p class="conteggio">${nellaLista} nella lista dell'utente su ${video.length} · in sequenza si segue quest'ordine</p>
      ${blocchi.join('')}
    `;
  }

  // ==================== SCHEDA SESSIONE ====================

  function schedaSessione() {
    const s = Archivio.getImpostazioni().sessione;
    const { min, max } = Archivio.LIMITI.secondi;
    const nVideo = Archivio.getYoutube().filter((v) => v.attivo && !Riproduttore.erroreDefinitivo(v.errore)).length;
    contenuto.innerHTML = `
      <h3><i class="bi bi-stopwatch"></i> Sessione</h3>
      <p class="helper-text">L'utente tocca l'oggetto e parte un video. Mentre il video scorre, ogni altro
        tocco viene ignorato. Poi l'oggetto torna in un altro punto dello schermo.</p>

      <fieldset class="gruppo-scelte">
        <legend>Durata del video</legend>
        <label class="scelta">
          <input type="radio" name="durata" value="intero" data-azione="sessione" ${s.durata === 'intero' ? 'checked' : ''} />
          <span><strong>Fino alla fine</strong>
            <small>Il video va fino alla fine (o al tempo di fine impostato). Il tocco successivo avvia il video seguente.</small></span>
        </label>
        <label class="scelta">
          <input type="radio" name="durata" value="temporizzato" data-azione="sessione" ${s.durata === 'temporizzato' ? 'checked' : ''} />
          <span><strong>Temporizzato</strong>
            <small>Dopo il tempo impostato il video va in pausa, senza chiudersi. Il tocco successivo fa
              riprendere lo stesso video da dove si era fermato. Quando il video finisce si passa al seguente.</small></span>
        </label>
        <div class="form-group secondi-temporizzato" ${s.durata === 'temporizzato' ? '' : 'hidden'}>
          <label for="sesSecondi">Secondi di video a ogni tocco</label>
          <input id="sesSecondi" type="number" min="${min}" max="${max}" inputmode="numeric"
            value="${s.secondi}" data-azione="sessione" />
        </div>
      </fieldset>

      <fieldset class="gruppo-scelte">
        <legend>Ordine dei video</legend>
        <label class="scelta">
          <input type="radio" name="ordine" value="sequenza" data-azione="sessione" ${s.ordine === 'sequenza' ? 'checked' : ''} />
          <span><strong>In sequenza</strong><small>Nell'ordine della lista (scheda YouTube), poi si ricomincia.</small></span>
        </label>
        <label class="scelta">
          <input type="radio" name="ordine" value="random" data-azione="sessione" ${s.ordine === 'random' ? 'checked' : ''} />
          <span><strong>Random</strong><small>A caso: nessun video si ripete finché non sono usciti tutti.</small></span>
        </label>
      </fieldset>

      <div id="statoSessione" class="status-message" role="status" aria-live="polite"></div>
      <p class="riepilogo-sessione ${nVideo ? '' : 'manca'}">
        <i class="bi ${nVideo ? 'bi-check-circle' : 'bi-exclamation-circle'}"></i>
        ${nVideo ? `${nVideo} video nella lista dell'utente.` : 'Nessun video nella lista: aggiungili nella scheda YouTube.'}
      </p>
    `;
  }

  function salvaSessione() {
    const valore = (nome) => contenuto.querySelector(`input[name="${nome}"]:checked`)?.value;
    const campoSecondi = contenuto.querySelector('#sesSecondi');
    const durata = valore('durata');
    const imp = Archivio.salvaImpostazioni({
      sessione: { durata, ordine: valore('ordine'), secondi: Number(campoSecondi.value) },
    });
    campoSecondi.value = imp.sessione.secondi;   // riportato nei limiti
    contenuto.querySelector('.secondi-temporizzato').hidden = durata !== 'temporizzato';
    stato('#statoSessione', '✅ Salvato.', 'success');
  }

  // ==================== EVENTI (delegati) ====================

  function gestisciClick(e) {
    const btn = e.target.closest('[data-azione]');
    if (!btn || btn.tagName === 'INPUT') {
      return;
    }
    const azione = btn.dataset.azione;
    const id = Number(btn.dataset.id);

    if (azione === 'aggiungi-arasaac') {
      aggiungiArasaac(id, btn.dataset.nome);
    } else if (azione === 'oggetto-elimina') {
      const oggetto = Archivio.getOggetti().find((o) => o.id === id);
      if (oggetto && confirm(`Eliminare l'oggetto "${oggetto.nome}"?\n\nNon si può annullare.`)) {
        Archivio.eliminaOggetto(id).then(disegnaOggetti);
      }
    } else if (azione === 'oggetto-ritaglia') {
      ritagliaOggetto(id);
    } else if (azione === 'licenza-arasaac') {
      App.apriFinestra('arasaacModal');
    } else if (azione === 'yt-riprova') {
      Archivio.aggiornaYoutube(id, { errore: null });
      disegnaListaYoutube();
    } else if (azione === 'yt-elimina') {
      const video = Archivio.getYoutube().find((v) => v.id === id);
      if (video && confirm(`Eliminare il video "${video.nome}"?\n\nNon si può annullare.`)) {
        Archivio.eliminaYoutube(id);
        disegnaListaYoutube();
      }
    } else if (azione === 'yt-elimina-playlist') {
      const playlistId = btn.dataset.playlist;
      const membri = Archivio.getYoutube().filter((v) => v.playlist_id === playlistId);
      const nome = membri[0]?.playlist_nome || 'questa playlist';
      if (membri.length && confirm(`Eliminare tutti i ${membri.length} video della playlist "${nome}"?\n\nNon si può annullare.`)) {
        Archivio.eliminaYoutubePlaylist(playlistId);
        disegnaListaYoutube();
      }
    }
  }

  function gestisciCambio(e) {
    const input = e.target.closest('[data-azione]');
    if (!input) {
      return;
    }
    const azione = input.dataset.azione;
    const id = Number(input.dataset.id);
    if (azione === 'yt-attivo') {
      Archivio.aggiornaYoutube(id, { attivo: input.checked });
      disegnaListaYoutube();
    } else if (azione === 'yt-tempo') {
      salvaTempiVideo(id);
    } else if (azione === 'modo-oggetti') {
      Archivio.salvaImpostazioni({ scena: { modo: input.value } });
      disegnaOggetti();
    } else if (azione === 'oggetto-scelto') {
      Archivio.salvaImpostazioni({ scena: { scelto: id } });
      disegnaOggetti();
    } else if (azione === 'oggetto-attivo') {
      Archivio.aggiornaOggetto(id, { attivo: input.checked });
      disegnaOggetti();
    } else if (azione === 'oggetto-categoria') {
      const oggetto = Archivio.getOggetti().find((o) => o.id === id);
      if (oggetto) {
        const categoria = input.dataset.categoria;
        const altre = oggetto.categorie.filter((c) => c !== categoria);
        Archivio.aggiornaOggetto(id, { categorie: input.checked ? [...altre, categoria] : altre });
        disegnaCollegamenti();
      }
    } else if (azione === 'sessione') {
      salvaSessione();
    }
  }

  return { apri, chiudi, mostraScheda };
})();
