// ================================================================
// LÍNEAS DE TRANSPORTE
// Los datos de cada línea (recorrido, paraderos, tarifa, horario, color…) viven en data/lineas/,
// un archivo .json por línea; la lista de cuáles se muestran y en qué orden está en
// data/lineas/index.json. Para agregar o corregir una línea ver data/lineas/LEEME.md y el editor
// de administración (node tools/admin.mjs).
//
// LINEAS empieza vacía y se llena al arrancar la app (main.js llama a cargarLineas() antes de abrir
// la primera pantalla). Las pantallas y servicios la usan igual que siempre.
// ================================================================

/** Lista viva de líneas ya cargadas (se llena en cargarLineas / definirLineas). */
export const LINEAS = [];

// Los recorridos traen un punto cada 100-300 m. Para subir y bajar con precisión se les agregan puntos
// intermedios (en línea recta entre dos puntos originales) hasta que ninguno quede a más de ~40 m del siguiente.
const PASO_KM = 0.04;
const dist = (a, b) => { const r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r; const x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
export function densificar(puntos) {
  const out = [puntos[0]];
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i], partes = Math.max(1, Math.ceil(dist(a, b) / PASO_KM));
    for (let k = 1; k < partes; k++) out.push([a[0] + ((b[0] - a[0]) * k) / partes, a[1] + ((b[1] - a[1]) * k) / partes]);
    out.push(b);
  }
  return out;
}

/**
 * Convierte el contenido de un archivo de línea al formato que usa la app.
 *   · ida:    recorrido [[lat, lon], …] (se densifica) y paraderos (nombres; paraderosCoord = [lat, lon] o null)
 *   · vuelta: si el archivo no trae "vuelta", se usa la ida al revés (misma calle de regreso).
 * La interfaz actual muestra y calcula la vuelta sobre el mismo trazo en sentido contrario.
 */
export function normalizarLinea(raw) {
  if (!raw?.id || !Array.isArray(raw.ida) || raw.ida.length < 2) throw new Error('falta "id" o "ida" (mínimo 2 puntos)');
  if (!Array.isArray(raw.paraderos) || !raw.paraderos.length) throw new Error('faltan "paraderos"');
  const esObj = (p) => p && typeof p === 'object';
  const nombres = (lista) => lista.map((p) => (esObj(p) ? p.nombre : p));
  const coords = (lista) => lista.map((p) => (esObj(p) && Array.isArray(p.c) ? p.c : null));
  const ida = densificar(raw.ida);
  return {
    ...raw,
    ida,
    paraderos: nombres(raw.paraderos),
    paraderosCoord: coords(raw.paraderos),
    vuelta: [...ida].reverse(),
    circular: raw.circular === true,
  };
}

/** Reemplaza el contenido de LINEAS (misma lista, así quienes ya la importaron la ven actualizada). */
export function definirLineas(lista) {
  LINEAS.splice(0, LINEAS.length, ...lista.map(normalizarLinea));
}

/**
 * Descarga data/lineas/index.json y cada línea listada. Si un archivo de línea está mal, se salta
 * (y se avisa en la consola) para que un error en una línea no deje sin app a todas las demás.
 * Para encontrar el error: node tools/lineas.mjs validar
 */
export async function cargarLineas(carpeta = 'data/lineas/') {
  const pedir = async (nombre) => {
    const r = await fetch(`${carpeta}${nombre}`);
    if (!r.ok) throw new Error(`${nombre}: ${r.status}`);
    return r.json();
  };
  const { lineas: ids } = await pedir('index.json');
  const cargadas = await Promise.all(ids.map(async (id) => {
    try { return normalizarLinea(await pedir(`${id}.json`)); }
    catch (e) { console.error(`Línea "${id}" no se cargó: ${e.message}`); return null; }
  }));
  const buenas = cargadas.filter(Boolean);
  if (!buenas.length) throw new Error('No se pudo cargar ninguna línea');
  LINEAS.splice(0, LINEAS.length, ...buenas);
  return LINEAS;
}

export const getLinea = (id) => LINEAS.find((l) => l.id === id);

/** Formatea un precio: 1 -> "S/ 1.00" */
export const soles = (n) => `S/ ${Number(n).toFixed(2)}`;
