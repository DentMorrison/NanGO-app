// ================================================================
// SERVICIO DE TIEMPOS ESTIMADOS 
// ================================================================
import { ahora } from './clock.js';

const aMinutos = (txt) => {            // '5:30 AM' -> 330
  const [hm, ampm] = txt.split(' ');
  let [h, m] = hm.split(':').map(Number);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

/** Minutos hasta el próximo micro de la línea, o null si no está en servicio. */
export function proximoMin(linea, d = ahora()) {
  const min = d.getHours() * 60 + d.getMinutes();
  if (min < aMinutos(linea.horario.inicio) || min > aMinutos(linea.horario.fin)) return null;
  const desfase = linea.id.length * 2;                     // para que cada línea tenga su propio ritmo
  const f = linea.frecuenciaMin;
  return Math.max(1, f - ((min + desfase) % f));
}

/** ¿Rige la tarifa nocturna? */
export const esNocturno = (linea, d = ahora()) => d.getHours() * 60 + d.getMinutes() >= aMinutos(linea.horario.nocturnoDesde);
