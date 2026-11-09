# Parola-Immagine

Esercizio di Training Cognitivo - AssistiveTech.it
Categoria: **leggo-scrivo**

Applicazione **statica** (HTML/CSS/JavaScript), installabile come PWA su tablet Android, iPad e
computer. **Un dispositivo = un utente**: non c'è registrazione né login, i dati restano nel browser.

> Versione autonoma del modulo `training_cognitivo/leggoscrivo/parolaimmagine` del portale
> assistivetech.it, che usava un database sul server (API PHP, tabelle `parola_immagine_*`,
> taratura font per utente). Qui l'archivio è locale (`js/archivio.js`): nessun server necessario.

## Cosa fa

L'educatore crea le **coppie**: un **target** (l'immagine giusta) e un **distrattore** (quella
sbagliata), ciascuno con la sua parola. L'utente sceglie tra due esercizi:

| Esercizio | Si vede | Si sceglie | Voce |
|---|---|---|---|
| **Parola → Immagine** (`esercizio.html`, arancione) | la parola | una di due immagini | legge la parola |
| **Immagine → Parola** (`esercizio-immagine-parola.html`, viola) | l'immagine | una di due parole | «Scegli: X o Y» |

- Le coppie escono **a caso senza ripetersi** finché non sono uscite tutte; il target sta sopra o
  sotto a caso. Una sessione ha il numero di prove scelto dall'educatore (1-50, predefinito 10).
- Risposta giusta: «Bravo!» con coriandoli e voce, poi la prova successiva.
- Risposta sbagliata: «Riprova»; al primo errore la stessa coppia torna con le posizioni invertite,
  al secondo si passa alla prova successiva.
- **Ascolta** ripete la parola (o le due parole); **Avanti** salta la prova senza registrare nulla.
- A fine sessione: riepilogo con risposte corrette/errate, percentuale e tabella per parola.
- Menu **☰**: grandezza della parola, delle immagini e degli spazi, salvati per ciascun esercizio.
- 🔊 nell'header attiva/disattiva la voce.

## Area Educatore (`gestione.html`)

- **Impostazioni Sessione**: numero di prove per sessione (vale per tutti e due gli esercizi).
- **Testo delle parole**: carattere, colore del testo e dello sfondo, spazio tra le lettere,
  maiuscolo, grassetto. Prende il posto della «taratura font» del portale.
- **Crea Nuova Coppia**: per target e distrattore si cerca un pittogramma **ARASAAC** (serve la rete)
  oppure si carica un'**immagine dal dispositivo**. La parola è sempre modificabile (per le foto la
  propone il nome del file). Al salvataggio le immagini vengono **incorporate** nella coppia
  (data URL, pittogrammi 500 px, foto ridotte a 800 px): gli esercizi funzionano anche offline.
- **Coppie Create**, con eliminazione.
- **Ultime Sessioni**: data, esercizio, prove, risposte, percentuale e parole sbagliate.
- **Copia dei dati**: **Esporta** salva tutto (immagini comprese) in un file `.json`;
  **Importa** lo ricarica qui o su un altro dispositivo, sostituendo i dati attuali.

## Dove stanno i dati

| Dove | Chiave | Contenuto |
|---|---|---|
| IndexedDB | database `parola-immagine`, archivio `coppie` | coppie con le immagini incorporate |
| localStorage | `pi_impostazioni` | prove per sessione + testo delle parole |
| localStorage | `pi_risultati` | una riga per ogni risposta (al massimo 3000) |
| localStorage | `pi_display_parola_immagine`, `pi_display_immagine_parola` | menu ☰ dei due esercizi |
| localStorage | `pi_voce` | voce attiva |

Le cache del service worker iniziano con `parola_immagine_`. Il pulsante ⟳ («Aggiorna l'app»)
cancella solo quelle e il service worker di questa cartella: **non** tocca i dati, né quelli delle
altre app dello stesso dominio.

## Struttura

```
parola_immagine/
├── index.html                       # Scelta: Area Educatore / i due esercizi + «Installa sul dispositivo»
├── gestione.html                    # Area Educatore
├── esercizio.html                   # Parola → Immagine
├── esercizio-immagine-parola.html   # Immagine → Parola
├── manifest.json                    # PWA (con scorciatoie alle tre aree)
├── service-worker.js                # Offline (cache con prefisso parola_immagine_)
├── css/styles.css
├── js/
│   ├── archivio.js       # Archivio locale (IndexedDB + localStorage pi_), esporta/importa
│   ├── educatore.js      # Area Educatore
│   ├── esercizio.js      # I due esercizi (modalità da <body data-modo>)
│   ├── comune.js         # Aggiorna l'app, avvisi, registrazione del service worker
│   ├── blocco-tocco.js   # Negli esercizi: niente zoom/menu con tocchi involontari (LIM, tablet)
│   ├── installa.js       # Riquadro «Installa sul dispositivo» (uguale in tutte le app)
│   └── raccolta.js       # Dove portano ← e 🏠 (indice della raccolta)
└── assets/
    ├── icons/            # Icone PWA
    └── fonts/            # Bootstrap Icons (offline)
```

## Navigazione

**←** porta al livello sopra (dagli esercizi e dall'Area Educatore alla pagina iniziale dell'app,
dalla pagina iniziale all'indice della raccolta); **🏠** porta all'indice della raccolta.
Con una sessione in corso viene chiesta conferma prima di uscire.

## Aggiornare l'app

Dopo una modifica aumentare la versione in `service-worker.js` (`CACHE_NAME`) e i `?v=` nelle pagine
(e nell'elenco del service worker), altrimenti i dispositivi continuano a usare i file vecchi.

Fa parte della raccolta di web app (una cartella per app) pubblicata come Azure Static Web App.

Pittogrammi ARASAAC (Sergio Palao, Governo di Aragona), licenza CC BY-NC-SA.
