# Frase Minima

Esercizio di Training Cognitivo - AssistiveTech.it
Categoria: **leggo-scrivo**

Applicazione **statica** (HTML/CSS/JavaScript), installabile come PWA su tablet Android, iPad e
computer. **Un dispositivo = un utente**: non c'è registrazione né login, i dati restano nel browser.

> Versione autonoma del modulo che faceva parte del portale assistivetech.it (con un archivio sul
> server). Qui l'archivio è locale, in `localStorage` (`js/archivio.js`): nessun server necessario.

## Cosa fa

L'utente compone una frase minima trascinando tre pittogrammi nei box colorati,
rispettando la sequenza **soggetto → predicato → complemento**.

```
┌──────────────┬──────────────┬──────────────┐
│  CHI?        │ FA CHE COSA? │  CHE COSA?   │   riga 1: box da riempire
│  (blu)       │  (rosso)     │  (verde)     │   sfondo tenue, in sequenza
├──────────────┴──────────────┴──────────────┤
│        MAMMA  ______  ______   🔊 Ripeti    │   frase in costruzione
├──────────────┬──────────────┬──────────────┤
│ [pittogramma]│ [pittogramma]│ [pittogramma]│   riga 2: mescolati,
│  bordo verde │  bordo blu   │ bordo rosso  │   bordo sfumato del colore
└──────────────┴──────────────┴──────────────┘   del box di destinazione
```

- **Sequenza rigida**: il box attivo pulsa, quelli successivi sono attenuati.
  Trascinare fuori sequenza o nel box sbagliato viene rifiutato con voce,
  suono e messaggio; il pittogramma torna al suo posto. Tentativi illimitati.
- **Lettura vocale**: ogni parola viene letta appena entra nel box; a frase
  completa viene letta l'intera frase seguita dal rinforzo ("Bravo!").
- **Bottone "Ripeti la frase"**: enuncia la frase da comporre, per chi non
  l'ha capita bene. Disponibile in ogni momento e anche nella schermata finale.
- **Aiuto**: dopo 3 errori il pittogramma giusto pulsa (disattivabile).
- **Indizio colore dei bordi**: il pulsante 🎨 nell'header (e la voce corrispondente
  nel menu impostazioni) toglie il colore ai bordi, portandoli a nero. Serve quando
  l'utente ha imparato la successione soggetto-predicato-complemento e non ha più
  bisogno dell'accoppiamento cromatico pittogramma↔box come aiuto. È un interruttore:
  l'educatore può ripristinare i bordi colorati quando vuole. La scelta viene
  ricordata tra le frasi e tra le sessioni (sul dispositivo).
- Ogni completamento viene registrato con numero di errori e tempo impiegato.
- **Sessione di lavoro**: nell'Area Educatore si sceglie quante frasi compone l'utente in
  una sessione (oppure «Libera», chiave `fm_sessione`). Durante l'esercizio compare il contatore
  «Frase 3 di 10», le frasi escono a caso senza ripetersi finché non sono uscite tutte, e alla
  fine c'è il **riepilogo** (frasi senza errori, errori in tutto, tempo).

Modalità di risposta: **drag & drop col mouse**, **trascinamento col dito**,
**tap semplice** (il pittogramma va nel box attivo) e **tastiera** (Tab + Invio).

## Struttura

```
frase_minima/
├── index.html              # Scelta area (educatore / utente)
├── gestione.html           # Area educatore: compone le frasi, risultati, copia dei dati
├── esercizio.html          # Area utente: svolge l'esercizio
├── manifest.json           # Configurazione PWA
├── service-worker.js       # Funzionamento offline (cache con prefisso frase_minima_)
├── staticwebapp.config.json, serve.json   # Azure Static Web Apps / npx serve
├── css/styles.css
├── js/
│   ├── archivio.js         # Archivio locale (localStorage, chiavi fm_)
│   ├── educatore-app.js
│   ├── esercizio-app.js
│   ├── arasaac-service.js  # Ricerca pittogrammi ARASAAC
│   └── clear-cache.js      # Aggiorna i file: tocca solo le cache di questa app
└── assets/
    ├── icons/              # Icone PWA
    └── fonts/              # Bootstrap Icons (offline)
```

## Flusso educatore

1. Apre `gestione.html`.
2. Per ciascuno dei tre elementi sceglie l'immagine, in due modi alternativi:
   - **ARASAAC**: cerca per parola e clicca il pittogramma (serve la rete);
   - **Dal PC**: carica un'immagine propria dal dispositivo.
   Al salvataggio ogni immagine viene **incorporata** nella frase (ridimensionata a 600 px,
   PNG se ha trasparenza, altrimenti JPEG): l'esercizio funziona anche senza rete e
   le immagini finiscono nella copia dei dati. Se il pittogramma ARASAAC non si
   riesce a scaricare resta il suo link (in quel caso serve la rete anche nell'esercizio).
3. Scrive la parola di ogni box (es. `MAMMA` · `CUCINA` · `LA PASTA`).
   Scegliendo un pittogramma ARASAAC la parola viene precompilata con la
   keyword, ma resta modificabile: la keyword è all'infinito ("cucinare"),
   mentre nella frase serve il verbo coniugato.
4. **Frase letta**: si compone da sola con le tre parti separate da un trattino
   (`il bambino - mangia - la mela`) ed è modificabile; il bottone "Automatica" la
   ricompone. La voce la legge senza trattini.
5. Decide se mostrare le parole scritte sotto i pittogrammi durante l'esercizio.
6. Salva. La frase compare subito nell'area dell'utente.
7. Nella sezione "Ultimi Risultati" vede data, frase, esito e tempo.
8. **Copia dei dati**: Esporta / Importa in un file JSON (`frase-minima-AAAA-MM-GG.json`)
   frasi, risultati e impostazioni, per un backup o per passarli su un altro tablet
   (l'import sostituisce i dati attuali).

## Codice colore

| Elemento     | Colore | Box utente        | Domanda guida  |
|--------------|--------|-------------------|----------------|
| Soggetto     | Blu    | sfondo azzurro    | Chi?           |
| Predicato    | Rosso  | sfondo rosa       | Fa che cosa?   |
| Complemento  | Verde  | sfondo verde tenue| Che cosa?      |

I pittogrammi in basso hanno il bordo sfumato del colore del box a cui
appartengono: è un indizio visivo, non svela la sequenza.

## Dati sul dispositivo

| Chiave localStorage | Contenuto |
|---|---|
| `fm_config` | frasi: per soggetto, predicato e complemento testo, immagine (data URL), id ARASAAC; frase letta; mostra_testo |
| `fm_risultati` | una riga per frase completata: frase, errori, tempo in secondi, data (ultime 2000) |
| `fm_impostazioni` | impostazioni del menu dell'Area Utente |
| `fm_scala_testo` | dimensione del testo sotto i pittogrammi |
| `fm_bordi_colorati` | indizio colore dei bordi (`1` / `0`) |

Sullo stesso sito convivono altre app: ognuna usa il suo prefisso e nessuna cancella i dati
delle altre. Lo spazio del browser è limitato (circa 5 MB): con molte foto caricate, se compare
il messaggio «Spazio del browser esaurito», eliminare qualche frase o esportare e fare pulizia.

## Pubblicazione e prova in locale

Fa parte della raccolta di web app (una cartella per app) pubblicata come Azure Static Web App.
In locale: `npx serve` (usa `serve.json`) oppure `python3 -m http.server` dalla cartella che la contiene.

Dopo un aggiornamento dei file aumentare `CACHE_NAME` in `service-worker.js` e i `?v=` nelle
pagine; se il browser mostra la versione vecchia usare il pulsante 🔄 in alto a destra
(cancella solo le cache e il service worker di questa app, non i dati).

Pittogrammi ARASAAC (Sergio Palao, Governo di Aragona), licenza CC BY-NC-SA.
