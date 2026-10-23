// ================================================================
// HORA PUNTA 
// ================================================================
export const FRANJAS_PUNTA = [
  [7.5, 8, 90],    // 7:30 – 8:00 AM
  [12, 13, 78],    // 12:00 – 1:00 PM
  [14, 15, 68],    // 2:00 – 3:00 PM
  [18, 20, 96],    // 6:00 – 8:00 PM
];

/** Mismo patrón para toda la semana mientras no haya datos distintos. */
export const PATRON = {
  lunvie: FRANJAS_PUNTA,
  sabado: FRANJAS_PUNTA.map(([a, b, n]) => [a, b, Math.round(n * 0.75)]),
  domingo: FRANJAS_PUNTA.map(([a, b, n]) => [a, b, Math.round(n * 0.5)]),
};

export const HORAS_RECOMENDADAS = 'Antes de 7:30 · 8:30 a 11:30 · 3:30 a 5:30 PM · después de las 8 PM';
