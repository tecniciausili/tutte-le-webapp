// ==================== AREA UTENTE ====================
// Lo schermo mostra solo lo sfondo e l'oggetto. Il tocco sull'oggetto avvia un
// video YouTube; mentre il video scorre ogni altro tocco viene ignorato. Poi:
//   - "fino alla fine": a fine video (o al tempo di fine) l'oggetto torna in un
//     altro punto e il tocco successivo avvia il video seguente;
//   - "temporizzato": dopo N secondi il video va in pausa (non si chiude) e
//     l'oggetto torna in un altro punto; il tocco successivo fa riprendere lo
//     stesso video. Quando il video finisce si passa al seguente.
// L'ordine dei video è "in sequenza" (quello della lista) o "random".
//
// Ogni oggetto fa partire solo i video delle sue categorie (tutti, se non ne ha).
// Un video interrotto (temporizzato, o ESC) riprende da dove era rimasto la
// prossima volta che compare un oggetto che lo può far partire.
//
// Fasi: 'messaggio' (avvio, avvisi) → 'sblocco' (solo iPad, una volta) →
//       'oggetto' ⇄ 'video'
//
// Fuori dalla fase 'messaggio' lo schermo è bloccato (vedi BLOCCO DELLO SCHERMO):
// vale solo il tocco sull'oggetto, più SPAZIO e INVIO. L'educatore esce con ESC.

const Utente = (() => {
  const ID_PLAYER = 'palcoYoutube';
  const RIENTRO_MS = 400;       // appena ricompare l'oggetto, i tocchi sono ignorati per un attimo
  const ATTESA_AVVIO_MS = Riproduttore.IOS ? 2500 : 5000;
  const MARGINE = 16;           // distanza minima dell'oggetto dai bordi
  const FASCIA_COMANDI = 64;    // in alto a sinistra ci sono i pulsanti dell'educatore

  let el = null;
  let fase = 'messaggio';
  let corrente = null;          // { video, pausato, partito }: il video nel player
  let prossimo = null;          // { video, tempo, pronto }: preparato muto mentre si vede l'oggetto
  let sospesi = [];             // [{ video, tempo }]: interrotti, riprendono col prossimo oggetto adatto
  const giri = new Map();       // ordine dei video: un giro per ogni gruppo di categorie
  let ordineGiro = null;
  let inScena = null;           // { oggetto, url }: l'oggetto mostrato ora
  let tentativi = 0;            // video saltati di fila perché non riproducibili
  let timerDurata = null;
  let timerAvvio = null;
  let monitorFine = null;
  let comparsa = 0;
  let posizionatore = null;     // posizione e movimento dell'oggetto (Oggetto.creaPosizionatore)
  let oggettiPronti = [];       // [{oggetto, url}] in scena, con l'immagine già caricata
  const giroOggetti = Util.creaGiro((p) => p.oggetto.id);
  let fineSblocco = null;       // risolve l'attesa del primo tocco sul video (iPad)
  let videoSblocco = null;      // il video da toccare per lo sblocco
  let osservatore = null;
  let bloccoAttivo = false;

  // ==================== STRUTTURA ====================

  function apri(contenitore) {
    contenitore.innerHTML = `
      <div class="utente">
        <div class="palco" id="palco" tabindex="-1">
          <div class="palco-video"><div id="${ID_PLAYER}"></div></div>
          <div class="palco-scena" id="palcoScena">
            <div class="area-centrale" id="palcoArea" hidden></div>
            <div class="oggetto" id="oggetto" hidden><img alt="Oggetto da toccare" draggable="false" /></div>
          </div>
          <div class="palco-velo" id="palcoVelo"></div>
          <div class="palco-messaggio" id="palcoMessaggio" hidden>
            <i class="bi palco-messaggio-icona" aria-hidden="true"></i>
            <h2 class="palco-messaggio-titolo"></h2>
            <p class="palco-messaggio-testo"></p>
            <div class="palco-messaggio-azioni"></div>
          </div>
          <div class="palco-avviso" id="palcoAvviso" hidden>
            <i class="bi bi-hand-index-thumb"></i> <span></span>
          </div>
          <div class="palco-comandi">
            <button type="button" class="palco-pulsante" data-comando="schermo-intero"
              title="Schermo intero" aria-label="Schermo intero"><i class="bi bi-fullscreen"></i></button>
            <button type="button" class="palco-pulsante" data-comando="opzioni"
              title="Dimensione e sfondo" aria-label="Dimensione e sfondo"><i class="bi bi-sliders"></i></button>
          </div>
          <aside class="pannello-opzioni" id="pannelloOpzioni" aria-label="Dimensione e sfondo">
            <div class="pannello-opzioni-intestazione">
              <h3><i class="bi bi-sliders"></i> Dimensione e sfondo</h3>
              <button type="button" class="btn-icona" data-comando="chiudi-opzioni" aria-label="Chiudi"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="pannello-opzioni-controlli">${Oggetto.htmlControlliAspetto(Archivio.getImpostazioni().aspetto)}</div>
            <div class="pannello-opzioni-azioni">
              <button type="button" class="btn-secondary" data-comando="ricomincia"><i class="bi bi-arrow-counterclockwise"></i> Ricomincia</button>
              <button type="button" class="btn-secondary" data-comando="educatore"><i class="bi bi-person-workspace"></i> Area Educatore</button>
            </div>
          </aside>
        </div>
      </div>
    `;

    el = {
      palco: contenitore.querySelector('#palco'),
      scena: contenitore.querySelector('#palcoScena'),
      oggetto: contenitore.querySelector('#oggetto'),
      img: contenitore.querySelector('#oggetto img'),
      velo: contenitore.querySelector('#palcoVelo'),
      messaggio: contenitore.querySelector('#palcoMessaggio'),
      avviso: contenitore.querySelector('#palcoAvviso'),
      avvisoTesto: contenitore.querySelector('#palcoAvviso span'),
      opzioni: contenitore.querySelector('#pannelloOpzioni'),
      schermoIntero: contenitore.querySelector('[data-comando="schermo-intero"]'),
    };

    posizionatore = Oggetto.creaPosizionatore(el.scena, el.oggetto, {
      elArea: contenitore.querySelector('#palcoArea'),
      margine: MARGINE,
      fasciaAlta: FASCIA_COMANDI,
    });

    if (!Riproduttore.schermoInteroDisponibile()) {
      el.schermoIntero.hidden = true;   // iPhone e app già a tutto schermo
    }

    el.palco.addEventListener('click', alClick);
    el.palco.addEventListener('contextmenu', (e) => e.preventDefault());
    el.img.addEventListener('error', () => {
      if (fase === 'oggetto') {
        mostraMessaggio({
          icona: 'bi-wifi-off',
          titolo: 'L\'immagine dell\'oggetto non si carica',
          testo: 'Controlla la connessione a internet: i pittogrammi ARASAAC arrivano dal loro server.',
          azioni: [['inizia', 'bi-play-fill', 'Riprova'], ['educatore', 'bi-person-workspace', 'Area Educatore']],
        });
      }
    });
    document.addEventListener('fullscreenchange', alCambioSchermoIntero);
    document.addEventListener('webkitfullscreenchange', alCambioSchermoIntero);

    Oggetto.collegaControlli(el.opzioni, () => aggiornaAspetto());
    osservatore = new ResizeObserver(() => aggiornaAspetto());
    osservatore.observe(el.palco);

    applicaSfondo();
    mostraPronto();
    // Le immagini si caricano subito: servono anche al pannello Dimensione e sfondo
    preparaOggetti();
  }

  // Carica in anticipo le immagini degli oggetti in scena (uno solo, oppure quelli
  // che compaiono a caso) e mostra il primo
  async function preparaOggetti() {
    const inScena = Archivio.oggettiInScena();
    const pronti = await Oggetto.precarica(inScena);
    if (!el) {
      return { inScena: 0, pronti: 0 };
    }
    if (pronti.length < inScena.length) {
      console.warn(`Oggetti: ${inScena.length - pronti.length} immagini non si caricano e restano fuori`);
    }
    oggettiPronti = pronti;
    giroOggetti.ricomincia();
    cambiaOggetto();
    return { inScena: inScena.length, pronti: pronti.length };
  }

  // Oggetto successivo: a caso, senza ripetizioni finché non sono usciti tutti
  // (e mai lo stesso due volte di fila). Con un solo oggetto resta quello.
  // Restano fuori gli oggetti che non hanno video da far partire.
  function cambiaOggetto() {
    const conVideo = oggettiPronti.filter((p) => videoPer(p.oggetto).length);
    const scelta = giroOggetti.prossimo(conVideo.length ? conVideo : oggettiPronti, Util.mescola);
    if (scelta) {
      inScena = scelta;
      Oggetto.mostraIn(el.img, scelta.oggetto, scelta.url);
    }
  }

  function chiudi() {
    disattivaBlocco();
    fermaSessione();
    Riproduttore.distruggi();
    Riproduttore.schermoAcceso(false);
    document.removeEventListener('fullscreenchange', alCambioSchermoIntero);
    document.removeEventListener('webkitfullscreenchange', alCambioSchermoIntero);
    if (Riproduttore.elementoSchermoIntero()) {
      Riproduttore.alternaSchermoIntero(el?.palco);
    }
    osservatore?.disconnect();
    osservatore = null;
    sospesi = [];
    inScena = null;
    posizionatore?.ferma();
    posizionatore = null;
    document.body.style.removeProperty('--sfondo-utente');
    el = null;
  }

  // ==================== MESSAGGI (avvio e avvisi per l'educatore) ====================

  function mostraMessaggio({ icona, titolo, testo = '', azioni = [], attesa = false }) {
    if (!el) {
      return;
    }
    fermaControlli();
    fase = 'messaggio';
    impostaVista('messaggio');
    el.messaggio.querySelector('.palco-messaggio-icona').className = `bi ${icona} palco-messaggio-icona${attesa ? ' gira' : ''}`;
    el.messaggio.querySelector('.palco-messaggio-titolo').textContent = titolo;
    el.messaggio.querySelector('.palco-messaggio-testo').textContent = testo;
    el.messaggio.querySelector('.palco-messaggio-azioni').innerHTML = azioni.map(([comando, ic, etichetta], i) => `
      <button type="button" class="${i === 0 ? 'btn-primary' : 'btn-secondary'}" data-comando="${comando}">
        <i class="bi ${ic}"></i> ${etichetta}
      </button>`).join('');
    el.messaggio.hidden = false;
    el.messaggio.querySelector('button')?.focus();
  }

  function mostraPronto() {
    const video = videoDisponibili();
    const s = Archivio.getImpostazioni().sessione;
    const durata = s.durata === 'temporizzato' ? `temporizzato ${s.secondi} s` : 'video fino alla fine';
    const ordine = s.ordine === 'random' ? 'random' : 'in sequenza';
    const nOggetti = Archivio.oggettiInScena().length;
    const oggetti = nOggetti > 1 ? `${nOggetti} oggetti a caso` : `${nOggetti} oggetto`;
    mostraMessaggio({
      icona: 'bi-hand-index-thumb',
      titolo: 'Pronto',
      testo: `${oggetti} · ${video.length} video nella lista · ${durata} · ${ordine}. `
        + 'Premi Inizia: comparirà l\'oggetto da toccare. '
        + 'Durante l\'attività lo schermo è bloccato: per fermarla premi ESC.',
      azioni: [['inizia', 'bi-play-fill', 'Inizia'], ['educatore', 'bi-person-workspace', 'Area Educatore']],
    });
  }

  // Quale strato si vede: 'messaggio' | 'sblocco' | 'oggetto' | 'video'
  function impostaVista(vista) {
    el.palco.dataset.vista = vista;
    // Con un messaggio a schermo l'educatore deve poter usare pulsanti e menu
    if (vista === 'messaggio') {
      disattivaBlocco();
    } else {
      attivaBlocco();
    }
    el.oggetto.hidden = vista !== 'oggetto';
    // L'oggetto in movimento si muove solo quando si vede
    if (vista === 'oggetto') {
      posizionatore.avvia();
    } else {
      posizionatore.ferma();
    }
    el.messaggio.hidden = vista !== 'messaggio';
    if (vista !== 'sblocco' && vista !== 'video') {
      nascondiAvviso();
    }
  }

  // Chiede di toccare il video: il velo lascia passare il tocco al player
  // (su iPad è l'unico modo per far partire YouTube la prima volta)
  function mostraAvviso(testo) {
    el.avvisoTesto.textContent = testo;
    el.avviso.hidden = false;
    el.palco.classList.add('attende-tocco-video');
  }

  function nascondiAvviso() {
    if (!el) {
      return;
    }
    el.avviso.hidden = true;
    el.palco.classList.remove('attende-tocco-video');
  }

  // ==================== AVVIO DELLA SESSIONE ====================

  function videoDisponibili() {
    return Archivio.getYoutube().filter((v) => v.attivo && !Riproduttore.erroreDefinitivo(v.errore));
  }

  // I video che l'oggetto può far partire: quelli delle sue categorie (tutti se non ne ha)
  function videoPer(oggetto) {
    return oggetto ? Archivio.videoDellOggetto(oggetto, videoDisponibili()) : [];
  }

  async function inizia() {
    chiudiOpzioni();
    // Schermo intero subito, finché vale il clic su «Inizia»: così barra delle
    // applicazioni e schede del browser non si possono toccare
    if (Riproduttore.schermoInteroDisponibile() && !Riproduttore.elementoSchermoIntero()) {
      Riproduttore.alternaSchermoIntero(el.palco);
    }
    mostraMessaggio({ icona: 'bi-arrow-repeat', titolo: 'Preparazione degli oggetti…', attesa: true });
    const oggetti = await preparaOggetti();
    if (!el) {
      return;
    }
    if (!oggetti.inScena) {
      const random = Archivio.getImpostazioni().scena.modo === 'random';
      mostraMessaggio({
        icona: 'bi-image',
        titolo: random ? 'Nessun oggetto in scena' : 'Manca l\'oggetto da toccare',
        testo: random
          ? 'Nell\'Area Educatore, scheda Oggetti, metti la spunta «In scena» ad almeno un oggetto.'
          : 'Sceglilo nell\'Area Educatore, scheda Oggetti: un pittogramma ARASAAC o un\'immagine.',
        azioni: [['educatore', 'bi-person-workspace', 'Area Educatore']],
      });
      return;
    }
    if (!oggetti.pronti) {
      mostraMessaggio({
        icona: 'bi-wifi-off',
        titolo: 'Le immagini degli oggetti non si caricano',
        testo: 'Controlla la connessione a internet: i pittogrammi ARASAAC arrivano dal loro server.',
        azioni: [['inizia', 'bi-arrow-repeat', 'Riprova'], ['educatore', 'bi-person-workspace', 'Area Educatore']],
      });
      return;
    }
    const video = videoDisponibili();
    if (!video.length) {
      mostraMessaggio({
        icona: 'bi-youtube',
        titolo: 'Nessun video nella lista',
        testo: 'Aggiungi i video nell\'Area Educatore, scheda YouTube, e lascia la spunta «Nella lista».',
        azioni: [['educatore', 'bi-person-workspace', 'Area Educatore']],
      });
      return;
    }
    if (!oggettiPronti.some((p) => videoPer(p.oggetto).length)) {
      mostraMessaggio({
        icona: 'bi-link-45deg',
        titolo: 'Nessun oggetto ha video da far partire',
        testo: 'Le categorie collegate agli oggetti non hanno video nella lista. '
          + 'Controllale nell\'Area Educatore, scheda Oggetti, «Quali video fa partire ogni oggetto».',
        azioni: [['educatore', 'bi-person-workspace', 'Area Educatore']],
      });
      return;
    }
    if (navigator.onLine === false) {
      mostraMessaggio({
        icona: 'bi-wifi-off',
        titolo: 'Manca la connessione a internet',
        testo: 'I video arrivano da YouTube: senza rete non possono partire.',
        azioni: [['inizia', 'bi-arrow-repeat', 'Riprova']],
      });
      return;
    }

    mostraMessaggio({ icona: 'bi-arrow-repeat', titolo: 'Preparazione di YouTube…', attesa: true });
    try {
      await Riproduttore.prepara(ID_PLAYER, video[0].video_id);
    } catch (e) {
      mostraMessaggio({
        icona: 'bi-wifi-off',
        titolo: 'YouTube non risponde',
        testo: e.message,
        azioni: [['inizia', 'bi-arrow-repeat', 'Riprova']],
      });
      return;
    }
    if (!el) {
      return;
    }
    Riproduttore.ascolta(alEventoPlayer);
    Riproduttore.schermoAcceso(true);
    corrente = null;
    prossimo = null;
    tentativi = 0;

    if (!Riproduttore.eSbloccato()) {
      const ok = await sblocca(video[0]);
      if (!ok || !el) {
        return;
      }
    }
    mostraOggetto();
  }

  // iPad: la prima volta il video va toccato direttamente. Poi i video partono da soli.
  function sblocca(primoVideo) {
    fase = 'sblocco';
    impostaVista('sblocco');
    mostraAvviso('Educatore: tocca il video una volta per abilitare YouTube');
    return new Promise((resolve) => {
      videoSblocco = primoVideo;
      fineSblocco = (esito) => {
        fineSblocco = null;
        videoSblocco = null;
        nascondiAvviso();
        resolve(esito);
      };
    });
  }

  function fermaSessione() {
    fermaControlli();
    fineSblocco?.(false);
    Riproduttore.ascolta(null);
    Riproduttore.pausa();
    corrente = null;
    prossimo = null;
  }

  function ricomincia() {
    chiudiOpzioni();
    fermaSessione();
    sospesi = [];
    giri.clear();
    Riproduttore.schermoAcceso(false);
    mostraPronto();
  }

  // ==================== OGGETTO ====================

  function mostraOggetto() {
    if (!el) {
      return;
    }
    fermaControlli();
    fase = 'oggetto';
    // Con più oggetti ne compare un altro; si cambia anche quando quello in scena
    // non ha più video (per esempio tutti rifiutati da YouTube)
    if (oggettiPronti.length > 1 || !videoPer(inScena?.oggetto).length) {
      cambiaOggetto();
    }
    if (!videoPer(inScena?.oggetto).length) {
      nessunVideo();
      return;
    }
    impostaVista('oggetto');
    aggiornaAspetto({ sposta: true });
    comparsa = performance.now();
    // Nel player resta solo un video che il nuovo oggetto può far partire:
    // gli altri si mettono da parte con il punto in cui erano arrivati
    if (corrente?.pausato && !Archivio.videoAdatto(inScena.oggetto, corrente.video)) {
      sospesi.push({ video: corrente.video, tempo: Riproduttore.tempo() });
      corrente = null;
    }
    if (prossimo && !Archivio.videoAdatto(inScena.oggetto, prossimo.video)) {
      sospesi.push({ video: prossimo.video, tempo: prossimo.tempo });
      prossimo = null;
    }
    if (!corrente) {
      preparaProssimo();
    }
  }

  function applicaSfondo() {
    const aspetto = Archivio.getImpostazioni().aspetto;
    el.palco.style.backgroundColor = aspetto.sfondo;
    el.scena.style.backgroundColor = aspetto.sfondo;
    document.body.style.setProperty('--sfondo-utente', aspetto.sfondo);
  }

  // Dimensione, sfondo, area e movimento. Con sposta: nuova posizione casuale,
  // lontana dalla precedente; altrimenti l'oggetto resta dov'è (se ci sta ancora).
  function aggiornaAspetto({ sposta = false } = {}) {
    if (!el) {
      return;
    }
    applicaSfondo();
    posizionatore.aggiorna({ sposta });
  }

  // ==================== BLOCCO DELLO SCHERMO ====================
  // L'utente colpisce l'oggetto con tutta la mano: il palmo e le altre dita toccano
  // lo schermo insieme. Durante l'attività l'unico segnale che conta è il contatto
  // sull'oggetto (più SPAZIO e INVIO); tutto il resto si ferma qui, prima di arrivare
  // alla pagina o al browser: pizzico con due dita (zoom), tasto destro e centrale,
  // rotella, tocco lungo, trascinamenti, selezione, scorciatoie da tastiera.
  // La barra in alto e i pulsanti spariscono. ESC ferma l'attività.
  // I gesti del sistema operativo (swipe dai bordi dello schermo, gesti a tre o
  // quattro dita) non arrivano alla pagina: vanno disattivati nelle impostazioni
  // del dispositivo.
  const EVENTI_BLOCCATI = [
    'click', 'dblclick', 'auxclick', 'contextmenu', 'mousedown', 'mouseup',
    'touchstart', 'touchmove', 'touchend', 'wheel', 'selectstart', 'dragstart',
    'gesturestart', 'gesturechange', 'gestureend', 'keyup', 'keypress',
  ];
  // passive: false serve a poter annullare tocchi e rotella (lo zoom)
  const ASCOLTO = { capture: true, passive: false };

  function attivaBlocco() {
    if (bloccoAttivo) {
      return;
    }
    bloccoAttivo = true;
    document.documentElement.classList.add('blocco-attivo');
    window.addEventListener('pointerdown', alPointerDown, ASCOLTO);
    window.addEventListener('keydown', alTasto, ASCOLTO);
    EVENTI_BLOCCATI.forEach((tipo) => window.addEventListener(tipo, blocca, ASCOLTO));
    // La tastiera deve arrivare alla pagina (ESC, SPAZIO, INVIO), non a un pulsante
    el.palco.focus({ preventScroll: true });
  }

  function disattivaBlocco() {
    if (!bloccoAttivo) {
      return;
    }
    bloccoAttivo = false;
    document.documentElement.classList.remove('blocco-attivo');
    window.removeEventListener('pointerdown', alPointerDown, ASCOLTO);
    window.removeEventListener('keydown', alTasto, ASCOLTO);
    EVENTI_BLOCCATI.forEach((tipo) => window.removeEventListener(tipo, blocca, ASCOLTO));
  }

  function blocca(e) {
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();
  }

  // Vale ogni contatto che cade sull'oggetto, anche se non è il primo: spesso il
  // palmo arriva sullo schermo un attimo prima delle dita. Col mouse solo il tasto sinistro.
  function alPointerDown(e) {
    blocca(e);
    if (e.button === 0 && e.target.closest?.('.oggetto')) {
      toccoOggetto();   // durante il video o appena ricompare l'oggetto non fa nulla
    }
  }

  // SPAZIO e INVIO valgono come tocco (switch USB o Bluetooth, Makey Makey).
  // Ogni altro tasto è ignorato (anche Ctrl + e Ctrl - dello zoom), tranne ESC.
  function alTasto(e) {
    blocca(e);
    if (e.repeat) {
      return;
    }
    if (e.key === 'Escape') {
      sospendi();
    } else if (e.key === ' ' || e.key === 'Enter') {
      toccoOggetto();
    }
  }

  // ESC: l'educatore ferma l'attività. Con «Continua» il video interrotto (o quello
  // già pronto) riprende da dove era rimasto; con «Ricomincia» si parte dal primo.
  function sospendi() {
    if (!bloccoAttivo) {
      return;
    }
    const daRiprendere = [];
    if (corrente) {
      daRiprendere.push({ video: corrente.video, tempo: Math.max(Riproduttore.tempo(), corrente.video.inizio || 0) });
    }
    if (prossimo) {
      daRiprendere.push({ video: prossimo.video, tempo: prossimo.tempo });
    }
    sospesi.unshift(...daRiprendere);
    fermaSessione();
    Riproduttore.schermoAcceso(false);
    mostraMessaggio({
      icona: 'bi-pause-circle',
      titolo: 'Attività ferma',
      testo: 'Premi Continua per far ricomparire l\'oggetto.',
      azioni: [
        ['inizia', 'bi-play-fill', 'Continua'],
        ['ricomincia', 'bi-arrow-counterclockwise', 'Ricomincia'],
        ['educatore', 'bi-person-workspace', 'Area Educatore'],
      ],
    });
  }

  // A schermo intero ESC lo fa chiudere al browser, che spesso non passa il tasto
  // alla pagina: l'uscita dallo schermo intero vale come ESC
  function alCambioSchermoIntero() {
    aggiornaIconaSchermoIntero();
    if (!Riproduttore.elementoSchermoIntero()) {
      sospendi();
    }
  }

  // ==================== TOCCO ====================

  function alClick(e) {
    const btn = e.target.closest('[data-comando]');
    if (!btn) {
      return;
    }
    const azioni = {
      inizia,
      ricomincia,
      educatore: () => App.mostraEducatore(),
      'schermo-intero': () => Riproduttore.alternaSchermoIntero(el.palco),
      opzioni: () => alternaOpzioni(),
      'chiudi-opzioni': () => chiudiOpzioni(),
    };
    azioni[btn.dataset.comando]?.();
  }

  function toccoOggetto() {
    if (fase !== 'oggetto' || performance.now() - comparsa < RIENTRO_MS) {
      return;
    }
    if (corrente?.pausato) {
      riprendiVideo();
    } else {
      avviaNuovoVideo();
    }
  }

  // ==================== VIDEO ====================

  // Il prossimo video delle categorie dell'oggetto, nell'ordine scelto. Ogni gruppo
  // di categorie ha il suo giro: in sequenza, ogni oggetto prosegue dal suo punto.
  function scegliVideo(oggetto) {
    const ordine = Archivio.getImpostazioni().sessione.ordine;
    if (ordine !== ordineGiro) {
      giri.clear();
      ordineGiro = ordine;
    }
    const chiave = [...oggetto.categorie].sort().join('\n');   // '' = tutti i video
    if (!giri.has(chiave)) {
      giri.set(chiave, Util.creaGiro((v) => v.id));
    }
    const casuale = ordine === 'random';
    return giri.get(chiave).prossimo(videoPer(oggetto), casuale ? Util.mescola : (x) => x, { seguiOrdine: !casuale });
  }

  // Cosa parte toccando l'oggetto: prima un video interrotto che l'oggetto può far
  // riprendere (dal punto in cui era rimasto), altrimenti il prossimo delle sue categorie
  function videoDaTocco(oggetto) {
    const ammessi = new Set(videoPer(oggetto).map((v) => v.id));
    const i = sospesi.findIndex((s) => ammessi.has(s.video.id));
    if (i >= 0) {
      return sospesi.splice(i, 1)[0];
    }
    const video = scegliVideo(oggetto);
    return video ? { video, tempo: video.inizio || 0 } : null;
  }

  // Mentre si vede l'oggetto il prossimo video si carica muto e si ferma subito:
  // al tocco parte senza attese, e se YouTube lo rifiuta lo si sa prima.
  function preparaProssimo() {
    if (prossimo || corrente || !inScena || !Riproduttore.eSbloccato()) {
      return;
    }
    const scelta = videoDaTocco(inScena.oggetto);
    if (!scelta) {
      return;
    }
    prossimo = { ...scelta, pronto: false };
    Riproduttore.carica(scelta.video, { muto: true, da: scelta.tempo });
  }

  function avviaNuovoVideo() {
    const pronto = prossimo;
    prossimo = null;
    const scelta = pronto || videoDaTocco(inScena.oggetto);
    if (!scelta) {
      mostraOggetto();   // l'oggetto non ha più video: ne compare un altro, o l'avviso
      return;
    }
    const { video, tempo } = scelta;
    corrente = { video, pausato: false, partito: false };
    fase = 'video';
    impostaVista('video');
    if (pronto) {
      // Già caricato (o in caricamento): basta farlo partire, con l'audio
      if (pronto.pronto) {
        Riproduttore.vaiA(tempo);
      }
      Riproduttore.muto(false);
      Riproduttore.play();
    } else {
      Riproduttore.carica(video, { da: tempo });
    }
    avviaControlli();
  }

  function riprendiVideo() {
    corrente.pausato = false;
    corrente.partito = false;
    fase = 'video';
    impostaVista('video');
    Riproduttore.muto(false);
    Riproduttore.play();
    avviaControlli();
  }

  function avviaControlli() {
    fermaControlli();
    const video = corrente.video;
    if (video.fine > 0) {
      monitorFine = setInterval(() => {
        if (fase === 'video' && Riproduttore.tempo() >= video.fine - 0.2) {
          fineVideo();
        }
      }, 250);
    }
    // Se il video non parte (autoplay bloccato, tipico su iPad), si chiede di toccarlo
    timerAvvio = setTimeout(() => {
      if (fase === 'video' && corrente && !corrente.partito) {
        mostraAvviso('Tocca il video per avviarlo');
      }
    }, ATTESA_AVVIO_MS);
  }

  function fermaControlli() {
    clearTimeout(timerDurata);
    clearTimeout(timerAvvio);
    clearInterval(monitorFine);
    timerDurata = null;
    timerAvvio = null;
    monitorFine = null;
  }

  // Temporizzato: il video si ferma ma resta caricato, pronto a riprendere
  function pausaTemporizzata() {
    if (fase !== 'video' || !corrente) {
      return;
    }
    Riproduttore.pausa();
    corrente.pausato = true;
    mostraOggetto();
  }

  function fineVideo() {
    if (fase !== 'video') {
      return;
    }
    Riproduttore.pausa();
    corrente = null;
    tentativi = 0;
    mostraOggetto();
  }

  function nessunVideo() {
    fermaSessione();
    mostraMessaggio({
      icona: 'bi-exclamation-triangle',
      titolo: 'Nessun video riproducibile',
      testo: 'I video della lista non si possono vedere fuori da YouTube. Controlla la scheda YouTube nell\'Area Educatore.',
      azioni: [['educatore', 'bi-person-workspace', 'Area Educatore'], ['ricomincia', 'bi-arrow-counterclockwise', 'Ricomincia']],
    });
  }

  // Video rifiutato da YouTube: resta segnato nella lista dell'educatore
  // e non viene più proposto finché non si preme «Riprova»
  function segnaErrore(video, codice) {
    console.warn(`YouTube: errore ${codice} sul video "${video.nome}" (${video.video_id})`);
    if (Riproduttore.erroreDefinitivo(codice)) {
      Archivio.aggiornaYoutube(video.id, { errore: codice });
    }
    tentativi++;
    return tentativi <= Archivio.getYoutube().length;
  }

  function erroreOrigine(codice) {
    if (codice !== 153) {
      return false;
    }
    fermaSessione();
    mostraMessaggio({
      icona: 'bi-exclamation-triangle',
      titolo: 'YouTube rifiuta l\'app',
      testo: Riproduttore.descriviErrore(153),
      azioni: [['ricomincia', 'bi-arrow-counterclockwise', 'Ricomincia']],
    });
    return true;
  }

  function alEventoPlayer(tipo, dato) {
    if (!el) {
      return;
    }
    const { STATI } = Riproduttore;

    if (fase === 'sblocco' && fineSblocco) {
      if (tipo === 'stato' && dato === STATI.IN_CORSO) {
        Riproduttore.pausa();
        fineSblocco(true);
      } else if (tipo === 'errore' && !erroreOrigine(dato)) {
        // Il primo video non va: si propone il successivo da toccare
        const rifiutato = videoSblocco;
        if (segnaErrore(rifiutato, dato)) {
          const altro = videoDisponibili().find((v) => v.id !== rifiutato.id);
          if (altro) {
            videoSblocco = altro;
            Riproduttore.carica(altro);
            return;
          }
        }
        fineSblocco(false);
        nessunVideo();
      }
      return;
    }

    if (fase === 'oggetto' && prossimo) {
      // Preparazione del prossimo video, nascosto e muto
      if (tipo === 'stato' && dato === STATI.IN_CORSO && !prossimo.pronto) {
        Riproduttore.pausa();
        Riproduttore.vaiA(prossimo.tempo);
        prossimo.pronto = true;
      } else if (tipo === 'errore' && !erroreOrigine(dato)) {
        const rifiutato = prossimo.video;
        prossimo = null;
        if (segnaErrore(rifiutato, dato)) {
          preparaProssimo();
        }
      }
      return;
    }

    if (fase !== 'video' || !corrente) {
      return;
    }
    if (tipo === 'errore') {
      if (erroreOrigine(dato)) {
        return;
      }
      // L'utente ha già toccato: si passa subito a un altro video
      const rifiutato = corrente.video;
      corrente = null;
      fermaControlli();
      if (segnaErrore(rifiutato, dato)) {
        avviaNuovoVideo();
      } else {
        nessunVideo();
      }
      return;
    }
    if (dato === STATI.IN_CORSO) {
      corrente.partito = true;
      nascondiAvviso();
      clearTimeout(timerAvvio);
      const s = Archivio.getImpostazioni().sessione;
      if (s.durata === 'temporizzato' && !timerDurata) {
        timerDurata = setTimeout(pausaTemporizzata, s.secondi * 1000);
      }
    } else if (dato === STATI.FINITO) {
      fineVideo();
    }
  }

  // ==================== PANNELLO DIMENSIONE E SFONDO ====================

  function alternaOpzioni(forza) {
    if (!el) {
      return;
    }
    const apri = typeof forza === 'boolean' ? forza : !el.opzioni.classList.contains('aperto');
    el.opzioni.classList.toggle('aperto', apri);
    // Mentre il pannello è aperto si vede il bordo dell'area centrale
    el.palco.classList.toggle('regolazione', apri);
    // Prima di iniziare, mentre l'educatore regola, al posto del messaggio si vede l'oggetto
    if (fase === 'messaggio') {
      el.messaggio.hidden = apri;
      el.oggetto.hidden = !apri || !el.img.getAttribute('src');
      aggiornaAspetto();
      if (apri) {
        posizionatore.avvia();
      } else {
        posizionatore.ferma();
      }
    }
  }

  function chiudiOpzioni() {
    alternaOpzioni(false);
  }

  function aggiornaIconaSchermoIntero() {
    const icona = el?.schermoIntero.querySelector('i');
    if (icona) {
      icona.className = Riproduttore.elementoSchermoIntero() ? 'bi bi-fullscreen-exit' : 'bi bi-fullscreen';
    }
  }

  return { apri, chiudi, alternaOpzioni };
})();
