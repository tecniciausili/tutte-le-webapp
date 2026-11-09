// ==================== UTILITÀ COMUNI ====================
// Piccole funzioni usate da tutti i moduli. Nessuna dipendenza.
// Stesse regole delle altre app di assistivetech.it/webapp.

const Util = {
  // Protegge il testo quando finisce dentro innerHTML
  escapeHtml(testo) {
    return String(testo ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
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
};

// ==================== SCHERMO ====================
// Schermo intero (computer e Android). Su iPad si usa l'app aggiunta alla schermata Home.

const Schermo = (() => {
  function elementoSchermoIntero() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function alternaSchermoIntero(elemento = document.documentElement) {
    if (!elementoSchermoIntero()) {
      const richiedi = elemento.requestFullscreen || elemento.webkitRequestFullscreen;
      richiedi?.call(elemento)?.catch?.(() => {});
    } else {
      const esci = document.exitFullscreen || document.webkitExitFullscreen;
      esci?.call(document)?.catch?.(() => {});
    }
  }

  function schermoInteroDisponibile() {
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  }

  return { elementoSchermoIntero, alternaSchermoIntero, schermoInteroDisponibile };
})();
