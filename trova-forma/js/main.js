/*
 * Trova Forma - main.js
 * Orchestrazione: avvio gioco a schermo intero, uscita (Esc / rotellina), schermo sempre acceso.
 */
(function () {
  'use strict';
  const TF = window.TF;
  const $ = function (s) { return document.querySelector(s); };

  let cfg = TF.Config.load();
  const reinforcer = TF.YT.Reinforcer($('#vid-layer'));

  let game = null, starting = false, leavingFs = false, wakeLock = null, objectUrl = null;

  const ui = TF.UI.init({
    cfg: cfg,
    setCfg: function (c) { cfg = c; },
    onPlaylistChange: warm
  });

  /** Prepara il player in anticipo se c'è una playlist (così al via è già pronto). */
  function warm() { if (cfg.reinforcement.playlist.length) reinforcer.warm(); }
  warm();

  /* ---------------- schermo intero ---------------- */
  function requestFs() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return Promise.resolve(false); // es. iPhone: si usa l'app installata (manifest "fullscreen")
    try {
      const r = fn.call(el, { navigationUI: 'hide' });
      return (r && r.then ? r : Promise.resolve()).then(function () { return true; }, function () { return false; });
    } catch (_) { return Promise.resolve(false); }
  }
  function exitFs() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) return;
    leavingFs = true;
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    try { const r = fn.call(document); if (r && r.catch) r.catch(function () {}); } catch (_) {}
    setTimeout(function () { leavingFs = false; }, 600);
  }
  function onFsChange() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    // uscita dallo schermo intero (Esc del browser, gesto di sistema): chiude la sessione
    if (!fsEl && game && !leavingFs) endSession('esc (schermo intero)');
  }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  /* ---------------- schermo sempre acceso ---------------- */
  async function acquireWake() {
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
  }
  function releaseWake() { try { if (wakeLock) wakeLock.release(); } catch (_) {} wakeLock = null; }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && game) acquireWake();
  });

  /* ---------------- avvio / fine ---------------- */
  function timeout(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function startGame() {
    if (starting || game) return;
    starting = true;

    // 1) Tutto ciò che richiede il gesto dell'utente va chiamato subito, in modo sincrono.
    const fsP = requestFs();
    reinforcer.configure(cfg.reinforcement);
    const primeP = reinforcer.prime();

    // 2) Passa alla vista di gioco e blocca i gesti del browser.
    $('#app-shell').hidden = true;
    $('#game-view').hidden = false;
    TF.TouchGuard.PageLock.engage(function (why) { endSession(why); });
    acquireWake();

    // 3) Immagine dell'oggetto
    try {
      const img = cfg.object.hasImage ? await TF.Config.getObjectImage() : null;
      objectUrl = img ? URL.createObjectURL(img.blob) : null;
    } catch (_) { objectUrl = null; }

    // 4) Attendi schermo intero e player pronto (con tempo massimo), poi parti.
    await Promise.race([Promise.all([fsP, primeP]), timeout(6000)]);
    if (!starting) return; // uscito (Esc) durante l'attesa

    game = TF.Game({
      cfg: cfg, reinforcer: reinforcer, objectUrl: objectUrl,
      els: { stage: $('#stage'), obj: $('#object'), shield: $('#shield'), gear: $('#gear') }
    });
    game.start();
    starting = false;
    game.ended.then(finish);
  }

  function endSession(reason) {
    if (game) game.end(reason);
    else if (starting) { starting = false; finish(null); }
  }

  function finish(summary) {
    const g = game; game = null; starting = false;
    reinforcer.stop();
    TF.TouchGuard.PageLock.release();
    exitFs();
    releaseWake();
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    $('#object').removeAttribute('src');
    $('#game-view').hidden = true;
    $('#app-shell').hidden = false;
    window.scrollTo(0, 0);
    if (summary) {
      ui.showSession(summary);
      if (cfg.session.autoSave && summary._touches + summary._trials > 0) ui.downloadSession();
    }
    void g;
  }

  $('#start').addEventListener('click', startGame);

  /* ---------------- pagine: esercizio e Configurazione ----------------
     Come nelle altre app della raccolta: all'apertura si va direttamente all'esercizio se è
     pronto (almeno un video di rinforzo), altrimenti alla Configurazione. */
  function esercizioPronto() { return cfg.reinforcement.playlist.length > 0; }
  function mostra(pagina) {
    $('#esercizio-view').hidden = pagina !== 'esercizio';
    $('#config-view').hidden = pagina !== 'configurazione';
    if (pagina === 'esercizio') ui.refreshRiepilogo();
    window.scrollTo(0, 0);
  }
  $('#vai-config').addEventListener('click', function () { mostra('configurazione'); });
  $('#vai-esercizio').addEventListener('click', function () { mostra('esercizio'); });
  $('#vai-esercizio-2').addEventListener('click', function () { mostra('esercizio'); });
  mostra(esercizioPronto() ? 'esercizio' : 'configurazione');

  /* ---------------- PWA ---------------- */
  if ('serviceWorker' in navigator && /^https:$|^http:$/.test(location.protocol) &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('service-worker.js?v=1.1.0').catch(function (e) { console.warn('SW', e); });
  }

  window.TF.app = { startGame: startGame, endSession: endSession, reinforcer: reinforcer, getConfig: function () { return cfg; } };
})();
