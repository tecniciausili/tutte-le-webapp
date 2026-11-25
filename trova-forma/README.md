# Trova Forma — web app (PWA)

Conversione dell'app Python (`TrovaForma_p100.py` + `Es_OculoManuali_p100v9.py`) in una web app statica: HTML + JavaScript puro, nessuna dipendenza, nessun build.

## Avvio

Fa parte della raccolta delle web app (repository `tutte-le-webapp`, pubblicato su Azure Static Web
Apps): è una cartella statica come le altre, senza server.

```bash
cd ..  &&  npx serve      # dalla radice della raccolta (oppure python3 -m http.server 8080)
                          # poi http://localhost:3000/trova-forma/
npm test                  # test del modulo touch (dalla cartella trova-forma)
```

Non aprire `index.html` con doppio clic (`file://`): service worker e YouTube richiedono `http(s)`.
HTTPS (quello di Azure) è necessario per installare la PWA, per lo schermo intero e per YouTube.

## Come le altre app della raccolta (versione 1.1.0, 25/11/2026)

- Intestazione bianca con il logo della Lega del Filo d'Oro a sinistra.
- All'apertura va **direttamente all'esercizio** se c'è almeno un video di rinforzo, altrimenti alla
  **Configurazione**. L'esercizio ha il riepilogo, il grande pulsante «Inizia gioco» e il tasto
  «Configurazione»; la Configurazione ha «Vai all'esercizio».
- Barra «Installa Trova Forma su questo dispositivo» in basso (`js/installa.js`, uguale in tutte le
  app); durante il gioco non compare.
- `service-worker.js` con cache dal prefisso `trova_forma_`: all'aggiornamento cancella solo le sue
  cache, mai quelle delle altre app dello stesso indirizzo. Chiavi di localStorage con prefisso `tf.`,
  database IndexedDB `trovaforma`.

## Uso

1. **Configurazione** (all'apertura, finché non c'è un video di rinforzo): sfondo, oggetto (GIF animata o immagine), dimensioni in cm, contrasto, zona dello schermo in cui si muove, tolleranza del tocco, rinforzo.
2. **Rinforzo:** cerca su YouTube (serve una chiave API, vedi sotto) oppure incolla il link di un video; ogni video ha secondi di inizio e fine (o "Anteprima" per sceglierli ascoltando). Scegli **audio + video** o **solo audio** e la durata in secondi.
3. **Esercizio → Inizia gioco** → schermo intero. L'oggetto compare al centro; al tocco parte il rinforzo per i secondi impostati (solo audio: lo schermo resta senza oggetto; audio+video: il video riempie lo schermo); poi l'oggetto riappare in una posizione diversa.
4. **Uscita:** `Esc`, oppure **pressione lunga** sulla rotellina in alto a destra → torna alla pagina da cui è partito e mostra il riepilogo (tocchi, prove, durata). I dati si scaricano in JSON.
5. **Salva / Apri configurazione:** file JSON autosufficiente (include l'immagine dell'oggetto, **non** la chiave API). La configurazione corrente è comunque ricordata dal browser.

Dettaglio di tutte le protezioni sui tocchi: [`docs/ACCORGIMENTI_TOUCH.md`](docs/ACCORGIMENTI_TOUCH.md).

## Corrispondenza con l'app Python

| Python | Web app |
|---|---|
| Colore sfondo, oggetto GIF, dimensione in cm (37 px/cm) | Uguale; ora anche immagine fissa; taratura px/cm modificabile (37,8 = 96 dpi) |
| Moving area X/Y (tagli da 0 e dalla fine) | Quattro margini (sx, dx, alto, basso) in cm, con anteprima. Nell'app Python il margine Y usava per errore lo stesso valore in alto e in basso |
| "Spostamento" (0–1000 px, scarto verticale) | "Escursione verticale" in % dell'area disponibile |
| Posizione: casuale a destra o a sinistra del centro | Casuale in tutta l'area, **sempre diversa dalla precedente** (distanza minima ≈ dimensione dell'oggetto) |
| Audio VLC + pausa/ripresa | Playlist YouTube con inizio/fine; "riprendi da dove interrotto" (come VLC) oppure "riparti dall'inizio" |
| Oggetto spostato dopo 15 s senza tocco (+ 5,5 s di pausa) | Uguale, regolabile (0 = mai) |
| `DATI Sessione….json` con Durata sessione / Trials / Touching responses | Stesse chiavi, più durata totale, motivo di uscita e elenco eventi con latenza di ogni tocco |

## Non portato (decisione da confermare)

- **Prompt audio** (la seconda traccia riprodotta quando l'oggetto riappare): nella descrizione del risultato finale non era previsto, quindi non è stato implementato.
- **Presa Tapo P100** (rinforzo esterno): un browser non può parlare con la presa (protocollo locale cifrato, niente CORS, blocco "mixed content" da HTTPS verso HTTP). Servirebbe un piccolo servizio locale (Node) che la pagina chiama; l'app è già strutturata per aggiungerlo.

## YouTube — note importanti

- **Ricerca nella pagina:** usa la YouTube Data API v3 e quindi una *chiave API* (Google Cloud → abilitare "YouTube Data API v3" → credenziali). Quota gratuita: circa 100 ricerche al giorno. La chiave resta solo nel browser del dispositivo. Senza chiave si può comunque incollare un link.
- Sono proposti solo video **incorporabili**; se uno non lo è (o viene rimosso) l'app lo salta.
- **Solo audio:** il player resta attivo ma invisibile. Le condizioni d'uso del player incorporato di YouTube chiedono che il player sia visibile: per un uso clinico/di ricerca interno è prassi comune, ma va tenuto presente se l'app viene distribuita.
- **Autoplay:** il gioco parte da un clic su "Inizia gioco", che sblocca la riproduzione; il primo video viene caricato e messo in pausa in quel momento. Serve connessione internet per il rinforzo; offline l'app continua a funzionare senza rinforzo.
- Il tempo di rinforzo parte quando il video sta realmente suonando (massimo 4 s di attesa), così il buffering non accorcia il rinforzo.

## Stato dei collaudi

Verificato in Chromium (Playwright) con tocchi emulati e un player YouTube simulato: tolleranza, strisciate, dito appoggiato, rotellina, Esc, "indietro", gesti bloccati, durata e ripresa del rinforzo, nuova posizione diversa, import/export. **Non ancora provato** su tablet/touchscreen reali né con YouTube reale: prima dell'uso con i pazienti fare una prova sul dispositivo finale (schermo intero, audio, taratura px/cm).

## Struttura

```
index.html  manifest.json  service-worker.js
css/style.css
assets/img/        logo della Lega del Filo d'Oro
js/installa.js     barra «Installa sul dispositivo» (uguale in tutte le app della raccolta)
js/config.js       configurazione, salvataggio, import/export
js/touch-guard.js  modulo touchscreen tollerante + blocco gesti
js/youtube.js      ricerca, player, riproduzione del rinforzo
js/game.js         ciclo di gioco
js/ui.js           pagina di configurazione e riepilogo dell'esercizio
js/main.js         apertura (esercizio o Configurazione), avvio, schermo intero, uscita
tests/             test automatici
```
