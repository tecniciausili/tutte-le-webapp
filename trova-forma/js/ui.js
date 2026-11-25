/*
 * Trova Forma - ui.js
 * Pagina di configurazione.
 */
(function () {
  'use strict';
  const TF = (window.TF = window.TF || {});
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const YTU = function () { return TF.YT; };

  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a && a[k]; }, o); }
  function setPath(o, p, v) {
    const ks = p.split('.'); const last = ks.pop();
    const t = ks.reduce(function (a, k) { return a[k]; }, o); t[last] = v;
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function stamp() {
    const d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + '-' + p(d.getMinutes()) + '-' + p(d.getSeconds());
  }

  function init(o) {
    let cfg = o.cfg;
    const Config = TF.Config;
    let lastSession = null;

    function persist() { Config.save(cfg); previewArea(); updateOutputs(); updateStartNote(); }

    /* ---------------- campi generici data-k ---------------- */
    function fillInputs() {
      document.querySelectorAll('[data-k]').forEach(function (el) {
        const v = getPath(cfg, el.dataset.k);
        if (el.type === 'checkbox') el.checked = !!v;
        else if (el.type === 'radio') el.checked = String(v) === el.value;
        else el.value = v;
      });
      updateOutputs();
    }
    function bindInputs() {
      document.querySelectorAll('[data-k]').forEach(function (el) {
        const handler = function () {
          let v;
          if (el.type === 'checkbox') v = el.checked;
          else if (el.type === 'radio') { if (!el.checked) return; v = el.value; }
          else if (el.type === 'number' || el.type === 'range') {
            v = parseFloat(el.value);
            if (!isFinite(v)) return;
            if (el.min !== '' && v < +el.min) v = +el.min;
            if (el.max !== '' && v > +el.max) v = +el.max;
          } else v = el.value;
          setPath(cfg, el.dataset.k, v);
          persist();
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      });
    }
    function updateOutputs() {
      $('#o-contrast').textContent = cfg.contrast + '%';
      $('#o-vertical').textContent = cfg.vertical + '%';
      $('#o-tol').textContent = String(cfg.touch.toleranceCm).replace('.', ',') + ' cm';
    }

    /* ---------------- oggetto ---------------- */
    let thumbUrl = null;
    async function refreshObject() {
      const img = cfg.object.hasImage ? await Config.getObjectImage() : null;
      if (thumbUrl) { URL.revokeObjectURL(thumbUrl); thumbUrl = null; }
      const th = $('#obj-thumb');
      if (img) {
        thumbUrl = URL.createObjectURL(img.blob); th.src = thumbUrl; th.hidden = false;
        $('#obj-name').textContent = img.name;
      } else {
        th.hidden = true;
        $('#obj-name').textContent = 'Nessun file: verrà usato un cerchio rosso.';
      }
    }
    $('#pick-obj').addEventListener('click', function () { $('#obj-file').click(); });
    $('#obj-file').addEventListener('change', async function (e) {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type)) { alert('Scegli un file immagine (GIF, PNG, JPG, WebP, SVG).'); return; }
      await Config.setObjectImage(f);
      cfg.object = { name: f.name, hasImage: true };
      persist(); refreshObject();
    });
    $('#clear-obj').addEventListener('click', async function () {
      await Config.clearObjectImage(); cfg.object = { name: '', hasImage: false }; persist(); refreshObject();
    });

    /* ---------------- anteprima area ---------------- */
    function previewArea() {
      const box = $('#area-preview');
      const sw = window.screen.width || window.innerWidth, sh = window.screen.height || window.innerHeight;
      const W = Math.max(sw, sh), H = Math.min(sw, sh); // anteprima in orizzontale; l'area reale segue l'orientamento
      const bw = box.clientWidth || 300, sc = bw / W;
      box.style.height = (H * sc) + 'px';
      const k = cfg.pxPerCm, a = cfg.area;
      const area = $('#ap-area');
      const l = a.left * k, r = W - a.right * k, t = a.top * k, b = H - a.bottom * k;
      area.style.left = (l * sc) + 'px'; area.style.top = (t * sc) + 'px';
      area.style.width = Math.max(0, (r - l) * sc - 4) + 'px'; area.style.height = Math.max(0, (b - t) * sc - 4) + 'px';
      const ow = Math.min(cfg.sizeCm.w * k, W), oh = Math.min(cfg.sizeCm.h * k, H);
      const ob = $('#ap-obj');
      ob.style.width = ow * sc + 'px'; ob.style.height = oh * sc + 'px';
      ob.style.left = ((l + r) / 2 - ow / 2) * sc + 'px'; ob.style.top = ((t + b) / 2 - oh / 2) * sc + 'px';
      $('#ap-hint').textContent = 'Schermo stimato ' + Math.round(W / k) + ' × ' + Math.round(H / k) + ' cm · area ' +
        Math.max(0, Math.round((r - l) / k)) + ' × ' + Math.max(0, Math.round((b - t) / k)) + ' cm.';
    }
    window.addEventListener('resize', previewArea);

    /* ---------------- playlist ---------------- */
    const pl = $('#playlist');
    function fmtDur(s) { return s ? YTU().formatTime(s) : ''; }

    function renderPlaylist() {
      const list = cfg.reinforcement.playlist;
      $('#pl-count').textContent = list.length;
      pl.innerHTML = '';
      if (!list.length) {
        const li = document.createElement('li'); li.className = 'empty'; li.style.display = 'block'; li.style.border = '0';
        li.textContent = 'Nessun video: il gioco funzionerà senza audio/video di rinforzo.';
        pl.appendChild(li);
      }
      list.forEach(function (it, i) {
        const li = document.createElement('li');
        li.innerHTML =
          '<img alt="" loading="lazy" src="https://i.ytimg.com/vi/' + encodeURIComponent(it.id) + '/mqdefault.jpg">' +
          '<div><div class="t"></div><div class="c"></div></div>' +
          '<div class="pl-times">' +
          '<label>Inizio<input data-f="start" inputmode="text" placeholder="0:00"></label>' +
          '<label>Fine<input data-f="end" inputmode="text" placeholder="fino alla fine"></label>' +
          '<div class="pl-btns">' +
          '<button class="small ghost" data-a="prev" type="button">Anteprima</button>' +
          '<button class="small ghost" data-a="up" type="button" aria-label="Sposta su">▲</button>' +
          '<button class="small ghost" data-a="down" type="button" aria-label="Sposta giù">▼</button>' +
          '<button class="small ghost" data-a="del" type="button" aria-label="Rimuovi">✕</button></div></div>';
        $('.t', li).textContent = it.title;
        $('.c', li).textContent = (it.channel || '') + (it.duration ? ' · ' + fmtDur(it.duration) : '');
        const si = $('[data-f=start]', li), ei = $('[data-f=end]', li);
        si.value = it.start ? YTU().formatTime(it.start) : '';
        ei.value = it.end ? YTU().formatTime(it.end) : '';
        function readTimes() {
          const s = YTU().parseTime(si.value), e = YTU().parseTime(ei.value);
          const sBad = Number.isNaN(s), eBad = Number.isNaN(e);
          const range = !sBad && !eBad && e !== null && e <= (s || 0);
          si.classList.toggle('bad', sBad || range); ei.classList.toggle('bad', eBad || range);
          if (sBad || eBad || range) return;
          it.start = s || 0; it.end = e; persist();
        }
        si.addEventListener('input', readTimes); ei.addEventListener('input', readTimes);
        li.addEventListener('click', function (ev) {
          const a = ev.target.dataset && ev.target.dataset.a; if (!a) return;
          if (a === 'del') list.splice(i, 1);
          else if (a === 'up' && i > 0) { const t = list[i - 1]; list[i - 1] = list[i]; list[i] = t; }
          else if (a === 'down' && i < list.length - 1) { const t = list[i + 1]; list[i + 1] = list[i]; list[i] = t; }
          else if (a === 'prev') { openClip(it); return; }
          persist(); renderPlaylist();
        });
        pl.appendChild(li);
      });
    }

    function addItem(v) {
      cfg.reinforcement.playlist.push({ id: v.id, title: v.title, channel: v.channel || '', duration: v.duration || null, start: 0, end: null });
      persist(); renderPlaylist();
      if (o.onPlaylistChange) o.onPlaylistChange();
    }

    /* ---------------- ricerca / link ---------------- */
    const keyInput = $('#api-key');
    keyInput.value = Config.getApiKey();
    keyInput.addEventListener('change', function () { Config.setApiKey(keyInput.value.trim()); });
    if (!keyInput.value) $('#key-box').open = false;

    async function doSearch() {
      const q = $('#q').value.trim(); if (!q) return;
      const box = $('#results'); box.innerHTML = '<div class="empty">Ricerca in corso…</div>';
      Config.setApiKey(keyInput.value.trim());
      try {
        const res = await YTU().search(q, Config.getApiKey(), 12);
        box.innerHTML = '';
        if (!res.length) { box.innerHTML = '<div class="empty">Nessun risultato incorporabile.</div>'; return; }
        res.forEach(function (v) {
          const d = document.createElement('div'); d.className = 'vid';
          d.innerHTML = '<img alt="" loading="lazy"><div><div class="t"></div><div class="c"></div></div><button class="small" type="button">Aggiungi</button>';
          $('img', d).src = v.thumb; $('.t', d).textContent = v.title;
          $('.c', d).textContent = v.channel + (v.duration ? ' · ' + fmtDur(v.duration) : '');
          $('button', d).addEventListener('click', function () { addItem(v); this.textContent = 'Aggiunto ✓'; });
          box.appendChild(d);
        });
      } catch (err) {
        box.innerHTML = ''; const e = document.createElement('div'); e.className = 'empty'; e.style.color = '#b42318';
        e.textContent = err.message; box.appendChild(e);
        if (!Config.getApiKey()) $('#key-box').open = true;
      }
    }
    $('#q-go').addEventListener('click', doSearch);
    $('#q').addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

    $('#link-add').addEventListener('click', async function () {
      const msg = $('#add-msg'); const id = YTU().parseVideoId($('#link').value);
      if (!id) { msg.textContent = 'Link o ID non riconosciuto.'; return; }
      msg.textContent = 'Aggiungo…';
      const t = await YTU().fetchTitle(id);
      addItem({ id: id, title: t.title, channel: t.channel });
      $('#link').value = ''; msg.textContent = 'Aggiunto: ' + t.title;
    });

    /* ---------------- anteprima clip ---------------- */
    const dlg = $('#clip-dlg');
    let clipPlayer = null, clipItem = null, testTimer = null;
    function clipInfo(t) { $('#clip-info').textContent = t || ''; }
    async function openClip(it) {
      clipItem = it; $('#clip-title').textContent = it.title; clipInfo('Caricamento…');
      dlg.showModal();
      try {
        if (!clipPlayer) {
          clipPlayer = await YTU().createPlayer('clip-player', { controls: 1, disablekb: 0, fs: 0 }, {});
        }
        clipPlayer.loadVideoById({ videoId: it.id, startSeconds: it.start || 0 });
        setTimeout(function () {
          try { const d = clipPlayer.getDuration(); if (d && !it.duration) { it.duration = Math.round(d); persist(); renderPlaylist(); } } catch (_) {}
        }, 1500);
        clipInfo('Metti in pausa dove vuoi e usa i pulsanti per impostare inizio e fine.');
      } catch (e) { clipInfo('Impossibile caricare YouTube: ' + e.message); }
    }
    function closeClip() { clearInterval(testTimer); try { clipPlayer && clipPlayer.pauseVideo(); } catch (_) {} dlg.close(); renderPlaylist(); }
    $('#clip-close').addEventListener('click', closeClip);
    dlg.addEventListener('cancel', function () { clearInterval(testTimer); try { clipPlayer.pauseVideo(); } catch (_) {} setTimeout(renderPlaylist, 0); });
    $('#clip-set-start').addEventListener('click', function () {
      if (!clipPlayer || !clipItem) return;
      const t = Math.round(clipPlayer.getCurrentTime() * 10) / 10;
      if (clipItem.end && t >= clipItem.end) { clipInfo('L\'inizio deve precedere la fine.'); return; }
      clipItem.start = t; persist(); clipInfo('Inizio: ' + YTU().formatTime(t));
    });
    $('#clip-set-end').addEventListener('click', function () {
      if (!clipPlayer || !clipItem) return;
      const t = Math.round(clipPlayer.getCurrentTime() * 10) / 10;
      if (t <= (clipItem.start || 0)) { clipInfo('La fine deve seguire l\'inizio.'); return; }
      clipItem.end = t; persist(); clipInfo('Fine: ' + YTU().formatTime(t));
    });
    $('#clip-test').addEventListener('click', function () {
      if (!clipPlayer || !clipItem) return;
      clearInterval(testTimer);
      clipPlayer.seekTo(clipItem.start || 0, true); clipPlayer.playVideo();
      if (clipItem.end) testTimer = setInterval(function () {
        try { if (clipPlayer.getCurrentTime() >= clipItem.end) { clipPlayer.pauseVideo(); clearInterval(testTimer); } } catch (_) { clearInterval(testTimer); }
      }, 150);
    });

    /* ---------------- salva / apri / ripristina ---------------- */
    $('#save-cfg').addEventListener('click', async function () {
      download('Parametri di Configurazione ' + stamp() + '.json', await Config.exportJson(cfg));
    });
    $('#open-cfg').addEventListener('click', function () { $('#cfg-file').click(); });
    $('#cfg-file').addEventListener('change', async function (e) {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        cfg = await Config.importJson(await f.text());
        o.setCfg(cfg); refreshAll();
        if (o.onPlaylistChange) o.onPlaylistChange();
      } catch (err) { alert(err.message || 'File non valido'); }
    });
    $('#reset-cfg').addEventListener('click', async function () {
      if (!confirm('Ripristinare tutte le impostazioni predefinite?')) return;
      await Config.clearObjectImage();
      cfg = JSON.parse(JSON.stringify(Config.DEFAULTS)); Config.save(cfg); o.setCfg(cfg); refreshAll();
    });

    /* ---------------- riepilogo sessione ---------------- */
    function showSession(summary) {
      lastSession = summary;
      const d = summary.Dati;
      $('#sb-text').textContent = 'tocchi: ' + d['Touching responses'] + ' · prove: ' + d['Trials'] + ' · durata totale: ' + d['Durata totale'] + ' · uscita: ' + d['Motivo uscita'];
      $('#session-banner').hidden = false;
      window.scrollTo(0, 0);
    }
    function downloadSession() {
      if (!lastSession) return;
      download('DATI Sessione ' + stamp() + '.json', JSON.stringify({ Dati: lastSession.Dati }, null, 2));
    }
    $('#sb-download').addEventListener('click', downloadSession);
    $('#sb-close').addEventListener('click', function () { $('#session-banner').hidden = true; });

    function updateStartNote() {
      const n = cfg.reinforcement.playlist.length;
      $('#start-note').textContent = n ? '' : 'Nessun video di rinforzo selezionato: dopo il tocco l\'oggetto sparirà e riapparirà senza audio/video.';
    }

    // Riepilogo nella pagina dell'esercizio: cosa partirà premendo «Inizia gioco»
    async function refreshRiepilogo() {
      const box = $('#riepilogo');
      if (!box) return;
      const n = cfg.reinforcement.playlist.length;
      let oggetto = 'cerchio rosso';
      try {
        const img = cfg.object.hasImage ? await Config.getObjectImage() : null;
        if (img) oggetto = img.name || 'immagine scelta';
      } catch (_) {}
      const righe = [
        ['Oggetto', oggetto + ' · ' + cfg.sizeCm.w + '×' + cfg.sizeCm.h + ' cm'],
        ['Rinforzo', n + (n === 1 ? ' video' : ' video') + ' · ' + cfg.reinforcement.seconds + ' s · ' + (cfg.reinforcement.mode === 'audio' ? 'solo audio' : 'audio + video')],
        ['Tolleranza del tocco', String(cfg.touch.toleranceCm).replace('.', ',') + ' cm'],
      ];
      box.innerHTML = '';
      righe.forEach(function (r) {
        const d = document.createElement('div');
        const s = document.createElement('strong'); s.textContent = r[0];
        const v = document.createElement('span'); v.textContent = r[1];
        d.append(s, v); box.appendChild(d);
      });
      box.style.setProperty('--sfondo-oggetto', cfg.background);
    }

    function refreshAll() { fillInputs(); renderPlaylist(); refreshObject(); previewArea(); updateStartNote(); refreshRiepilogo(); }

    bindInputs(); refreshAll();
    requestAnimationFrame(previewArea);

    return { showSession: showSession, downloadSession: downloadSession, refresh: refreshAll, refreshRiepilogo: refreshRiepilogo };
  }

  TF.UI = { init: init, download: download, stamp: stamp };
})();
