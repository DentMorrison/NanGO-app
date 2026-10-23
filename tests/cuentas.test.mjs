// Cerrar sesión borra lo personal del teléfono (pero no las preferencias) y los viajes se guardan del más reciente al más viejo.
import assert from 'node:assert/strict';
import { store, datosPersonalesVacios } from '../js/core/store.js';
import { terminar } from '../js/services/trip.service.js';

store.set({
  lang: 'qu', theme: 'dark', textSize: 2,
  user: { nombre: 'Ana' }, guest: false,
  favoriteLines: ['linea-15'], shortcuts: [{ id: 's1', label: 'Mi casa', icon: 'home', place: 'Plaza de Armas' }],
  history: [{ o: 'A', d: 'B', lineaId: 'linea-15', when: 'hoy', ts: 1 }],
  viajesCompletados: [{ lineaId: 'linea-15', fecha: '2026-10-20T10:00:00.000Z' }], votes: { x: 'yes' },
  stats: { avisos: 4, confirmaron: 7 },
});
store.set({ user: null, guest: false, ...datosPersonalesVacios() });   // lo que hace salir()
const s = store.get();
assert.equal(s.user, null);
assert.equal(s.stats, null);                                           // las cifras de la cuenta tampoco se quedan
assert.deepEqual([s.shortcuts, s.history, s.viajesCompletados, s.votes, s.favoritePlaces], [[], [], [], {}, []]);
assert.deepEqual(s.favoriteLines, ['linea-60', 'linea-20mayo']);           // vuelve a los favoritos de inicio
assert.deepEqual([s.lang, s.theme, s.textSize], ['qu', 'dark', 2]);          // las preferencias se conservan

// Viajes: el más reciente primero, máximo 50.
const viaje = (linea) => ({ legs: [{ lineaId: linea, stops: [] }], leg: 0, index: 1, previos: 0, startedAt: Date.now() - 120000 });
store.set({ trip: viaje('linea-60') }); terminar();
store.set({ trip: viaje('linea-15') }); terminar();
assert.deepEqual(store.get().viajesCompletados.map((v) => v.lineaId), ['linea-15', 'linea-60']);
store.set({ viajesCompletados: Array.from({ length: 60 }, (_, i) => ({ lineaId: 'linea-60', fecha: String(i) })) });
store.set({ trip: viaje('linea-15') }); terminar();
assert.equal(store.get().viajesCompletados.length, 50);
assert.equal(store.get().viajesCompletados[0].lineaId, 'linea-15');
console.log('Todo en orden (cuentas y viajes)');

// Sin cuenta no se piden estadísticas.
import { cargarEstadisticas } from '../js/services/stats.service.js';
store.set({ user: null, guest: false });
assert.equal(await cargarEstadisticas(), false);
store.set({ user: null, guest: true });
assert.equal(await cargarEstadisticas(), false);
console.log('Todo en orden (estadísticas sin cuenta)');
