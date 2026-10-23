// ================================================================
// SERVICIO DE MODO VIAJE 
//
// Un viaje es una lista de TRAMOS (uno por micro; dos si hay transbordo). Cada tramo trae solo los paraderos
// desde donde se sube hasta donde se baja, en el sentido en que se viaja:
//   trip = { legs: [{ lineaId, desde, hasta, caminataAntes, stops: [{ nombre, c, ref }] }], leg, index, previos, startedAt }
// TODO(lógica): vibración/sonido al faltar paraderos, notificaciones y guardar el viaje terminado.
// ================================================================
import { store } from '../core/store.js';
import { getLinea } from '../data/lineas.js';
import { paraderosDe, indiceDeParadero } from './lines.service.js';
import { empujarPerfil } from './sync.service.js';

export const actual = () => { const t = store.get().trip; return t && t.legs ? t : null; };   // ignora viajes guardados con el formato anterior

/** Paraderos de un tramo: punto de subida, paraderos conocidos de la línea que quedan en medio, punto de bajada. */
function paradasDelTramo(linea, desde, hasta, sube, baja) {
  const [a, b] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  // Paraderos con nombre que quedan de verdad entre donde se sube y donde se baja (y no pegados a esos dos puntos)
  const conocidos = paraderosDe(linea).filter((p) => p.idx > a + 3 && p.idx < b - 3);
  if (desde > hasta) conocidos.reverse();
  const lista = [
    { nombre: sube.calle || 'Punto de subida', c: sube.c, ref: 'Aquí subes' },
    ...conocidos.map((p) => ({ nombre: p.nombre, c: p.c })),
    { nombre: baja.calle || 'Punto de bajada', c: baja.c },
  ];
  return lista.map((p, i) => ({ ...p, ref: i === 0 ? 'Aquí subes' : i === lista.length - 1 ? 'Aquí bajas' : `Después de ${lista[i - 1].nombre}` }));
}

/** Inicia el viaje de una opción de ruta (con o sin transbordo). */
export function iniciarOpcion(opcion) {
  const legs = opcion.tramos.map((tr, i) => {
    const l = getLinea(tr.lineaId);
    return {
      lineaId: tr.lineaId, desde: tr.desde, hasta: tr.hasta,
      caminataAntes: i === 0 ? opcion.caminata.inicio : opcion.caminata.transbordo,
      stops: paradasDelTramo(l, tr.desde, tr.hasta, tr.sube, tr.baja),
    };
  });
  store.set({ trip: { legs, leg: 0, index: 0, previos: 0, startedAt: Date.now(), caminataFinal: opcion.caminata.final } });
}

/** Inicia un viaje recorriendo una línea completa (desde su ficha). */
export function iniciar(lineaId) {
  const l = getLinea(lineaId);
  const stops = paraderosDe(l).map((p) => ({ nombre: p.nombre, c: p.c, ref: p.ref }));
  store.set({ trip: { legs: [{ lineaId, desde: 0, hasta: l.ida.length - 1, caminataAntes: 0, stops }], leg: 0, index: 0, previos: 0, startedAt: Date.now(), caminataFinal: 0 } });
}

// Viaje en una línea que la persona ya conoce: sube en el paradero kSube y baja en el kBaja (posiciones en la lista
// de paraderos de la línea). El sentido (ida o vuelta) sale del orden: si kSube < kBaja va de ida; si no, de vuelta.
export function iniciarTramoLinea(lineaId, kSube, kBaja) {
  const l = getLinea(lineaId);
  const ps = paraderosDe(l);
  const paso = kSube <= kBaja ? 1 : -1;
  const lista = [];
  for (let k = kSube; k !== kBaja + paso; k += paso) lista.push(ps[k]);
  const stops = lista.map((p, i) => ({
    nombre: p.nombre, c: p.c,
    ref: i === 0 ? 'Aquí subes' : i === lista.length - 1 ? 'Aquí bajas' : `Después de ${lista[i - 1].nombre}`,
  }));
  const desde = indiceDeParadero(l, kSube), hasta = indiceDeParadero(l, kBaja);
  store.set({ trip: { legs: [{ lineaId, desde, hasta, caminataAntes: 0, stops }], leg: 0, index: 0, previos: 0, startedAt: Date.now(), caminataFinal: 0 } });
}

export function marcarPasado() {
  const t = actual();
  if (!t) return null;
  const ultimo = t.legs[t.leg].stops.length - 1;
  const index = Math.min(t.index + 1, ultimo);
  store.set({ trip: { ...t, index } });
  return index;
}

export function retroceder() {
  const t = actual();
  if (t && t.index > 0) store.set({ trip: { ...t, index: t.index - 1 } });
}

/** Ya bajó de la primera micro y subió a la siguiente. */
export function cambiarDeMicro() {
  const t = actual();
  if (!t || t.leg >= t.legs.length - 1) return;
  store.set({ trip: { ...t, leg: t.leg + 1, index: 0, previos: t.previos + t.index } });
}

export function terminar(calificacion = null) {
  const t = actual();
  if (t) {
    const duracionMinutos = Math.max(1, Math.round((Date.now() - t.startedAt) / 60000));
    const nuevo = {
      lineaId: t.legs[0].lineaId,
      lineas: t.legs.map((g) => g.lineaId),
      paraderosAvanzados: (t.previos || 0) + t.index,
      duracion: duracionMinutos,
      calificacion,
      fecha: new Date().toISOString(),
    };
    // El más reciente va primero; se guardan los últimos 50 y, con cuenta, también en la nube.
    const viajesCompletados = [nuevo, ...(store.get().viajesCompletados || [])].slice(0, 50);
    store.set({ trip: null, viajesCompletados });
    empujarPerfil({ trips: viajesCompletados });
  }
  return t;
}

/** Datos para pintar la pantalla del viaje. */
export function estado() {
  const t = actual();
  if (!t) return null;
  const tramo = t.legs[t.leg];
  const linea = getLinea(tramo.lineaId);
  const paraderos = tramo.stops;
  const bajarIndex = paraderos.length - 1;
  const faltan = Math.max(0, bajarIndex - t.index);
  const hayOtro = t.leg < t.legs.length - 1;
  const finTramo = t.index >= bajarIndex;
  const otro = hayOtro ? t.legs[t.leg + 1] : null;
  return {
    t, tramo, linea, paraderos, bajarIndex, faltan,
    siguiente: paraderos[Math.min(t.index, bajarIndex)],
    avisoBajada: faltan <= 2,
    finTramo,
    siguienteTramo: otro ? { linea: getLinea(otro.lineaId), sube: otro.stops[0], caminata: otro.caminataAntes } : null,
    llego: finTramo && !hayOtro,
    numTramo: t.leg + 1, totalTramos: t.legs.length,
    paraderosRecorridos: (t.previos || 0) + t.index,
  };
}
