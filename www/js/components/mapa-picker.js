// ================================================================
// SELECTOR DE PUNTO A PANTALLA COMPLETA  ("Elegir en el mapa")
//   const r = await elegirEnMapa({ tipo: 'origin' | 'destination', centro: [lat, lng], enlace: false });
//   // r = { lat, lng, nombre }  ·  null si se canceló (← o Escape)
//
// Cómo funciona:
//  · El pin queda fijo en el centro de la pantalla y se mueve el mapa debajo (pointer-events: none).
//    El centro del círculo del pin es exactamente el punto que se guarda.
//  · Cambia de etiqueta y color según el campo (Origen = azul, Destino = amarillo).
//  · Al dejar de mover el mapa (moveend) se muestra la calle más cercana del catálogo (calleCerca),
//    sin consultar ningún servicio externo. Es aproximada: el catálogo guarda un punto por calle.
//  · "Pegar un enlace de Google Maps": lee el portapapeles y, si no hay permiso (iPhone, por
//    ejemplo), deja un campo para pegar a mano. Mueve el mapa al punto y la usuaria lo ajusta.
//    Los enlaces cortos (maps.app.goo.gl) los expande la Edge Function `expandir-enlace` (Supabase).
//    Si no está desplegada o no hay internet, se avisa que copien el enlace largo.
//  · enlace: true abre directo el campo para pegar (acceso "Pegar enlace" de la lista).
// ================================================================
import { t } from '../core/i18n.js';
import { createMap } from './map.js';
import { extraerCoordsDeTexto, esEnlaceCorto } from '../services/geo.js';
import { expandirEnlace } from '../services/enlaces.service.js';
import { calleCerca } from '../services/places.service.js';

const CENTRO_JULIACA = [-15.4985, -70.1333];

export function elegirEnMapa({ tipo = 'destination', centro = null, enlace = false } = {}) {
  return new Promise((resolve) => {
    const esDestino = tipo !== 'origin';
    const etiqueta = esDestino ? t('Destino') : t('Origen');

    const overlay = document.createElement('div');
    overlay.className = 'mappicker';
    overlay.innerHTML = `
      <div class="mappicker__map"></div>
      <div class="mappicker__pin ${esDestino ? 'is-dest' : ''}"><span>${etiqueta}</span><i></i></div>
      <button class="mappicker__back" aria-label="${t('Volver')}">←</button>
      <div class="mappicker__sheet">
        <strong class="mappicker__dir"></strong>
        <small class="mappicker__coords"></small>
        <button class="mappicker__paste">${t('Pegar un enlace de Google Maps')}</button>
        <div class="mappicker__link" hidden>
          <input class="mappicker__input" inputmode="url" autocomplete="off" placeholder="${t('Pega aquí el enlace')}" aria-label="${t('Pegar un enlace de Google Maps')}">
          <small class="mappicker__msg" role="status"></small>
        </div>
        <button class="btn btn--primary btn--block btn--lg mt-8 mappicker__ok">${t('Confirmar {c}', { c: etiqueta.toLowerCase() })}</button>
      </div>`;
    document.getElementById('app').append(overlay);

    const dirEl = overlay.querySelector('.mappicker__dir');
    const coordsEl = overlay.querySelector('.mappicker__coords');
    const cajaEnlace = overlay.querySelector('.mappicker__link');
    const inputEl = overlay.querySelector('.mappicker__input');
    const msgEl = overlay.querySelector('.mappicker__msg');
    const m = createMap(overlay.querySelector('.mappicker__map'), { center: centro || CENTRO_JULIACA, zoom: centro ? 17 : 14 });
    const mapa = m.map;

    const actualizar = () => {
      const c = mapa.getCenter();
      coordsEl.textContent = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
      const calle = calleCerca([c.lat, c.lng]);
      dirEl.textContent = calle ? t('Cerca de {calle}', { calle }) : t('Ubicación en el mapa');
    };
    mapa.on('moveend', actualizar);
    actualizar();

    const cerrar = (resultado) => {
      document.removeEventListener('keydown', teclado, true);
      m.destroy();
      overlay.remove();
      resolve(resultado);
    };
    // Capture (true) + stopPropagation: si hay una hoja/modal debajo, Escape solo cierra este selector.
    const teclado = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(null); } };
    document.addEventListener('keydown', teclado, true);
    if (mapa.attributionControl) mapa.attributionControl.setPosition('topright');

    // ---- Pegar un enlace de Google Maps ----
    const aviso = (texto, error = false) => { msgEl.textContent = texto; msgEl.classList.toggle('is-error', error); };
    let lectura = 0;                       // descarta lecturas viejas si la usuaria sigue escribiendo
    const leerEnlace = async (texto) => {
      const mia = ++lectura;
      const limpio = String(texto || '').trim();
      if (!limpio) { aviso(''); return false; }
      let xy = extraerCoordsDeTexto(limpio);
      if (!xy && esEnlaceCorto(limpio)) {
        aviso(t('Leyendo el enlace…'));
        const largo = await expandirEnlace(limpio);      // lo sigue el servidor (Edge Function)
        if (mia !== lectura) return false;
        xy = largo ? extraerCoordsDeTexto(largo) : null;
        if (!xy) { aviso(t('No pudimos leer ese enlace corto. Ábrelo y copia el enlace de la barra del navegador, o mueve el mapa.'), true); return false; }
      }
      if (xy) { mapa.setView([xy.lat, xy.lng], 17); aviso(t('Ubicación leída del enlace. Ajusta el mapa si hace falta.')); return true; }
      aviso(t('No se reconocieron coordenadas en el enlace.'), true);
      return false;
    };
    const abrirEnlace = async ({ leerPortapapeles = true } = {}) => {
      cajaEnlace.hidden = false;
      inputEl.focus();
      if (!leerPortapapeles) return;
      let texto = '';
      try { texto = await navigator.clipboard.readText(); } catch { /* sin permiso: se pega a mano */ }
      if (texto) { inputEl.value = texto; leerEnlace(texto); }
    };
    inputEl.addEventListener('input', () => leerEnlace(inputEl.value));
    overlay.querySelector('.mappicker__paste').addEventListener('click', () => abrirEnlace());
    if (enlace) abrirEnlace({ leerPortapapeles: false });

    overlay.querySelector('.mappicker__back').addEventListener('click', () => cerrar(null));
    overlay.querySelector('.mappicker__ok').addEventListener('click', () => {
      const c = mapa.getCenter();
      cerrar({ lat: c.lat, lng: c.lng, nombre: dirEl.textContent });
    });
  });
}
