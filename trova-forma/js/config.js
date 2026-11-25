/*
 * Trova Forma - config.js
 * Configurazione: valori di default, persistenza (localStorage + IndexedDB per
 * l'immagine dell'oggetto), import/export JSON.
 */
(function () {
  'use strict';
  const TF = (window.TF = window.TF || {});

  const LS_CONFIG = 'tf.config.v1';
  const LS_APIKEY = 'tf.ytApiKey';

  const DEFAULTS = {
    version: 1,
    background: '#FFFF00',
    object: { name: '', hasImage: false },       // l'immagine vera sta in IndexedDB
    sizeCm: { w: 7, h: 7 },
    contrast: 100,                                 // % (filtro CSS contrast)
    pxPerCm: 37.8,                                 // 96 dpi CSS; calibrare sul tablet reale
    area: { left: 0, right: 0, top: 0, bottom: 0 },// margini (cm) che delimitano la zona di movimento
    vertical: 100,                                 // % di escursione verticale concessa all'oggetto
    reinforcement: {
      seconds: 5,
      mode: 'av',                                  // 'av' = audio+video | 'audio' = solo audio
      resume: 'resume',                            // 'resume' riprende da dove interrotto | 'restart' ricomincia la clip
      order: 'seq',                                // 'seq' | 'random'
      playlist: []                                 // [{id,title,channel,duration,start,end}] end:null = fino alla fine
    },
    touch: { toleranceCm: 1, gearHoldSec: 2, showGear: true },
    session: { idleSec: 15, idleBlankSec: 5.5, autoSave: true }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // merge ricorsivo: i campi mancanti (config vecchie / parziali) prendono il default
  function merge(base, extra) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!extra || typeof extra !== 'object') return out;
    Object.keys(extra).forEach(function (k) {
      if (k === 'playlist' && Array.isArray(extra[k])) out[k] = extra[k];
      else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = merge(base[k], extra[k]);
      else if (extra[k] !== undefined) out[k] = extra[k];
    });
    return out;
  }

  /* ---------- IndexedDB (immagine oggetto) ---------- */
  function idb() {
    return new Promise(function (res, rej) {
      const r = indexedDB.open('trovaforma', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbGet(key) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        const q = db.transaction('kv').objectStore('kv').get(key);
        q.onsuccess = function () { res(q.result || null); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  function idbPut(key, val) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbDel(key) {
    return idb().then(function (db) {
      return new Promise(function (res) {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete(key);
        tx.oncomplete = function () { res(); };
      });
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (res, rej) {
      const fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(fr.error); };
      fr.readAsDataURL(blob);
    });
  }
  async function dataUrlToBlob(url) { return (await fetch(url)).blob(); }

  /* ---------- API pubblica ---------- */
  const Config = {
    DEFAULTS: DEFAULTS,

    load: function () {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(LS_CONFIG) || 'null'); } catch (_) {}
      return merge(clone(DEFAULTS), saved || {});
    },

    save: function (cfg) {
      try { localStorage.setItem(LS_CONFIG, JSON.stringify(cfg)); } catch (e) { console.warn('save', e); }
    },

    getApiKey: function () { try { return localStorage.getItem(LS_APIKEY) || ''; } catch (_) { return ''; } },
    setApiKey: function (k) { try { localStorage.setItem(LS_APIKEY, k || ''); } catch (_) {} },

    /** Restituisce {name,blob} dell'immagine oggetto oppure null. */
    getObjectImage: function () { return idbGet('object').catch(function () { return null; }); },
    setObjectImage: function (file) { return idbPut('object', { name: file.name, type: file.type, blob: file }); },
    clearObjectImage: function () { return idbDel('object'); },

    /** Export: la chiave API non viene mai inclusa; l'immagine sì (base64) così il file è autosufficiente. */
    exportJson: async function (cfg) {
      const out = clone(cfg);
      const img = await Config.getObjectImage();
      out.object = { name: img ? img.name : '', hasImage: !!img, dataUrl: img ? await blobToDataUrl(img.blob) : null };
      return JSON.stringify({ app: 'TrovaForma', Dati: out }, null, 2);
    },

    /** Import: accetta il formato di questa app. Ritorna la nuova config (già salvata). */
    importJson: async function (text) {
      const parsed = JSON.parse(text);
      if (!parsed || parsed.app !== 'TrovaForma' || !parsed.Dati) throw new Error('File non valido: non è una configurazione di Trova Forma');
      const d = parsed.Dati;
      const cfg = merge(clone(DEFAULTS), d);
      if (d.object && d.object.dataUrl) {
        const blob = await dataUrlToBlob(d.object.dataUrl);
        await idbPut('object', { name: d.object.name || 'oggetto', type: blob.type, blob: blob });
        cfg.object = { name: d.object.name || 'oggetto', hasImage: true };
      } else {
        await idbDel('object');
        cfg.object = { name: '', hasImage: false };
      }
      Config.save(cfg);
      return cfg;
    }
  };

  TF.Config = Config;
})();
