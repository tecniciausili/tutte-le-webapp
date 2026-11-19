# Apprendere Categorie

Comunicatore a **griglie di categorie**: l'utente tocca una categoria (per esempio *Mangiare*), poi
un elemento (*la pizza*) e compare la **frase** a celle grandi, letta ad alta voce
(«io mangio la pizza»). Un tocco sulla frase riporta alla griglia iniziale, con le celle in
**ordine casuale**: così l'utente impara a cercare la categoria e non la posizione.

Applicazione **statica**: un solo `index.html` con stile e codice dentro, installabile come PWA.
**Un dispositivo = un utente**: griglie, immagini e impostazioni restano nel browser del dispositivo.

## Uso

- **Modalità utente** (barra scura in alto): 🏠 torna alla griglia iniziale dell'app, ← torna
  alla griglia precedente, ⛶ schermo intero. Si può nascondere la barra (Impostazioni): resta
  solo ⚙ in alto a destra, quasi invisibile.
- **Modalità modifica**: si entra **tenendo premuto ⚙ per 1,2 secondi** (l'utente non ci entra
  per sbaglio). Al primo avvio l'app parte già in modifica, con due griglie di esempio.
  - Griglie: crea, rinomina, elimina, imposta come iniziale (★), da 1 a 8 colonne e righe.
  - Cella: testo, testo nella frase, immagine (simboli **ARASAAC** cercati in rete, oppure
    un'immagine dal dispositivo, ridotta a 320 px), colore, azione: *passa a un'altra griglia*,
    *vai alla frase*, *avvia un video YouTube*. Una cella può essere un **soggetto** (sostituisce
    «Io») o restare fuori dalla frase.
  - Impostazioni: soggetto predefinito, voce e velocità della sintesi vocale, pronuncia a ogni
    tocco, schermo intero all'uscita dalla modifica, chiave API di YouTube (facoltativa).
- **Video YouTube**: si apre a tutto schermo; a fine video, con il pulsante rosso ← o con il tasto
  Indietro di Android si torna alla griglia. Senza chiave API, «Cerca» apre YouTube in un'altra
  scheda e si incolla il link.

## Menu ☰ (in modalità modifica)

**Esporta dati** / **Importa dati** (file `apprendere-categorie-dati-AAAA-MM-GG.json`, per
passare le griglie a un altro dispositivo; l'importazione sostituisce tutte le griglie),
**Installa l'app**, **Aggiorna App** (scarica l'ultima versione; i dati restano e senza
connessione non cancella nulla).

## Dati

| Dato | Dove |
|---|---|
| Griglie, celle, immagini (come data URL), impostazioni | `IndexedDB` (`apprendere-categorie` → `kv`, chiave `state`) |
| Chiave API di YouTube | `localStorage` (`ac_ytkey`): resta sul dispositivo, **non** va nel file esportato |
| File dell'app per l'uso senza rete | cache del service worker (`apprendere_categorie_v…`) |

Le immagini ARASAAC scelte vengono salvate dentro i dati: funzionano anche senza rete. La ricerca
dei simboli e i video YouTube richiedono la connessione.

## Aggiornare l'app

Dopo una modifica aumentare la versione in `service-worker.js` (`CACHE_NAME`) e nei `?v=` di
`index.html`, poi seguire il README della raccolta (`bash controlla.sh`, commit, push).

Pittogrammi ARASAAC (Sergio Palao, Governo di Aragona), licenza CC BY-NC-SA.
