# Conta con le Dita

**Riconoscimento della quantità mostrata con le dita.** L'educatore prepara degli esercizi
(un'immagine di una mano + tre numeri, di cui uno corretto e due distrattori); nell'Area Utente
compare l'immagine e l'utente trascina nel box il numero giusto, scegliendolo fra i tre in basso.

Applicazione **statica** (HTML/CSS/JavaScript), installabile come PWA su tablet Android, iPad e
computer. **Un dispositivo = un utente**: non c'è registrazione né login, i dati restano nel browser.

> Versione autonoma del modulo originariamente parte del portale assistivetech.it (che usava un
> backend PHP + MySQL). Qui il backend è stato sostituito da un archivio locale in `localStorage`
> (`js/archivio.js`): nessun server, nessuna rete necessaria.

## Funzionalità

### Area Educatore (`gestione.html`)
- **Galleria** delle immagini delle dita (cartella `assets/dita/`). Il numero corretto è dedotto
  dal nome del file (`mano-03.png` → 3).
- Si scrivono i **tre numeri** (uno deve corrispondere alle dita; gli altri due sono distrattori,
  fino a 99) e si sceglie se **mescolare** la posizione dei box.
- Elenco degli **esercizi creati** (con eliminazione) e tabella degli **ultimi risultati**.
- **Copia dei dati**: Esporta / Importa in un file JSON (backup o travaso su un altro dispositivo).

### Area Utente (`esercizio.html`)
- Sceglie un esercizio dalla griglia, poi **trascina** (mouse, dito o tap) o usa la **tastiera** il
  numero nel box.
- Voce di rinforzo, coriandoli, aiuto dopo 3 errori, avanzamento automatico, dimensione dei box
  regolabile. Impostazioni nel menu laterale.

## Architettura dati

| Dato | Dove | Chiave |
|---|---|---|
| Esercizi configurati | `localStorage` | `cd_config` |
| Storico dei risultati | `localStorage` | `cd_risultati` |

Le chiavi hanno il prefisso `cd_` e la cache del service worker il prefisso `conta_con_le_dita_`:
non toccano le altre app sullo stesso dominio. Nell'Area Educatore i pulsanti **Esporta dati** /
**Importa dati** (sezione "Copia dei dati") salvano/rileggono tutto come file JSON, utili per una
copia di sicurezza o per spostare gli esercizi su un altro dispositivo (l'import sostituisce i dati
attuali).

## Struttura

```
├── index.html            Scelta Area Educatore / Area Utente
├── gestione.html         Area Educatore
├── esercizio.html        Area Utente (il gioco)
├── css/styles.css
├── js/
│   ├── clear-cache.js    Pulsante "aggiorna app" (tocca solo questa app, NON i dati)
│   ├── archivio.js       Archivio locale in localStorage (sostituisce il vecchio backend PHP)
│   ├── educatore-app.js  Logica Area Educatore
│   └── esercizio-app.js  Logica Area Utente
├── assets/
│   ├── dita/             mano-00.png … mano-10.png (0–10 dita)
│   ├── icons/            Icone PWA
│   └── fonts/            Bootstrap Icons
├── manifest.json · service-worker.js · staticwebapp.config.json · serve.json
```

Per aggiungere immagini: copiale in `assets/dita/` con il numero nel nome e aggiungi il nome file
nell'array `FILE_DITA` di `js/archivio.js` (un sito statico non può leggere la cartella da solo).

## Sviluppo locale

```bash
cd conta_con_le_dita
npx serve          # poi aprire http://localhost:3000
```

Dopo ogni modifica conviene aumentare la versione in `service-worker.js` (`CACHE_NAME`) e il `?v=`
nei tag `<script>`/`<link>` delle pagine HTML.

## Pubblicazione

- Statica: va bene su Azure Static Web Apps, come singola app o come cartella dentro una raccolta
  (`/webapp/conta_con_le_dita/`).
- Non serve pubblicare `README.md`, `serve.json`, `staticwebapp.config.json` quando si carica via FTP
  in un portale esistente.
