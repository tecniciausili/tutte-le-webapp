# Web App AssistiveTech: raccolta

Un solo sito con dentro più web app: `index.html` mostra l'elenco con link e codice QR, e ogni app sta
nella sua cartella (`/conta_con_le_dita/`, `/scrivo_parole_con_le_lettere/`, `/concetti_topologici/`…).
Così su Azure si occupa **una sola** App Web statica (piano Gratuito) invece di una per app.

Tutte le app sono **statiche** (HTML, CSS, JavaScript) e installabili come PWA. Non hanno registrazione
né login: **un dispositivo = un utente**, i dati restano nel browser (localStorage/IndexedDB) e si
salvano con **Esporta/Importa** nell'Area Educatore di ogni app.

## Struttura

| File / cartella | A cosa serve |
|---|---|
| `index.html` | Indice semplice: un box (icona + nome) per app. Il suo elenco `APP` è **l'unica lista** delle app |
| `<cartella app>/` | Una web app completa, con il suo `manifest.json` e `service-worker.js` |
| `staticwebapp.config.json` | Configurazione Azure, **generata da `aggiorna.sh`**: non modificarla a mano |
| `404.html` | Pagina per gli indirizzi inesistenti |
| `aggiorna.sh` | Copia le app dalla libreria `~/PROGETTTI_SINGOLI_AZURE/webapp` e rigenera la configurazione |

Le app condividono lo stesso indirizzo (origine), quindi ognuna usa un **prefisso suo** per le chiavi
di localStorage (`cd_`, `spl_`, `ct_`…) e per le cache del service worker. Nessuna app deve chiamare
`localStorage.clear()`: cancellerebbe i dati di tutte le altre.

## Aggiungere o aggiornare un'app

1. L'app va prima preparata (o modificata) nella libreria `~/PROGETTTI_SINGOLI_AZURE/webapp/<cartella>`.
2. Solo per un'app nuova: aggiungere la sua voce all'elenco `APP` in `index.html`
   (`{ cartella: '…', nome: '…' }`, icona facoltativa).
3. Lanciare `bash aggiorna.sh`. Si ferma se trova file da server (`.php`, `.sql`, `api/`):
   i moduli del portale li contengono, con le password del database, e non devono finire su GitHub.
4. Provare in locale: `python3 -m http.server 8080` e aprire <http://localhost:8080>.
5. Se l'app è cambiata, controllare di aver aumentato la versione nel suo `service-worker.js`
   (e gli eventuali `?v=`), altrimenti i dispositivi continuano a usare i file vecchi.
6. `git add -A && git commit -m "…" && git push`: dopo 1-3 minuti il sito su Azure è aggiornato.

## Pubblicazione

Azure Static Web Apps, piano Gratuito, gruppo di risorse Ausili. Il repository è su GitHub,
account tecniciausili, ramo `main`. Impostazioni dell'app su Azure: preset **Personalizzato**,
percorso app `/`, percorso API e output vuoti. Procedura completa:
`~/PROGETTTI_SINGOLI_AZURE/Guida_pubblicazione_App_Web_Azure.docx`.

Pittogrammi ARASAAC (Sergio Palao, Governo di Aragona), licenza CC BY-NC-SA.
