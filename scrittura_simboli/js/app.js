// ==================== SCRITTURA CON SIMBOLI - AVVIO E MENU ====================
// App statica, installabile come PWA su tablet Android, iPad e computer.
// Un dispositivo = un utente: i dati restano nel browser (vedi js/archivio.js).

// Stesso prefisso delle cache in service-worker.js
const PREFISSO_CACHE = 'scrittura_simboli_';
// Pittogrammi ARASAAC e simboli Mulberry già scaricati: «Aggiorna App» non li cancella
const CACHE_ARASAAC = `${PREFISSO_CACHE}arasaac`;
const CACHE_MULBERRY = `${PREFISSO_CACHE}mulberry`;

const APP_CONFIG = {
  nome: 'Scrittura con Simboli',
  versione: '1.5.3',
};
window.APP_CONFIG = APP_CONFIG;

const App = (() => {
  let richiestaInstallazione = null;

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
    document.getElementById('infoParole').textContent = Simboli.numeroParole.toLocaleString('it-IT');
    const box = document.getElementById('infoStorage');
    const info = await Archivio.storageInfo();
    if (info) {
      const mb = (n) => (n / (1024 * 1024)).toFixed(1);
      box.innerHTML = `<strong>Spazio dati:</strong> ${mb(info.usati)} MB usati su ${mb(info.disponibili)} MB disponibili`;
    } else {
      box.hidden = true;
    }
  }

  function nuovoFoglio() {
    alternaMenu(false);
    if (!confirm('📄 NUOVO FOGLIO\n\nIl testo scritto viene cancellato.\nI simboli scelti e le foto restano.\n\nContinuare?')) {
      return;
    }
    Editor.nuovoFoglio();
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
      a.download = `scrittura-simboli-dati-${dataPerNomeFile()}.json`;
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
    if (!confirm('📥 IMPORTA DATI\n\nTesto, simboli scelti e foto del file sostituiranno quelli attuali di questo dispositivo.\n\nContinuare?')) {
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
      const esito = await Archivio.importaDati(JSON.parse(await file.text()));
      alert(`✅ Dati importati (${esito.foto} ${esito.foto === 1 ? 'foto' : 'foto'}).\n\nL'app viene ricaricata.`);
      window.location.reload();
    } catch (err) {
      alert(`❌ Importazione non riuscita: ${err.message}`);
    }
  }

  // ==================== PWA: INSTALLA E AGGIORNA ====================

  const installata = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  // Il pulsante «Installa l'app» in fondo alla pagina sparisce quando l'app è già installata
  function aggiornaPiede() {
    const piede = document.getElementById('piedeInstalla');
    if (piede) {
      piede.hidden = installata();
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    richiestaInstallazione = e;
  });

  window.addEventListener('appinstalled', () => {
    richiestaInstallazione = null;
    const piede = document.getElementById('piedeInstalla');
    if (piede) {
      piede.hidden = true;
    }
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
    if (installata()) {
      alert('✅ L\'app è già installata su questo dispositivo.');
    } else {
      alert('📱 INSTALLA APP\n\n'
        + '🍎 iPad con Safari: pulsante Condividi → "Aggiungi alla schermata Home"\n'
        + '📱 Android con Chrome: Menu (⋮) → "Installa app" oppure "Aggiungi a schermata Home"\n'
        + '🌐 Chrome/Edge sul computer: icona di installazione nella barra degli indirizzi');
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

  // Svuota solo la cache dei file di questa app: testo, simboli scelti e foto restano.
  // Sullo stesso dominio ci sono altre app (assistivetech.it/webapp/): i loro
  // service worker e le loro cache non vanno toccati.
  async function aggiorna() {
    alternaMenu(false);
    if (!confirm('🔄 AGGIORNA APP\n\nScarica l\'ultima versione dell\'applicazione.\n\nTesto, simboli scelti e foto NON vengono toccati.\n\nContinuare?')) {
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
        await Promise.all(nomi.filter((n) => n.startsWith(PREFISSO_CACHE) && n !== CACHE_ARASAAC && n !== CACHE_MULBERRY).map((n) => caches.delete(n)));
      }
      window.location.reload();
    } catch (e) {
      alert(`❌ Errore durante l'aggiornamento: ${e.message}`);
    }
  }

  function tornaAllaRaccolta() {
    Editor.ferma();
    window.location.href = window.RACCOLTA ? window.RACCOLTA.url : './';
  }

  // ==================== AVVIO ====================

  function avvia() {
    Archivio.richiediStoragePersistente();
    document.getElementById('fileImporta')?.addEventListener('change', alFileImporta);

    const btnSchermo = document.getElementById('btnSchermoIntero');
    if (Schermo.schermoInteroDisponibile()) {
      btnSchermo.hidden = false;
      document.addEventListener('fullscreenchange', () => {
        btnSchermo.querySelector('.ms').textContent = Schermo.elementoSchermoIntero() ? 'fullscreen_exit' : 'fullscreen';
      });
    }

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-app]');
      if (!el) {
        return;
      }
      const azioni = {
        menu: () => alternaMenu(),
        'chiudi-menu': () => alternaMenu(false),
        nuovo: nuovoFoglio,
        istruzioni: () => apriFinestra('instructionsModal'),
        informazioni: mostraInformazioni,
        esporta,
        importa,
        installa,
        aggiorna,
        'schermo-intero': () => Schermo.alternaSchermoIntero(),
        // Pagina unica: «indietro» e «casa» portano entrambe all'indice della raccolta (js/raccolta.js)
        indietro: tornaAllaRaccolta,
        casa: tornaAllaRaccolta,
        'chiudi-finestra': () => chiudiFinestra(el.dataset.finestra),
      };
      azioni[el.dataset.app]?.();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ['infoModal', 'instructionsModal'].forEach(chiudiFinestra);
        alternaMenu(false);
      }
    });

    // Icone pronte: senza il font si vedrebbero i nomi delle icone
    const iconePronte = () => document.documentElement.classList.add('icone-pronte');
    if (document.fonts?.load) {
      document.fonts.load('24px "Material Symbols Outlined"', 'home').then(iconePronte, iconePronte);
      setTimeout(iconePronte, 3000);
    } else {
      iconePronte();
    }

    aggiornaPiede();
    window.matchMedia('(display-mode: standalone)').addEventListener?.('change', aggiornaPiede);

    Editor.avvia();
    console.log(`${APP_CONFIG.nome} v${APP_CONFIG.versione}`);
  }

  document.addEventListener('DOMContentLoaded', avvia);

  return { apriFinestra, alternaMenu };
})();
