/**
 * Concetti topologici - Archivio sul dispositivo (Web App autonoma)
 * AssistiveTech.it
 *
 * Come nelle altre web app autonome: UN DISPOSITIVO = UN UTENTE, nessun server, nessun login.
 *   - Profilo (impostazioni e scene)          → localStorage «ct_profilo» (JSON)
 *   - Foto caricate dall'educatore            → IndexedDB «concetti_topologici», store «foto» { id, blob }
 *   - Risultati (una riga per risposta)       → IndexedDB, store «risultati»
 * Nelle scene una foto è { tipo: 'foto', id }: prima di disegnare si precaricano gli object URL
 * (precaricaFoto), così il disegno delle scene resta sincrono.
 *
 * Esporta dati / Importa dati (menu ☰ della pagina iniziale): un file JSON con profilo, foto
 * (in base64) e risultati. Serve anche a preparare le scene sul computer e ritrovarle sul tablet dell'utente.
 */
window.CT = window.CT || {};

CT.Archivio = (function () {
    const C = () => CT.Concetti;
    const CHIAVE_PROFILO = 'ct_profilo';
    const DB_NOME = 'concetti_topologici';
    const DB_VERSIONE = 1;
    const FORMATO_COPIA = 'concetti_topologici-copia';

    /* ---------- IndexedDB ---------- */

    let promessaDb = null;
    function db() {
        if (promessaDb) return promessaDb;
        promessaDb = new Promise((risolvi, rifiuta) => {
            if (!('indexedDB' in window)) { rifiuta(new Error('Questo browser non può salvare dati sul dispositivo')); return; }
            const req = indexedDB.open(DB_NOME, DB_VERSIONE);
            req.onupgradeneeded = () => {
                const d = req.result;
                if (!d.objectStoreNames.contains('foto')) d.createObjectStore('foto', { keyPath: 'id' });
                if (!d.objectStoreNames.contains('risultati')) {
                    const s = d.createObjectStore('risultati', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('sessione', 'sessione');
                }
            };
            req.onsuccess = () => risolvi(req.result);
            req.onerror = () => { promessaDb = null; rifiuta(new Error('Archivio del dispositivo non disponibile (navigazione privata?)')); };
        });
        return promessaDb;
    }

    /** Esegue fn(store) in una transazione; risolve con il valore della richiesta restituita da fn (se c'è) a transazione finita */
    async function transazione(store, modo, fn) {
        const d = await db();
        return new Promise((risolvi, rifiuta) => {
            const tx = d.transaction(store, modo);
            let risultato;
            const req = fn(tx.objectStore(store));
            if (req && 'onsuccess' in req) req.onsuccess = () => { risultato = req.result; };
            tx.oncomplete = () => risolvi(risultato);
            tx.onerror = () => rifiuta(tx.error || new Error('Errore dell\'archivio del dispositivo'));
            tx.onabort = () => rifiuta(tx.error || new Error('Operazione annullata (spazio esaurito?)'));
        });
    }

    /* ---------- Profilo ---------- */

    /** Scala e spostamento scelti nell'editor (unità del viewBox 400×300), con gli stessi limiti dell'editor.
        Vanno conservati qui: immagineValida() tiene solo i campi noti, e senza questo si perderebbero. */
    function trasformaValida(img, out) {
        const sc = Math.round(Number(img.scala) * 100) / 100;
        if (Number.isFinite(sc) && sc > 0 && Math.abs(sc - 1) > 0.001) out.scala = Math.max(0.3, Math.min(3, sc));
        const dx = Math.round(Number(img.dx)), dy = Math.round(Number(img.dy));
        if (Number.isFinite(dx) && dx !== 0) out.dx = Math.max(-170, Math.min(170, dx));
        if (Number.isFinite(dy) && dy !== 0) out.dy = Math.max(-130, Math.min(130, dy));
        return out;
    }

    /** Controlla un'immagine di scena: tiene solo i tipi conosciuti (più scala/spostamento) */
    function immagineValida(img, ruolo) {
        const pulita = immagineBase(img, ruolo);
        return (img && typeof img === 'object' && ruolo !== 'pronta') ? trasformaValida(img, pulita) : pulita;
    }

    function immagineBase(img, ruolo) {
        const predefinita = { tipo: 'simbolo', id: ruolo === 'oggetto' ? 'pallino' : 'quadrato' };
        if (!img || typeof img !== 'object') return predefinita;
        const parola = typeof img.parola === 'string' ? img.parola.slice(0, 80) : undefined;
        if (img.tipo === 'simbolo' && ['quadrato', 'pallino'].includes(img.id)) return { tipo: 'simbolo', id: img.id };
        if (img.tipo === 'contenitore' && ['scatola', 'cesto'].includes(img.id)) return { tipo: 'contenitore', id: img.id };
        if (img.tipo === 'arasaac' && parseInt(img.id, 10) > 0) return Object.assign({ tipo: 'arasaac', id: parseInt(img.id, 10) }, parola ? { parola } : {});
        if (img.tipo === 'foto' && /^f_[A-Za-z0-9_]{1,40}$/.test(String(img.id))) return Object.assign({ tipo: 'foto', id: img.id }, parola ? { parola } : {});
        return predefinita;
    }

    /** Profilo pulito e completo (anche da file importati o localStorage toccati a mano) */
    function profiloValido(doc) {
        const p = C().normalizzaProfilo(doc);
        const ids = new Set();
        p.scene = p.scene.filter(s => {
            if (!s || typeof s.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(s.id) || ids.has(s.id)) return false;
            ids.add(s.id);
            return true;
        }).slice(0, 400).map(s => {
            const o = { id: s.id, concetto: s.concetto, tipo: s.tipo === 'pronta' ? 'pronta' : 'componi',
                        nota: typeof s.nota === 'string' ? s.nota.slice(0, 120) : '', attiva: s.attiva !== false };
            if (o.tipo === 'pronta') o.immagine = immagineValida(s.immagine, 'pronta');
            else { o.riferimento = immagineValida(s.riferimento, 'riferimento'); o.oggetto = immagineValida(s.oggetto, 'oggetto'); }
            return o;
        }).filter(s => s.tipo !== 'pronta' || ['arasaac', 'foto'].includes(s.immagine.tipo));
        return p;
    }

    function profilo() {
        let doc = null;
        try { doc = JSON.parse(localStorage.getItem(CHIAVE_PROFILO) || 'null'); } catch (e) { /* rovinato: si riparte */ }
        return { documento: profiloValido(doc), nuovo: !doc };
    }

    function salvaProfilo(documento) {
        try {
            localStorage.setItem(CHIAVE_PROFILO, JSON.stringify(documento));
        } catch (e) {
            throw new Error('Spazio del dispositivo esaurito: il profilo non è stato salvato');
        }
    }

    /* ---------- Foto ---------- */

    const urlCache = new Map();   // id → object URL

    /* ---------- Scontorno delle foto (toglie lo sfondo) ----------
       Tutto nel browser: onnxruntime-web (come lo strumento «occhio») + modello U²-Net leggero
       (u2netp, licenza Apache-2.0) in modelli/. Le foto non escono dal dispositivo (nessun server). Il modello si
       scarica una volta e resta in cache (service worker). I pittogrammi ARASAAC non si scontornano
       (sono già senza sfondo). Se qualcosa non va, chi chiama usa la foto intera come ripiego. */
    const ORT_VERSIONE = '1.24.3';
    const ORT_CDN = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSIONE}/dist/`;
    const MODELLO_URL = new URL('modelli/u2netp.onnx', document.baseURI).href;
    const U2NET_LATO = 320;
    const MEDIA = [0.485, 0.456, 0.406], DEV = [0.229, 0.224, 0.225];
    let _sessionePromessa = null;

    function sessioneScontorno() {
        if (!_sessionePromessa) _sessionePromessa = (async () => {
            const ort = await import(`${ORT_CDN}ort.wasm.min.mjs`);
            ort.env.wasm.wasmPaths = ORT_CDN;
            ort.env.wasm.numThreads = 1;   // senza isolamento cross-origin non ci sono thread
            const sess = await ort.InferenceSession.create(MODELLO_URL, { executionProviders: ['wasm'] });
            return { ort, sess };
        })().catch(e => { _sessionePromessa = null; throw e; });   // un errore non blocca i tentativi futuri
        return _sessionePromessa;
    }

    /** Prepara l'app in anticipo (scarica modello e runtime) così il primo scontorno è più rapido */
    function preparaScontorno() { return sessioneScontorno().then(() => true, () => false); }

    /** Restituisce un canvas con lo sfondo tolto (alfa dalla maschera U²-Net) a partire da un canvas sorgente */
    async function scontornaCanvas(canvasOrig) {
        const { ort, sess } = await sessioneScontorno();
        const S = U2NET_LATO, plane = S * S;

        // Preprocess: ridimensiona a 320×320, scala [0,1], normalizza con le statistiche ImageNet (CHW)
        const pc = document.createElement('canvas'); pc.width = S; pc.height = S;
        const pctx = pc.getContext('2d', { willReadFrequently: true });
        pctx.drawImage(canvasOrig, 0, 0, S, S);
        const px = pctx.getImageData(0, 0, S, S).data;
        const t = new Float32Array(3 * plane);
        for (let i = 0; i < plane; i++) {
            t[i]             = (px[i * 4]     / 255 - MEDIA[0]) / DEV[0];
            t[i + plane]     = (px[i * 4 + 1] / 255 - MEDIA[1]) / DEV[1];
            t[i + 2 * plane] = (px[i * 4 + 2] / 255 - MEDIA[2]) / DEV[2];
        }
        const feeds = {};
        feeds[sess.inputNames[0]] = new ort.Tensor('float32', t, [1, 3, S, S]);
        const uscita = await sess.run(feeds);
        const d0 = uscita[sess.outputNames[0]].data;   // saliency 320×320, da normalizzare min-max

        let mn = Infinity, mx = -Infinity;
        for (let i = 0; i < plane; i++) { const v = d0[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
        const rng = (mx - mn) || 1e-8;

        // Maschera 320 in scala di grigi, poi riportata (liscia) alla dimensione originale
        const mc = document.createElement('canvas'); mc.width = S; mc.height = S;
        const mImg = mc.getContext('2d').createImageData(S, S);
        for (let i = 0; i < plane; i++) {
            const a = ((d0[i] - mn) / rng) * 255;
            mImg.data[i * 4] = mImg.data[i * 4 + 1] = mImg.data[i * 4 + 2] = a;
            mImg.data[i * 4 + 3] = 255;
        }
        mc.getContext('2d').putImageData(mImg, 0, 0);

        const W = canvasOrig.width, H = canvasOrig.height;
        const um = document.createElement('canvas'); um.width = W; um.height = H;
        const umctx = um.getContext('2d', { willReadFrequently: true });
        umctx.imageSmoothingEnabled = true;
        umctx.drawImage(mc, 0, 0, W, H);
        const mask = umctx.getImageData(0, 0, W, H).data;

        // Applica la maschera come canale alfa sulla foto originale
        const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
        const octx = oc.getContext('2d', { willReadFrequently: true });
        octx.drawImage(canvasOrig, 0, 0);
        const od = octx.getImageData(0, 0, W, H);
        let minX = W, minY = H, maxX = -1, maxY = -1;
        const SOGLIA = 18;   // sotto questo valore di alfa il pixel è «sfondo»
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const a = mask[(y * W + x) * 4];
                od.data[(y * W + x) * 4 + 3] = a;
                if (a > SOGLIA) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
            }
        }
        octx.putImageData(od, 0, 0);
        if (maxX < minX || maxY < minY) return oc;   // nessun oggetto rilevato: ritorna l'immagine intera

        // Ritaglia al riquadro dell'oggetto (con un piccolo margine) così riempie bene la scena
        const marg = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
        const cx = Math.max(0, minX - marg), cy = Math.max(0, minY - marg);
        const cw = Math.min(W - 1, maxX + marg) - cx + 1, ch = Math.min(H - 1, maxY + marg) - cy + 1;
        if (cw >= W && ch >= H) return oc;
        const crop = document.createElement('canvas'); crop.width = cw; crop.height = ch;
        crop.getContext('2d').drawImage(oc, cx, cy, cw, ch, 0, 0, cw, ch);
        return crop;
    }

    /** Scontorna una foto (File) e restituisce un Blob PNG trasparente, lato lungo max 700 px */
    async function scontornaFoto(file) {
        const canvas = await ridimensionaFoto(file, 700);
        const out = await scontornaCanvas(canvas);
        return await new Promise(r => out.toBlob(r, 'image/png'));
    }

    /** Disegna la foto in un canvas con lato lungo massimo `max` px */
    async function ridimensionaFoto(file, max) {
        if (!file || !/^image\//.test(file.type)) throw new Error('Scegli un file immagine (JPG, PNG, WebP)');
        const bitmap = await createImageBitmap(file).catch(() => null);
        if (!bitmap) throw new Error('Immagine non leggibile (le foto HEIC si aprono solo con Safari)');
        const scala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scala);
        canvas.height = Math.round(bitmap.height * scala);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    /**
     * Ridimensiona la foto (lato lungo max 700 px), opzionalmente ne toglie lo sfondo, e la salva
     * sul dispositivo (IndexedDB). Se lo scontorno non riesce (es. senza rete la prima volta) si
     * salva la foto intera. Restituisce { id, scontornata }.
     */
    async function salvaFoto(file, { scontorna = false } = {}) {
        const canvas = await ridimensionaFoto(file, 700);
        let blob = null, scontornata = false;
        if (scontorna) {
            try {
                const out = await scontornaCanvas(canvas);
                blob = await new Promise(r => out.toBlob(r, 'image/png'));
                scontornata = !!blob;
            } catch (e) {
                console.warn('[Concetti topologici] Scontorno non riuscito, salvo la foto intera:', e);
            }
        }
        if (!blob) {
            // PNG mantiene la trasparenza (pittogrammi, ritagli); le foto in JPEG, più leggere
            const png = ['image/png', 'image/webp', 'image/gif'].includes(file.type);
            blob = await new Promise(r => canvas.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.86));
        }
        if (!blob) throw new Error('Conversione della foto non riuscita');
        const id = CT.util.uid('f');
        await transazione('foto', 'readwrite', s => s.put({ id, blob }));
        urlCache.set(id, URL.createObjectURL(blob));
        return { id, scontornata };
    }

    /** Object URL di una foto già precaricata (sincrono: serve al disegno delle scene) */
    function urlFoto(id) { return urlCache.get(id) || null; }

    function idFoto(documento) {
        const ids = new Set();
        (documento?.scene || []).forEach(s => [s.riferimento, s.oggetto, s.immagine].forEach(img => { if (img && img.tipo === 'foto') ids.add(img.id); }));
        return ids;
    }

    /** Carica in memoria gli object URL di tutte le foto del profilo */
    async function precaricaFoto(documento) {
        const mancanti = [...idFoto(documento)].filter(id => !urlCache.has(id));
        if (!mancanti.length) return;
        const d = await db();
        await Promise.all(mancanti.map(id => new Promise(risolvi => {
            const req = d.transaction('foto').objectStore('foto').get(id);
            req.onsuccess = () => { if (req.result?.blob) urlCache.set(id, URL.createObjectURL(req.result.blob)); risolvi(); };
            req.onerror = () => risolvi();
        })));
    }

    /** Cancella le foto che nessuna scena usa più (si chiama all'apertura dell'Area Educatore) */
    async function pulisciFoto(documento) {
        const usate = idFoto(documento);
        const tutte = await transazione('foto', 'readonly', s => s.getAllKeys()) || [];
        const orfane = tutte.filter(id => !usate.has(id));
        if (!orfane.length) return 0;
        await transazione('foto', 'readwrite', s => { orfane.forEach(id => s.delete(id)); });
        orfane.forEach(id => { if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); } });
        return orfane.length;
    }

    /* ---------- Risultati ---------- */

    const dataOra = (d = new Date()) => {
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };

    async function registraRisposta(r) {
        const riga = {
            sessione: r.sessione, modalita: r.modalita === 'esegui' ? 'esegui' : 'riconosci',
            id_scena: r.id_scena, tipo_scena: r.tipo_scena, concetto: r.concetto, risposta: r.risposta,
            corretto: r.concetto === r.risposta ? 1 : 0, tentativo: r.tentativo, tempo_ms: r.tempo_ms,
            ts: Date.now(), data_ora: dataOra()
        };
        await transazione('risultati', 'readwrite', s => s.add(riga));
    }

    const tutteLeRisposte = async () => (await transazione('risultati', 'readonly', s => s.getAll())) || [];

    /** Stesso formato dell'API del portale: ultime 30 sessioni e andamento per concetto (60 giorni, prime risposte) */
    async function risultati() {
        const righe = await tutteLeRisposte();
        const perSessione = new Map();
        righe.forEach(r => {
            if (!perSessione.has(r.sessione)) perSessione.set(r.sessione, []);
            perSessione.get(r.sessione).push(r);
        });
        const sessioni = [...perSessione.entries()].map(([id, rr]) => {
            const prime = rr.filter(r => r.tentativo === 1);
            const inizio = Math.min(...rr.map(r => r.ts));
            return {
                sessione: id, inizio, data_ora: rr.find(r => r.ts === inizio).data_ora,
                modalita: [...new Set(rr.map(r => r.modalita))].join(','),
                scene: new Set(rr.map(r => r.id_scena)).size,
                giuste_subito: prime.filter(r => r.corretto).length,
                errori: rr.filter(r => !r.corretto).length,
                tempo_medio: prime.length ? Math.round(prime.reduce((t, r) => t + r.tempo_ms, 0) / prime.length) : 0
            };
        }).sort((a, b) => b.inizio - a.inizio).slice(0, 30);

        const limite = Date.now() - 60 * 24 * 3600 * 1000;
        const mappa = new Map();
        righe.filter(r => r.tentativo === 1 && r.ts >= limite).forEach(r => {
            const k = `${r.concetto}|${r.modalita}`;
            const x = mappa.get(k) || { concetto: r.concetto, modalita: r.modalita, proposte: 0, giuste: 0 };
            x.proposte++; x.giuste += r.corretto ? 1 : 0;
            mappa.set(k, x);
        });
        return { sessioni, per_concetto: [...mappa.values()] };
    }

    async function dettaglioSessione(idSessione) {
        return (await tutteLeRisposte()).filter(r => r.sessione === idSessione).sort((a, b) => a.id - b.id);
    }

    async function cancellaRisultati() {
        await transazione('risultati', 'readwrite', s => s.clear());
    }

    /* ---------- Esporta dati / Importa dati ---------- */

    const blobInDataUrl = (blob) => new Promise((risolvi, rifiuta) => {
        const r = new FileReader();
        r.onload = () => risolvi(r.result);
        r.onerror = () => rifiuta(r.error);
        r.readAsDataURL(blob);
    });

    async function esportaDati() {
        const doc = profilo().documento;
        const foto = {};
        const d = await db();
        for (const id of idFoto(doc)) {
            const rec = await new Promise(r => { const q = d.transaction('foto').objectStore('foto').get(id); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
            if (rec?.blob) foto[id] = await blobInDataUrl(rec.blob);
        }
        const risposte = (await tutteLeRisposte()).map(({ id, ...resto }) => resto);
        return { formato: FORMATO_COPIA, versione: 1, app: CT.VERSIONE, esportato: new Date().toISOString(), profilo: doc, foto, risultati: risposte };
    }

    /**
     * Importa dati: sostituisce profilo e foto; i risultati della copia si aggiungono a quelli
     * già sul dispositivo (senza doppioni), così non si perde lo storico del tablet.
     */
    async function importaDati(dati) {
        if (!dati || dati.formato !== FORMATO_COPIA) throw new Error('Il file non è una copia di Concetti topologici');
        const doc = profiloValido(dati.profilo);
        const foto = dati.foto && typeof dati.foto === 'object' ? dati.foto : {};
        const servono = idFoto(doc);
        const nuove = [];
        for (const id of servono) {
            const dataUrl = foto[id];
            if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(dataUrl)) continue;
            nuove.push({ id, blob: await (await fetch(dataUrl)).blob() });
        }
        await transazione('foto', 'readwrite', s => { nuove.forEach(f => s.put(f)); });

        let aggiunte = 0;
        if (Array.isArray(dati.risultati)) {
            const chiave = r => `${r.sessione}|${r.id_scena}|${r.tentativo}|${r.ts}`;
            const esistenti = new Set((await tutteLeRisposte()).map(chiave));
            const concetti = C().CONCETTI;
            const valide = dati.risultati.filter(r => r && typeof r.sessione === 'string' && concetti[r.concetto] && concetti[r.risposta] && !esistenti.has(chiave(r)));
            await transazione('risultati', 'readwrite', s => {
                valide.forEach(r => s.add({
                    sessione: r.sessione.slice(0, 40), modalita: r.modalita === 'esegui' ? 'esegui' : 'riconosci',
                    id_scena: String(r.id_scena || '').slice(0, 40), tipo_scena: String(r.tipo_scena || 'simboli').slice(0, 20),
                    concetto: r.concetto, risposta: r.risposta, corretto: r.concetto === r.risposta ? 1 : 0,
                    tentativo: parseInt(r.tentativo, 10) || 1, tempo_ms: parseInt(r.tempo_ms, 10) || 0,
                    ts: parseInt(r.ts, 10) || Date.now(), data_ora: String(r.data_ora || '').slice(0, 19)
                }));
            });
            aggiunte = valide.length;
        }
        salvaProfilo(doc);
        await pulisciFoto(doc);
        return { scene: doc.scene.length, foto: nuove.length, risultati: aggiunte, fotoMancanti: [...servono].filter(id => !foto[id]).length };
    }

    /* ---------- Pittogrammi ARASAAC (api.arasaac.org, CC BY-NC-SA, autore Sergio Palao, Governo di Aragona) ---------- */

    const cacheArasaac = new Map();
    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    async function cercaArasaac(query, limite = 40) {
        query = String(query || '').trim();
        if (query.length < 2) return [];
        if (!navigator.onLine) throw new Error('La ricerca dei pittogrammi ARASAAC richiede la connessione a internet');
        const chiave = norm(query);
        if (cacheArasaac.has(chiave)) return cacheArasaac.get(chiave).slice(0, limite);
        const risposta = await fetch(`https://api.arasaac.org/api/pictograms/it/search/${encodeURIComponent(query)}`);
        if (risposta.status === 404) { cacheArasaac.set(chiave, []); return []; }
        if (!risposta.ok) throw new Error(`ARASAAC non risponde (${risposta.status})`);
        const dati = await risposta.json();
        const risultati = (Array.isArray(dati) ? dati : []).map(d => {
            const id = parseInt(d._id, 10);
            if (!id) return null;
            const parole = (d.keywords || []).map(k => k.keyword).filter(Boolean);
            const esatto = parole.some(p => norm(p) === chiave);
            return { id, parola: parole[0] || query, esatto, url: `https://static.arasaac.org/pictograms/${id}/${id}_300.png` };
        }).filter(Boolean);
        risultati.sort((a, b) => (b.esatto - a.esatto) || (a.id - b.id));
        cacheArasaac.set(chiave, risultati);
        return risultati.slice(0, limite);
    }

    return {
        profilo, salvaProfilo, salvaFoto, urlFoto, precaricaFoto, pulisciFoto,
        registraRisposta, risultati, dettaglioSessione, cancellaRisultati,
        esportaDati, importaDati, cercaArasaac, scontornaFoto, preparaScontorno
    };
})();
