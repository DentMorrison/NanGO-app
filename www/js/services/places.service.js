// ================================================================
// SERVICIO DE LUGARES
// Hoy lee el catálogo local (js/data/lugares.js). Para usar un servidor:
// TODO(lógica): reemplazar `LUGARES` por una petición y mantener estas mismas funciones.
// ================================================================
import { LUGARES } from '../data/lugares.js';
import { lineasCerca, UMBRAL_CERCA_KM } from './lines.service.js';
import { norm } from '../core/dom.js';
import { km } from './geo.js';

export const ICONOS_CATEGORIA = {
  'Mercados': 'building-store', 'Comercio': 'shopping-cart', 'Salud': 'stethoscope', 'Educación': 'school',
  'Plazas y parques': 'trees', 'Deporte': 'ball-football', 'Terminales y salidas': 'bus-stop',
  'Avenidas y jirones': 'road', 'Barrios y comunidades': 'home-2', 'Hoteles': 'bed', 'Grifos': 'gas-station',
  'Bancos': 'building-bank', 'Iglesias y templos': 'building-church', 'Servicios públicos': 'building-community',
  'Cultura y ocio': 'ticket',
};

/** Categorías que se muestran como filtros (las más usadas primero). */
export const FILTROS = ['Mercados', 'Salud', 'Educación', 'Plazas y parques', 'Avenidas y jirones', 'Barrios y comunidades', 'Terminales y salidas', 'Hoteles'];

const ordenados = LUGARES.map((l) => ({ ...l, _k: norm(l.n) })).sort((a, b) => a._k.localeCompare(b._k));

export const total = () => LUGARES.length;
export const contar = (categoria) => LUGARES.filter((l) => l.t === categoria).length;
export const iconoDe = (lugar) => ICONOS_CATEGORIA[lugar.t] || 'map-pin';
export const getLugar = (nombre) => LUGARES.find((l) => l.n === nombre) || null;

/** Coordenadas dentro de un texto: "Av. X (-15.4985, -70.1333)" o solo "-15.4985, -70.1333". */
export const RE_COORDS = /(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/;

export const esPunto = (nombre) => RE_COORDS.test(String(nombre || ''));

/**
 * Origen o destino de un viaje. Normalmente es un lugar del catálogo (por nombre); pero si el usuario
 * eligió un punto en el mapa guardamos "dirección (lat, lng)" como valor. Aquí lo reconocemos y
 * devolvemos un lugar sintético para que el mapa (punto amarillo "Destino") y las rutas funcionen
 * igual que con el catálogo.
 */
export function getPunto(nombre) {
  const lugar = getLugar(nombre);
  if (lugar) return lugar;
  const m = String(nombre || '').match(RE_COORDS);
  if (!m) return null;
  const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { n: String(nombre).trim(), c: [lat, lng], t: 'Punto en el mapa', punto: true };
}

/** Lista de lugares filtrada por texto y/o categoría, en orden alfabético. */
export function listar({ q = '', categoria = null } = {}) {
  const nq = norm(q.trim());
  const base = ordenados.filter((l) => (!categoria || l.t === categoria) && (!nq || l._k.includes(nq)) && (nq || /^[a-z]/.test(l._k)));
  if (!nq) return base;
  // Con texto: primero lo que empieza igual, luego palabras que empiezan igual, luego el resto
  const puntaje = (l) => (l._k.startsWith(nq) ? 0 : l._k.includes(` ${nq}`) ? 1 : 2);
  return base.map((l) => [puntaje(l), l]).sort((a, b) => a[0] - b[0] || PRIORIDAD.indexOf(a[1].t) - PRIORIDAD.indexOf(b[1].t)).map((x) => x[1]);
}
const PRIORIDAD = ['Educación', 'Mercados', 'Salud', 'Plazas y parques', 'Terminales y salidas', 'Comercio', 'Barrios y comunidades', 'Avenidas y jirones'];

/** Líneas que pasan a menos de ~1,5 km de un lugar (para los puntos de colores de la lista). */
export const lineasDe = (lugar) => lineasCerca(lugar.c, UMBRAL_CERCA_KM);

const CALLES = LUGARES.filter((l) => l.t === 'Avenidas y jirones');
/** Calle, avenida o jirón del catálogo más cercano a un punto (aproximado: el catálogo guarda un punto por calle). */
export function calleCerca(c) {
  let mejor = null, d = Infinity;
  for (const l of CALLES) { const x = km(l.c, c); if (x < d) { d = x; mejor = l; } }
  return mejor && d <= 0.45 ? mejor.n.replace(/^(\S+) \1\b/i, '$1') : null;   // quita prefijos repetidos (Jirón Jirón X)
}