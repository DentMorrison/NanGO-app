#!/usr/bin/env node
// ================================================================
// HERRAMIENTA PARA LAS LÍNEAS DE ÑanGO  (se usa desde la terminal, con Node.js)
//
//   node tools/lineas.mjs validar [linea-60]          revisa los datos y avisa de errores
//   node tools/lineas.mjs nueva linea-30 "Línea 30"   crea el archivo de una línea nueva
//   node tools/lineas.mjs importar linea-30 mapa.kml  carga recorrido y paraderos desde Google My Maps / GeoJSON
//        opciones: --solo-trazo  --solo-paraderos  --tramo 2   (si el archivo trae varias líneas dibujadas)
//                  --vuelta   guarda lo importado como VUELTA (recorrido y paraderos de regreso) en vez de la ida
//
// Los datos viven en data/lineas/ (un archivo .json por línea). Guía completa: data/lineas/LEEME.md
// ================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { km, serializar, leerKML, leerGeoJSON, revisar, plantillaLinea, ID_VALIDO } from '../admin/lib/formato-lineas.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = path.join(RAIZ, 'data', 'lineas');
const INDICE = path.join(CARPETA, 'index.json');
const existeFoto = (ruta) => fs.existsSync(path.join(RAIZ, ruta));

// ---------------------------------------------------------------- comandos
const leerJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const archivoDe = (id) => path.join(CARPETA, `${id}.json`);
const leerIndice = () => leerJSON(INDICE).lineas;

function validar(soloId) {
  let nErr = 0, nAv = 0;
  const ids = leerIndice();
  const archivos = fs.readdirSync(CARPETA).filter((f) => f.endsWith('.json') && f !== 'index.json' && !f.startsWith('_')).map((f) => f.slice(0, -5));
  if (new Set(ids).size !== ids.length) { console.log('✗ index.json tiene ids repetidos'); nErr++; }
  ids.filter((i) => !archivos.includes(i)).forEach((i) => { console.log(`✗ index.json lista "${i}" pero no existe data/lineas/${i}.json`); nErr++; });
  archivos.filter((i) => !ids.includes(i)).forEach((i) => { console.log(`! ${i}.json no está en index.json: la app no lo mostrará`); nAv++; });
  // Un número de línea repetido es un error aunque se revise una sola línea: se mira en todos los archivos.
  const porNumero = new Map();
  for (const id of ids.filter((i) => archivos.includes(i))) {
    try { const n = leerJSON(archivoDe(id)).numero; porNumero.set(n, [...(porNumero.get(n) || []), id]); } catch { /* se avisa más abajo */ }
  }
  for (const id of ids.filter((i) => archivos.includes(i) && (!soloId || i === soloId))) {
    let l;
    try { l = leerJSON(archivoDe(id)); } catch (err) { console.log(`\n${id}\n  ✗ el archivo no es un JSON válido: ${err.message}`); nErr++; continue; }
    const r = revisar(l, id, { existeFoto });
    const otras = (porNumero.get(l.numero) || []).filter((x) => x !== id);
    if (otras.length) r.errores.push(`el número "${l.numero}" también lo usa ${otras.join(', ')}`);
    const { puntos, km: k, paraderos, conCoord } = r.resumen;
    console.log(`\n${id} · ${l.nombre || '?'}  (${puntos} puntos, ${k.toFixed(1)} km, ${paraderos} paraderos, ${conCoord} con coordenadas · ${r.resumen.sentidos})`);
    r.errores.forEach((m) => console.log(`  ✗ ${m}`));
    r.avisos.forEach((m) => console.log(`  ! ${m}`));
    if (!r.errores.length && !r.avisos.length) console.log('  ✓ todo en orden');
    nErr += r.errores.length; nAv += r.avisos.length;
  }
  console.log(`\n${nErr} errores, ${nAv} avisos`);
  return nErr ? 1 : 0;
}

function nueva(id, nombre) {
  if (!ID_VALIDO.test(id || '')) { console.log('Uso: node tools/lineas.mjs nueva linea-30 "Línea 30"\n(el id va en minúsculas, sin espacios ni tildes, y empieza con "linea-")'); return 1; }
  if (fs.existsSync(archivoDe(id))) { console.log(`Ya existe data/lineas/${id}.json`); return 1; }
  const l = plantillaLinea(id, nombre);
  fs.writeFileSync(archivoDe(id), serializar(l));
  const ids = leerIndice(); ids.push(id);
  fs.writeFileSync(INDICE, JSON.stringify({ lineas: ids }, null, 2) + '\n');
  console.log(`Creado data/lineas/${id}.json y agregado a index.json.\nSiguiente paso: dibuja la línea en Google My Maps, expórtala como KML y ejecuta:\n  node tools/lineas.mjs importar ${id} mi-mapa.kml`);
  return 0;
}

function importar(id, archivo, opts) {
  if (!id || !archivo || !fs.existsSync(archivoDe(id))) { console.log('Uso: node tools/lineas.mjs importar linea-30 mapa.kml [--solo-trazo] [--solo-paraderos] [--vuelta] [--tramo N]\n(la línea debe existir: créala antes con "nueva")'); return 1; }
  if (!fs.existsSync(archivo)) { console.log(`No encuentro el archivo ${archivo}`); return 1; }
  const txt = fs.readFileSync(archivo, 'utf8');
  const datos = /\.kml$/i.test(archivo) ? leerKML(txt) : leerGeoJSON(txt);
  const l = leerJSON(archivoDe(id));
  const [campoTrazo, campoParaderos] = opts.vuelta ? ['vuelta', 'paraderosVuelta'] : ['ida', 'paraderos'];
  if (!opts.soloParaderos) {
    if (!datos.trazos.length) console.log('! El archivo no trae ninguna línea dibujada: no se cambió "' + campoTrazo + '".');
    else {
      const n = opts.tramo ? opts.tramo - 1 : 0;
      if (!datos.trazos[n]) { console.log(`El archivo tiene ${datos.trazos.length} líneas dibujadas; --tramo debe estar entre 1 y ${datos.trazos.length}`); return 1; }
      if (datos.trazos.length > 1 && !opts.tramo) console.log(`! El archivo trae ${datos.trazos.length} líneas dibujadas (${datos.trazos.map((t, i) => `${i + 1}: ${t.nombre || 'sin nombre'}`).join(' · ')}). Se usó la 1; con --tramo N eliges otra.`);
      l[campoTrazo] = datos.trazos[n].pts;
      console.log(`✓ ${opts.vuelta ? 'recorrido de la vuelta' : 'recorrido'}: ${l[campoTrazo].length} puntos${datos.trazos[n].nombre ? ` ("${datos.trazos[n].nombre}")` : ''}`);
    }
  }
  if (!opts.soloTrazo) {
    if (!datos.puntos.length) console.log('! El archivo no trae puntos marcados: no se cambiaron los paraderos.');
    else {
      l[campoParaderos] = datos.puntos.map((p, i) => ({ nombre: p.nombre || `Paradero ${i + 1}`, c: p.c }));
      console.log(`✓ ${opts.vuelta ? 'paraderos de la vuelta' : 'paraderos'}: ${l[campoParaderos].length}, en el mismo orden del archivo`);
    }
  }
  fs.writeFileSync(archivoDe(id), serializar(l));
  console.log('\nRevisando el resultado…');
  return validar(id);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...resto] = process.argv.slice(2);
  const opts = { soloTrazo: resto.includes('--solo-trazo'), soloParaderos: resto.includes('--solo-paraderos'), vuelta: resto.includes('--vuelta'), tramo: Number(resto[resto.indexOf('--tramo') + 1]) || 0 };
  const pos = resto.filter((x, i) => !x.startsWith('--') && resto[i - 1] !== '--tramo');
  const codigo = cmd === 'validar' ? validar(pos[0]) : cmd === 'nueva' ? nueva(pos[0], pos[1]) : cmd === 'importar' ? importar(pos[0], pos[1], opts)
    : (console.log('Comandos: validar [id] · nueva <id> "<nombre>" · importar <id> <archivo.kml|.geojson> [--solo-trazo] [--solo-paraderos] [--vuelta] [--tramo N]'), 0);
  process.exit(codigo);
}
