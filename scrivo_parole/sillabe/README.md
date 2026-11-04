# Scrivo Parole con le Sillabe

**Composizione di parole sillaba per sillaba.** L'educatore inserisce le sillabe disponibili
(corrette e distrattori) e le parole da comporre; nell'Area Utente compare il pittogramma della
parola e l'utente tocca le sillabe nell'ordine giusto. Pensata anche per l'**ipovisione**:
dimensione del testo e colori delle sillabe si scelgono per ogni esercizio.

Applicazione **statica** (HTML/CSS/JavaScript), installabile come PWA su tablet Android, iPad e
computer. **Un dispositivo = un utente**: non c'è registrazione né login, i dati restano nel browser.

> Versione autonoma del modulo che faceva parte del portale assistivetech.it (backend su server
> con database). Qui il backend è sostituito da un archivio locale in `localStorage`
> (`js/archivio.js`). Sta in `scrivo_parole/sillabe/`, accanto a `scrivo_parole/lettere/`: la pagina
> `scrivo_parole/index.html` fa scegliere fra le due.

## Funzionalità

### Area Educatore (`gestione.html`)
- **Sillabe disponibili**: si scrivono (anche più insieme: `CA, SA, MA`) o si aggiungono le
  «sillabe comuni»; quelle in più fanno da distrattori.
- **Parole target**: una o più per esercizio. Una parola che non si può comporre con le sillabe
  inserite viene segnata in rosso e l'esercizio non si salva finché non si corregge.
- **Accessibilità**: dimensione del testo (1,5–10 rem), colore di sfondo e del testo delle sillabe,
  con anteprima.
- Al salvataggio il **pittogramma ARASAAC** di ogni parola viene scaricato e incorporato
  nell'esercizio (PNG, max 400 px): poi funziona anche senza rete. Senza rete al momento del
  salvataggio l'esercizio si salva lo stesso e mostra la parola scritta.
- Elenco degli **esercizi creati** con eliminazione; **statistiche** per parola (grafico Chart.js
  in locale, oppure tabella se il grafico non si può disegnare).
- **Copia dei dati**: Esporta / Importa in un file JSON (`scrivo-parole-sillabe-AAAA-MM-GG.json`).
  L'importazione sostituisce i dati attuali.

### Area Utente (`esercizio.html`)
- Scelta dell'esercizio, poi una parola estratta a caso fra quelle dell'esercizio.
- La voce legge la parola e poi le sue sillabe (lettura per sillabe disattivabile con il pulsante
  🔊 nell'intestazione); ogni sillaba toccata viene letta.
- Accanto al pittogramma della parola richiesta compare quello della parola composta (se è una
  parola dell'esercizio, o con la rete attiva, da ARASAAC).
- Verifica automatica quando il numero di sillabe è quello giusto, oppure con «Verifica parola».
  Primo errore: si riprova la stessa parola; secondo errore: la voce dice la parola giusta e si
  passa a un'altra. Dopo una risposta giusta si passa da soli a un altro esercizio.
- Cursore per ingrandire box e sillabe; tastiera (Tab + Invio) oltre al tocco.

## Dati (localStorage)

| Chiave | Contenuto |
|---|---|
| `sps_config` | esercizi: `id_esercizio`, `sillabe_disponibili`, `parole_target`, `font_size`, `bg_color`, `text_color`, `immagini` (`{PAROLA: dataURL}`), `data_creazione` |
| `sps_impostazioni` | area utente: `zoom`, `sillabazione` |
| `sps_risultati` | prove: `parola_richiesta`, `parola_composta`, `esito`, `tempo_composizione` (s), `data_esecuzione` (max 2000) |
| `sps_banner_installa_nascosto` | l'invito a installare l'app è stato chiuso |

Il prefisso `sps_` evita collisioni con le altre app dello stesso sito. L'app non cancella mai
localStorage per intero; «Aggiorna l'app» (`js/clear-cache.js`) toglie solo le cache che iniziano
con `scrivo_parole_sillabe_` e il service worker di questa cartella.

## Struttura

```
sillabe/
├── index.html            # Scelta area (educatore / utente)
├── gestione.html         # Area educatore
├── esercizio.html        # Area utente
├── manifest.json         # PWA (scope ./)
├── service-worker.js     # Prima la rete, poi la cache (prefisso scrivo_parole_sillabe_)
├── css/styles.css
├── js/
│   ├── archivio.js       # Dati in localStorage + scomposizione in sillabe
│   ├── educatore-app.js
│   ├── esercizio-app.js
│   └── clear-cache.js
└── assets/               # icone, Bootstrap Icons e Chart.js 4.4.1 in locale
```

Per pubblicare una nuova versione aumentare `CACHE_NAME` in `service-worker.js` e i `?v=` nelle
pagine, altrimenti i dispositivi continuano a usare i file vecchi.

## Licenze

Pittogrammi ARASAAC (Sergio Palao, Governo di Aragona), licenza CC BY-NC-SA.
Chart.js (MIT), Bootstrap Icons (MIT).
