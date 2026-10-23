// VIAJE EN UNA LÍNEA 
import { t } from '../core/i18n.js';
import { esc, ic } from '../core/dom.js';
import { appbar, subbar, lineBadge } from '../components/ui.js';
import { getLinea } from '../data/lineas.js';
import { paraderosDe } from '../services/lines.service.js';
import { iniciarTramoLinea } from '../services/trip.service.js';

function lista(ps, elegido, bloqueado, accion) {
  return `<div class="group pick-list">${ps.map((p, k) => {
    const marcado = k === elegido, off = k === bloqueado;
    return `<button class="pick ${marcado ? 'is-on' : ''}" ${off ? 'disabled' : ''} data-action="${accion}" data-params='{"k":${k}}' aria-pressed="${marcado}">
      ${ic(marcado ? 'circle-check-filled' : 'circle', 'pick__radio')}<span class="pick__name">${esc(p.nombre)}</span>${k === 0 ? `<small>${t('Inicio')}</small>` : k === ps.length - 1 ? `<small>${t('Final')}</small>` : ''}
    </button>`;
  }).join('')}</div>`;
}

/** Vuelve a pintar sin que la lista salte al inicio. */
function conScroll(api) {
  const y = document.querySelector('#screen .scroll')?.scrollTop || 0;
  api.rerender();
  const nuevo = document.querySelector('#screen .scroll'); if (nuevo) nuevo.scrollTop = y;
}

export default {
  name: 'line-trip',
  tab: 'lines',

  render(params) {
    const l = getLinea(params.id);
    const ps = paraderosDe(l);
    const { sube, baja } = params;
    const listo = sube !== undefined && baja !== undefined && sube !== baja;
    const sentido = listo ? (sube < baja ? t('Ida') : t('Vuelta')) : null;
    return `${appbar()}
      ${subbar('Tu viaje en esta línea', l.nombre)}
      <div class="scroll scroll--no-tabbar">
        <div class="line-head" style="padding:12px 16px 0">${lineBadge(l, 'lg')}<div class="grow"><b style="font-size:1.0625rem">${esc(l.nombre)}</b><div class="muted" style="font-size:.875rem">${t('Elige dónde subes y dónde piensas bajar. Los paraderos son aproximados.')}</div></div></div>
        <div class="section-title"><h3>${t('¿En qué paradero subes?')}</h3></div>
        ${lista(ps, sube, baja, 'sube')}
        <div class="section-title"><h3>${t('¿En cuál bajas?')}</h3></div>
        ${lista(ps, baja, sube, 'baja')}
        <div class="line-trip__cta">
          ${sentido ? `<div class="line-fact" style="margin:0 0 10px">${ic('arrows-right-left')}${t('Sentido: {s}', { s: sentido })} · ${t('{n} paraderos', { n: Math.abs(baja - sube) })}</div>` : ''}
          <button class="btn btn--primary btn--lg btn--block" data-action="iniciar" ${listo ? '' : 'disabled'}>${ic('player-play')}${t('Iniciar modo viaje')}</button>
        </div>
      </div>`;
  },

  actions: {
    sube(_el, { k }, api, _e, pantalla) { pantalla.sube = k; if (pantalla.baja === k) pantalla.baja = undefined; conScroll(api); },
    baja(_el, { k }, api, _e, pantalla) { pantalla.baja = k; if (pantalla.sube === k) pantalla.sube = undefined; conScroll(api); },
    iniciar(_el, _p, api, _e, pantalla) {
      if (pantalla.sube === undefined || pantalla.baja === undefined || pantalla.sube === pantalla.baja) return;
      iniciarTramoLinea(pantalla.id, pantalla.sube, pantalla.baja);
      api.go('trip');
    },
  },
};
