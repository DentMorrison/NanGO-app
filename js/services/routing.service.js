// ================================================================
// SERVICIO DE RUTAS: opciones de viaje entre dos lugares (1 micro o 1 transbordo).
//
// Cómo funciona:
//  · Cada línea es un recorrido (js/data/trazos.js). La micro sube y baja por el MISMO recorrido, así que se puede
//    viajar en cualquiera de los dos sentidos: el tramo entre dos puntos siempre mide lo que hay entre ellos.
//  · Se busca dónde subir (punto del recorrido cercano al origen) y dónde bajar (cercano al destino).
//    Se elige la combinación con menor tiempo total: caminar + esperar + ir en micro.
//  · Si ninguna línea sirve directo, se busca un transbordo: dos líneas que se cruzan a menos de 300 m.
//
// Cada opción devuelta:  { id, tipo, lineas, tramos, minutos, precio, esperaMin, caminata:{inicio,transbordo,final}, ... }
//  tramo = { lineaId, desde, hasta, km, sube:{c,calle}, baja:{c,calle} }   (desde / hasta = posición en linea.ida)
//
// TODO(lógica): con paraderos reales (coordenadas) subir y bajar exactamente en ellos.
// ================================================================
import { LINEAS } from '../data/lineas.js';
import { getLugar, getPunto, calleCerca } from './places.service.js';
import { km } from './geo.js';
import { calleEn, UMBRAL_PASA_KM, UMBRAL_CERCA_KM } from './lines.service.js';
import { proximoMin, esNocturno } from './eta.service.js';
import { recargaMin } from './rush.service.js';
import { ahora } from './clock.js';

const RADIO_CAMINATA_KM = 0.9;     // hasta dónde se camina para subir o desde dónde se baja
const CRUCE_MAX_KM = 0.3;          // distancia máxima a pie entre dos líneas para hacer transbordo
const MIN_TRAMO_KM = 0.2;          // un tramo en micro más corto que esto no tiene sentido
const VEL_MICRO_KMH = 16;
const VEL_CAMINATA_KMH = 4.8;
const CASTIGO_TRANSBORDO_MIN = 6;  // incomodidad de cambiar de micro
const FACTOR_CALLES = 1.25;        // caminando no se va en línea recta: las calles dan rodeos

const minutosDe = (kms, vel) => (kms / vel) * 60;
const precioDe = (linea, d) => (esNocturno(linea, d) ? linea.tarifa.nocturna : linea.tarifa.adulto);
const getLinea = (id) => LINEAS.find((l) => l.id === id);

// ---------- geometría del recorrido ----------
const acumulados = new WeakMap();
function acumulado(puntos) {
  let a = acumulados.get(puntos);
  if (!a) {
    a = [0];
    for (let k = 0; k < puntos.length - 1; k++) a.push(a[k] + km(puntos[k], puntos[k + 1]));
    acumulados.set(puntos, a);
  }
  return a;
}
/** Kilómetros de recorrido entre dos posiciones (en cualquier sentido). */
const entre = (puntos, i, j) => Math.abs(acumulado(puntos)[j] - acumulado(puntos)[i]);

/** Posiciones del recorrido que quedan más cerca de un punto que sus vecinas (mínimos locales) y a distancia caminable. */
function cercanos(puntos, c, radio = RADIO_CAMINATA_KM) {
  const minimos = [];
  let anterior = Infinity, bajando = false;
  for (let i = 0; i < puntos.length; i++) {
    const d = km(puntos[i], c);
    if (d < anterior) bajando = true;
    else if (d > anterior && bajando) { if (anterior <= radio) minimos.push({ i: i - 1, d: anterior }); bajando = false; }
    anterior = d;
  }
  if (bajando && anterior <= radio) minimos.push({ i: puntos.length - 1, d: anterior });
  return minimos.sort((a, b) => a.d - b.d).slice(0, 4);
}

// Puntos donde el recorrido de A pasa a menos de 300 m del de B. No depende del origen ni del destino: se calcula una vez.
const crucesCache = new Map();
function cruces(A, B) {
  const clave = `${A.id}|${B.id}`;
  if (!crucesCache.has(clave)) {
    const lista = [];
    for (let i = 0; i < A.ida.length; i += 2) {
      for (let j = 0; j < B.ida.length; j += 2) {
        const d = km(A.ida[i], B.ida[j]);
        if (d <= CRUCE_MAX_KM) lista.push({ i, j, d });
      }
    }
    crucesCache.set(clave, lista);
  }
  return crucesCache.get(clave);
}

// La calle es la real por donde va la micro (data/calles.js); si falta, la más cercana del catálogo.
const punto = (linea, i) => ({ c: linea.ida[i], calle: calleEn(linea, i) || calleCerca(linea.ida[i]) });
const tramo = (linea, desde, hasta) => ({
  lineaId: linea.id, desde, hasta, km: entre(linea.ida, desde, hasta),
  sube: punto(linea, desde), baja: punto(linea, hasta),
});

// ---------- armado de una opción ----------
function armarOpcion(tramos, caminataRecta, d) {
  const caminata = { inicio: caminataRecta.inicio * FACTOR_CALLES, transbordo: caminataRecta.transbordo * FACTOR_CALLES, final: caminataRecta.final * FACTOR_CALLES };
  const lineas = tramos.map((t) => getLinea(t.lineaId));
  const enMicro = tramos.reduce((s, t) => s + minutosDe(t.km, VEL_MICRO_KMH), 0);
  const espera = Math.round(proximoMin(lineas[0], d) ?? 8);
  const esperaExtra = tramos.length > 1 ? Math.round(proximoMin(lineas[1], d) ?? 8) : 0;
  const caminando = minutosDe(caminata.inicio + caminata.transbordo + caminata.final, VEL_CAMINATA_KMH);
  const base = Math.round(caminando + enMicro) + espera + esperaExtra;
  const extra = recargaMin(base, d);
  const m = (x) => Math.round(x * 1000);
  return {
    id: tramos.map((t) => t.lineaId).join('+'),
    tipo: tramos.length === 1 ? 'directo' : 'transbordo',
    nivel: nivelDe(Math.max(caminataRecta.inicio, caminataRecta.final)),
    lineas, tramos, esperaMin: espera, esperaExtraMin: esperaExtra,
    minutos: base + extra, extraPunta: extra,
    precio: lineas.reduce((s, l) => s + precioDe(l, d), 0),
    caminata: { inicio: m(caminata.inicio), transbordo: m(caminata.transbordo), final: m(caminata.final) },
    caminataMetros: m(caminata.inicio + caminata.transbordo + caminata.final),
  };
}

const RANGO_NIVEL = { cerca: 0, media: 1, lejos: 2 };

/**
 * Opciones entre dos lugares. Primero se buscan las que suben y bajan a ≤ 400 m del origen y del destino; solo si no
 * hay ninguna se amplía hasta 900 m. Cada opción trae `nivel`: 'cerca' (≤ 250 m caminando en cada extremo),
 * 'media' (≤ 400 m) o 'lejos' (más). Las de nivel 'cerca' van primero; dentro de cada nivel, de la más corta a la más larga.
 */
export function buscarOpciones(nombreOrigen, nombreDestino, d = ahora()) {
  const o = getPunto(nombreOrigen), de = getPunto(nombreDestino);
  if (!o || !de) return [];
  let opciones = calcular(o, de, d, UMBRAL_CERCA_KM);
  if (!opciones.length) opciones = calcular(o, de, d, RADIO_CAMINATA_KM);
  return opciones.sort((x, y) => RANGO_NIVEL[x.nivel] - RANGO_NIVEL[y.nivel] || x.minutos - y.minutos);
}

function calcular(o, de, d, radio) {
  const directas = [], conTransbordo = [];

  // 1) Un solo micro
  for (const l of LINEAS) {
    let mejor = null;
    for (const a of cercanos(l.ida, o.c, radio)) {
      for (const b of cercanos(l.ida, de.c, radio)) {
        const viaje = entre(l.ida, a.i, b.i);
        if (viaje < MIN_TRAMO_KM) continue;
        const costo = minutosDe(viaje, VEL_MICRO_KMH) + minutosDe(a.d + b.d, VEL_CAMINATA_KMH);
        if (!mejor || costo < mejor.costo) mejor = { a, b, costo };
      }
    }
    if (mejor) directas.push(armarOpcion([tramo(l, mejor.a.i, mejor.b.i)], { inicio: mejor.a.d, transbordo: 0, final: mejor.b.d }, d));
  }

  // 2) Dos micros: se baja de A donde su recorrido pasa cerca del de B
  for (const A of LINEAS) {
    for (const B of LINEAS) {
      if (A === B) continue;
      const origenes = cercanos(A.ida, o.c, radio), destinos = cercanos(B.ida, de.c, radio);
      if (!origenes.length || !destinos.length) continue;
      let mejor = null;
      const posibles = cruces(A, B);
      for (const a of origenes) {
        for (const b of destinos) {
          for (const x of posibles) {
            const kmA = entre(A.ida, a.i, x.i), kmB = entre(B.ida, x.j, b.i);
            if (kmA < MIN_TRAMO_KM || kmB < MIN_TRAMO_KM) continue;
            const costo = minutosDe(kmA + kmB, VEL_MICRO_KMH) + minutosDe(a.d + b.d + x.d, VEL_CAMINATA_KMH) + CASTIGO_TRANSBORDO_MIN;
            if (!mejor || costo < mejor.costo) mejor = { a, b, i: x.i, j: x.j, cruce: x.d, costo };
          }
        }
      }
      if (mejor) {
        conTransbordo.push(armarOpcion(
          [tramo(A, mejor.a.i, mejor.i), tramo(B, mejor.j, mejor.b.i)],
          { inicio: mejor.a.d, transbordo: mejor.cruce, final: mejor.b.d }, d));
      }
    }
  }

  directas.sort((x, y) => x.minutos - y.minutos);
  conTransbordo.sort((x, y) => x.minutos - y.minutos);
  // El transbordo solo se ofrece cuando hace falta (no hay micro directo) o cuando ahorra bastante tiempo.
  const mejorDirecta = directas[0]?.minutos ?? Infinity;
  const utiles = directas.length ? conTransbordo.filter((x) => x.minutos <= mejorDirecta - 8).slice(0, 2) : conTransbordo.slice(0, 3);
  return [...directas, ...utiles].sort((x, y) => x.minutos - y.minutos).slice(0, 5);
}

const nivelDe = (km) => (km <= UMBRAL_PASA_KM ? 'cerca' : km <= UMBRAL_CERCA_KM ? 'media' : 'lejos');

/** Se conserva por compatibilidad: las opciones ya vienen ordenadas por tiempo. */
export const ordenar = (opciones) => [...opciones].sort((a, b) => a.minutos - b.minutos);

// ---------- instrucciones paso a paso ----------
const redondear = (m) => (m < 100 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50);
const enCalle = (calle) => calle || 'el recorrido de la línea';

export function pasosDe(opcion, nombreOrigen = '', nombreDestino = '') {
  const pasos = [];
  const lugarO = getPunto(nombreOrigen), lugarD = getPunto(nombreDestino);
  const calleO = lugarO ? calleCerca(lugarO.c) : null;
  if (nombreOrigen) pasos.push({ icono: 'map-pin', titulo: `Estás en ${nombreOrigen}`, detalle: calleO && calleO !== nombreOrigen ? `Cerca de ${calleO}` : '' });

  opcion.tramos.forEach((tr, i) => {
    const l = getLinea(tr.lineaId);
    const aPie = i === 0 ? opcion.caminata.inicio : opcion.caminata.transbordo;
    const paraderos = Math.max(1, Math.round(tr.km / 0.45));
    const minEspera = i === 0 ? opcion.esperaMin : opcion.esperaExtraMin;

    if (aPie >= 40) {
      pasos.push({ icono: 'walk', titulo: `Camina ${redondear(aPie)} m hacia ${enCalle(tr.sube.calle)}`, detalle: i === 0 ? `Para tomar la ${l.nombre}` : `Transbordo: allí tomas la ${l.nombre}` });
    } else if (i === 0) {
      pasos.push({ icono: 'walk', titulo: `Espera en ${enCalle(tr.sube.calle)}`, detalle: `Ahí mismo pasa la ${l.nombre}` });
    } else {
      pasos.push({ icono: 'arrows-exchange', titulo: `Cambia de micro en ${enCalle(tr.sube.calle)}`, detalle: `Transbordo a la ${l.nombre}` });
    }
    pasos.push({ icono: 'bus', linea: l, titulo: `Toma la ${l.nombre}`, detalle: `Sube en ${enCalle(tr.sube.calle)} · pasa en ~${minEspera} min` });
    pasos.push({ icono: 'bus-stop', titulo: `Baja en ${enCalle(tr.baja.calle)}`, detalle: `~${paraderos} ${paraderos === 1 ? 'paradero' : 'paraderos'} · ${Math.max(1, Math.round(minutosDe(tr.km, VEL_MICRO_KMH)))} min en micro` });
  });

  const final = opcion.caminata.final;
  const ultimo = opcion.tramos[opcion.tramos.length - 1];
  void lugarD;
  if (final >= 40) pasos.push({ icono: 'walk', titulo: `Camina ${redondear(final)} m hasta ${nombreDestino || 'tu destino'}`, detalle: ultimo.baja.calle ? `Desde ${ultimo.baja.calle}` : '' });
  else pasos.push({ icono: 'flag', titulo: `Llegaste a ${nombreDestino || 'tu destino'}`, detalle: '' });
  return pasos;
}

export { km };
