// Pruebas del servidor del editor (tools/admin.mjs).   Uso:  node tests/admin-api.test.mjs
// Trabaja sobre una copia temporal del proyecto: no toca tus datos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { crearServidor } from '../tools/admin.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nango-admin-'));
for (const p of ['data', 'admin', 'assets']) if (fs.existsSync(path.join(RAIZ, p))) fs.cpSync(path.join(RAIZ, p), path.join(tmp, p), { recursive: true });
fs.copyFileSync(path.join(RAIZ, 'index.html'), path.join(tmp, 'index.html'));
fs.writeFileSync(path.join(tmp, 'secreto.txt'), 'no debe poder leerse desde fuera de la carpeta pública');
const raiz = path.join(tmp, 'sitio'); fs.mkdirSync(raiz);
for (const p of ['data', 'admin', 'assets', 'index.html']) fs.renameSync(path.join(tmp, p), path.join(raiz, p));

const srv = crearServidor({ raiz, puerto: 0 });
const puerto = await srv.iniciar();
const base = `http://127.0.0.1:${puerto}`;
let fallas = 0;
const ok = (c, m) => { if (!c) { fallas++; console.log(`  ✗ FALLA: ${m}`); } };
const llamar = async (met, ruta, cuerpo, { token = srv.token, cab = {} } = {}) => {
  const r = await fetch(base + ruta, { method: met, headers: { 'content-type': 'application/json', ...(token ? { 'x-admin-token': token } : {}), ...cab }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  return { s: r.status, d: await r.json().catch(() => ({})) };
};
const leerLinea = (id) => JSON.parse(fs.readFileSync(path.join(raiz, 'data/lineas', `${id}.json`), 'utf8'));
const indice = () => JSON.parse(fs.readFileSync(path.join(raiz, 'data/lineas/index.json'), 'utf8')).lineas;
const cruda = (ruta, host) => new Promise((res) => http.get({ host: '127.0.0.1', port: puerto, path: ruta, headers: host ? { host } : {} }, (r) => { r.resume(); res(r.statusCode); }));

console.log('Servidor y acceso');
ok((await fetch(`${base}/index.html`)).status === 200, 'la app debe servirse');
if (fs.existsSync(path.join(raiz, 'admin/index.html'))) {
  const pagina = await (await fetch(`${base}/admin/`)).text();
  ok(pagina.includes(srv.token) && !pagina.includes('__TOKEN__'), 'el editor debe recibir la clave del servidor');
}
ok(await cruda('/index.html', 'evil.example.com') === 403, 'un Host ajeno debe rechazarse');
ok(await cruda('/..%2Fsecreto.txt') !== 200 && await cruda('/%2e%2e/secreto.txt') !== 200, 'no se debe salir de la carpeta');
ok(await cruda('/data/../../secreto.txt') !== 200, 'no se debe salir de la carpeta (2)');
ok((await llamar('GET', '/api/estado', undefined, { token: '' })).s === 403, 'sin clave debe dar 403');
ok((await llamar('GET', '/api/estado', undefined, { token: 'x'.repeat(srv.token.length) })).s === 403, 'clave incorrecta debe dar 403');
ok((await llamar('GET', '/api/estado', undefined, { cab: { origin: 'http://evil.example.com' } })).s === 403, 'un origen ajeno debe rechazarse');
const est = await llamar('GET', '/api/estado');
ok(est.s === 200 && est.d.indice.length === 3 && est.d.archivos.length === 3, 'estado inicial: 3 líneas');

console.log('Guardar líneas');
let l60 = leerLinea('linea-60'); l60.nombre = 'Línea 60 (editada)'; l60.frecuenciaMin = 7;
let r = await llamar('PUT', '/api/linea/linea-60', l60);
ok(r.s === 200 && r.d.publicada === true, 'guardar una línea válida publicada');
ok(leerLinea('linea-60').nombre === 'Línea 60 (editada)' && leerLinea('linea-60').frecuenciaMin === 7, 'el archivo debe cambiar');
ok(fs.readFileSync(path.join(raiz, 'data/lineas/linea-60.json'), 'utf8').includes('\n    ['), 'se debe conservar el formato legible (un punto por renglón)');

const antes = fs.readFileSync(path.join(raiz, 'data/lineas/linea-60.json'), 'utf8');
r = await llamar('PUT', '/api/linea/linea-60', { ...l60, frecuenciaMin: 0 });
ok(r.s === 400 && r.d.errores?.length > 0, 'una línea publicada con errores no se debe guardar');
ok(fs.readFileSync(path.join(raiz, 'data/lineas/linea-60.json'), 'utf8') === antes, 'el archivo no debe cambiar si se rechazó');

r = await llamar('PUT', '/api/linea/linea-77', { id: 'linea-77', numero: '77', nombre: 'Borrador', empresa: 'x', color: '#1D4ED8', colorClaro: '#7AA7FF', ida: [], paraderos: [] });
ok(r.s === 200 && r.d.guardada && r.d.publicada === false && r.d.errores.length > 0, 'un borrador con errores se guarda pero no se publica');
ok(!indice().includes('linea-77') && fs.existsSync(path.join(raiz, 'data/lineas/linea-77.json')), 'el borrador existe y no está en index.json');

const buena = leerLinea('linea-15'); buena.id = 'linea-77'; buena.numero = '77'; buena.nombre = 'Línea 77';
r = await llamar('PUT', '/api/linea/linea-77', buena);
ok(r.s === 200 && r.d.publicada === true && indice().includes('linea-77'), 'al quedar sin errores se publica en index.json');

const repetida = { ...buena, id: 'linea-78', numero: '15' };
r = await llamar('PUT', '/api/linea/linea-78', repetida);
ok(r.s === 200 && r.d.publicada === false && r.d.errores.some((e) => e.includes('también lo usa')), 'número repetido: no se publica');

r = await llamar('PUT', '/api/linea/linea-60', { ...l60, evil: 'x', otro: { a: 1 } });
ok(!('evil' in leerLinea('linea-60')) && !('otro' in leerLinea('linea-60')), 'los campos desconocidos se descartan');

console.log('Entradas inválidas');
for (const id of ['LINEA-1', 'linea-', 'linea-1/../x', '..%2F..%2Fx', 'otra']) {
  ok((await llamar('PUT', `/api/linea/${id}`, { id })).s === 400, `id inválido "${id}" debe dar 400`);
}
ok((await llamar('PUT', '/api/linea/linea-60', { ...l60, id: 'linea-15' })).s === 400, 'id distinto al de la dirección');
ok((await llamar('PUT', '/api/linea/linea-60', { ...l60, ida: 'no es lista' })).s === 400, 'una lista que no es lista');
ok((await llamar('PUT', '/api/linea/linea-60', [1, 2])).s === 400, 'el contenido debe ser un objeto');
const trampa = { id: 'linea-79', numero: '79', nombre: 'T', empresa: 'x', color: '#1D4ED8', colorClaro: '#7AA7FF', paraderos: [], ida: [['1], "x": [', 2]] };
r = await llamar('PUT', '/api/linea/linea-79', trampa);
let texto = fs.readFileSync(path.join(raiz, 'data/lineas/linea-79.json'), 'utf8'), parseado = null;
try { parseado = JSON.parse(texto); } catch { /* queda null */ }
ok(parseado && !('x' in parseado), 'un texto malicioso en un punto no debe romper ni alterar el archivo');

console.log('Orden de las líneas');
const orden = indice().slice().reverse();
r = await llamar('PUT', '/api/indice', { lineas: orden });
ok(r.s === 200 && JSON.stringify(indice()) === JSON.stringify(orden), 'reordenar index.json');
ok((await llamar('PUT', '/api/indice', { lineas: [...orden, 'linea-999'] })).s === 400, 'una línea que no existe no se puede publicar');
ok((await llamar('PUT', '/api/indice', { lineas: [orden[0], orden[0]] })).s === 400, 'ids repetidos');
r = await llamar('PUT', '/api/indice', { lineas: orden.filter((x) => x !== 'linea-77') });
ok(r.s === 200 && !indice().includes('linea-77') && fs.existsSync(path.join(raiz, 'data/lineas/linea-77.json')), 'quitar de la app conserva el archivo');

await srv.cerrar();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fallas ? `\n${fallas} FALLAS` : '\nTodo en orden');
process.exit(fallas ? 1 : 0);
