// ================================================================
// MAPA (Leaflet + OpenStreetMap). Envuelve lo que usan las pantallas:
//   const m = createMap(elemento);
//   m.line(linea, { weight, opacity })      dibuja el recorrido de una línea
//   m.segment(linea, desde, hasta)           resalta un tramo (el recorrido elegido)
//   m.pin([lat, lon], 'origin'|'dest'|'stop'|'now', 'texto opcional junto al punto')
//   m.fit(puntos, { top, bottom })           encuadra los puntos dejando espacio arriba/abajo
//   m.destroy()                              se llama al salir de la pantalla
// El modo oscuro se hace con un filtro CSS sobre las baldosas (css/03-map.css).
// Con internet usa OpenStreetMap; sin internet usa assets/mapa/juliaca.pmtiles si existe (docs/OFFLINE.md).
// ================================================================
import { isDark } from '../core/theme.js';

const L = window.L;
const NO_HAY_MAPA = { line() {}, segment() { return []; }, pin() {}, dashed() {}, fit() {}, destroy() {} };
const CENTRO_JULIACA = [-15.4985, -70.1333];

// Mapa guardado (sin internet): si existe assets/mapa/juliaca.pmtiles se dibuja con protomaps-leaflet. Cómo generarlo: docs/OFFLINE.md.
const PAQUETE_MAPA = 'assets/mapa/juliaca.pmtiles';
let hayPaquete = null;                                   // se comprueba una sola vez
const existePaquete = () => (hayPaquete ||= (async () => {
  try {
    const r = await fetch(PAQUETE_MAPA, { method: 'HEAD' });
    return r.ok && !/text\/html/.test(r.headers.get('content-type') || '');   // un servidor que devuelve la página no cuenta
  } catch { return false; }
})());
existePaquete();                                         // se adelanta al arrancar la app
const cargarScript = (src) => new Promise((ok, mal) => {
  const el = document.createElement('script');
  el.src = src; el.onload = ok; el.onerror = mal;
  document.head.append(el);
});
/** Crea (sin agregar) la capa del mapa guardado. Devuelve null si no hay archivo o la librería no carga. */
async function crearCapaGuardada(sigueVivo) {
  if (!(await existePaquete())) return null;
  try {
    if (!window.protomapsL) await cargarScript('assets/vendor/protomaps-leaflet/protomaps-leaflet.js');
    if (!sigueVivo() || !window.protomapsL) return null;
    // Siempre claro: el modo oscuro lo hace el filtro CSS de las baldosas (css/03-map.css).
    return window.protomapsL.leafletLayer({ url: PAQUETE_MAPA, flavor: 'light', lang: 'es', maxDataZoom: 15, attribution: '© OpenStreetMap · Protomaps' });
  } catch { return null; }
}

// Con internet se usa el mapa en línea (más detalle, zoom hasta 19). Sin internet, el guardado.
// Si el teléfono dice que hay conexión pero las baldosas no llegan (wifi sin datos), también se pasa al guardado.
const ERRORES_PARA_CAMBIAR = 4;
let sinInternetDesde = 0;                                // el siguiente mapa arranca directo con el guardado
const hayInternet = () => navigator.onLine !== false && Date.now() - sinInternetDesde > 60000;

export function createMap(el, { zoom = 13, center = CENTRO_JULIACA } = {}) {
  if (!el) return NO_HAY_MAPA;                       // la pantalla ya se reemplazó
  let vivo = true;
  const map = L.map(el, { zoomControl: false, attributionControl: true, zoomSnap: 0.25 });
  const enLinea = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
  let guardada = null, actual = null, errores = 0;
  const poner = (capa) => {
    if (!vivo || !capa || actual === capa) return;
    if (actual) map.removeLayer(actual);
    capa.addTo(map); actual = capa;
  };
  const irAGuardada = async () => {
    guardada ||= await crearCapaGuardada(() => vivo);
    if (guardada) poner(guardada);
    return !!guardada;
  };
  const irAEnLinea = () => { errores = 0; poner(enLinea); };
  enLinea.on('tileload', () => { errores = 0; });
  enLinea.on('tileerror', async () => {
    if (++errores < ERRORES_PARA_CAMBIAR || actual !== enLinea) return;
    sinInternetDesde = Date.now();
    await irAGuardada();                                 // si no hay mapa guardado, se queda el de en línea
  });
  const alPerderInternet = () => { irAGuardada(); };
  const alVolverInternet = () => { sinInternetDesde = 0; irAEnLinea(); };
  window.addEventListener('offline', alPerderInternet);
  window.addEventListener('online', alVolverInternet);
  (async () => { if (hayInternet() || !(await irAGuardada())) irAEnLinea(); })();
  map.setView(center, zoom);
  requestAnimationFrame(() => vivo && map.invalidateSize());

  const colorDe = (l) => (isDark() ? l.colorClaro : l.color);
  const casing = isDark() ? '#14233B' : '#FFFFFF';

  const api = {
    map,
    line(linea, { weight = 6, opacity = 1, points = linea.ida, withCasing = true, draw = false } = {}) {
      if (withCasing) L.polyline(points, { color: casing, weight: weight + 4, opacity: Math.min(1, opacity + 0.2), lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
      const p = L.polyline(points, { color: colorDe(linea), weight, opacity, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
      if (draw) {
        // Se espera a que el mapa termine de encuadrar para medir el largo real; al terminar la
        // animación se quita el trazo discontinuo (si no, al acercar el mapa quedarían huecos).
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const path = vivo && p.getElement();
          if (!path?.getTotalLength) return;
          path.style.setProperty('--len', path.getTotalLength());
          path.classList.add('route-drawn');
          path.addEventListener('animationend', () => { path.classList.remove('route-drawn'); path.style.strokeDasharray = 'none'; }, { once: true });
        }));
      }
      return p;
    },
    segment(linea, desde, hasta, opts = {}) {
      const [a, b] = desde <= hasta ? [desde, hasta] : [hasta, desde];
      const pts = linea.ida.slice(a, b + 1);
      api.line(linea, { weight: 8, points: pts, draw: true, ...opts });
      return pts;
    },
    pin(c, kind = 'stop', label = null) {
      const rotulo = label ? `<span class="pin-label pin-label--${kind}">${label}</span>` : '';
      const icon = L.divIcon({ className: '', html: `<div class="pin pin--${kind === 'now' ? 'now' : kind}">${rotulo}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
      return L.marker(c, { icon, interactive: false }).addTo(map);
    },
    dashed(a, b) {
      return L.polyline([a, b], { color: isDark() ? '#C9D8EE' : '#0F2D57', weight: 3, dashArray: '2 8', opacity: 0.75, lineCap: 'round', interactive: false }).addTo(map);
    },
    fit(points, { top = 24, bottom = 24, side = 24 } = {}) {
      if (!points?.length) return;
      map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [side, top], paddingBottomRight: [side, bottom], animate: false, maxZoom: 16 });
    },
    destroy() {
      vivo = false;
      window.removeEventListener('offline', alPerderInternet);
      window.removeEventListener('online', alVolverInternet);
      map.remove();
    },
  };
  return api;
}
