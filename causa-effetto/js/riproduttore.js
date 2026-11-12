// ==================== RIPRODUTTORE YOUTUBE ====================
// Un solo player per tutta la sessione: si crea una volta e poi si cambia solo il
// video. Su iPad è indispensabile: YouTube parte da solo solo dopo che l'utente
// ha toccato il player almeno una volta, e il permesso vale per quel player.
//
// Questo modulo comanda il player e inoltra gli eventi; le regole della sessione
// (quando mettere in pausa, quale video scegliere) stanno in utente.js.

const Riproduttore = (() => {
  // Errori del player YouTube (evento onError) spiegati a chi usa l'app
  const ERRORI_YOUTUBE = {
    2: 'Il link del video non è valido.',
    5: 'Il browser non riesce a riprodurre questo video.',
    100: 'Il video non esiste più oppure è privato.',
    101: 'Il proprietario non permette di vederlo fuori da YouTube (succede spesso con i video musicali ufficiali).',
    150: 'Il proprietario non permette di vederlo fuori da YouTube (succede spesso con i video musicali ufficiali).',
    153: 'YouTube non riconosce l\'indirizzo dell\'app: aprila da http://localhost o dal suo indirizzo su Azure, non con doppio clic sul file.',
  };
  // Errori che non cambiano riprovando: il video va sostituito
  const ERRORI_DEFINITIVI = [2, 100, 101, 150];

  const STATI = { FINITO: 0, IN_CORSO: 1, PAUSA: 2, CARICAMENTO: 3, PRONTO: 5 };

  // iPad e iPhone: YouTube parte solo dopo un tocco sul video stesso
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let yt = null;
  let ytPronto = null;
  let ascoltatore = null;       // (tipo: 'stato'|'errore', dato)
  let sbloccato = !IOS;         // fuori da iOS basta l'interazione con la pagina

  let wakeLock = null;
  let schermoRichiesto = false;

  function descriviErrore(codice) {
    return ERRORI_YOUTUBE[codice] || `YouTube non riesce a riprodurre questo video (errore ${codice}).`;
  }

  function erroreDefinitivo(codice) {
    return ERRORI_DEFINITIVI.includes(Number(codice));
  }

  function attendiApi(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const inizio = Date.now();
      (function controlla() {
        if (window.YT && typeof window.YT.Player === 'function') {
          resolve();
        } else if (Date.now() - inizio > timeoutMs) {
          reject(new Error('YouTube non raggiungibile: serve la connessione a internet.'));
        } else {
          setTimeout(controlla, 200);
        }
      }());
    });
  }

  // Crea il player dentro l'elemento indicato (una volta per palco)
  function prepara(idElemento, videoIdIniziale) {
    if (ytPronto) {
      return ytPronto;
    }
    ytPronto = attendiApi().then(() => new Promise((resolve, reject) => {
      if (!document.getElementById(idElemento)) {
        reject(new Error('Palco non disponibile.'));
        return;
      }
      const opzioni = {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 0,       // nessun comando: l'utente tocca solo l'oggetto
          rel: 0,
          modestbranding: 1,
          disablekb: 1,      // i tasti restano agli switch, non comandano YouTube
          playsinline: 1,
          fs: 0,
          iv_load_policy: 3,
          // Da ottobre 2025 YouTube rifiuta l'embed senza un origin valido (errore 153)
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => resolve(yt),
          onStateChange: (evento) => {
            if (evento.data === STATI.IN_CORSO) {
              sbloccato = true;
            }
            ascoltatore?.('stato', evento.data);
          },
          onError: (evento) => ascoltatore?.('errore', Number(evento.data)),
        },
      };
      if (videoIdIniziale) {
        opzioni.videoId = videoIdIniziale;
      }
      yt = new YT.Player(idElemento, opzioni);
    }));
    ytPronto.catch(() => {
      ytPronto = null;
    });
    return ytPronto;
  }

  function distruggi() {
    ascoltatore = null;
    try {
      yt?.destroy();
    } catch (e) { /* già distrutto */ }
    yt = null;
    ytPronto = null;
  }

  function ascolta(funzione) {
    ascoltatore = funzione;
  }

  // Comandi: il player può non essere pronto o essere stato distrutto, e le
  // chiamate verso l'iframe non devono mai bloccare la sessione
  function comando(nome, ...argomenti) {
    try {
      return yt?.[nome]?.(...argomenti);
    } catch (e) {
      return undefined;
    }
  }

  // Carica un video. muto: per prepararlo in anticipo senza farlo sentire.
  // da: secondo da cui partire (un video interrotto riprende da dove era rimasto).
  function carica(video, { muto = false, da = video.inizio || 0 } = {}) {
    const richiesta = { videoId: video.video_id, startSeconds: da };
    if (video.fine > 0) {
      richiesta.endSeconds = video.fine;
    }
    comando(muto ? 'mute' : 'unMute');
    comando('loadVideoById', richiesta);
  }

  const play = () => comando('playVideo');
  const pausa = () => comando('pauseVideo');
  const muto = (si) => comando(si ? 'mute' : 'unMute');
  const vaiA = (secondi) => comando('seekTo', secondi, true);
  const tempo = () => Number(comando('getCurrentTime')) || 0;
  const stato = () => comando('getPlayerState');

  function eSbloccato() {
    return sbloccato;
  }

  // ==================== SCHERMO SEMPRE ACCESO E SCHERMO INTERO ====================

  async function schermoAcceso(attivo) {
    schermoRichiesto = attivo;
    if (!('wakeLock' in navigator)) {
      return;
    }
    if (attivo && !wakeLock) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      } catch (e) { /* negato (batteria scarica o pagina non visibile) */ }
    } else if (!attivo && wakeLock) {
      try {
        await wakeLock.release();
      } catch (e) { /* già rilasciato */ }
      wakeLock = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && schermoRichiesto && !wakeLock) {
      schermoAcceso(true);
    }
  });

  function elementoSchermoIntero() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function alternaSchermoIntero(elemento) {
    if (!elementoSchermoIntero()) {
      const richiedi = elemento.requestFullscreen || elemento.webkitRequestFullscreen;
      const p = richiedi?.call(elemento);
      p?.catch?.(() => {});
    } else {
      const esci = document.exitFullscreen || document.webkitExitFullscreen;
      esci?.call(document);
    }
  }

  function schermoInteroDisponibile() {
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  }

  return {
    IOS,
    STATI,
    descriviErrore,
    erroreDefinitivo,
    attendiApi,
    prepara,
    distruggi,
    ascolta,
    carica,
    play,
    pausa,
    muto,
    vaiA,
    tempo,
    stato,
    eSbloccato,
    schermoAcceso,
    alternaSchermoIntero,
    elementoSchermoIntero,
    schermoInteroDisponibile,
  };
})();
