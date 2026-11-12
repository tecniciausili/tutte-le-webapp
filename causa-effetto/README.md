# Causa Effetto — versione autonoma

Esercizio **stimolo-risposta** per iPad (e computer): sullo schermo c'è un oggetto; l'utente lo
tocca e parte un **video YouTube**. Poi l'oggetto torna in un altro punto dello schermo.

Applicazione **statica** (HTML/CSS/JavaScript) per Azure Static Web Apps, installabile come PWA.
**Un dispositivo = un utente**: impostazioni e link restano nel browser del dispositivo.
I video **non si scaricano** (si salva solo il link) e dei pittogrammi ARASAAC si salva solo l'id.

## Funzionalità

### Area Educatore

A sinistra c'è una colonna con quattro schede. Lo spazio a destra resta libero per la finestra di
ricerca di YouTube, come in Mastertutor.

| Scheda | Cosa si fa |
|---|---|
| **Oggetti** | Un elenco di oggetti: pittogrammi **ARASAAC** (API pubblica, si salva solo l'id) e **immagini** dal computer o dalle Foto del tablet (anche più insieme; ridotte a 1000 px e salvate in IndexedDB). Si sceglie **un solo oggetto** («Usa questo») oppure **più oggetti, uno alla volta a caso** (spunta «In scena»). L'anteprima mostra a rotazione gli oggetti in scena |
| **Aspetto** | **Dimensione** dell'oggetto (10–90 % del lato corto dello schermo), colore dello **sfondo**, che è l'unico sfondo: dietro l'immagine non c'è nessun riquadro. **Solo area centrale** (visione a tunnel, per esempio Sindrome di Usher): l'oggetto sta in un quadrato al centro, di ampiezza regolabile (30–100 %); senza spunta usa tutto lo schermo. **Oggetto in movimento**: scorre e rimbalza sui bordi dell'area, velocità da 1 a 10; senza spunta è statico. Anteprima animata e avvisi (contrasto basso, oggetto grande quanto l'area) |
| **YouTube** | Scrivendo la **categoria** si apre YouTube con la ricerca. Poi si inseriscono link (controllato subito: i video non incorporabili non si salvano), nome, **inizio e fine** in minuti e secondi, e si può importare un'intera **playlist**. Nella lista si cambiano inizio e fine, si sceglie se il video è **nella lista dell'utente**, si elimina un video o una playlist |
| **Sessione** | **Durata**: *fino alla fine* oppure *temporizzato* (N secondi). **Ordine**: *in sequenza* oppure *random* |

### Area Utente

1. L'educatore preme **Inizia**. Su iPad, solo la prima volta, tocca il video una volta per
   abilitare YouTube.
2. Compare l'oggetto. Con più oggetti in scena, a ogni ricomparsa ne compare uno diverso scelto a
   caso: nessuno si ripete finché non sono comparsi tutti, e mai lo stesso due volte di fila. Il tocco sull'oggetto avvia il video; mentre il video scorre, ogni altro
   tocco viene ignorato (un velo trasparente copre il player).
3. **Fino alla fine**: a fine video, o al tempo di fine impostato, l'oggetto torna in un altro
   punto. Il tocco successivo avvia il video seguente.
4. **Temporizzato**: dopo N secondi il video va **in pausa**, senza chiudersi, e l'oggetto torna in
   un altro punto. Il tocco successivo fa **riprendere lo stesso video** da dove si era fermato.
   Quando il video finisce si passa al seguente.
5. **Random**: nessun video si ripete finché non sono usciti tutti.

- Il pulsante con i cursori (in alto a sinistra e nell'intestazione) apre il pannello
  **Dimensione e sfondo**, che regola l'oggetto anche durante l'uso: dimensione, sfondo, area
  centrale e movimento. Le modifiche valgono anche per l'Area Educatore. Mentre il pannello è
  aperto si vede il bordo tratteggiato dell'area centrale.
- **Oggetto in movimento**: si muove solo mentre è visibile; durante il video si ferma e, quando
  ricompare, riparte da un punto nuovo in una direzione casuale.
- **SPAZIO** e **INVIO** valgono come tocco (switch USB o Bluetooth, Makey Makey).
- Il prossimo video si carica, muto e nascosto, mentre si vede l'oggetto: al tocco parte subito.
- Un video rifiutato da YouTube (errori 101/150) viene saltato e segnato nella lista
  dell'educatore, con il pulsante **Riprova**.
- Il tocco conta solo con il primo dito, al momento dell'appoggio (`pointerdown`). Zoom, doppio
  tocco e menu del tocco lungo sono disattivati.
- Lo schermo resta acceso durante la sessione (Wake Lock).

## Architettura dati

| Dato | Dove |
|---|---|
| Link YouTube (con inizio, fine, «nella lista») | `localStorage` (`ce_youtube`) |
| Elenco degli oggetti (tipo, id ARASAAC, nome, «in scena») | `localStorage` (`ce_oggetti`) |
| Modo degli oggetti, aspetto, sessione | `localStorage` (`ce_impostazioni`) |
| Immagini caricate dal dispositivo | `IndexedDB` (`causa-effetto` → `immagini`, chiave `img-<id>`) |
| Pittogrammi ARASAAC | solo l'id; le immagini restano anche in una cache del service worker |

I dati delle versioni fino alla 1.0.3 (un solo oggetto) si convertono da soli al primo avvio, e
anche i loro file esportati si possono importare.

**Esporta / Importa dati** (menu ☰) salva e rilegge un piccolo `.json` con impostazioni, link,
oggetti e immagini caricate. Serve a configurare sul computer e passare tutto all'iPad, e vale
anche come backup.

## Struttura del progetto

```
├── index.html              Pagina unica
├── css/styles.css          Stili
├── js/
│   ├── util.js             Utilità comuni (da Mastertutor)
│   ├── archivio.js         localStorage + IndexedDB, esporta/importa
│   ├── raccolta.js         RACCOLTA = null: l'app non torna all'elenco delle app
│   ├── oggetto.js          ARASAAC, immagine dal dispositivo, controlli di aspetto
│   ├── ritaglio.js         Ritaglio quadrato delle immagini caricate
│   ├── riproduttore.js     Player YouTube unico, schermo acceso, schermo intero
│   ├── educatore.js        Area Educatore
│   ├── utente.js           Area Utente: oggetto, tocco, video, pausa e ripresa
│   └── app.js              Avvio, menu ☰, installazione PWA, «Aggiorna App»
├── assets/                 Icone, font Bootstrap Icons
├── manifest.json · service-worker.js
```

La configurazione Azure (`staticwebapp.config.json`) e `serve.json` sono quelli della radice del
repository, generati da `controlla.sh`.

## Navigazione e menu ☰

- **←** (in alto a sinistra, solo nell'Area Educatore e nell'Area Utente) torna alla pagina
  iniziale dell'app. Nella pagina iniziale non c'è: l'app **non torna all'elenco delle app**
  (`window.RACCOLTA = null` in `js/raccolta.js`), come tutte le app della raccolta.
- Menu ☰: Schermata iniziale, Area Educatore, Area Utente, **Esporta dati**, **Importa dati**,
  **Installa l'app**, Come funziona, Informazioni, **Aggiorna App**.
- **Aggiorna App** prima controlla la connessione (richiesta HEAD, che non passa dalla cache):
  senza rete avvisa e non cancella nulla. Con la rete cancella solo le cache dei file di questa app;
  restano dati, immagini e la cache dei pittogrammi ARASAAC.

## Sviluppo locale

Dalla radice del repository (`tutte-le-webapp`):

```bash
npx serve          # poi aprire http://localhost:3000/causa-effetto/
```

YouTube rifiuta l'embed senza `origin` (errore 153): l'app va aperta da `http://localhost` o da
`https://`, non con doppio clic sul file.

Dopo ogni modifica si aumenta la versione in `service-worker.js` (`CACHE_NAME`), il `?v=` in
`index.html` e `APP_CONFIG.versione` in `js/app.js`, altrimenti i dispositivi continuano a usare i
file vecchi.

## Pubblicazione

L'app è la cartella `causa-effetto/` del repository **tutte-le-webapp** (GitHub → Azure Static
Web Apps), con la sua voce nell'elenco `APP` dell'`index.html` della radice. Ogni `git push` sul
ramo `main` aggiorna il sito. La stessa cartella si può caricare anche nel portale
`https://www.assistivetech.it/webapp/causa-effetto/` (FileZilla).

- Tutte le app dello stesso indirizzo condividono cache e dati del browser, per questo:
  - il service worker cancella solo le proprie cache (prefisso `causa_effetto_`);
  - **Aggiorna App** disattiva solo il service worker di questa cartella e cancella solo le
    proprie cache;
  - i dati usano chiavi proprie (`ce_…` in localStorage, database `causa-effetto`);
  - l'app non chiama mai `localStorage.clear()`.

## Su iPad

- Si apre l'indirizzo in **Safari** → Condividi → **Aggiungi alla schermata Home**.
- Attivare l'**Accesso Guidato** (Impostazioni → Accessibilità) per impedire di uscire dall'app.
- Se lo schermo si spegne comunque: Impostazioni → Schermo e luminosità → Blocco automatico: Mai.
- Se l'icona viene tolta dalla schermata Home, i dati spariscono: tenere un'esportazione.

## Note

- **Pubblicità**: i video monetizzati possono mostrare annunci anche incorporati; l'app non può
  toglierli. Meglio video senza annunci o di un proprio canale.
- **Pittogrammi ARASAAC**: autore Sergio Palao, proprietà del Governo di Aragona, licenza
  CC BY-NC-SA. Le condizioni d'uso sono nel menu *Informazioni* e nella scheda *Oggetti*.
