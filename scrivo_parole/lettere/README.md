# Scrivo Parole con le Lettere

**Composizione di parole lettera per lettera.** L'educatore prepara le parole (con immagine ARASAAC,
foto propria o solo testo) e sceglie le lettere disponibili, distrattori compresi; nell'Area Utente
compare lo stimolo e l'utente compone la parola toccando o trascinando le lettere nelle caselle.

Applicazione **statica** (HTML/CSS/JavaScript), installabile come PWA su tablet Android, iPad e
computer. **Un dispositivo = un utente**: non c'è registrazione né login, i dati restano nel browser.

> Versione autonoma del modulo che faceva parte del portale assistivetech.it (backend PHP + MySQL).
> Qui il backend è sostituito da un archivio locale in `localStorage` (`js/archivio.js`).

## Funzionalità

### Area Educatore (`gestione.html`)
- **Impostazioni**: numero di prove per sessione, tasto cancella visibile, complimento BRAVO/BRAVA.
- **Crea esercizio**: parola, immagine (ricerca ARASAAC, foto dal dispositivo o solo testo) e lettere
  disponibili (tutto l'alfabeto, solo quelle della parola, o scelte a mano).
- Elenco degli **esercizi creati** con eliminazione.
- **Copia dei dati**: Esporta / Importa in un file JSON (backup o travaso su un altro dispositivo;
  l'import sostituisce i dati attuali).

### Area Utente (`esercizio.html`)
- Sessione di N prove con parole estratte senza ripetizioni; lettere per tocco, trascinamento o tastiera.
- Voce (sintesi vocale), aiuto con la lettera in trasparenza, cursore, avanzamento automatico,
  dimensione e colori regolabili (menu laterale, salvati sul dispositivo).
- Riepilogo finale con tabella e grafico.

## Architettura dati

| Dato | Dove | Chiave |
|---|---|---|
| Esercizi | `localStorage` | `spl_config` |
| Impostazioni dell'educatore | `localStorage` | `spl_impostazioni` |
| Storico delle prove | `localStorage` | `spl_risultati` |
| Preferenze di visualizzazione | `localStorage` | `scrivo_*` (già presenti nella versione originale) |

Le chiavi hanno prefissi propri e la cache del service worker il prefisso
`scrivo_parole_con_le_lettere_`: non toccano le altre app sullo stesso dominio. Il pulsante
"aggiorna" (`js/clear-cache.js`) svuota solo la cache di questa app e **non** cancella i dati.

### Immagini
- **Foto caricate**: ridimensionate a max 600 px e salvate nell'esercizio (data URL).
- **ARASAAC**: la ricerca richiede internet. Al salvataggio il pittogramma viene scaricato e
  incorporato nell'esercizio, così funziona anche offline ed è incluso nell'esportazione; se il
  download non riesce resta il link al sito ARASAAC.
- `localStorage` ha uno spazio limitato (circa 5 MB): con molte foto conviene esportare e fare
  pulizia. Se lo spazio finisce l'app lo segnala invece di perdere dati.

Rispetto al portale non c'è la "taratura font" per utente (era un altro strumento): si usano le
regolazioni del menu laterale dell'Area Utente.

## Struttura

```
├── index.html             Scelta Area Educatore / Area Utente
├── gestione.html          Area Educatore
├── esercizio.html         Area Utente
├── css/styles.css
├── js/
│   ├── archivio.js        Archivio locale (sostituisce il vecchio backend PHP)
│   ├── arasaac-service.js Ricerca pittogrammi ARASAAC
│   ├── educatore-app.js   Logica Area Educatore
│   ├── esercizio-app.js   Logica Area Utente
│   └── clear-cache.js     Pulsante "aggiorna app" (solo questa app, NON i dati)
├── assets/                icone PWA, Bootstrap Icons, chart.min.js
├── manifest.json · service-worker.js · staticwebapp.config.json · serve.json
```

## Sviluppo locale

```bash
cd scrivo_parole_con_le_lettere
npx serve          # poi aprire http://localhost:3000
```

Dopo ogni modifica conviene aumentare la versione in `service-worker.js` (`CACHE_NAME`) e il `?v=`
nei tag `<script>`/`<link>` delle pagine.

## Pubblicazione

- Statica: va bene su Azure Static Web Apps, come singola app o come cartella di una raccolta.
- Non serve pubblicare `README.md`, `serve.json`, `staticwebapp.config.json` quando si carica via FTP
  in un portale esistente.
