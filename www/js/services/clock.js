// Hora actual. Para probar la hora punta sin esperar: abrir la app con ?hora=7:45
const forzada = new URLSearchParams(location.search).get('hora');

export function ahora() {
  const d = new Date();
  if (forzada) {
    const [h, m = 0] = forzada.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

/** Hora decimal: 7:45 -> 7.75 */
export const horaDecimal = (d = ahora()) => d.getHours() + d.getMinutes() / 60;

export const formatoHora = (d = ahora()) => d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });

export function saludo(d = ahora()) {
  const h = d.getHours();
  return h < 12 ? 'Buen día' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

// Frases cortas de la cabecera de Inicio, según la hora. Cada día se elige una distinta del mismo tramo.
const FRASES = {
  madrugada: ['Buenas noches', '¡Madrugando!'],
  manana: ['Buenos días', 'Buen día', '¡A moverse!'],
  tarde: ['Buenas tardes', '¡Buena tarde!'],
  noche: ['Buenas noches', '¡Buen viaje!'],
};
export function saludoDelDia(d = ahora()) {
  const h = d.getHours();
  const lista = FRASES[h < 5 ? 'madrugada' : h < 12 ? 'manana' : h < 19 ? 'tarde' : 'noche'];
  return lista[Math.floor(d.getTime() / 86400000) % lista.length];
}

/** 'lunvie' | 'sabado' | 'domingo' */
export function tipoDia(d = ahora()) {
  const n = d.getDay();
  return n === 0 ? 'domingo' : n === 6 ? 'sabado' : 'lunvie';
}
