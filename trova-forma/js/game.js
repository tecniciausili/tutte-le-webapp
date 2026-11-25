/*
 * Trova Forma - game.js
 * Motore di gioco (porting di main_Game in Es_OculoManuali_p100v9.py).
 *
 * Stati:  starting -> waiting (oggetto visibile) -> reinforcing (rinforzo) -> waiting ...
 *                                   \-> blank (oggetto sparito per inattività) -> waiting
 * Contatori come nell'app Python:
 *   - "Touching responses" = tocchi sull'oggetto
 *   - "Trials"             = tocchi + riposizionamenti per inattività
 */
(function () {
  'use strict';
  const TF = (window.TF = window.TF || {});

  const DEFAULT_OBJECT_SVG =
    'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#d62828"/></svg>');

  const GEAR_ZONE = 88; // px riservati in alto a destra per la rotellina

  function Game(o) {
    const cfg = o.cfg;
    const els = o.els;               // {stage, obj, shield, gear}
    const reinforcer = o.reinforcer;
    const objectUrl = o.objectUrl;   // blob: URL oppure null

    let state = 'starting';
    let W = 0, H = 0, ow = 0, oh = 0, area = null;
    let cx = 0, cy = 0, prev = null;
    let idleTimer = null, blankTimer = null, resizeTimer = null, appearedAt = 0;
    let t0 = Date.now(), tFirstTouch = null;
    let touches = 0, trials = 0;
    const events = [];
    let detector = null, longPress = null;
    let onEnd = null;
    const ended = new Promise(function (r) { onEnd = r; });

    /* ---------------- geometria ---------------- */
    function layout() {
      const r = els.stage.getBoundingClientRect();
      W = r.width; H = r.height;
      const k = cfg.pxPerCm;
      ow = Math.max(8, cfg.sizeCm.w * k); oh = Math.max(8, cfg.sizeCm.h * k);
      // oggetto mai più grande dello schermo
      const sc = Math.min(1, W / ow, H / oh); ow *= sc; oh *= sc;
      area = { l: cfg.area.left * k, r: W - cfg.area.right * k, t: cfg.area.top * k, b: H - cfg.area.bottom * k };
      if (area.r - area.l < ow) { const m = (area.l + area.r) / 2; area.l = m - ow / 2; area.r = m + ow / 2; }
      if (area.b - area.t < oh) { const m = (area.t + area.b) / 2; area.t = m - oh / 2; area.b = m + oh / 2; }
    }

    function ranges() {
      const xMin = area.l + ow / 2, xMax = area.r - ow / 2;
      const midY = (area.t + area.b) / 2;
      const half = Math.max(0, (area.b - area.t - oh) / 2) * (cfg.vertical / 100);
      return { xMin: xMin, xMax: xMax, yMin: midY - half, yMax: midY + half, midX: (area.l + area.r) / 2, midY: midY };
    }

    function overlapsGear(x, y) {
      if (!cfg.touch.showGear) return false;
      return (x + ow / 2 > W - GEAR_ZONE) && (y - oh / 2 < GEAR_ZONE);
    }

    /** Posizione casuale nell'area, DIVERSA dalla precedente (distanza minima ~ dimensione oggetto). */
    function pickPosition() {
      const g = ranges();
      const maxD = Math.hypot(g.xMax - g.xMin, g.yMax - g.yMin);
      const minD = prev ? Math.min(Math.max(ow, oh), maxD * 0.6) : 0;
      let best = null, bestD = -1;
      for (let i = 0; i < 80; i++) {
        const x = g.xMin + Math.random() * (g.xMax - g.xMin);
        const y = g.yMin + Math.random() * (g.yMax - g.yMin);
        if (overlapsGear(x, y)) continue;
        const d = prev ? Math.hypot(x - prev.x, y - prev.y) : Infinity;
        if (d >= minD) return { x: x, y: y };
        if (d > bestD) { bestD = d; best = { x: x, y: y }; }
      }
      return best || { x: g.midX, y: g.midY };
    }

    function place(p) {
      cx = p.x; cy = p.y;
      const s = els.obj.style;
      s.width = ow + 'px'; s.height = oh + 'px';
      s.left = (cx - ow / 2) + 'px'; s.top = (cy - oh / 2) + 'px';
    }
    function showObject() {
      els.obj.style.visibility = 'visible';
      appearedAt = performance.now();
      if (detector) detector.rearmFresh(); // dita ancora appoggiati: non riattivano
    }
    function hideObject() { els.obj.style.visibility = 'hidden'; }

    function hitRect() {
      if (state !== 'waiting') return null;
      const r = els.stage.getBoundingClientRect();
      return { left: r.left + cx - ow / 2, right: r.left + cx + ow / 2, top: r.top + cy - oh / 2, bottom: r.top + cy + oh / 2 };
    }

    /* ---------------- ciclo di gioco ---------------- */
    function armIdle() {
      clearTimeout(idleTimer);
      if (cfg.session.idleSec > 0) idleTimer = setTimeout(onIdle, cfg.session.idleSec * 1000);
    }

    function onIdle() {
      if (state !== 'waiting') return;
      state = 'blank';
      trials++;
      events.push({ tipo: 'inattivita', t: Math.round((Date.now() - t0)) / 1000, x: Math.round(cx), y: Math.round(cy) });
      hideObject();
      blankTimer = setTimeout(function () {
        if (state !== 'blank') return;
        const p = pickPosition(); prev = { x: cx, y: cy }; place(p);
        state = 'waiting'; showObject(); armIdle();
      }, Math.max(0, cfg.session.idleBlankSec) * 1000);
    }

    async function onHit(info) {
      if (state !== 'waiting') return;
      state = 'reinforcing';
      clearTimeout(idleTimer);
      if (tFirstTouch === null) tFirstTouch = Date.now();
      touches++; trials++;
      events.push({
        tipo: 'tocco', t: Math.round(Date.now() - t0) / 1000,
        latenza_ms: Math.round(performance.now() - appearedAt),
        x: Math.round(info.x), y: Math.round(info.y), modo: info.how
      });
      hideObject();
      await reinforcer.run(cfg.reinforcement.seconds, cfg.reinforcement.mode === 'av');
      if (state === 'ended') return;
      prev = { x: cx, y: cy };
      place(pickPosition());
      state = 'waiting';
      showObject();
      armIdle();
    }

    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (state === 'ended') return;
        layout();
        const g = ranges();
        // riporta l'oggetto dentro la nuova area senza cambiare stato
        place({ x: Math.min(g.xMax, Math.max(g.xMin, cx)), y: Math.min(g.yMax, Math.max(g.yMin, cy)) });
      }, 150);
    }

    /* ---------------- API ---------------- */
    const api = {
      ended: ended,
      stats: function () { return { touches: touches, trials: trials }; },

      /** Chiamare con lo stage già visibile (a schermo intero). */
      start: function () {
        els.obj.src = objectUrl || DEFAULT_OBJECT_SVG;
        els.obj.style.filter = 'contrast(' + cfg.contrast + '%)';
        els.stage.style.backgroundColor = cfg.background;
        layout();
        const g = ranges();
        place({ x: g.midX, y: g.midY }); // come nell'app Python: la prima volta al centro
        t0 = Date.now();
        window.addEventListener('resize', onResize);

        detector = TF.TouchGuard.createHitDetector({
          surface: els.shield,
          getRect: hitRect,
          isEnabled: function () { return state === 'waiting'; },
          getTolerancePx: function () { return cfg.touch.toleranceCm * cfg.pxPerCm; },
          onHit: onHit
        });
        longPress = TF.TouchGuard.attachLongPress(els.gear, function () { return cfg.touch.gearHoldSec * 1000; },
          function () { api.end('gear'); });
        els.gear.hidden = !cfg.touch.showGear;

        state = 'waiting';
        showObject();
        armIdle();
      },

      end: function (reason) {
        if (state === 'ended') return;
        state = 'ended';
        clearTimeout(idleTimer); clearTimeout(blankTimer); clearTimeout(resizeTimer);
        window.removeEventListener('resize', onResize);
        if (detector) detector.destroy();
        if (longPress) longPress.cancel();
        reinforcer.stop();
        hideObject();
        const now = Date.now();
        const secs = function (ms) { return Math.round(ms / 100) / 10; };
        onEnd({
          // chiavi compatibili con il file "DATI Sessione....json" dell'app Python
          Dati: {
            'Durata sessione': tFirstTouch ? secs(now - tFirstTouch) + ' s (dal primo tocco)' : '0 s',
            'Trials': String(trials),
            'Touching responses': String(touches),
            'Durata totale': secs(now - t0) + ' s',
            'Motivo uscita': reason,
            'Inizio': new Date(t0).toISOString(),
            'Fine': new Date(now).toISOString(),
            'Eventi': events
          },
          _touches: touches, _trials: trials, _reason: reason
        });
      }
    };
    return api;
  }

  TF.Game = Game;
})();
