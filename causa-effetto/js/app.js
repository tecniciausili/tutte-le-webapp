// ==================== CAUSA EFFETTO - AVVIO E NAVIGAZIONE ====================
// App statica per Azure Static Web Apps, installabile come PWA su computer e iPad.
// Un dispositivo = un utente: i dati restano nel browser (vedi js/archivio.js).

// Stesso prefisso delle cache in service-worker.js
const PREFISSO_CACHE = 'causa_effetto_';
const CACHE_ARASAAC = `${PREFISSO_CACHE}arasaac`;

const APP_CONFIG = {
  nome: 'Causa Effetto',
  versione: '1.0.7',
};
window.APP_CONFIG = APP_CONFIG;

const App = (() => {
  let areaCorrente = null; // 'educatore' | 'utente' | null
  let richiestaInstallazione = null;

  function principale() {
    return document.getElementById('appMain');
  }

  function lasciaAreaCorrente() {
    if (areaCorrente === 'educatore') {
      Educatore.chiudi();
    } else if (areaCorrente === 'utente') {
      Utente.chiudi();
    }
    areaCorrente = null;
    document.body.classList.remove('educator-mode', 'user-mode-active');
  }

  function mostraEducatore() {
    lasciaAreaCorrente();
    areaCorrente = 'educatore';
    document.body.classList.add('educator-mode');
    Educatore.apri(principale());
    window.scrollTo(0, 0);
  }

  function mostraUtente() {
    lasciaAreaCorrente();
    areaCorrente = 'utente';
    document.body.classList.add('user-mode-active');
    Utente.apri(principale());
    window.scrollTo(0, 0);
  }

  function mostraBenvenuto() {
    lasciaAreaCorrente();
    principale().innerHTML = document.getElementById('modelloBenvenuto').innerHTML;
  }

  // ==================== MENU E FINESTRE ====================

  function alternaMenu(forza) {
    const menu = document.getElementById('sideMenu');
    const apri = typeof forza === 'boolean' ? forza : !menu.classList.contains('active');
    menu.classList.toggle('active', apri);
    document.getElementById('overlay').classList.toggle('active', apri);
  }

  function apriFinestra(id) {
    alternaMenu(false);
    document.getElementById(id)?.classList.add('active');
  }

  function chiudiFinestra(id) {
    document.getElementById(id)?.classList.remove('active');
  }

  async function mostraInformazioni() {
    apriFinestra('infoModal');
    document.getElementById('infoVersione').textContent = APP_CONFIG.versione;
    const box = document.getElementById('infoStorage');
    const info = await Archivio.storageInfo();
    if (info) {
      const mb = (n) => (n / (1024 * 1024)).toFixed(1);
      box.innerHTML = `<strong>Spazio dati:</strong> ${mb(info.usati)} MB usati su ${mb(info.disponibili)} MB disponibili`;
    } else {
      box.hidden = true;
    }
  }

  // ==================== ESPORTA / IMPORTA DATI ====================

  function dataPerNomeFile() {
    const d = new Date();
    const due = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
  }

  async function esporta() {
    alternaMenu(false);
    try {
      const dati = await Archivio.esportaDati();
      const blob = new Blob([JSON.stringify(dati)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `causa-effetto-dati-${dataPerNomeFile()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(`❌ Esportazione non riuscita: ${e.message}`);
    }
  }

  function importa() {
    alternaMenu(false);
    if (!confirm('📥 IMPORTA DATI\n\nI dati del file (oggetti, aspetto, video e impostazioni della sessione) '
      + 'sostituiranno quelli attuali di questo dispositivo.\n\nContinuare?')) {
      return;
    }
    const campo = document.getElementById('fileImporta');
    campo.value = '';
    campo.click();
  }

  async function alFileImporta(e) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const oggetto = JSON.parse(await file.text());
      const esito = await Archivio.importaDati(oggetto);
      alert(`✅ Dati importati: ${esito.oggetti} ${esito.oggetti === 1 ? 'oggetto' : 'oggetti'} e ${esito.youtube} video.\n\nL'app viene ricaricata.`);
      window.location.reload();
    } catch (err) {
      alert(`❌ Importazione non riuscita: ${err.message}`);
    }
  }

  // ==================== PWA: INSTALLA E AGGIORNA ====================

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    richiestaInstallazione = e;
  });

  function installa() {
    alternaMenu(false);
    if (richiestaInstallazione) {
      richiestaInstallazione.prompt();
      richiestaInstallazione.userChoice.finally(() => {
        richiestaInstallazione = null;
      });
      return;
    }
    const installata = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (installata) {
      alert('✅ L\'app è già installata su questo dispositivo.');
    } else {
      alert('📱 INSTALLA APP\n\n'
        + '🍎 iPad con Safari: pulsante Condividi → "Aggiungi alla schermata Home"\n'
        + '🌐 Chrome/Edge sul computer: icona di installazione nella barra degli indirizzi, oppure Menu (⋮) → "Installa app"\n'
        + '📱 Android: Menu (⋮) → "Aggiungi a schermata Home"');
    }
  }

  // Chiede alla rete la pagina dell'app. La richiesta HEAD non passa dalla cache del
  // service worker (che gestisce solo le GET): senza connessione fallisce davvero.
  async function reteDisponibile() {
    try {
      const risposta = await fetch(`./?rete=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
      return risposta.ok;
    } catch (e) {
      return false;
    }
  }

  // Svuota solo la cache dei file di questa app: oggetti, video e impostazioni restano,
  // e resta anche la cache dei pittogrammi ARASAAC (servono senza rete).
  // Sullo stesso dominio ci sono altre app: i loro service worker e le loro cache
  // non vanno toccati.
  async function aggiorna() {
    alternaMenu(false);
    if (!confirm('🔄 AGGIORNA APP\n\nScarica l\'ultima versione dell\'applicazione.\n\nOggetti, video e impostazioni NON vengono toccati.\n\nContinuare?')) {
      return;
    }
    // Senza connessione non si cancella nulla: l'app deve continuare a funzionare offline.
    if (!(await reteDisponibile())) {
      alert('📡 Per aggiornare serve la connessione a internet.\n\nNon è stato cambiato nulla: riprova quando c\'è la connessione.');
      return;
    }
    try {
      if ('serviceWorker' in navigator) {
        const miaCartella = new URL('./', window.location.href).href;
        const registrazioni = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrazioni.filter((r) => r.scope === miaCartella).map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const nomi = await caches.keys();
        await Promise.all(nomi.filter((n) => n.startsWith(PREFISSO_CACHE) && n !== CACHE_ARASAAC).map((n) => caches.delete(n)));
      }
      window.location.reload();
    } catch (e) {
      alert(`❌ Errore durante l'aggiornamento: ${e.message}`);
    }
  }

  // ==================== AVVIO ====================

  async function avvia() {
    Archivio.richiediStoragePersistente();
    // Dati salvati da versioni precedenti (un solo oggetto): diventano il primo dell'elenco
    try {
      await Archivio.migraVersionePrecedente();
    } catch (e) {
      console.warn('Conversione dei dati della versione precedente non riuscita:', e);
    }
    document.getElementById('fileImporta')?.addEventListener('change', alFileImporta);

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-app]');
      if (!el) {
        return;
      }
      const azioni = {
        educatore: mostraEducatore,
        utente: mostraUtente,
        home: mostraBenvenuto,
        menu: () => alternaMenu(),
        'chiudi-menu': () => alternaMenu(false),
        opzioni: () => Utente.alternaOpzioni(),
        istruzioni: () => apriFinestra('instructionsModal'),
        informazioni: mostraInformazioni,
        arasaac: () => apriFinestra('arasaacModal'),
        esporta,
        importa,
        installa,
        aggiorna,
        'chiudi-finestra': () => chiudiFinestra(el.dataset.finestra),
      };
      azioni[el.dataset.app]?.();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ['infoModal', 'instructionsModal', 'arasaacModal'].forEach(chiudiFinestra);
        alternaMenu(false);
      }
    });

    mostraBenvenuto();
    console.log(`${APP_CONFIG.nome} v${APP_CONFIG.versione}`);
  }

  document.addEventListener('DOMContentLoaded', avvia);

  return { mostraEducatore, mostraUtente, mostraBenvenuto, apriFinestra };
})();

// La YouTube IFrame API chiama questa funzione quando è pronta
window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  console.log('YouTube IFrame API pronta');
};
