// ==================== VOCE ====================
// Sintesi vocale del dispositivo (Web Speech API, nessun servizio esterno).
// Stessa base delle altre app; in più: scelta della voce e avviso parola per parola
// (per illuminare il cartellino che si sta leggendo).

const Voce = (() => {
  let voci = [];
  let pronta = null;

  function disponibile() {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  function init() {
    if (pronta) {
      return pronta;
    }
    pronta = new Promise((resolve) => {
      if (!disponibile()) {
        resolve([]);
        return;
      }
      const carica = () => {
        voci = speechSynthesis.getVoices();
        return voci.length > 0;
      };
      if (carica()) {
        resolve(voci);
        return;
      }
      speechSynthesis.addEventListener('voiceschanged', carica);
      let tentativi = 0;
      const timer = setInterval(() => {
        if (carica() || ++tentativi > 20) {
          clearInterval(timer);
          resolve(voci);
        }
      }, 250);
    });
    return pronta;
  }

  function vociItaliane() {
    return voci.filter((v) => (v.lang || '').toLowerCase().replace('_', '-').startsWith('it'));
  }

  // La voce scelta, altrimenti un'italiana di buona qualità
  function voce(uri) {
    const it = vociItaliane();
    return it.find((v) => v.voiceURI === uri)
      || it.find((v) => /google|alice|federica|luca|elsa|natural|premium|enhanced/i.test(v.name))
      || it.find((v) => /it-IT/i.test(v.lang))
      || it[0]
      || null;
  }

  function stop() {
    if (disponibile()) {
      try {
        speechSynthesis.cancel();
      } catch (e) { /* ignora */ }
    }
  }

  // Legge una frase. onParola(posizione) a ogni parola, se il browser lo segnala.
  function parla(testo, { velocita = 1, uri = '', onInizio, onParola } = {}) {
    testo = String(testo || '');
    if (!testo.trim() || !disponibile()) {
      return Promise.resolve(false);
    }
    return init().then(() => new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(testo);
      const v = voce(uri);
      if (v) {
        u.voice = v;
      }
      u.lang = v?.lang || 'it-IT';
      u.rate = Math.min(2, Math.max(0.5, velocita));
      u.onstart = () => onInizio?.();
      u.onboundary = (e) => {
        if (!e.name || e.name === 'word') {
          onParola?.(e.charIndex);
        }
      };
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      try {
        if (speechSynthesis.paused) {
          speechSynthesis.resume();
        }
      } catch (e) { /* ignora */ }
      speechSynthesis.speak(u);
    }));
  }

  init();

  return { disponibile, init, vociItaliane, parla, stop };
})();
