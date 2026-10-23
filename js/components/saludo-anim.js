// ================================================================
// SALUDO DE LA CABECERA DE INICIO
// ================================================================
import { store } from '../core/store.js';

const ESCALA = 0.29;                 // la combi (sprite de 427 px) se dibuja a 124 px de ancho
const ANCHO_SPRITE = 427;
const RADIO_NEUMATICO = 28;          // px del sprite (la rueda completa, no solo el rin)
const DURACION_MS = 2400;
const PASOS = 96;
const CLAVE_SESION = 'nango.saludo-visto';

// cubic-bezier(0.23, 1, 0.32, 1): la curva "ease-out" fuerte de la app (--ease-out), resuelta a mano para muestrear
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const x = (t) => ((ax * t + bx) * t + cx) * t;
  const y = (t) => ((ay * t + by) * t + cy) * t;
  return (p) => {
    let t = p;
    for (let i = 0; i < 8; i++) { const dx = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(dx) < 1e-6) break; t -= (x(t) - p) / dx; }
    return y(Math.min(1, Math.max(0, t)));
  };
}
const easeOut = bezier(0.23, 1, 0.32, 1);

const mueveMenos = () => document.getElementById('app')?.classList.contains('reduce-motion')
  || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  || store.get().reduceMotion;

export async function animarSaludo(escenario, { fotograma = null } = {}) {
  const texto = escenario?.querySelector('.hero__saludo');
  const van = escenario?.querySelector('.vanrig');
  if (!texto || !van) return;
  const ruedas = [...van.querySelectorAll('.vanrig__wheel')];

  // La fuente del saludo debe estar cargada antes de medir la frase
  try { await Promise.race([document.fonts.load('40px Dantene'), new Promise((r) => setTimeout(r, 900))]); } catch { /* sin fuente: se mide con la de respaldo */ }
  if (!escenario.isConnected) return;

  const W = escenario.clientWidth;
  const anchoVan = ANCHO_SPRITE * ESCALA;
  const izquierda = 16, holgura = 12, margenDerecho = 14;

  // La frase debe caber en una línea junto a la combi: si no, se achica un poco
  let px = parseFloat(getComputedStyle(texto).fontSize);
  while (texto.offsetWidth > W - anchoVan - izquierda - holgura - margenDerecho && px > 26) { px -= 1; texto.style.fontSize = `${px}px`; }
  const anchoTexto = texto.offsetWidth;

  const xFinal = W - anchoVan - margenDerecho;       // dónde se queda la combi
  const xInicio = -anchoVan - 10;                    // fuera de la pantalla, a la izquierda
  const APOYO = 3;                                   // px que la combi baja para que las ruedas toquen la barra
  const tramaVan = (x, y = 0) => `translate3d(${x}px, ${y + APOYO}px, 0) scale(${ESCALA})`;

  // Estado final (también el de quien tiene "reducir movimiento")
  van.style.transform = tramaVan(xFinal);
  texto.style.transform = 'none';
  escenario.classList.add('is-listo');

  const congelado = fotograma ?? (new URLSearchParams(location.search).get('saludoT'));
  const yaVisto = sessionStorage.getItem(CLAVE_SESION) === '1';
  if (congelado === null && (mueveMenos() || yaVisto)) return;
  try { sessionStorage.setItem(CLAVE_SESION, '1'); } catch { /* sin almacenamiento */ }

  // Radio efectivo para que las ruedas no "bailen" al verse (6 rayos): giran como mucho ~24° por fotograma
  const rodadura = (xv) => (xv - xInicio) / (RADIO_NEUMATICO * ESCALA);          // radianes
  let maxPaso = 0;
  for (let i = 1; i <= PASOS; i++) maxPaso = Math.max(maxPaso, rodadura(xInicio + (xFinal - xInicio) * easeOut(i / PASOS)) - rodadura(xInicio + (xFinal - xInicio) * easeOut((i - 1) / PASOS)));
  const framesPorPaso = (DURACION_MS / PASOS) / (1000 / 60);
  const maxGradosFrame = (maxPaso * 180 / Math.PI) / framesPorPaso;
  const reductor = Math.max(1, maxGradosFrame / 24);

  const kVan = [], kTexto = [], kRueda = [];
  for (let i = 0; i <= PASOS; i++) {
    const p = i / PASOS, e = easeOut(p);
    const xv = xInicio + (xFinal - xInicio) * e;
    const rebote = Math.sin(p * Math.PI * 9) * 1.1 * (1 - p) * (1 - p);          // suspensión: se calma al frenar
    const xTexto = Math.min(0, xv - holgura - anchoTexto - izquierda);            // detrás de la combi, hasta su sitio
    kVan.push({ transform: tramaVan(xv, rebote), offset: p });
    kTexto.push({ transform: `translate3d(${xTexto}px, 0, 0)`, offset: p });
    kRueda.push({ transform: `rotate(${(rodadura(xv) * 180 / Math.PI) / reductor}deg)`, offset: p });   // horario
  }

  const opciones = { duration: DURACION_MS, easing: 'linear', fill: 'both' };
  const animaciones = [
    van.animate(kVan, opciones),
    texto.animate(kTexto, opciones),
    ...ruedas.map((r) => r.animate(kRueda, opciones)),
  ];

  if (congelado !== null) {
    animaciones.forEach((a) => { a.pause(); a.currentTime = Math.max(0, Math.min(DURACION_MS, Number(congelado))); });
    return;
  }
  // Al terminar, el estado final queda en el CSS y se libera la animación
  animaciones[0].finished.then(() => animaciones.forEach((a) => a.cancel())).catch(() => {});
}
