// Anti-spam: máximo 5 avisos por hora por persona. Sin conexión, el aviso queda guardado en el teléfono.
import assert from 'node:assert/strict';
import { store } from '../js/core/store.js';
import { reportar, puedeReportar, subirPendientes, LIMITE_AVISOS_HORA, listar } from '../js/services/alerts.service.js';

store.set({ user: { nombre: 'Ana' }, guest: false, favoriteLines: ['linea-60'], alerts: [], misReportes: [] });
assert.equal(LIMITE_AVISOS_HORA, 5);
assert.deepEqual(puedeReportar(), { ok: true, esperaMin: 0 });

for (let i = 0; i < 5; i++) {
  const r = await reportar({ tipo: 'trafico', lineaId: 'linea-60', donde: `Paradero ${i}`, nota: '' });
  assert.ok(r, `el aviso ${i + 1} debe enviarse`);
  assert.ok(String(r.id).startsWith('local-'), 'sin conexión se queda en el teléfono');
  await new Promise((ok) => setTimeout(ok, 2));          // ids distintos (usan la hora)
}
const lim = puedeReportar();
assert.equal(lim.ok, false);
assert.ok(lim.esperaMin >= 1 && lim.esperaMin <= 60);
assert.equal(await reportar({ tipo: 'paro', lineaId: 'linea-60', donde: '', nota: '' }), null);   // el 6.º se rechaza
assert.equal(store.get().alerts.length, 5);                                                     // y no se crea nada

await subirPendientes();                                                                        // sin conexión: nada se pierde
assert.equal(listar({ soloMisLineas: false }).length, 5);

// Pasada la hora, vuelve a poder avisar.
store.set({ misReportes: store.get().misReportes.map((ts) => ts - 61 * 60000) });
assert.equal(puedeReportar().ok, true);
console.log('Todo en orden (límite de avisos y reintento)');
