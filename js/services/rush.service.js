// ================================================================
// SERVICIO DE HORA PUNTA
// Los niveles salen de js/data/horas.js (franjas de referencia).
// TODO(lógica): cuando haya datos reales por línea y por día
// ================================================================
import { PATRON, HORAS_RECOMENDADAS } from '../data/horas.js';
import { ahora, horaDecimal, tipoDia } from './clock.js';

/** Nivel de congestión 0-100 a una hora decimal (7.5 = 7:30). */
export function nivel(h, dia = tipoDia()) {
  const franjas = PATRON[dia];
  let v = h < 6.5 ? 18 : h >= 20 ? 26 : 34;
  for (const [a, b, x] of franjas) {
    if (h >= a && h < b) v = x;
    else if (h >= a - 0.5 && h < a) v = Math.max(v, x * 0.62);
    else if (h >= b && h < b + 0.5) v = Math.max(v, x * 0.62);
  }
  return Math.round(v);
}

export const categoria = (v) => (v >= 70 ? 'muy' : v >= 45 ? 'concurrido' : 'tranquilo');

/** Serie por medias horas de 5:00 a 22:00 para el gráfico. */
export function serie(dia = tipoDia()) {
  const out = [];
  for (let h = 5; h < 22.5; h += 0.5) out.push({ h, v: nivel(h, dia) });
  return out;
}

/** ¿Estamos en hora punta? Devuelve { activa, hasta } (hasta = hora en que termina). */
export function estado(d = ahora()) {
  const h = horaDecimal(d);
  const f = PATRON[tipoDia(d)].find(([a, b]) => h >= a && h < b);
  return { activa: !!f, hasta: f ? f[1] : null, nivel: nivel(h, tipoDia(d)) };
}

/** Minutos extra que suma la hora punta a un viaje de `minBase` minutos. */
export function recargaMin(minBase, d = ahora()) {
  const { nivel: n } = estado(d);
  return n >= 70 ? Math.round(minBase * 0.2) : n >= 45 ? Math.round(minBase * 0.08) : 0;
}

export const horaTexto = (h) => {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${hh}:${String(mm).padStart(2, '0')}`;
};
export const mejoresHoras = () => HORAS_RECOMENDADAS;
export const franjas = (dia = tipoDia()) => PATRON[dia];
