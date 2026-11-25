/*
 * Trova Forma - touch-guard.js
 * ---------------------------------------------------------------------------
 * Modulo "touchscreen tollerante". Fa due cose distinte:
 *
 *  1) HitDetector  -> decide se un contatto sullo schermo conta come "toccato
 *                     l'oggetto", accettando tocchi imprecisi, debolissimi,
 *                     striscianti, multipli o interrotti dal browser.
 *  2) PageLock     -> impedisce che qualunque tocco/gesto/tasto sbagliato
 *                     chiuda l'app, scrolli, zoomi, apra menu o finestre.
 *
 * Nessuna dipendenza. Espone window.TF.TouchGuard.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  const TF = (window.TF = window.TF || {});

  /* ======================================================================
   * Geometria
   * ==================================================================== */

  /** Distanza minima tra un punto e un rettangolo {left,top,right,bottom} (0 se dentro). */
  function distToRect(px, py, r) {
    const dx = Math.max(r.left - px, 0, px - r.right);
    const dy = Math.max(r.top - py, 0, py - r.bottom);
    return Math.hypot(dx, dy);
  }

  /**
   * Controlla anche il percorso tra due campioni consecutivi (swept test):
   * un dito che attraversa velocemente l'oggetto tra due eventi pointermove
   * non deve "saltarlo". Campiona il segmento ogni <= stepPx pixel.
   */
  function segmentHits(x0, y0, x1, y1, rect, reach, stepPx) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / (stepPx || 6)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (distToRect(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, rect) <= reach) return true;
    }
    return false;
  }

  /* ======================================================================
   * 1) HitDetector
   * ==================================================================== */

  /**
   * @param {Object}   o
   * @param {Element}  o.surface        elemento trasparente a tutto schermo che riceve i puntatori
   * @param {Function} o.getRect        () => {left,top,right,bottom} dell'oggetto (px viewport) | null
   * @param {Function} o.isEnabled      () => bool   (false durante rinforzo / pause)
   * @param {Function} o.getTolerancePx () => px di margine attorno all'oggetto
   * @param {Function} o.onHit          (info) => void
   * @param {number}   [o.maxContactPx] raggio massimo di contatto considerato (default 56)
   * @param {number}   [o.rearmPx]      spostamento che "riarma" un dito appoggiato (default 20)
   */
  function createHitDetector(o) {
    const MAX_CONTACT = o.maxContactPx || 56;
    const REARM = o.rearmPx || 20;
    /** pointerId -> {x,y,r,armed,ax,ay} */
    const active = new Map();

    function reach(contactRadius) {
      return Math.max(0, o.getTolerancePx()) + Math.min(contactRadius, MAX_CONTACT);
    }

    // Raggio del contatto: i digitizer che lo espongono (width/height) permettono di
    // accettare anche dita grandi / palmi / tocchi larghi. Se non esposto vale 1 -> 0.
    function contactRadius(e) {
      const w = e.width || 0, h = e.height || 0;
      return e.pointerType === 'mouse' ? 0 : Math.max(w, h) / 2;
    }

    function blockAll() {
      active.forEach(function (p) { p.armed = false; p.ax = p.x; p.ay = p.y; });
    }

    function fire(p, how) {
      // un solo colpo per volta; tutti i contatti in corso devono essere "riarmati" con un
      // movimento o rialzati: evita doppi conteggi e che un dito appoggiato riattivi l'oggetto.
      blockAll();
      try { o.onHit({ x: p.x, y: p.y, how: how, pointerId: p.id }); } catch (err) { console.error(err); }
    }

    function evaluate(p, prev, how) {
      if (!o.isEnabled()) return;
      const rect = o.getRect();
      if (!rect) return;
      const rch = reach(p.r);
      let hit = distToRect(p.x, p.y, rect) <= rch;
      if (!hit && prev) hit = segmentHits(prev.x, prev.y, p.x, p.y, rect, rch, 6);
      if (hit) fire(p, how);
    }

    function track(e, create) {
      let p = active.get(e.pointerId);
      if (!p) {
        if (!create) return null;
        // Un contatto nato mentre l'input era disabilitato (rinforzo in corso) o già
        // "consumato" parte non armato: non attiva nulla finché non si muove davvero.
        p = { id: e.pointerId, x: e.clientX, y: e.clientY, r: 0, armed: o.isEnabled(), ax: e.clientX, ay: e.clientY };
        active.set(e.pointerId, p);
      }
      return p;
    }

    function update(p, e) {
      p.x = e.clientX; p.y = e.clientY; p.r = contactRadius(e);
      if (!p.armed && Math.hypot(p.x - p.ax, p.y - p.ay) >= REARM && o.isEnabled()) p.armed = true;
    }

    function onDown(e) {
      const p = track(e, true);
      update(p, e);
      try { o.surface.setPointerCapture(e.pointerId); } catch (_) { /* non critico */ }
      if (p.armed) evaluate(p, null, 'down');
    }

    function onMove(e) {
      const p = track(e, false);
      if (!p) return; // mouse in hover senza pulsante premuto: ignorato
      // coalesced: tutti i campioni intermedi che il browser ha accorpato
      const list = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
      const samples = list.length ? list : [e];
      for (let i = 0; i < samples.length; i++) {
        const prev = { x: p.x, y: p.y };
        update(p, samples[i]);
        if (p.armed) evaluate(p, prev, 'move');
      }
    }

    function onUp(e) {
      const p = track(e, false);
      if (!p) return;
      const prev = { x: p.x, y: p.y };
      update(p, e);
      if (p.armed) evaluate(p, prev, 'up');
      active.delete(e.pointerId);
    }

    function onCancel(e) {
      // Il browser annulla il puntatore (gesto di sistema, palmo, ecc.): l'ultima posizione
      // nota viene comunque valutata, così un tocco "rubato" non va perso.
      const p = track(e, false);
      if (!p) return;
      if (p.armed) evaluate(p, null, 'cancel');
      active.delete(e.pointerId);
    }

    const s = o.surface;
    s.addEventListener('pointerdown', onDown);
    s.addEventListener('pointermove', onMove);
    s.addEventListener('pointerup', onUp);
    s.addEventListener('pointercancel', onCancel);
    s.addEventListener('lostpointercapture', function (e) {
      // se il capture si perde senza up/cancel, non lasciare puntatori fantasma
      if (active.has(e.pointerId)) active.delete(e.pointerId);
    });

    return {
      /** Da chiamare quando l'oggetto riappare: i contatti ancora appoggiati vanno bloccati. */
      rearmFresh: blockAll,
      reset: function () { active.clear(); },
      destroy: function () {
        s.removeEventListener('pointerdown', onDown);
        s.removeEventListener('pointermove', onMove);
        s.removeEventListener('pointerup', onUp);
        s.removeEventListener('pointercancel', onCancel);
        active.clear();
      }
    };
  }

  /* ======================================================================
   * Pressione lunga (rotellina) - tollerante a micro-spostamenti, ma ignora
   * tocchi brevi. Mostra l'avanzamento su una variabile CSS --p (0..1).
   * ==================================================================== */
  function attachLongPress(el, holdMs, onFire) {
    let timer = null, raf = 0, t0 = 0, pid = null;
    function cancel() {
      clearTimeout(timer); cancelAnimationFrame(raf); timer = null; pid = null;
      el.style.setProperty('--p', '0'); el.classList.remove('pressing');
    }
    function tick() {
      el.style.setProperty('--p', String(Math.min(1, (performance.now() - t0) / holdMs())));
      raf = requestAnimationFrame(tick);
    }
    el.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      if (pid !== null) return;
      pid = e.pointerId; t0 = performance.now();
      el.classList.add('pressing');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      raf = requestAnimationFrame(tick);
      timer = setTimeout(function () { cancel(); onFire(); }, holdMs());
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) {
      el.addEventListener(n, function (e) { if (e.pointerId === pid) cancel(); });
    });
    ['pointermove', 'pointerdown', 'pointerup'].forEach(function (n) {
      el.addEventListener(n, function (e) { e.stopPropagation(); });
    });
    // tasto destro / tocco lungo del sistema: niente menu
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return { cancel: cancel };
  }

  /* ======================================================================
   * 2) PageLock: nessun tocco o gesto fuori dall'oggetto deve fare danni.
   * ==================================================================== */

  const PageLock = (function () {
    let on = false;
    let exitCb = null;
    const handlers = [];
    let historyTrapped = false;

    function add(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      handlers.push([target, type, fn, opts]);
    }
    const stop = function (e) { if (e.cancelable) e.preventDefault(); };
    const stopAll = function (e) { if (e.cancelable) e.preventDefault(); e.stopPropagation(); };

    function onKey(e) {
      if (e.key === 'Escape' || e.code === 'Escape') { // unica scorciatoia ammessa
        e.preventDefault();
        if (exitCb) exitCb('esc');
        return;
      }
      // tutto il resto: tasti funzione, Tab, Backspace, Spazio, frecce, Ctrl+/-, Ctrl+P, Ctrl+S ...
      // (Ctrl+W, Ctrl+T, Alt+F4 sono riservati al browser/OS e non intercettabili dalle pagine:
      //  vedi README, sezione "Blocco kiosk").
      e.preventDefault();
      e.stopPropagation();
    }

    function onBeforeUnload(e) {
      // chiusura scheda / ricarica / navigazione per sbaglio: il browser chiede conferma
      e.preventDefault();
      e.returnValue = '';
      return '';
    }

    function onPopState() {
      // gesto/tasto "indietro": viene riassorbito, la pagina resta dov'è
      history.pushState({ tf: 'lock' }, '', location.href);
    }

    return {
      /** @param {Function} onExit  chiamata con 'esc' quando si preme Esc */
      engage: function (onExit) {
        if (on) return;
        on = true; exitCb = onExit;
        document.body.classList.add('playing');
        const nonPassive = { passive: false, capture: true };

        // Touch (iOS/Android): se nessuno chiama preventDefault, il browser scrolla,
        // fa pull-to-refresh, pinch-zoom, swipe "indietro" dal bordo, long-press menu.
        add(document, 'touchstart', stop, nonPassive);
        add(document, 'touchmove', stop, nonPassive);
        add(document, 'touchend', stop, nonPassive);
        // Safari iOS: pinch tramite eventi "gesture*"
        add(document, 'gesturestart', stop, nonPassive);
        add(document, 'gesturechange', stop, nonPassive);
        add(document, 'gestureend', stop, nonPassive);
        // Menu contestuale (tasto destro / long-press), selezione, trascinamento, doppio click/tap
        add(document, 'contextmenu', stopAll, true);
        add(document, 'selectstart', stopAll, true);
        add(document, 'dragstart', stopAll, true);
        add(document, 'dblclick', stopAll, true);
        add(document, 'auxclick', stopAll, true);          // click centrale (apre link in nuova scheda)
        add(document, 'wheel', stop, nonPassive);          // scroll e Ctrl+rotella (zoom)
        add(document, 'keydown', onKey, true);
        add(document, 'keypress', stop, true);
        add(window, 'beforeunload', onBeforeUnload);

        // "Indietro" assorbito
        if (!historyTrapped) {
          history.pushState({ tf: 'lock' }, '', location.href);
          historyTrapped = true;
        }
        add(window, 'popstate', onPopState);
      },

      release: function () {
        if (!on) return;
        on = false; exitCb = null;
        document.body.classList.remove('playing');
        handlers.splice(0).forEach(function (h) { h[0].removeEventListener(h[1], h[2], h[3]); });
      }
    };
  })();

  TF.TouchGuard = {
    createHitDetector: createHitDetector,
    attachLongPress: attachLongPress,
    PageLock: PageLock,
    _geom: { distToRect: distToRect, segmentHits: segmentHits } // esposti per i test
  };
})();
