// ================================================================
// SERVICIO DE LÍNEAS: paraderos y cercanía.
// Los paraderos con coordenada de data/lineas/<linea>.json tienen prioridad; si no hay, se usan los de data/paraderos.js.
// ================================================================
import { LINEAS } from '../data/lineas.js';
import { km, nearest, pointAt } from './geo.js';
import { CALLES_LINEA } from '../data/calles.js';
import { PARADEROS_REALES } from '../data/paraderos.js';

const memoParaderos = new Map();

/**
 * Paraderos con nombre de una línea, ordenados a lo largo del recorrido de ida.
 * Cada uno lleva su posición real sobre el recorrido (idx). Salen de data/paraderos.js, que ubica cada nombre en el
 * mapa y descarta los que no quedan cerca del recorrido. Si una línea no tiene datos, se reparten de forma pareja.
 */
export function paraderosDe(linea) {
  if (memoParaderos.has(linea.id)) return memoParaderos.get(linea.id);
  const reales = PARADEROS_REALES[linea.id];
  const propios = linea.paraderosCoord || [];          // coordenadas puestas en data/lineas/<linea>.json (editor de administración)
  const n = linea.paraderos.length;
  let lista;
  if (propios.some(Boolean)) {
    // Paraderos con coordenada en el archivo de la línea: se usan tal cual; los que no la tienen se reparten sobre el recorrido.
    lista = linea.paraderos.map((nombre, i) => {
      const c = propios[i] || pointAt(linea.ida, n === 1 ? 0 : i / (n - 1));
      return { nombre, c, idx: nearest(linea.ida, c).i, dist: null };
    });
  } else if (reales?.length) {
    lista = reales.map((p) => ({ nombre: p.nombre, c: p.c, idx: nearest(linea.ida, p.c).i, dist: p.dist }));
  } else {
    lista = linea.paraderos.map((nombre, i) => ({ nombre, c: pointAt(linea.ida, n === 1 ? 0 : i / (n - 1)), idx: Math.round((linea.ida.length - 1) * (n === 1 ? 0 : i / (n - 1))), dist: null }));
  }
  lista = lista.map((p, i) => ({ ...p, ref: i === 0 ? 'Inicio del recorrido' : `Después de ${lista[i - 1].nombre}` }));
  memoParaderos.set(linea.id, lista);
  return lista;
}

/** Paradero más cercano a una posición del recorrido. */
export function paraderoCercano(linea, indice) {
  return paraderosDe(linea).reduce((a, b) => (Math.abs(b.idx - indice) < Math.abs(a.idx - indice) ? b : a));
}

/** Líneas que pasan a menos de `radioKm` de un punto, ordenadas de más cerca a más lejos. */
export function lineasCerca(c, radioKm = 2) {
  return LINEAS.map((l) => ({ linea: l, ...distanciaARecorrido(l.ida, c) }))
    .filter((x) => x.d <= radioKm)
    .sort((a, b) => a.d - b.d);
}

// Distancia a pie (en línea recta) hasta la que se dice que una línea "pasa por aquí", y hasta la que se
// ofrece como alternativa más lejana.
export const UMBRAL_PASA_KM = 0.25;
export const UMBRAL_CERCA_KM = 0.4;

// Distancia (km) de un punto a un recorrido, medida contra los TRAMOS (la proyección más cercana sobre cada segmento)
// y no solo contra sus puntos. Usa un plano local (equirectangular), exacto de sobra a escala de ciudad.
export function distanciaARecorrido(puntos, c) {
  const kx = 111.32 * Math.cos((c[0] * Math.PI) / 180), ky = 110.57;      // km por grado de longitud / latitud
  const px = c[1] * kx, py = c[0] * ky;
  let mejor = { d: Infinity, i: 0, t: 0 };
  for (let i = 0; i < puntos.length - 1; i++) {
    const ax = puntos[i][1] * kx, ay = puntos[i][0] * ky;
    const dx = puntos[i + 1][1] * kx - ax, dy = puntos[i + 1][0] * ky - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < mejor.d) mejor = { d, i, t };
  }
  return mejor;
}

// Clasifica las líneas respecto a un punto: las que pasan por ahí (≤ 250 m), las algo más lejanas (≤ 400 m) y,
// si no hay ninguna de las dos, la más cercana aunque quede lejos.
export function clasificarLineas(c) {
  const todas = lineasCerca(c, 99);
  return {
    pasan: todas.filter((x) => x.d <= UMBRAL_PASA_KM),
    cercanas: todas.filter((x) => x.d > UMBRAL_PASA_KM && x.d <= UMBRAL_CERCA_KM),
    masCercana: todas[0] || null,
  };
}

// Posición (en linea.ida) donde queda el paradero número k de la lista de paraderos.
export function indiceDeParadero(linea, k) {
  return paraderosDe(linea)[k].idx;
}

const limpiar = (s) => (s || '').replace(/^(\S+) \1\b/i, '$1').replace(/\s+/g, ' ').trim();

// Calle por la que va la micro en una posición del recorrido (datos reales de OpenStreetMap, ver data/calles.js).
export function calleEn(linea, indice) {
  const m = CALLES_LINEA[linea.id];
  if (!m?.length) return null;
  const c = linea.ida[indice];
  let mejor = null, d = Infinity;
  for (const s of m) { if (!s.calle) continue; const x = km(s.c, c); if (x < d) { d = x; mejor = s; } }
  return mejor && d <= 0.6 ? limpiar(mejor.calle) : null;
}

// Calles principales por las que pasa la línea, en orden de recorrido (sin repetir).
export function callesDeLinea(linea, invertido = false) {
  const m = (CALLES_LINEA[linea.id] || []).filter((s) => s.calle);
  const orden = invertido ? [...m].reverse() : m;
  const clave = (n) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(avenida|av\.?|jiron|jr\.?|calle|prolongacion|prol\.?)\s+(av\.?\s+)?/, '').trim();
  const out = [], vistos = new Map();
  for (const s of orden) {
    const n = limpiar(s.calle), k = clave(n);
    if (!vistos.has(k)) { vistos.set(k, out.length); out.push(n); }
    else if (n.length > out[vistos.get(k)].length) out[vistos.get(k)] = n;   // se queda con el nombre completo (Avenida X en vez de X)
  }
  return out;
}

export const distanciaTexto = (d) => (d < 1 ? `a ${Math.max(100, Math.round(d * 10) * 100)} m` : `a ${d.toFixed(1)} km`);
export { km };
