# Web app Lega del Filo d'Oro: raccolta

Un solo sito con dentro più web app: `index.html` mostra un box per app, e ogni app sta nella sua
cartella (`/conta_con_le_dita/`, `/scrivo_parole/`, `/frase_minima/`, `/concetti_topologici/`).
Così su Azure si occupa **una sola** App Web statica (piano Gratuito) invece di una per app.

Tutte le app sono **statiche** (HTML, CSS, JavaScript) e installabili come PWA (pulsante «Installa sul
dispositivo» nella pagina iniziale). Non hanno registrazione né login: **un dispositivo = un utente**,
i dati restano nel browser (localStorage/IndexedDB) e si salvano con **Esporta/Importa** nell'Area
Educatore di ogni app.

Questo repository è **autonomo**: le app si modificano direttamente qui. Non dipende da altre copie.

## Struttura

| File / cartella | A cosa serve |
|---|---|
| `index.html` | Indice: un box (icona + nome) per app. Il suo elenco `APP` è **l'unica lista** delle app |
| `<cartella app>/` | Una web app completa, con il suo `manifest.json` e `service-worker.js` |
| `staticwebapp.config.json` | Configurazione Azure, **generata da `controlla.sh`**: non modificarla a mano |
| `serve.json` | Per la prova in locale con `npx serve`, **generato da `controlla.sh`** |
| `404.html` | Pagina per gli indirizzi inesistenti |
| `controlla.sh` | Controlli prima del commit e rigenerazione delle due configurazioni |

Le app condividono lo stesso indirizzo (origine), quindi ognuna usa un **prefisso suo** per le chiavi
di localStorage (`cd_`, `spl_`, `sps_`, `fm_`, `ct_`) e per le cache del service worker. Nessuna app
deve chiamare `localStorage.clear()`: cancellerebbe i dati di tutte le altre.

## Frecce di navigazione

In tutte le app: **←** porta al livello sopra (da Area Educatore o Area Utente alla pagina iniziale
dell'app; dalla pagina iniziale all'indice; con un esercizio aperto alla scelta dell'esercizio),
**🏠** porta sempre all'indice della raccolta. L'indirizzo dell'indice è in `js/raccolta.js` di
ogni app (`'../'`, oppure `'../../'` per `scrivo_parole/lettere` e `scrivo_parole/sillabe`).

## Aggiungere o aggiornare un'app

1. Modificare (o aggiungere) l'app nella sua cartella, qui nel repository.
2. Solo per un'app nuova: aggiungere la sua voce all'elenco `APP` in `index.html`
   (`{ cartella: '…', nome: '…' }`, icona facoltativa).
3. Lanciare `bash controlla.sh`. Si ferma se trova file da server (`.php`, `.sql`, `api/`).
4. Provare in locale: `npx serve` e aprire l'indirizzo che scrive.
5. Se l'app è cambiata, aumentare la versione nel suo `service-worker.js` (e gli eventuali `?v=`),
   altrimenti i dispositivi continuano a usare i file vecchi.
6. `git add -A && git commit -m "…" && git push`: dopo 1-3 minuti il sito su Azure è aggiornato.

## Pubblicazione

Il repository è su GitHub: **github.com/tecniciausili/tutte-le-webapp**, ramo `main`.
L'App Web statica su Azure la crea il coordinatore, con le sue credenziali.

### Impostazioni per creare l'App Web statica su Azure

| Campo | Valore |
|---|---|
| Servizio | **App Web statiche** (Static Web Apps), non «App Web» |
| Sottoscrizione / gruppo di risorse | Microsoft Azure Sponsorship / **Ausili** |
| Piano | **Gratuito** (il modulo propone Standard, che è a pagamento) |
| Origine della distribuzione | GitHub → organizzazione `tecniciausili`, repository `tutte-le-webapp`, ramo `main` |
| Preset di compilazione | **Personalizzato** (Custom) |
| Percorso app | `/` |
| Percorso API / Percorso output | vuoti |

Non serve nessuna compilazione: sono file statici. Il file `staticwebapp.config.json` è già nella
radice. Dopo la creazione Azure aggiunge al repository il file `.github/workflows/…yml`: prima del
push successivo bisogna fare `git pull`. Da quel momento ogni `git push` aggiorna il sito in 1-3 minuti.
Procedura completa nella guida interna «Guida pubblicazione App Web Azure» (non è nel repository).

Pittogrammi ARASAAC (Sergio Palao, Governo di Aragona), licenza CC BY-NC-SA.
