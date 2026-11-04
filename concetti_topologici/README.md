# Concetti topologici (web app autonoma)

Esercizio sui concetti topologici: sopra/sotto, dentro/fuori, davanti/dietro, accanto/in mezzo (le
tessere del libro di CAA), più destra/sinistra, vicino/lontano, in alto/in basso.

Questa è la versione **autonoma**, pubblicata in `assistivetech.it/webapp/concetti_topologici/` e
scaricabile senza passare dal portale. La versione del portale, con login, assegnazione dell'esercizio
e dati su MySQL, sta in `training_cognitivo/strumenti/concetti_topologici/` (esercizio 70) ed è un
progetto separato: scene, tessere e logica dell'esercizio sono le stesse.

**Modello: UN DISPOSITIVO = UN UTENTE** (come Grid, Occhio, Scegli tra due). Nessun server, nessun login:
- profilo (impostazioni e scene) → `localStorage` («ct_profilo»);
- foto caricate dall'educatore → IndexedDB `concetti_topologici`, store `foto` (ridimensionate a 700 px);
- risultati (una riga per risposta, anche i tentativi dopo un errore) → IndexedDB, store `risultati`.

L'app funziona **senza connessione**: il service worker precarica tutti i file, compresi i font
(in `assets/fonts/`, licenza SIL OFL). La rete serve solo per cercare i pittogrammi ARASAAC (quelli già
visti restano in cache) e per il primo scontorno di una foto (poi il modello è in cache).

**Novità 1.1.0 (3/11/2026)**, allineate alla versione del portale:
- scheda **Scene a colonna**: le 7 coppie sempre visibili, una riga per concetto con le sue scene e «Crea scena»;
  interruttore per coppia e per scena;
- **editor interattivo**: nell'anteprima si **trascina** un'immagine per spostarla e si usa la **maniglia**
  d'angolo per ingrandirla/rimpicciolirla (campi `scala` 0,3–3, `dx` ±170, `dy` ±130 nel viewBox 400×300;
  le tessere restano simboli puri). `archivio.js` → `trasformaValida()` conserva questi campi: senza, la
  validazione del profilo li toglierebbe al primo salvataggio;
- **scontorno delle foto** nel browser (toglie lo sfondo e ritaglia sull'oggetto): onnxruntime-web 1.24.3
  da jsDelivr + modello `modelli/u2netp.onnx` (U²-Net leggero, ~4,5 MB, licenza Apache-2.0). Si scaricano
  al primo scontorno e poi restano in cache (anche offline); la foto non esce dal dispositivo. Se non
  riesce (es. senza rete la prima volta) si salva la foto intera. Non si applica all'«immagine pronta».

**Copia di sicurezza** (Area Educatore → Impostazioni): «Scarica la copia» salva un file JSON con
scene, foto (base64), impostazioni e risultati; «Ripristina una copia» sostituisce scene e impostazioni
e somma i risultati, senza doppioni. Così l'educatore prepara al computer e ritrova tutto sul tablet.

## Pensata per un utente sordo che comunica in LIS

Nessuna domanda scritta o parlata, nessun suono: solo scene e tessere, rinforzo visivo. La domanda la fa
l'educatore in LIS, come coppia di opposti («dov'è l'oggetto? dentro o fuori?»): pausa **prima** della
risposta e **dopo** (pulsante «Avanti» in alto a destra o Spazio, oppure a tempo, oppure nessuna pausa).

## Pagine

- `index.html`: scelta fra Area Educatore e Area Utente, installazione come app.
- `gestione.html`: scene per coppia (simboli del libro, scatola e cesto disegnati, ARASAAC, foto,
  immagine pronta), impostazioni, risultati, copia di sicurezza. «Prova» = esercizio senza salvare.
- `gioca.html`: esercizio (Riconosci, Esegui o alternati). Per uscire: lucchetto premuto 2 secondi, o Esc.

## Pubblicazione

Fa parte della raccolta «tutte-le-webapp» (GitHub → Azure Static Web Apps): la cartella sta nella
radice del repository e la voce è nell'elenco `APP` di `index.html`.

Cambiando i file dell'app, aggiornare `CACHE_NAME` in `service-worker.js` e i `?v=` nelle pagine.

Modello di scontorno U²-Net (u2netp), licenza Apache-2.0; onnxruntime-web, licenza MIT.
Pittogrammi ARASAAC (arasaac.org), autore Sergio Palao, proprietà del Governo di Aragona, licenza CC BY-NC-SA.
