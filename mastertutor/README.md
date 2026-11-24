# Mastertutor

Strumento di **stimolazione e ascolto** per utenti con disabilità: audio registrati con la voce di chi
conosce l'utente, video YouTube (anche **solo audio**) e una **presa smart Tapo** per accendere una
luce, un ventilatore o un giocattolo.
È la versione PWA del programma Python *Mastertutor_Tapo*.

Applicazione **statica** (HTML/CSS/JavaScript) per Azure Static Web Apps, installabile su **computer e
tablet**. Audio, video e registro restano nel browser del dispositivo, divisi in **configurazioni con un
nome, una per utente** (dalla versione 1.0.21).

## Funzionalità

### Configurazione (prima «Area Educatore», accesso libero)

All'apertura l'app va **direttamente all'esercizio** se c'è almeno uno stimolo nel gioco, altrimenti
sulla **Configurazione** (tasti «Vai all'esercizio» e «Configurazione» per passare dall'una all'altro).
Intestazione bianca con il logo della Lega del Filo d'Oro (versione 1.0.20, 23/11/2026).

**Configurazioni (una per utente, versione 1.0.21).** In cima alla Configurazione si sceglie l'**utente**, cioè la
configurazione in uso; **Nuova** ne crea una (vuota oppure copia di quella attuale: audio, video,
anticipatori e tempi, senza registro), **Rinomina** ed **Elimina** agiscono su quella scelta (l'ultima
rimasta non si può eliminare). Ognuna ha i suoi audio, video, impostazioni, ordine degli stimoli e
registro; le prese (account Tapo e indirizzi) e il codice del ponte sono del dispositivo, comuni a
tutte. Con più configurazioni la pagina dell'esercizio mostra il nome di quella in uso.
I dati delle versioni precedenti diventano la configurazione «Utente 1» (stesse chiavi di `localStorage`;
le altre usano `mt_…@c2`, `mt_…@c3`…; ogni audio in IndexedDB ha il campo `config`).
**Esporta/Importa** lavorano sulla configurazione in uso.

| Scheda | Cosa si fa |
|---|---|
| **Audio** | Registrare la voce con il microfono del dispositivo, oppure caricare **qualsiasi file audio** dal disco (MP3, vocali **WhatsApp**, M4A, WAV, FLAC, AMR, WMA, AIFF, anche l'audio di un video). Tutto viene convertito in MP3 nel browser (lamejs) e il silenzio iniziale e finale viene tagliato. Con la spunta **Nel gioco** l'audio diventa uno stimolo |
| **YouTube** | Ricerca integrata (scrivendo la categoria si apre YouTube), link, nome, **tempi di inizio e fine**, scelta **video** oppure **solo audio** |
| **Anticipatore** | L'audio che annuncia ogni stimolo, **uno per ogni tipo**: voci, musica (YouTube) e ogni presa (es. «anticipatore-ventilatore»); oppure il generale: suono predefinito, nessuno, o uno registrato o caricato |
| **Presa** | Abbinamento con il **ponte** (codice di 12 caratteri), **elenco delle prese in funzione** con scelta, prova ed **Elimina**, durata. Il pulsante **Configura le prese** (anche nel menu ⋮) apre una finestra a scomparsa per inserire account Tapo e indirizzi delle prese di una nuova rete, per esempio a casa, e salvarli sul ponte |
| **Tempi** | Attesa casuale minima e massima, durata massima di audio e video, tipi di stimolo usati, tempo per rispondere allo switch |
| **Registro** | Sessioni svolte: stimoli, risposte allo switch, tempi medi di risposta, pressioni |

### Area Utente

La modalità si sceglie con il pulsante in alto a sinistra.

| Modalità | Comportamento |
|---|---|
| **Stimolazione casuale** | Come il programma originale. L'educatore preme *Avvia*; dopo un'attesa casuale suona l'anticipatore e parte lo stimolo. **Audio e video** seguono la lista (o partono a caso, se scelto); la **presa** parte sempre a caso, tra uno stimolo e l'altro |
| **Stimolo su richiesta** | Come sopra, ma dopo l'anticipatore lo stimolo parte **solo se l'utente preme lo switch** entro il tempo impostato. Il registro raccoglie risposte e tempi di reazione (causa-effetto) |
| **Ascolto con switch** | Come nelle altre app: **Diretto**, **Random** (mai lo stesso due volte di fila), **Temporizzato** (pausa dopo N secondi, lo switch riprende), **🔒 Timer persistente** (switch disattivato durante il timer), **Navigazione assistita** (la voce annuncia ogni stimolo, che parte dopo un conto alla rovescia) |

- **Switch**: SPAZIO, INVIO, frecce (Makey Makey, switch USB o Bluetooth) oppure **tocco sullo schermo**.
- **Doppio switch** (opzione): la FRECCIA DESTRA fa sentire gli audio registrati. La musica YouTube va in
  pausa e riprende alla fine dell'audio.
- **Attesa tra gli stimoli**: si regola solo in Configurazione → *Tempi* (dalla 1.0.21 non ci sono più i
  cursori sotto *Avvia*); la pagina dell'esercizio la mostra nel riepilogo.
- **Ordine degli stimoli**: nell'elenco dell'Area Utente si trascinano con la maniglia ⠿ (mouse o
  dito; con la tastiera, frecce su e giù sulla maniglia). È un'unica sequenza, uguale in tutte le
  modalità e negli elenchi della Configurazione (dove è di sola lettura: l'ordine si cambia **solo**
  nell'Area Utente). Nella stimolazione casuale e su richiesta la lista di audio e video si ripete
  dall'inizio e salta quelli non disponibili (tipo escluso nei *Tempi*, video non riproducibile).
  La **presa** non fa parte della sequenza: parte a caso, tra uno stimolo e l'altro.
- **Video pronti in anticipo**: il prossimo video si carica, muto e nascosto, mentre suona l'audio
  anticipatore o scorre il conto alla rovescia, così parte subito.
- **Schermo intero**, schermo sempre acceso durante le sessioni, scene grandi e ad alto contrasto.
- I tasti **non comandano YouTube** (`disablekb`) e un velo trasparente impedisce al video di rubare il focus.
- Su **iPad/iPhone** YouTube parte da solo solo dopo un primo tocco sul video: all'avvio di una
  sessione l'app lo chiede una volta.

## Architettura dati

| Dato | Dove |
|---|---|
| Video YouTube, impostazioni, registro | `localStorage` |
| Audio registrati e caricati (MP3) | `IndexedDB` |
| Account Tapo e indirizzi delle prese | nell'APK: memoria privata dell'app sul tablet; con la webapp: solo nel `config.json` del **ponte**, mai nella webapp |

All'avvio l'app chiede `navigator.storage.persist()`. **Non cancellare i dati di navigazione** sul
dispositivo: contengono le registrazioni.

### Esporta / Importa (menu ⋮)

**Esporta dati** salva un unico file `.json` con impostazioni, video YouTube, ordine degli stimoli e
**gli audio inclusi** (in base64). **Importa dati** lo rilegge e sostituisce tutto. Serve a configurare
comodamente sul computer (dove copiare i link di YouTube è facile) e poi auto-configurare il tablet,
e vale anche come backup. Il file **non** contiene il registro delle sessioni né la password delle
prese; il codice di abbinamento del ponte resta quello del dispositivo su cui si importa. Gli id degli
audio vengono rimappati, così l'ordine degli stimoli resta corretto.

## La presa smart

Una PWA non può comandare le prese della rete locale, perché il browser lo impedisce. Ci sono due strade.

### 1. Mastertutor Android (APK): consigliata sul tablet

L'APK comanda le prese **direttamente dal tablet**, senza ponte e senza Azure. Si scarica dal riquadro
**Mastertutor Android** nella pagina iniziale della raccolta (cartella `mastertutor-android/`).
Nell'app: **Configurazione → Presa → Configura le prese** → account Tapo e indirizzi IP delle prese →
**Salva configurazione**. I dati restano nel tablet, che deve essere nella stessa rete Wi-Fi delle prese.
Così si crea una configurazione nuova per ogni rete (sede, casa).

### 2. Webapp (computer, tablet, telefono) con il ponte

```
webapp → /api/negotiate (funzione Azure) → Azure Web PubSub → ponte → prese Tapo
```

- **Il ponte** è un programma Node.js senza dipendenze, acceso su un computer o un Raspberry Pi nella
  rete delle prese. Sta nel repository **tecniciausili/mastertutor**, cartella `ponte/`, con le sue
  istruzioni. Come indirizzo dell'app gli si dà quello della raccolta (senza `/mastertutor/`).
- **La funzione `api/negotiate`** sta nella radice di questo repository (cartella `api/`), perché il
  ponte la chiama su *indirizzo del sito* + `/api/negotiate`. Ogni codice di abbinamento ha i suoi
  gruppi: chi non conosce il codice non comanda le prese.
- **Azure Web PubSub** fa da postino: va creato una volta sola (portale Azure → **Web PubSub Service**,
  gruppo **Ausili**, piano **Free (F1)**), poi nell'App Web statica della raccolta, **Impostazioni →
  Variabili di ambiente**, si aggiunge `WEBPUBSUB_CONNECTION_STRING` con la stringa di connessione
  primaria della risorsa (pagina **Chiavi**).
- Finché questa variabile manca, la scheda **Presa** della webapp lo dice e rimanda a Mastertutor Android:
  tutto il resto funziona.
- **Prese di un'altra rete** (per esempio a casa, con prese nuove): si avvia un ponte in quella rete,
  si inserisce il suo codice nella scheda *Presa*, poi con **Configura le prese** si scrivono account e
  indirizzi e si preme **Salva configurazione**. Il ponte salva, prova ogni presa e dice quali rispondono.
  La password viaggia cifrata fino al ponte e viene salvata solo lì, mai nella webapp.
- **Sicurezza**: la webapp chiede «accendi per N secondi» e lo spegnimento lo fa il ponte da solo, anche
  se il tablet perde la connessione.

## Da dove viene questa cartella

È la copia dei file web del repository **tecniciausili/mastertutor** (cartella `versione_pwa`), senza
`ponte/`, `strumenti/` e `api/`. Due piccole differenze per la raccolta: la webapp chiama la funzione
nella radice del sito (`/api/negotiate`) e il rimando all'APK porta alla pagina iniziale della raccolta.
Per una nuova versione: aumentare `CACHE_NAME` in `service-worker.js` e i `?v=` in `index.html`.

## Note

- **YouTube «solo audio»**: il video resta coperto da un'immagine. Le regole di YouTube per i player
  incorporati non consentono di separare l'audio dal video: è una scelta da valutare per un'app pubblica.
- YouTube rifiuta l'embed senza `origin` (errore 153): l'app va aperta da `http://localhost` o
  `https://`, non con doppio clic sul file.
