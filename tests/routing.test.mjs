// Pruebas del motor de rutas (interfaz nueva: trazo único, subida/bajada en cualquier sentido).
// Uso:  node tests/routing.test.mjs
globalThis.location = { search: '' };
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { cargarDesdeDisco } = await import('./cargar-lineas.mjs');
await cargarDesdeDisco();
const { LINEAS } = await import('../js/data/lineas.js');
const { LUGARES } = await import('../js/data/lugares.js');
const R = await import('../js/services/routing.service.js');
const { paraderosDe, clasificarLineas } = await import('../js/services/lines.service.js');
const { km } = R;

let fallas = 0;
const ok = (cond, msg) => { if (!cond) { fallas++; console.log(`  ✗ FALLA: ${msg}`); } };
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const lugarAzar = () => LUGARES[Math.floor(rnd() * LUGARES.length)].n;
const horas = [new Date(2026, 9, 15, 8, 30), new Date(2026, 9, 17, 14, 10), new Date(2026, 9, 18, 22, 40)];

console.log('1) Líneas cargadas desde data/lineas/');
ok(LINEAS.length >= 3, `se esperaban al menos 3 líneas y hay ${LINEAS.length}`);
for (const l of LINEAS) {
  ok(l.vuelta.length === l.ida.length, `${l.id}: la vuelta debe tener los mismos puntos que la ida`);
  const ps = paraderosDe(l);
  ok(ps.length >= 2, `${l.id}: faltan paraderos`);
  ok(ps.every((p, i) => i === 0 || p.idx >= ps[i - 1].idx), `${l.id}: paraderos fuera de orden`);
}

console.log('2) Reglas de cada opción (400 búsquedas al azar)');
let busquedas = 0, conOpciones = 0;
for (let n = 0; n < 400; n++) {
  const o = lugarAzar(), d = lugarAzar(); if (o === d) continue;
  const ops = R.buscarOpciones(o, d, horas[n % 3]); busquedas++; if (ops.length) conOpciones++;
  ok(new Set(ops.map((x) => x.id)).size === ops.length, `ids repetidos en ${o} -> ${d}`);
  for (const op of ops) {
    ok(op.minutos >= 1 && op.minutos <= 180, `minutos raros (${op.minutos}) en ${o} -> ${d}`);
    ok(['cerca', 'media', 'lejos'].includes(op.nivel), `nivel inválido ${op.nivel}`);
    ok(op.tipo === (op.tramos.length === 1 ? 'directo' : 'transbordo'), 'tipo no coincide con los tramos');
    ok(op.caminata && ['inicio', 'transbordo', 'final'].every((k) => op.caminata[k] >= 0), 'caminata incompleta');
    for (const t of op.tramos) {
      const l = LINEAS.find((x) => x.id === t.lineaId);
      ok(!!l, `línea inexistente ${t.lineaId}`);
      ok(t.desde !== t.hasta && t.km > 0, `tramo vacío en ${o} -> ${d}`);
      ok(t.sube?.c && t.baja?.c, 'faltan puntos de subida o bajada');
    }
    ok(R.pasosDe(op, o, d).length >= 3, 'pasos insuficientes');
  }
}
console.log(`   ${busquedas} búsquedas, ${conOpciones} con opciones`);
ok(conOpciones / busquedas > 0.3, 'muy pocas búsquedas con opciones');

console.log('3) Simetría: ir y volver entre dos puntos usa las mismas líneas');
{
  let pares = 0, asimetricos = 0;
  for (let n = 0; n < 60; n++) {
    const a = lugarAzar(), b = lugarAzar(); if (a === b) continue;
    const ida = R.buscarOpciones(a, b, horas[0]).filter((x) => x.tipo === 'directo').map((x) => x.id).sort().join();
    const vuelta = R.buscarOpciones(b, a, horas[0]).filter((x) => x.tipo === 'directo').map((x) => x.id).sort().join();
    pares++; if (ida !== vuelta) asimetricos++;
  }
  console.log(`   ${pares} pares, ${asimetricos} con diferencias`);
  ok(asimetricos / pares < 0.25, 'demasiadas búsquedas asimétricas');
}

console.log('4) Cercanía a un punto del recorrido');
{
  const l = LINEAS[0], c = l.ida[Math.floor(l.ida.length / 2)];
  const { pasan } = clasificarLineas(c);
  ok(pasan.some((x) => x.linea.id === l.id), 'la línea debe "pasar" por un punto de su propio recorrido');
  ok(km(c, c) === 0, 'km(c,c) debe ser 0');
}

console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo en orden');
process.exit(fallas ? 1 : 0);
