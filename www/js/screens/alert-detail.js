// DETALLE DE UN AVISO: el tramo afectado en el mapa, qué hacer y votar.
import { t } from '../core/i18n.js';
import { esc, ic } from '../core/dom.js';
import { appbar } from '../components/ui.js';
import { createMap } from '../components/map.js';
import { getLinea } from '../data/lineas.js';
import { LINEAS } from '../data/lineas.js';
import { obtener, tipoDe, votar, votoDe, puedeAportar } from '../services/alerts.service.js';
import { lineDot } from '../components/ui.js';

// 1. Añadimos las importaciones necesarias para buscar el lugar geográfico
import { getLugar } from '../services/places.service.js';
import { nearest } from '../services/geo.js';

export default {
  name: 'alert-detail',
  tab: 'alerts',

  render({ id }) {
    const a = obtener(id), tp = tipoDe(a.tipo), l = getLinea(a.lineaId), voto = votoDe(id);
    return `${appbar()}
      <div style="position:relative;flex:1;min-height:0">
        <div class="map" id="map"></div>
        <button class="map-btn" style="left:12px;top:12px" data-back aria-label="${t('Volver')}">${ic('arrow-left')}</button>
        <div class="sheet">
          <div class="sheet__handle"></div>
          <div style="display:flex;gap:12px;padding:0 18px"><span class="alert__icon is-${tp.clase}" style="width:46px;height:46px">${ic(tp.icono)}</span>
            <div class="grow"><h3 class="sheet__title" style="padding:0;font-size:1.5rem;line-height:1.05">${esc(a.titulo)}</h3><div class="alert__meta">${lineDot(l)}${esc(l.nombre)} · ${esc(a.hace)}</div></div></div>
          ${a.texto ? `<div class="alert-detail__text"><b>${t('Qué hacer:')}</b> ${esc(a.texto)}</div>` : ''}
          <div class="alert-detail__votes">
            <button class="btn btn--outline btn--sm ${voto === 'yes' ? 'is-voted' : ''}" data-action="votar" data-params='{"v":"yes"}' style="${voto === 'yes' ? 'background:var(--ok-bg);color:var(--ok)' : ''}">${ic('thumb-up')}${t('Sigue así')} · ${a.confirmaciones}</button>
            <button class="btn btn--outline btn--sm" data-action="votar" data-params='{"v":"no"}' style="${voto === 'no' ? 'background:var(--ok-bg);color:var(--ok)' : ''}">${ic('thumb-down')}${t('Ya no')}</button>
          </div>
          <div class="line-fact">${ic('users')}${t('Confirmado por {n} pasajeros', { n: a.confirmaciones })}</div>
        </div>
      </div>`;
  },

  // 2. Modificamos la función mount, que es la que se encarga de dibujar el mapa
  mount(root, { id }) {
    const a = obtener(id), l = getLinea(a.lineaId);
    const mapa = createMap(root.querySelector('#map'));
    LINEAS.forEach((x) => mapa.line(x, { weight: 3, opacity: 0.35, withCasing: false }));
    
    // Tramo real del recorrido
    const n = l.ida.length;
    // Intentamos extraer el nombre del lugar del título del aviso (ej: "Desvío en UNAJ" -> "UNAJ")
    const lugarAfectado = getLugar(a.titulo.split(' en ')[1]); 
    let i, j;
    
    if (lugarAfectado) {
        // Si el lugar indicado existe en el catálogo, se toman 5 puntos antes y 5 después
        const puntoCercano = nearest(l.ida, lugarAfectado.c);
        i = Math.max(0, puntoCercano.i - 5);
        j = Math.min(n - 1, puntoCercano.i + 5);
    } else {
        // Fallback: si no escribió un lugar o no existe, mostramos el tramo genérico (centro de la ruta)
        i = Math.floor(n * 0.4);
        j = Math.floor(n * 0.6);
    }
    // --- FIN DE LA LÓGICA ---

    const tramo = mapa.segment(l, i, j);
    mapa.fit(tramo, { top: 80, bottom: root.querySelector('.sheet').offsetHeight + 20 });
    return () => mapa.destroy();
  },

  actions: {
    votar(_el, { v }, api, _e, pantalla) {
      if (!puedeAportar()) { api.toast(t('Crea una cuenta para reportar y votar avisos.')); return; }
      votar(pantalla.id, v); api.rerender();
    },
  },
};