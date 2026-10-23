// ================================================================
// PANTALLA DE CARGA
// ================================================================
import { store } from '../core/store.js';
import { t } from '../core/i18n.js';
import { wait } from '../core/dom.js';
import { hayAcceso } from '../services/auth.service.js';

const MIN_MS = 2000;

// Nubes: [archivo, x, y, ancho, alto, velocidad] en el sistema de 1024 px del dibujo original.
const NUBES = [[1, 170, 178, 220, 79, 17], [2, 408, 166, 107, 38, 25], [3, 552, 122, 147, 56, 21], [4, 489, 252, 123, 43, 29], [5, 265, 306, 81, 32, 23], [6, 724, 280, 178, 73, 19], [7, 60, 414, 79, 73, 27]];
const CIELO = { x: 99, y: 89, d: 792 };      // círculo del cielo dentro del dibujo (1024 px)

// Combi: ocho posiciones según hacia dónde avanza.
const POSICIONES = { right: 4, downright: 3, down: 2, downleft: 1, left: 5, upleft: 8, up: 7, upright: 6 };
const TAMANO = { 1: [335, 216], 2: [232, 228], 3: [337, 216], 4: [427, 194], 5: [427, 194], 6: [308, 212], 7: [196, 234], 8: [313, 212] };
const DIRECCIONES = ['right', 'downright', 'down', 'downleft', 'left', 'upleft', 'up', 'upright'];
const ANILLO = { cx: 517, cy: 706, rx: 452, ry: 172, rot: (-9.4 * Math.PI) / 180 };
const VUELTA_MS = 3600;
const TH_INICIO = 0.95;                      // empieza en diagonal, como en la ilustración original

const IMAGENES = [
  'assets/img/carga/primer-plano.png', 'assets/img/brand/wordmark.png', 'assets/img/brand/logo.png', 'assets/img/portada/iglesia.jpg',
  ...NUBES.map((n) => `assets/img/carga/nube-${n[0]}.png`),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `assets/img/carga/combi/combi-${n}.png`),
  ...['linea-60', 'linea-15', 'linea-20mayo'].map((n) => `assets/img/lineas/${n}.png`),
];

const nubeHtml = ([n, x, y, w, h, v]) => {
  const rx = x - CIELO.x, ry = y - CIELO.y, u = (k) => `${(k / CIELO.d) * 100}`;
  const recorrido = CIELO.d + w;
  const dur = recorrido / v;
  const delay = -((rx + w) / recorrido) * dur;       // arranca en su lugar original
  return `<img class="planet__cloud" src="assets/img/carga/nube-${n}.png" alt="" style="top:${u(ry)}%;width:${u(w)}%;--from:${-u(w)}cqw;--to:100cqw;--rest:${u(rx)}cqw;--dur:${dur.toFixed(1)}s;--delay:${delay.toFixed(1)}s">`;
};

export default {
  name: 'splash',
  flow: true,

  render() {
    return `
      <section class="splash" style="flex:1;display:flex;flex-direction:column;align-items:center">
        <img class="splash__wordmark" src="assets/img/brand/wordmark.png" alt="ÑanGO">
        <p class="splash__tagline">${t('Tu camino en Juliaca')}</p>
        <div class="planet" id="planet" role="img" aria-label="${t('Planeta con edificios de Juliaca y una combi que da vueltas')}">
          <div class="planet__sky"></div>
          <div class="planet__clouds">${NUBES.map(nubeHtml).join('')}</div>
          <img class="planet__front" src="assets/img/carga/primer-plano.png" alt="">
          <img class="planet__van" id="van" src="assets/img/carga/combi/combi-1.png" alt="">
        </div>
        <div class="splash__status" role="status" aria-live="polite">
          <div class="splash__message" id="msg">${t('Abriendo tus rutas guardadas…')}</div>
          <div class="splash__bar"><i class="splash__bar-fill" id="bar"></i></div>
          <div class="splash__pct" id="pct">0 %</div>
        </div>
      </section>`;
  },

  mount(root, _p, api) {
    const planet = root.querySelector('#planet');
    const van = root.querySelector('#van');
    const reducir = store.get().reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    let vivo = true, terminar = false, thFinal = null, llego;
    const llegada = new Promise((r) => { llego = r; });     // se cumple cuando la combi queda de frente en el centro
    const inicio = performance.now();

    // ---- Combi: recorre el anillo y vuelve al centro, de frente ----
    const pos = (th) => {
      const x = ANILLO.rx * Math.cos(th), y = ANILLO.ry * Math.sin(th);
      return [ANILLO.cx + x * Math.cos(ANILLO.rot) - y * Math.sin(ANILLO.rot), ANILLO.cy + x * Math.sin(ANILLO.rot) + y * Math.cos(ANILLO.rot)];
    };
    function dibujar(th, frente = false) {
      const f = planet.clientWidth / 1024;
      const [x, y] = pos(th), [x2, y2] = pos(th + 0.02);
      const fi = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
      const spr = frente ? 2 : POSICIONES[DIRECCIONES[((Math.round(fi / 45) % 8) + 8) % 8]];
      const s = Math.sin(th), k = 0.6 + 0.1 * Math.max(0, s);
      const [w0, h0] = TAMANO[spr], w = w0 * k * f, h = h0 * k * f;
      const src = `assets/img/carga/combi/combi-${spr}.png`;
      if (!van.src.endsWith(src)) van.src = src;
      van.style.width = `${w}px`; van.style.height = `${h}px`;
      van.style.transform = `translate(${x * f - w / 2}px, ${y * f - h * 0.72}px)`;
      van.style.zIndex = s < 0 ? 2 : 4;                    // por detrás del planeta cuando da la vuelta al fondo
    }
    function girar(ahora) {
      if (!vivo) return;
      let th = TH_INICIO + ((ahora - inicio) / VUELTA_MS) * 2 * Math.PI;
      if (terminar) {
        if (thFinal === null) thFinal = Math.ceil((th - Math.PI / 2) / (2 * Math.PI)) * 2 * Math.PI + Math.PI / 2;
        if (th >= thFinal) { dibujar(Math.PI / 2, true); llego(); return; }
      }
      dibujar(th);
      requestAnimationFrame(girar);
    }
    if (reducir) { dibujar(Math.PI / 2, true); llego(); } else requestAnimationFrame(girar);

    // ---- Progreso real: imágenes cargadas ----
    const bar = root.querySelector('#bar'), pct = root.querySelector('#pct'), msg = root.querySelector('#msg');
    const mensajes = ['Abriendo tus rutas guardadas…', 'Cargando paraderos…', 'Preparando el mapa…', '¡Listo para viajar!'];
    let cargadas = 0;
    const avanzar = () => {
      const p = Math.round((++cargadas / IMAGENES.length) * 100);
      bar.style.width = `${p}%`; pct.textContent = `${p} %`;
      msg.textContent = t(mensajes[Math.min(3, Math.floor((p / 100) * 3.99))]);
    };
    const precarga = Promise.all(IMAGENES.map((src) => new Promise((ok) => { const i = new Image(); i.onload = i.onerror = () => { avanzar(); ok(); }; i.src = src; })));

    // ---- Salir: espera mínima 2 s, la combi llega al centro y se abre la app ----
    Promise.all([precarga, wait(MIN_MS)]).then(async () => {
      terminar = true;
      await Promise.race([llegada, wait(VUELTA_MS + 800)]);   // la combi termina su vuelta (límite de seguridad si la pestaña está oculta)
      if (vivo && !reducir) dibujar(Math.PI / 2, true);
      await wait(reducir ? 150 : 600);
      if (!vivo) return;
      const s = store.get();
      if (!s.seenWelcome) api.replace('welcome');
      else if (!hayAcceso()) api.replace('auth', { modo: 'registro' });
      else api.replace('home');
    });

    return () => { vivo = false; };
  },
};
