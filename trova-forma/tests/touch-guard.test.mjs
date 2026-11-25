// Test del modulo touch (nessun browser: superficie finta basata su EventTarget).
// Esecuzione: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, console, document: {}, performance, requestAnimationFrame() {}, cancelAnimationFrame() {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/touch-guard.js', import.meta.url), 'utf8'), ctx);
const TG = ctx.window.TF.TouchGuard;

const RECT = { left: 400, top: 300, right: 500, bottom: 400 };

function setup(opts = {}) {
  const surface = new EventTarget();
  surface.setPointerCapture = () => {};
  let enabled = true; const hits = [];
  const det = TG.createHitDetector({
    surface, getRect: () => (enabled ? RECT : null), isEnabled: () => enabled,
    getTolerancePx: () => opts.tol ?? 38, onHit: (i) => hits.push(i),
  });
  const fire = (type, x, y, extra = {}) => {
    const e = new Event(type); Object.assign(e, { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, width: 1, height: 1 }, extra);
    surface.dispatchEvent(e);
  };
  return { fire, hits, det, setEnabled: (v) => { enabled = v; } };
}

test('tocco dentro l\'oggetto: colpito', () => {
  const t = setup(); t.fire('pointerdown', 450, 350); assert.equal(t.hits.length, 1);
});
test('tocco entro la tolleranza (30 px dal bordo): colpito', () => {
  const t = setup(); t.fire('pointerdown', 530, 350); assert.equal(t.hits.length, 1);
});
test('tocco oltre la tolleranza (60 px): ignorato', () => {
  const t = setup(); t.fire('pointerdown', 560, 350); t.fire('pointerup', 560, 350); assert.equal(t.hits.length, 0);
});
test('contatto largo (dito/palmo) aumenta la portata', () => {
  const t = setup(); t.fire('pointerdown', 560, 350, { width: 60, height: 60 }); assert.equal(t.hits.length, 1);
});
test('strisciata veloce che salta l\'oggetto tra due campioni: colpito', () => {
  const t = setup(); t.fire('pointerdown', 100, 350); t.fire('pointermove', 900, 350); assert.equal(t.hits.length, 1);
});
test('dito che scivola dentro l\'oggetto: colpito', () => {
  const t = setup(); t.fire('pointerdown', 450, 600); t.fire('pointermove', 450, 500); t.fire('pointermove', 450, 420); assert.equal(t.hits.length, 1);
});
test('pointerup sull\'oggetto (dito sollevato lì): colpito', () => {
  const t = setup(); t.fire('pointerdown', 450, 600, { }); // non armato? è armato: giù fuori area
  t.fire('pointerup', 450, 350); assert.equal(t.hits.length, 1);
});
test('pointercancel valuta l\'ultima posizione nota', () => {
  const t = setup(); t.fire('pointerdown', 700, 350); t.fire('pointermove', 520, 350); // 20 px dal bordo -> già colpito in move
  assert.equal(t.hits.length, 1);
  const u = setup(); u.fire('pointerdown', 450, 350, { pointerId: 2 }); assert.equal(u.hits.length, 1);
});
test('mouse in hover senza pulsante premuto: ignorato', () => {
  const t = setup(); t.fire('pointermove', 450, 350, { pointerType: 'mouse' }); assert.equal(t.hits.length, 0);
});
test('un solo colpo anche con dito che resta appoggiato e si muove sull\'oggetto', () => {
  const t = setup(); t.fire('pointerdown', 450, 350); t.fire('pointermove', 452, 352); t.fire('pointermove', 455, 355);
  assert.equal(t.hits.length, 1);
});
test('multi-touch: qualsiasi dito può colpire', () => {
  const t = setup(); t.fire('pointerdown', 50, 50, { pointerId: 1 }); t.fire('pointerdown', 450, 350, { pointerId: 2 });
  assert.equal(t.hits.length, 1);
});
test('contatto nato durante il rinforzo (disabilitato): non colpisce finché non si muove davvero', () => {
  const t = setup(); t.setEnabled(false);
  t.fire('pointerdown', 450, 350);          // palmo appoggiato dove poi comparirà l'oggetto
  t.setEnabled(true); t.det.rearmFresh();
  t.fire('pointermove', 452, 351);          // micro-tremore: nessun colpo
  assert.equal(t.hits.length, 0);
  t.fire('pointermove', 480, 380);          // movimento deliberato (> 20 px): ora vale
  assert.equal(t.hits.length, 1);
});
test('dito consumato da un colpo non rimbalza dopo la riapparizione', () => {
  const t = setup(); t.fire('pointerdown', 450, 350); assert.equal(t.hits.length, 1);
  t.setEnabled(false); t.setEnabled(true); t.det.rearmFresh();
  t.fire('pointermove', 451, 350); assert.equal(t.hits.length, 1);
});
