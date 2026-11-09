# Scrittura con Simboli

**Scrittura con il supporto dei simboli**: si scrive in italiano, **una parola per riga** e sempre in
maiuscolo; accanto a ogni parola, in una colonna a destra, compare la sua immagine. Andando a capo la
parola viene letta ad alta voce, con il punto la frase intera.
Ispirata all'editor di documenti di Widgit Online, ma con simboli liberi e un vocabolario proprio.

Applicazione **statica** (HTML/CSS/JavaScript), installabile come PWA su tablet Android, iPad e
computer, **funziona offline** (font ed emoji sono inclusi nella cartella). **Un dispositivo = un
utente**: i dati restano nel browser.

## Funzionalità

| Cosa | Come |
|---|---|
| **Frasi e discorsi** | Due colonne: a sinistra il testo, a destra le immagini, riga per riga alla stessa altezza (le colonne scorrono insieme). Lo **spazio va a capo**: una parola per riga. Testo sempre **maiuscolo** |
| **Aspetto** | Grandezza del testo (24–110 px), **grassetto**, **colore** (6 colori + colore libero), grandezza delle immagini (56–300 px); la colonna delle immagini è larga quanto le immagini e il testo prende il resto; l'altezza delle righe segue il più grande |
| **Italiano** | Plurali e femminili (*bambine*, *amici*), verbi coniugati (*mangio*, *andremo*), apostrofi (*l'acqua*) |
| **Parole grammaticali** | Articoli, preposizioni, congiunzioni con un segno piccolo e grigio (▶ articolo, + «e», 🔗 «con»…) |
| **Parole sconosciute** | Riquadro tratteggiato con «?» |
| **Cambiare simbolo** | Tocco sull'immagine → pannello: alternative, **nessun simbolo**, **ricerca** nel vocabolario |
| **Foto personali** | **Usa una mia foto** (nel pannello della parola): la foto si collega alla parola e compare **ogni volta** che la parola viene scritta, in tutte le sue forme (*mamma*, *mamme*). La spunta **Usa la mia foto**, parola per parola, sceglie tra la foto e il pittogramma generico. Ogni foto (JPG, PNG, **HEIC dell'iPhone**…) viene ridotta a 480 px e convertita in **PNG** |
| **Lettura** | Ogni parola quando si va a capo, la frase intera con . ! ? (si può disattivare), tutto con **Leggi tutto**; l'immagine della parola letta si illumina. Voce e velocità regolabili |
| **Pittogrammi ARASAAC** | Spunta facoltativa: il simbolo proposto diventa il pittogramma ARASAAC (servono internet), quelli dell'app restano come alternative |
| **Simboli Mulberry** | Spunta facoltativa: simboli Mulberry inclusi nell'app (funzionano offline). Con entrambe le spunte: prima ARASAAC, poi Mulberry, poi i simboli dell'app. |
| **Installazione** | Pulsante **Installa l'app su questo dispositivo** in fondo alla pagina (sparisce quando l'app è già installata); anche dal menu |

Menu (⋮): **Nuovo foglio**, **Esporta / Importa dati** (`.json` con testo, scelte e foto),
**Installa l'app**, **Come funziona**, **Informazioni**, **Aggiorna App**. In alto a sinistra lo
**schermo intero** (computer e Android).

## Vocabolario

`js/lessico.js` è **generato** (non si modifica a mano): circa 3.200 parole di base, 21.000 forme
flesse e 1.700 espressioni. Fonti:

1. un vocabolario di base curato a mano (parole grammaticali, persone, casa, scuola, cibo, verbi
   regolari e irregolari con le loro coniugazioni);
2. i concetti italiani del set di pittogrammi (`PROGETTI_SEMPLICI/img_nuove/csv/mapping.csv`), con
   l'immagine scelta **per significato** (il collegamento automatico del mapping era per somiglianza
   di lettere e dava icone sbagliate);
3. le emoji con i loro nomi italiani ufficiali (Unicode CLDR), escluse quelle non adatte ai bambini.

Simboli: icone **Material Symbols** (Google, Apache 2.0) nel verde #4F8A6B, emoji **Noto Color
Emoji** (Google, OFL), foto dell'utente. Nessun simbolo incluso ha licenza non commerciale.

### Pittogrammi ARASAAC (facoltativi)

Con la spunta **Pittogrammi ARASAAC** (`js/arasaac.js`) per ogni parola non grammaticale si cerca il
lemma (*mangio* → *mangiare*) con `https://api.arasaac.org/v1/pictograms/it/search/…`; i risultati
vengono riordinati (prima la parola chiave identica) e si escludono quelli segnati violenti o sessuali.
Le immagini arrivano da `static.arasaac.org` e il service worker le tiene nella cache
`scrittura_simboli_arasaac`, che non viene svuotata né dalle nuove versioni né da «Aggiorna App».
Una scelta ARASAAC (`aac:id`) con la spunta spenta lascia il posto al simbolo proposto.

- Licenza **CC BY-NC-SA 4.0**: solo uso non commerciale; quando la spunta è attiva i crediti
  (Sergio Palao, ARASAAC, Governo d'Aragona) compaiono sotto la pagina e nelle Informazioni.
- Privacy: con la spunta attiva le parole scritte vengono inviate all'API di ARASAAC.

### Simboli Mulberry (facoltativi)

[Mulberry Symbols](https://mulberrysymbols.org) 3.6.1 di Steve Lee, licenza **CC BY-SA 4.0** (uso
anche commerciale, citando l'autore: i crediti compaiono quando la spunta è attiva). Sono **inclusi**:
1.505 SVG in `assets/mulberry/<numero>.svg` (circa 10,6 MB) per 1.742 parole italiane
(`js/mulberry-dati.js`, generato; logica in `js/mulberry.js`).

- I nomi Mulberry sono solo in inglese: l'italiano è ricavato dalle parole chiave inglesi e italiane
  di ARASAAC sullo stesso pittogramma. Copre circa 740 lemmi del vocabolario; qualche abbinamento è
  impreciso e si corregge toccando la parola. Per rigenerare: `strumenti/mulberry/LEGGIMI.md`.
- I file non sono nella cache d'installazione: quando si attiva la spunta vengono scaricati tutti
  nella cache `scrittura_simboli_mulberry` (avanzamento in fondo alla pagina), poi funzionano offline.

## Architettura dati

| Dato | Dove |
|---|---|
| Testo scritto | `localStorage` (`ss_testo`) |
| Simbolo scelto per ogni parola o espressione | `localStorage` (`ss_scelte`) |
| Foto collegata a una parola e scelta foto/pittogramma | `localStorage` (`ss_foto_parole`: `{ chiave: { id, attiva } }`) |
| Voce, velocità, grandezza, lettura automatica, ARASAAC e Mulberry sì/no | `localStorage` (`ss_impostazioni`) |
| Ricerche ARASAAC già fatte (cache, non esportata) | `localStorage` (`ss_arasaac`) |
| Foto dell'utente (PNG, lato massimo 480 px, come data URL) | `IndexedDB` (`scrittura-simboli` → `foto`) |

## Struttura del progetto

```
├── index.html              Pagina unica
├── css/styles.css          Stili (stesso linguaggio visivo delle altre app, colore verde)
├── js/
│   ├── lessico.js          Vocabolario (generato)
│   ├── raccolta.js         Frecce ← e 🏠 verso l'indice della raccolta (qui RACCOLTA = null: nascoste)
│   ├── util.js             Utilità comuni, schermo intero
│   ├── archivio.js         localStorage + IndexedDB, esporta/importa
│   ├── voce.js             Sintesi vocale del dispositivo, avviso parola per parola
│   ├── simboli.js          Dal testo ai cartellini: forme, espressioni, ricerca
│   ├── arasaac.js          Pittogrammi ARASAAC facoltativi: ricerca, ordinamento, cache
│   ├── mulberry-dati.js    Parola italiana → simboli Mulberry (generato)
│   ├── mulberry.js         Simboli Mulberry facoltativi: ricerca, scaricamento per l'uso offline
│   ├── editor.js           Frasi: testo + colonna immagini, pannello, foto personali (→ PNG), lettura
│   └── app.js              Avvio, menu, finestre, PWA, aggiornamento
├── assets/
│   ├── fonts/simboli/      Material Symbols (solo le icone usate), Noto Color Emoji, Atkinson Hyperlegible
│   ├── mulberry/           Simboli Mulberry usati (SVG) + LICENSE.txt
│   ├── vendor/heic-to/     Convertitore HEIC → PNG (heic-to 1.6.5 / libheif, LGPL-3.0), caricato solo se serve
│   └── icons/              Icone dell'app
├── strumenti/mulberry/     Script per rigenerare i simboli Mulberry (non si carica sul sito)
├── manifest.json · service-worker.js · staticwebapp.config.json · serve.json
```

## Sviluppo locale

```bash
cd scrittura_simboli
npx serve          # poi aprire http://localhost:3000
```

Si può anche aprire `index.html` con un doppio clic: tutto funziona tranne installazione e uso offline.

Dopo ogni modifica si aumenta la versione in `service-worker.js` (`CACHE_NAME`), il `?v=` in
`index.html` e `APP_CONFIG.versione` in `js/app.js`.

## Pubblicazione nel portale assistivetech.it

- Cartella `scrittura_simboli` caricata intera via FTP dentro `webapp/`; voce «Scrittura con
  Simboli» nell'array `APP` di `webapp/index.html`.
- Indirizzo: `https://www.assistivetech.it/webapp/scrittura_simboli/`.
- Non serve caricare `README.md`, `serve.json`, `staticwebapp.config.json`, `.gitignore`, `strumenti/`.
- Cache con prefisso `scrittura_simboli_`, dati con chiavi `ss_…` e database `scrittura-simboli`:
  non toccano le altre app del dominio.

## Su tablet

- **iPad**: Safari → Condividi → **Aggiungi alla schermata Home**.
- **Android**: Chrome → Menu ⋮ → **Installa app**.
- Se l'icona viene tolta dalla schermata Home, i dati spariscono: tenere un'esportazione.
