// ==================== RITAGLIO DELLE IMMAGINI ====================
// Le immagini caricate dal dispositivo diventano quadrate come i pittogrammi
// ARASAAC: l'educatore sposta e ingrandisce la foto sotto un riquadro quadrato e
// sceglie cosa tenere. Così sullo schermo l'oggetto riempie il suo spazio, grande
// come un pittogramma. I pittogrammi ARASAAC non passano di qui.
// Si trascina col dito o col mouse; si ingrandisce col cursore, con la rotella
// o con due dita.

const Ritaglio = (() => {
  const LATO_USCITA = 1000;   // px del quadrato salvato: basta per qualunque tablet, pesa poco
  const ZOOM_MAX = 5;         // rispetto al quadrato pieno

  // Apre la finestra di ritaglio su un File o un Blob. Restituisce il Blob quadrato,
  // oppure null se l'educatore annulla.
  async function apri(sorgente, { sottotitolo = '', trasparente = false } = {}) {
    if (sorgente.type && !sorgente.type.startsWith('image/')) {
      throw new Error('Il file scelto non è un\'immagine.');
    }
    const img = await Oggetto.caricaImmagine(sorgente);
    return new Promise((fine) => costruisci(img, { sottotitolo, trasparente }, fine));
  }

  function costruisci(img, { sottotitolo, trasparente }, fine) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    // zoom 1 = l'immagine riempie il quadrato; zoomMin = si vede tutta l'immagine
    const zoomMin = Math.min(w, h) / Math.max(w, h);
    let zoom = 1;
    let cx = w / 2;             // punto dell'immagine al centro del quadrato
    let cy = h / 2;

    const finestra = document.createElement('div');
    finestra.className = 'modal active';
    finestra.setAttribute('role', 'dialog');
    finestra.setAttribute('aria-modal', 'true');
    finestra.setAttribute('aria-labelledby', 'titoloRitaglio');
    finestra.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="titoloRitaglio"><i class="bi bi-crop"></i> Ritaglia l'immagine</h3>
          <button type="button" class="btn-close-modal" data-ritaglio="annulla" aria-label="Annulla">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="modal-body">
          ${sottotitolo ? `<p class="ritaglio-nome">${Util.escapeHtml(sottotitolo)}</p>` : ''}
          <p class="helper-text">Sposta la foto col dito o col mouse e ingrandiscila: quello che resta
            nel quadrato diventa l'oggetto da toccare, grande come un pittogramma.</p>
          <div class="ritaglio-riquadro"></div>
          <div class="riga-cursore">
            <i class="bi bi-zoom-out" aria-hidden="true"></i>
            <input type="range" min="0" max="1000" step="1" aria-label="Ingrandimento" />
            <i class="bi bi-zoom-in" aria-hidden="true"></i>
          </div>
          <div class="ritaglio-scorciatoie">
            <button type="button" class="btn-secondary btn-piccolo" data-ritaglio="riempi">
              <i class="bi bi-arrows-fullscreen"></i> Riempi il quadrato</button>
            <button type="button" class="btn-secondary btn-piccolo" data-ritaglio="intera">
              <i class="bi bi-aspect-ratio"></i> Tutta l'immagine</button>
          </div>
        </div>
        <div class="modal-footer ritaglio-azioni">
          <button type="button" class="btn-secondary" data-ritaglio="annulla">Annulla</button>
          <button type="button" class="btn-primary" data-ritaglio="salva"><i class="bi bi-check-lg"></i> Salva</button>
        </div>
      </div>`;
    const riquadro = finestra.querySelector('.ritaglio-riquadro');
    const cursore = finestra.querySelector('input[type="range"]');
    img.draggable = false;
    img.alt = '';
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    riquadro.appendChild(img);
    document.body.appendChild(finestra);

    const lato = () => riquadro.clientWidth;
    const scala = () => (zoom * lato()) / Math.min(w, h);   // px sullo schermo per px dell'immagine

    // Il quadrato resta sempre sull'immagine; se l'immagine è più piccola del
    // quadrato su un asse, su quell'asse resta al centro
    function limita() {
      zoom = Math.min(ZOOM_MAX, Math.max(zoomMin, zoom));
      const meta = lato() / (2 * scala());
      cx = w >= 2 * meta ? Math.min(w - meta, Math.max(meta, cx)) : w / 2;
      cy = h >= 2 * meta ? Math.min(h - meta, Math.max(meta, cy)) : h / 2;
    }

    // Posizione dell'immagine nel quadrato (angolo in alto a sinistra, in px)
    function origine() {
      const s = scala();
      return { x: lato() / 2 - cx * s, y: lato() / 2 - cy * s, s };
    }

    function disegna() {
      limita();
      const { x, y, s } = origine();
      img.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
      // Cursore in scala logaritmica: ingrandire un po' costa lo stesso gesto a ogni livello
      cursore.value = Math.round((Math.log(zoom / zoomMin) / Math.log(ZOOM_MAX / zoomMin)) * 1000);
    }

    // ---------- Trascinamento, pizzico e rotella ----------
    const puntatori = new Map();
    let distanzaPrima = 0;

    const distanza = () => {
      const [a, b] = [...puntatori.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    riquadro.addEventListener('pointerdown', (e) => {
      riquadro.setPointerCapture(e.pointerId);
      puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (puntatori.size === 2) {
        distanzaPrima = distanza();
      }
    });
    riquadro.addEventListener('pointermove', (e) => {
      const prima = puntatori.get(e.pointerId);
      if (!prima) {
        return;
      }
      const s = scala();
      if (puntatori.size === 1) {
        cx -= (e.clientX - prima.x) / s;
        cy -= (e.clientY - prima.y) / s;
      }
      puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (puntatori.size === 2) {
        const ora = distanza();
        if (distanzaPrima > 0) {
          zoom *= ora / distanzaPrima;
        }
        distanzaPrima = ora;
      }
      disegna();
    });
    const lascia = (e) => {
      puntatori.delete(e.pointerId);
      distanzaPrima = 0;
    };
    riquadro.addEventListener('pointerup', lascia);
    riquadro.addEventListener('pointercancel', lascia);
    riquadro.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom *= Math.exp(-e.deltaY * 0.0015);
      disegna();
    }, { passive: false });

    cursore.addEventListener('input', () => {
      zoom = zoomMin * (ZOOM_MAX / zoomMin) ** (cursore.value / 1000);
      disegna();
    });

    // ---------- Pulsanti e tastiera ----------
    function chiudi(risultato) {
      document.removeEventListener('keydown', alTasto, true);
      window.removeEventListener('resize', disegna);
      finestra.remove();
      fine(risultato);
    }

    function salva() {
      limita();
      const { x, y, s } = origine();
      const v = lato();
      // Mai più grande del pezzo di immagine ritagliato: ingrandire non aggiunge dettagli
      const uscita = Math.max(1, Math.min(LATO_USCITA, Math.round(v / s)));
      const k = uscita / v;
      const tela = document.createElement('canvas');
      tela.width = uscita;
      tela.height = uscita;
      tela.getContext('2d').drawImage(img, x * k, y * k, w * s * k, h * s * k);
      // Con parti vuote nel quadrato serve la trasparenza: lì si vedrà lo sfondo scelto
      const pieno = w * s >= v - 0.5 && h * s >= v - 0.5;
      const png = trasparente || !pieno;
      tela.toBlob((blob) => chiudi(blob), png ? 'image/png' : 'image/jpeg', 0.9);
    }

    function alTasto(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        chiudi(null);
      } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        salva();
      }
    }

    finestra.addEventListener('click', (e) => {
      const comando = e.target.closest('[data-ritaglio]')?.dataset.ritaglio;
      if (comando === 'annulla') {
        chiudi(null);
      } else if (comando === 'salva') {
        salva();
      } else if (comando === 'riempi') {
        zoom = 1;
        disegna();
      } else if (comando === 'intera') {
        zoom = zoomMin;
        disegna();
      }
    });
    document.addEventListener('keydown', alTasto, true);
    window.addEventListener('resize', disegna);

    disegna();
    finestra.querySelector('[data-ritaglio="salva"]').focus();
  }

  return { apri };
})();
