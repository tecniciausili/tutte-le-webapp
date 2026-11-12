// ==================== UTILITÀ COMUNI ====================
// Piccole funzioni usate da tutti i moduli. Nessuna dipendenza.
// Derivate da Mastertutor, stesse regole e stessi formati.

const Util = {
  // Protegge il testo inserito dall'educatore quando finisce dentro innerHTML
  escapeHtml(testo) {
    return String(testo ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  },

  // 75 → "1:15"
  formatoTempo(secondi) {
    const s = Math.max(0, Math.round(Number(secondi) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },

  // Tempo scritto come minuti e secondi → secondi totali
  secondiDa(minuti, secondi) {
    return (parseInt(minuti, 10) || 0) * 60 + (parseInt(secondi, 10) || 0);
  },

  // Copia della lista in ordine casuale (Fisher-Yates)
  mescola(lista) {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  },

  // Giro senza ripetizioni: ogni elemento esce una sola volta finché non sono usciti
  // tutti, poi si prepara un nuovo giro. prossimo(elementi, prepara) riceve gli elementi
  // disponibili adesso; prepara(elementi) dà l'ordine del nuovo giro (lista o mescolato).
  // Gli elementi tolti a metà giro vengono saltati, quelli aggiunti entrano dal giro dopo.
  // Con seguiOrdine (giro "in sequenza") quelli non ancora usciti seguono subito
  // l'ordine attuale degli elementi.
  creaGiro(chiave = (x) => x) {
    let coda = [];
    let ultima = null;
    return {
      prossimo(elementi, prepara, { seguiOrdine = false } = {}) {
        if (!elementi || elementi.length === 0) {
          return null;
        }
        const perChiave = new Map(elementi.map((e) => [chiave(e), e]));
        coda = coda.filter((k) => perChiave.has(k));
        if (seguiOrdine && coda.length > 1) {
          const posizione = new Map(elementi.map((e, i) => [chiave(e), i]));
          coda.sort((a, b) => posizione.get(a) - posizione.get(b));
        }
        if (coda.length === 0) {
          coda = prepara(elementi).map(chiave);
          // A cavallo tra due giri lo stesso elemento non esce due volte di fila
          if (coda.length > 1 && coda[0] === ultima) {
            [coda[0], coda[1]] = [coda[1], coda[0]];
          }
        }
        ultima = coda.shift();
        return perChiave.get(ultima);
      },
      // Butta il giro in corso (es. passaggio tra sequenza e random)
      ricomincia() {
        coda = [];
      },
    };
  },

  // Estrae l'id del video da tutti i formati di link YouTube comuni
  estraiVideoId(url) {
    if (!url) {
      return null;
    }
    const valido = (id) => (/^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null);
    try {
      const u = new URL(url.trim());
      const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
      if (host === 'youtu.be') {
        return valido(u.pathname.split('/')[1]);
      }
      if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
        if (u.searchParams.has('v')) {
          return valido(u.searchParams.get('v'));
        }
        const m = u.pathname.match(/\/(embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
        if (m) {
          return valido(m[2]);
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  },

  // Estrae l'id di una playlist dal link YouTube (parametro "list").
  // Esclude le liste private non enumerabili (WL = Guarda più tardi, LL = Mi piace).
  estraiPlaylistId(url) {
    if (!url) {
      return null;
    }
    try {
      const u = new URL(url.trim());
      const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
      if (!(host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com'))) {
        return null;
      }
      const id = u.searchParams.get('list');
      if (!id || id === 'WL' || id === 'LL') {
        return null;
      }
      return /^[A-Za-z0-9_-]{12,}$/.test(id) ? id : null;
    } catch (e) {
      return null;
    }
  },

  // True se il tasto arriva da un campo di testo (lì SPAZIO e INVIO servono a scrivere)
  daCampoDiTesto(evento) {
    const t = evento.target;
    if (!t || !t.tagName) {
      return false;
    }
    if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') {
      return true;
    }
    if (t.tagName === 'INPUT') {
      return ['text', 'number', 'url', 'search', 'email', 'password', 'color', 'range'].includes(t.type);
    }
    return false;
  },

  // Blob → data URL (per esporta dati)
  blobInDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const lettore = new FileReader();
      lettore.onload = () => resolve(lettore.result);
      lettore.onerror = () => reject(lettore.error || new Error('Lettura non riuscita'));
      lettore.readAsDataURL(blob);
    });
  },

  // data URL → Blob (per importa dati)
  async dataUrlInBlob(dataUrl) {
    const risposta = await fetch(dataUrl);
    return risposta.blob();
  },
};
