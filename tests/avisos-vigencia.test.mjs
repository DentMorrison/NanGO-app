// Los avisos vencidos no se muestran; los vigentes y los de ejemplo (sin fecha) sí.
import assert from 'node:assert/strict';
import { store } from '../js/core/store.js';
import { listar } from '../js/services/alerts.service.js';

const hora = 3600000;
const aviso = (id, expiraEnHoras) => ({
  id, tipo: 'trafico', lineaId: 'linea-60', titulo: id, texto: '', hace: '', confirmaciones: 2, rechazos: 0, estado: 'publicado',
  expira: expiraEnHoras === null ? null : new Date(Date.now() + expiraEnHoras * hora).toISOString(),
});

store.set({
  favoriteLines: ['linea-60'],
  alerts: [aviso('vigente', 2), aviso('vencido', -1), aviso('ejemplo', null), aviso('recien-vencido', -0.01)],
});
const ids = listar({ soloMisLineas: false }).map((a) => a.id);
assert.deepEqual(ids.sort(), ['ejemplo', 'vigente']);
console.log('Todo en orden (vigencia de avisos)');
