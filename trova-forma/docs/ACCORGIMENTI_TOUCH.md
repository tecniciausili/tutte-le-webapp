# Trova Forma — accorgimenti del modulo touchscreen

Codice: `js/touch-guard.js` (logica) e `js/game.js` (uso). Test: `tests/touch-guard.test.mjs` (13 casi) e collaudo end-to-end in Chromium con tocchi emulati.

## Cosa faceva l'app Python (e perché andava bene)

| Nell'app Python | Effetto |
|---|---|
| Ogni evento, anche non di tocco, rivaluta `collidepoint(mouse.get_pos())` | Il tocco conta anche se arriva come mouse emulato, come dito o come gesto multi-touch |
| Si ascoltano `FINGERDOWN`, `FINGERUP`, `FINGERMOTION`, `MULTIGESTURE` e anche i click | Tocco appena accennato, dito che scivola, dito che si solleva: ognuno vale |
| Nessuna soglia di pressione né di durata | Tocchi deboli e brevissimi accettati |
| `pygame.event.clear()` dopo ogni evento e dopo il rinforzo | Il tocco che ha scatenato il rinforzo, o quelli arrivati durante, non si accumulano e non lo rilanciano |
| Chiusura solo con `Esc` | Un tocco sbagliato non può chiudere l'app |
| Schermo intero, nessuna barra, nessun menu | Nessun elemento di sistema su cui toccare per sbaglio |

Nel browser queste protezioni non esistono "gratis" (scroll, zoom, menu, "indietro", ecc.), quindi sono state riscritte esplicitamente.

## A. Riconoscere il tocco anche se impreciso o debole (`HitDetector`)

1. **Pointer Events, non `click`.** Il `click` del browser non parte se il dito si sposta di qualche pixel, se il tocco è lungo o se viene "trascinato". Qui conta `pointerdown`, e in più `pointermove`, `pointerup` e `pointercancel`. Un solo contatto che sfiora l'oggetto basta.
2. **Nessuna soglia di pressione, durata o movimento.** Non si legge `pressure` né si richiede un tempo minimo di contatto: se il digitizer segnala il contatto, il contatto vale.
3. **Margine di tolleranza attorno all'oggetto** (impostabile 0–5 cm, predefinito 1 cm). Si misura la distanza tra il punto toccato e il rettangolo dell'oggetto: entro il margine è un colpo.
4. **Ampiezza del contatto.** Se il dispositivo comunica larghezza e altezza del contatto (`PointerEvent.width/height`), metà dell'ampiezza (massimo 56 px) si somma alla tolleranza: dita grandi, palmi, nocche, tocchi "piatti".
5. **Dito che scivola sull'oggetto.** Il tocco può iniziare altrove e arrivare sull'oggetto strisciando: ogni movimento viene valutato.
6. **Controllo del percorso tra due campioni** (swept test). Una strisciata veloce può attraversare l'oggetto senza che nessun campione ci cada sopra: il segmento tra due posizioni consecutive viene campionato ogni 6 px. Si usano anche gli eventi "coalesced" del browser.
7. **Dito sollevato sull'oggetto.** Vale anche il punto in cui il dito si stacca.
8. **`pointercancel`.** Se il browser o il sistema annullano il tocco (gesto di sistema, palmo), l'ultima posizione nota viene comunque valutata, così il tocco non va perso.
9. **Multi-touch.** Ogni dito è tracciato separatamente: basta che uno colpisca.
10. **Pointer capture.** Dopo il `pointerdown` i movimenti successivi arrivano anche se il dito esce dallo schermo o dall'area.
11. **Mouse in sola "passata" ignorato.** Con il mouse conta solo il movimento a pulsante premuto: sfiorare l'oggetto col cursore non lo attiva.

## B. Evitare conteggi doppi e rimbalzi

12. **Un solo colpo per volta.** Appena scatta il rinforzo l'input è disabilitato (come i `sleep` dell'app Python).
13. **Dito rimasto appoggiato.** Un contatto nato durante il rinforzo, o già usato per un colpo, resta "non armato" finché non si muove di almeno 20 px: un palmo fermo non riattiva l'oggetto che riappare, un movimento deliberato sì. Chi tiene il dito sullo schermo e lo trascina sull'oggetto viene riconosciuto.
14. **Tocchi durante il rinforzo ignorati.** Non vengono né contati né accodati.

## C. Tocchi sbagliati che non devono fare nulla (`PageLock`)

Attivo solo durante il gioco, rimosso all'uscita.

15. `touch-action: none`, `overscroll-behavior: none` e pagina a posizione fissa: niente scroll, pull-to-refresh, pan, zoom a pizzico.
16. `preventDefault` su `touchstart/move/end` (listener non passivi) e su `gesturestart/change/end` (pizzico Safari/iOS).
17. Blocco di menu contestuale (tocco lungo, tasto destro), selezione di testo, trascinamento di immagini, doppio tocco/click, click centrale e `auxclick`.
18. **Rotella e Ctrl+rotella** (zoom) bloccate.
19. **Tastiera:** tutti i tasti sono neutralizzati (F5, Backspace, Tab, Spazio, frecce, F-tasti, Ctrl+/−, Ctrl+P, Ctrl+S…) tranne `Esc`.
20. **"Indietro" assorbito:** durante il gioco la cronologia ha una voce fittizia e `popstate` la reinserisce, quindi swipe o tasto "indietro" non lasciano la pagina.
21. **`beforeunload`:** se si prova a chiudere la scheda, ricaricare o navigare via, il browser chiede conferma.
22. **Schermo-scudo trasparente** sopra tutto: il player YouTube sta sotto, con `pointer-events: none`. Nessun tocco raggiunge mai l'iframe, quindi niente logo YouTube che apre una scheda, niente controlli, niente "guarda su YouTube", niente suggerimenti di fine video.
23. **Player YouTube senza interfaccia:** `controls=0`, `disablekb=1`, `fs=0`, `rel=0`, `iv_load_policy=3`, `modestbranding=1`, `playsinline=1`.
24. **Cursore nascosto, nessun elemento selezionabile**, nessuna evidenziazione del tocco (`-webkit-tap-highlight-color`).
25. **Schermo sempre acceso** (Screen Wake Lock) per tutta la sessione.
26. **Schermo intero** richiesto dal gesto "Inizia gioco" (obbligatorio per i browser).
27. **Uscita volontaria soltanto** con `Esc` / uscita dallo schermo intero oppure con **pressione lunga** sulla rotellina (predefinito 2 s, regolabile 1–10 s, indicatore a cerchio che si riempie). La rotellina è semitrasparente e in alto a destra; l'oggetto non compare mai sotto di essa.
28. **L'app non si blocca mai:** se YouTube non risponde (offline, video non incorporabile, errore) il rinforzo passa comunque il tempo previsto e l'oggetto riappare; un video che dà errore viene saltato.

## Cosa il browser NON può impedire

- **Gesti del sistema operativo**: tendina notifiche, tasto Home, swipe dal bordo con navigazione a gesti, selettore app. Per i tablet usati in terapia serve il blocco di sistema: Android → *Blocco su schermo* (screen pinning) o Chrome in modalità kiosk; iPad → *Accesso Guidato*; Windows → *Accesso assegnato* con Edge in modalità kiosk. L'app installata come PWA (display `fullscreen`) toglie già le barre del browser.
- **Scorciatoie riservate al browser** (Ctrl+W, Ctrl+T, Alt+F4): non intercettabili da nessuna pagina web.
- **Sensibilità hardware:** se il pannello non rileva proprio un contatto leggerissimo, il software non lo vede. Il software non aggiunge soglie, ma la sensibilità va regolata nel sistema (es. Windows: *Impostazioni → Bluetooth e dispositivi → Penna e Windows Ink / Tocco*; protezione schermo da togliere o con sensibilità alta). Se `width/height` del contatto non sono forniti dal dispositivo, resta solo la tolleranza in cm: in quel caso conviene alzarla.
- **iPhone/iPad Safari:** l'API di schermo intero non è disponibile su iPhone; installare l'app con "Aggiungi a Home" (parte in schermo intero).
