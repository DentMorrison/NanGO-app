// Cálculos geográficos simples (distancias en kilómetros). Sin dependencias.
const R = 6371;
const rad = (g) => (g * Math.PI) / 180;

/** Distancia entre dos puntos [lat, lon]. */
export function km(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Punto de un recorrido más cercano a c: { i: posición, d: distancia en km }. */
export function nearest(points, c) {
  let best = { i: 0, d: Infinity };
  for (let i = 0; i < points.length; i++) {
    const d = km(points[i], c);
    if (d < best.d) best = { i, d };
  }
  return best;
}

/** Largo del recorrido entre dos posiciones. */
export function pathKm(points, i, j) {
  const [a, b] = i < j ? [i, j] : [j, i];
  let s = 0;
  for (let k = a; k < b; k++) s += km(points[k], points[k + 1]);
  return s;
}

/** Punto situado a una fracción (0 a 1) del recorrido. */
export const pointAt = (points, f) => points[Math.min(points.length - 1, Math.round((points.length - 1) * f))];

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)';
const par = (a, b) => {
  const lat = parseFloat(a), lng = parseFloat(b);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

/** Enlaces cortos de Google Maps: solo se pueden abrir con un servidor que siga la redirección. */
export const esEnlaceCorto = (texto) => /maps\.app\.goo\.gl|goo\.gl\/maps|share\.google/i.test(String(texto || ''));

/**
 * Si el texto trae coordenadas (enlace de Google Maps o "lat, lng"), las devuelve como { lat, lng }.
 * Orden de prioridad, porque un mismo enlace puede traer varios pares:
 *   1) !3d<lat>!4d<lng>  → el lugar exacto (pin) de Google Maps
 *   2) parámetros ?q= ?ll= ?query= ?destination= ... → coordenadas escritas a propósito
 *   3) @<lat>,<lng>      → solo el centro de la pantalla de quien copió el enlace (aproximado)
 *   4) un "lat, lng" suelto en el texto
 */
export function extraerCoordsDeTexto(texto) {
  const s = String(texto || '').trim();
  if (!s) return null;
  let crudo = s;
  try { crudo = decodeURIComponent(s); } catch { /* se usa tal cual */ }

  let m = crudo.match(new RegExp(`!3d${NUM}!4d${NUM}`));
  if (m) return par(m[1], m[2]);

  try {
    const q = new URL(s).searchParams;
    const lat = q.get('lat') || q.get('latitude');
    const lng = q.get('lng') || q.get('longitude') || q.get('lon');
    if (lat && lng) { const r = par(lat, lng); if (r) return r; }
    const ll = q.get('ll');
    if (ll) { const [a, b] = ll.split(','); const r = par(a, b); if (r) return r; }
    for (const k of ['q', 'center', 'query', 'destination', 'origin']) {
      const v = q.get(k);
      const mq = v && v.match(new RegExp(`${NUM}\\s*,\\s*${NUM}`));
      if (mq) { const r = par(mq[1], mq[2]); if (r) return r; }
    }
  } catch { /* no era una URL válida */ }

  m = crudo.match(new RegExp(`@${NUM},${NUM}`));
  if (m) return par(m[1], m[2]);

  m = crudo.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  return m ? par(m[1], m[2]) : null;
}

/** Obtiene la ruta peatonal real por las calles usando la API de OSRM */
export async function rutaCaminata(origen, destino) {
  try {
    // OSRM requiere las coordenadas invertidas [longitud, latitud]
    const url = `https://router.project-osrm.org/route/v1/foot/${origen[1]},${origen[0]};${destino[1]},${destino[0]}?geometries=geojson`;
    const respuesta = await fetch(url);
    const data = await respuesta.json();

    if (data.routes && data.routes[0]) {
      // Coordenadas en el orden [latitud, longitud] que usa Leaflet
      return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
    }
  } catch (error) {
    console.warn("No se pudo cargar la ruta peatonal, usando línea directa.", error);
  }
  // Si falla el internet, devolvemos una línea recta como plan B
  return [origen, destino];
}