/*
 * Trova Forma - youtube.js
 * - utilità: id da URL, tempi mm:ss
 * - ricerca (YouTube Data API v3, richiede chiave API)
 * - Reinforcer: riproduzione del rinforzo da playlist (IFrame Player API)
 */
(function () {
  'use strict';
  const TF = (window.TF = window.TF || {});

  /* ---------------------------------------------------------------- utilità */

  function parseVideoId(input) {
    if (!input) return null;
    const s = String(input).trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    try {
      const u = new URL(s.match(/^https?:\/\//i) ? s : 'https://' + s);
      const host = u.hostname.replace(/^www\.|^m\./, '');
      if (host === 'youtu.be') return /^[\w-]{11}$/.test(u.pathname.slice(1, 12)) ? u.pathname.slice(1, 12) : null;
      if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
        const v = u.searchParams.get('v');
        if (v && /^[\w-]{11}$/.test(v)) return v;
        const m = u.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{11})/);
        if (m) return m[2];
      }
    } catch (_) {}
    return null;
  }

  /** "1:23" | "83" | "1:02:03" -> secondi; "" -> null */
  function parseTime(str) {
    if (str === null || str === undefined) return null;
    const s = String(str).trim();
    if (!s) return null;
    if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(s)) return NaN;
    return s.split(':').reduce(function (acc, p) { return acc * 60 + parseFloat(p); }, 0);
  }

  function formatTime(sec) {
    if (sec === null || sec === undefined || !isFinite(sec)) return '';
    sec = Math.max(0, Math.round(sec * 10) / 10);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec - h * 3600 - m * 60;
    const ss = (s < 10 ? '0' : '') + (Number.isInteger(s) ? s : s.toFixed(1));
    return h ? h + ':' + (m < 10 ? '0' : '') + m + ':' + ss : m + ':' + ss;
  }

  function isoDuration(iso) {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
    if (!m) return null;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }

  /* -------------------------------------------------------------- caricamento API */

  let apiPromise = null;
  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(function (resolve, reject) {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = function () { apiPromise = null; reject(new Error('YouTube non raggiungibile (offline?)')); };
      document.head.appendChild(s);
      setTimeout(function () { if (!(window.YT && window.YT.Player)) { apiPromise = null; reject(new Error('Timeout caricamento YouTube')); } }, 15000);
    });
    return apiPromise;
  }

  function baseVars() {
    const v = { controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1, cc_load_policy: 0 };
    if (/^https?:$/.test(location.protocol)) v.origin = location.origin;
    return v;
  }

  /** Crea un player nel div #elId. vars aggiuntive opzionali. Ritorna Promise<player> pronto. */
  function createPlayer(elId, vars, events) {
    return loadApi().then(function () {
      return new Promise(function (resolve) {
        const p = new window.YT.Player(elId, {
          width: '100%', height: '100%',
          playerVars: Object.assign(baseVars(), vars || {}),
          events: Object.assign({}, events || {}, { onReady: function () { resolve(p); } })
        });
      });
    });
  }

  /* -------------------------------------------------------------- ricerca */

  async function search(query, apiKey, maxResults) {
    if (!apiKey) throw new Error('Inserisci la chiave API di YouTube per usare la ricerca');
    const q = new URLSearchParams({
      part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true',
      safeSearch: 'strict', maxResults: String(maxResults || 12), q: query, key: apiKey
    });
    const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + q);
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || 'Errore ricerca YouTube');
    const ids = (j.items || []).map(function (i) { return i.id.videoId; }).filter(Boolean);
    let durations = {};
    if (ids.length) {
      try {
        const r2 = await fetch('https://www.googleapis.com/youtube/v3/videos?' + new URLSearchParams({ part: 'contentDetails', id: ids.join(','), key: apiKey }));
        const j2 = await r2.json();
        (j2.items || []).forEach(function (v) { durations[v.id] = isoDuration(v.contentDetails.duration); });
      } catch (_) { /* durata facoltativa */ }
    }
    return (j.items || []).filter(function (i) { return i.id.videoId; }).map(function (i) {
      const sn = i.snippet || {};
      return {
        id: i.id.videoId,
        title: decodeEntities(sn.title || i.id.videoId),
        channel: sn.channelTitle || '',
        thumb: (sn.thumbnails && (sn.thumbnails.medium || sn.thumbnails.default) || {}).url || '',
        duration: durations[i.id.videoId] || null
      };
    });
  }

  function decodeEntities(s) { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; }

  /** Titolo per un video incollato come link (oEmbed, senza chiave); in caso di errore usa l'id. */
  async function fetchTitle(id) {
    try {
      const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
      if (!r.ok) throw new Error();
      const j = await r.json();
      return { title: j.title || id, channel: j.author_name || '' };
    } catch (_) { return { title: 'Video ' + id, channel: '' }; }
  }

  /* -------------------------------------------------------------- Reinforcer */

  const S = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

  /**
   * Gestisce il rinforzo. Un unico player persistente (niente ricaricamenti a ogni tocco):
   *  - tra un rinforzo e l'altro il video resta in pausa;
   *  - "resume": il rinforzo successivo riprende da dove si era fermato (come il pause/play
   *    del lettore VLC dell'app Python), passando alla clip successiva quando si raggiunge
   *    il secondo di fine impostato; "restart": riparte sempre dall'inizio della clip.
   * Il timer dei secondi di rinforzo parte quando il video è realmente in riproduzione
   * (con tolleranza massima di attesa), così il buffering non "mangia" il rinforzo.
   * Se YouTube non è raggiungibile il gioco NON si blocca: passa semplicemente il tempo.
   */
  function Reinforcer(hostEl) {
    let player = null, initPromise = null, loadedId = null;
    let items = [], opts = { resume: 'resume', order: 'seq' };
    let idx = 0, pos = null, bad = {};
    let run = null, priming = false, lastState = -1;
    let lastError = null;

    function good() { return items.filter(function (it) { return !bad[it.id]; }); }

    function pickNext(curIdx) {
      const n = items.length;
      if (n <= 1) return 0;
      if (opts.order === 'random') {
        let k, guard = 0;
        do { k = Math.floor(Math.random() * n); guard++; } while ((k === curIdx || bad[items[k].id]) && guard < 40);
        return k;
      }
      for (let s = 1; s <= n; s++) { const k = (curIdx + s) % n; if (!bad[items[k].id]) return k; }
      return curIdx;
    }

    function onState(e) {
      lastState = e.data;
      if (priming) return;
      if (!run) return;
      if (e.data === S.PLAYING) run.onPlaying();
      else if (e.data === S.ENDED) run.advance();
    }
    function onError(e) {
      lastError = e && e.data;
      const it = items[idx];
      if (it) bad[it.id] = true; // non incorporabile / rimosso / privato
      if (run) run.advance();
    }

    function ensurePlayer() {
      if (initPromise) return initPromise;
      hostEl.innerHTML = '<div id="yt-reinf-inner"></div>';
      initPromise = createPlayer('yt-reinf-inner', {}, { onStateChange: onState, onError: onError })
        .then(function (p) { player = p; return true; })
        .catch(function (err) { console.warn('YouTube non disponibile:', err.message); initPromise = null; return false; });
      return initPromise;
    }

    function startAtFor(it) {
      const s = it.start || 0;
      if (opts.resume === 'resume' && pos !== null && pos >= s && (it.end == null || pos < it.end - 0.5)) return pos;
      return s;
    }

    function loadItem(it, startAt) {
      try {
        if (loadedId === it.id) { player.seekTo(startAt, true); player.playVideo(); }
        else { player.loadVideoById({ videoId: it.id, startSeconds: startAt }); loadedId = it.id; }
      } catch (e) { console.warn(e); }
    }

    return {
      /** Imposta playlist e opzioni per la sessione. */
      configure: function (rcfg) {
        items = (rcfg.playlist || []).map(function (p) {
          return { id: p.id, start: p.start || 0, end: (p.end === null || p.end === undefined || p.end <= (p.start || 0)) ? null : p.end };
        });
        opts = { resume: rcfg.resume, order: rcfg.order };
        bad = {}; pos = null; loadedId = null;
        idx = (opts.order === 'random' && items.length) ? Math.floor(Math.random() * items.length) : 0;
        hostEl.classList.toggle('audio-mode', rcfg.mode !== 'av');
        run = null;
      },

      hasItems: function () { return items.length > 0; },

      /** Crea il player in anticipo (pagina di configurazione), così all'avvio è già pronto. */
      warm: function () { return ensurePlayer(); },

      /**
       * Da chiamare DENTRO il gesto dell'utente (click su "Inizia"): sblocca l'autoplay
       * riproducendo in muto per un attimo la prima clip, poi la mette in pausa.
       */
      prime: function () {
        if (!items.length) return Promise.resolve(false);
        const first = items[idx];
        const ready = ensurePlayer();
        return ready.then(function (ok) {
          if (!ok) return false;
          return new Promise(function (resolve) {
            priming = true;
            try { player.mute(); player.loadVideoById({ videoId: first.id, startSeconds: first.start }); loadedId = first.id; } catch (_) {}
            const t0 = Date.now();
            const iv = setInterval(function () {
              if (lastState === S.PLAYING || Date.now() - t0 > 3500) {
                clearInterval(iv);
                try { player.pauseVideo(); player.seekTo(first.start, true); player.unMute(); } catch (_) {}
                priming = false; pos = null; resolve(true);
              }
            }, 80);
          });
        });
      },

      /**
       * Esegue un rinforzo di `seconds` secondi. Risolve a rinforzo concluso (o abortito).
       * @param {boolean} showVideo  true: il video diventa visibile a tutto schermo
       */
      run: function (seconds, showVideo) {
        const self = this;
        self.abort();
        return new Promise(function (resolve) {
          const ms = Math.max(0.5, seconds) * 1000;
          let started = false, tmr = null, fb = null, mon = null, done = false, attempts = 0;

          function beginTimer() {
            if (started) return;
            started = true; clearTimeout(fb);
            tmr = setTimeout(finish, ms);
          }
          function finish() {
            if (done) return; done = true;
            clearTimeout(tmr); clearTimeout(fb); clearInterval(mon);
            if (player) { try { const t = player.getCurrentTime(); if (isFinite(t)) pos = t; player.pauseVideo(); } catch (_) {} }
            hostEl.classList.remove('show');
            if (run === ctl) run = null;
            resolve();
          }
          function advance() {
            if (done || !player) return;
            if (++attempts > items.length + 2 || !good().length) return; // niente cicli infiniti se tutte le clip falliscono
            idx = pickNext(idx);
            const it = items[idx];
            pos = it.start;
            try { player.loadVideoById({ videoId: it.id, startSeconds: it.start }); loadedId = it.id; } catch (_) {}
          }
          const ctl = {
            finish: finish, advance: advance,
            onPlaying: function () { beginTimer(); if (showVideo) hostEl.classList.add('show'); }
          };
          run = ctl;

          if (!player || !good().length) { beginTimer(); return; } // nessun audio: attesa pura
          // se la clip corrente è inutilizzabile passa alla prossima
          if (bad[items[idx].id]) idx = pickNext(idx);
          const it = items[idx];
          loadItem(it, startAtFor(it));
          fb = setTimeout(beginTimer, 4000); // rete lenta / errore: non bloccare il gioco
          mon = setInterval(function () {
            if (done || !player) return;
            const cur = items[idx];
            if (cur && cur.end != null) {
              let t = NaN; try { t = player.getCurrentTime(); } catch (_) {}
              if (isFinite(t) && t >= cur.end - 0.15) advance();
            }
          }, 200);
        });
      },

      abort: function () { if (run) run.finish(); },

      stop: function () {
        this.abort();
        if (player) { try { player.pauseVideo(); } catch (_) {} }
        hostEl.classList.remove('show');
      },

      /** per i test */
      _state: function () { return { idx: idx, pos: pos, bad: bad, loadedId: loadedId, lastError: lastError }; }
    };
  }

  TF.YT = { parseVideoId: parseVideoId, parseTime: parseTime, formatTime: formatTime, loadApi: loadApi, createPlayer: createPlayer, search: search, fetchTitle: fetchTitle, Reinforcer: Reinforcer, S: S };
})();
